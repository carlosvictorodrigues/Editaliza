// tests/integration/server-setup.js - Real server setup for integration tests
const express = require('express');
const path = require('path');
const fs = require('fs');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

// Create test database path with random name to avoid conflicts
const testDbPath = path.join(__dirname, '../test-integration-' + Date.now() + '.db');
process.env.DB_PATH = testDbPath;

// Clean up any existing test database
if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
}

// Create our own test database instance
const sqlite3 = require('sqlite3').verbose();
const testDb = new sqlite3.Database(testDbPath);

// Function to create a real server instance for testing
const createRealTestServer = () => {
    // We need to create the app the same way as server.js but without starting it
    const express = require('express');
    const db = require('../../database.js');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const cors = require('cors');
    const crypto = require('crypto');
    const rateLimit = require('express-rate-limit');
    const helmet = require('helmet');
    const { body, query, validationResult } = require('express-validator');
    const session = require('express-session');
    const SQLiteStore = require('connect-sqlite3')(session);
    const multer = require('multer');
    const fs = require('fs');

    // Import middleware
    const {
        sanitizeMiddleware,
        handleValidationErrors,
        authenticateToken,
        validators,
        bodySizeLimit
    } = require('../../middleware.js');

    const app = express();

    // Security configuration (minimal for tests)
    app.use(helmet({
        contentSecurityPolicy: false,
        hsts: false
    }));

    app.use(cors({
        origin: true,
        credentials: true
    }));

    // Session configuration
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: new SQLiteStore({
            db: 'test-sessions.db',
            dir: path.join(__dirname, '../')
        }),
        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        }
    }));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(bodySizeLimit('10mb'));
    app.use(sanitizeMiddleware);

    // Rate limiting (more permissive for tests)
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        skip: () => process.env.NODE_ENV === 'test'
    });
    app.use(globalLimiter);

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 50,
        skip: () => process.env.NODE_ENV === 'test'
    });

    // Initialize database tables
    testDb.serialize(() => {
        testDb.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            name TEXT,
            google_id TEXT,
            auth_provider TEXT DEFAULT 'local',
            profile_picture TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )`);

        testDb.run(`CREATE TABLE IF NOT EXISTS study_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plan_name TEXT NOT NULL,
            exam_date TEXT,
            study_hours_per_day INTEGER DEFAULT 4,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
    });

    // Helper functions for database operations
    const dbGet = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            testDb.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    const dbAll = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            testDb.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    const dbRun = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            testDb.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    };

    // AUTHENTICATION ROUTES
    app.post('/register', 
        validators.email,
        validators.password,
        handleValidationErrors,
        async (req, res) => {
            const { email, password } = req.body;
            try {
                const hashedPassword = await bcrypt.hash(password, 12);
                const currentDate = new Date().toISOString();
                await dbRun('INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)', 
                    [email, hashedPassword, currentDate, currentDate]);
                res.status(201).json({ message: 'Usuário criado com sucesso!' });
            } catch (error) {
                if (error.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'Este e-mail já está em uso.' });
                } else {
                    console.error('Erro no registro:', error);
                    res.status(500).json({ error: 'Erro ao criar usuário.' });
                }
            }
        }
    );

    app.post('/login', 
        loginLimiter,
        validators.email,
        validators.password,
        handleValidationErrors,
        async (req, res) => {
            const { email, password } = req.body;
            try {
                const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
                if (!user || !await bcrypt.compare(password, user.password_hash)) {
                    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
                }
                
                const token = jwt.sign(
                    { id: user.id, email: user.email }, 
                    process.env.JWT_SECRET, 
                    { expiresIn: '24h', issuer: 'editaliza' }
                );
                
                req.session.userId = user.id;
                req.session.loginTime = new Date();
                
                res.json({ message: 'Login bem-sucedido!', token: token });
            } catch (error) {
                console.error('Erro no login:', error);
                res.status(500).json({ error: 'Erro no servidor.' });
            }
        }
    );

    app.get('/profile', authenticateToken, async (req, res) => {
        try {
            const user = await dbGet(`SELECT 
                id, email, name, auth_provider, profile_picture, created_at, updated_at
                FROM users WHERE id = ?`, [req.user.id]);
            
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            
            res.json(user);
        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
            res.status(500).json({ error: 'Erro no servidor' });
        }
    });

    app.get('/health', (req, res) => {
        const healthCheck = {
            uptime: process.uptime(),
            message: 'OK',
            timestamp: Date.now(),
            status: 'ok'
        };
        res.status(200).json(healthCheck);
    });

    // PLAN ROUTES
    app.get('/plans', authenticateToken, async (req, res) => {
        try {
            const rows = await dbAll('SELECT * FROM study_plans WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao buscar planos:', error);
            res.status(500).json({ error: 'Erro ao buscar planos de estudo' });
        }
    });

    app.post('/plans', 
        authenticateToken,
        validators.text('plan_name', 1, 200),
        handleValidationErrors,
        async (req, res) => {
            const { plan_name, exam_date, study_hours_per_day } = req.body;
            try {
                const currentDate = new Date().toISOString();
                const result = await dbRun(
                    'INSERT INTO study_plans (user_id, plan_name, exam_date, study_hours_per_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [req.user.id, plan_name, exam_date, study_hours_per_day || 4, currentDate, currentDate]
                );
                res.status(201).json({ message: 'Plano criado com sucesso!', planId: result.lastID });
            } catch (error) {
                console.error('Erro ao criar plano:', error);
                res.status(500).json({ error: 'Erro ao criar plano de estudo' });
            }
        }
    );

    // Error handling
    app.use((err, req, res, next) => {
        console.error('Erro não tratado:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    });

    return app;
};

const cleanupTestDb = () => {
    return new Promise((resolve) => {
        testDb.close((err) => {
            if (err) {
                console.log('Error closing test database:', err.message);
            }
            resolve();
        });
    });
};

module.exports = { createRealTestServer, testDbPath, cleanupTestDb };