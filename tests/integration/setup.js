/**
 * FASE 9 - INTEGRATION TESTS SETUP
 * 
 * Setup específico para testes de integração
 * Configura servidor de teste isolado e banco de dados
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');

// Mock configurations to avoid external dependencies
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-tokens-in-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jwt-refresh';
process.env.SESSION_SECRET = 'test-session-secret-key-for-express-sessions';
process.env.DATABASE_URL = 'memory://test';
process.env.EMAIL_PROVIDER = 'mock';

// Mock database functions to avoid real database connections
const mockDatabase = {
    dbRun: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
    dbGet: jest.fn().mockResolvedValue(null),
    dbAll: jest.fn().mockResolvedValue([])
};

// Mock email services to avoid network calls
jest.mock('../../src/services/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue(true),
    sendPasswordReset: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/emailProviders', () => ({
    initializeTransporter: jest.fn().mockResolvedValue(true),
    verifyConnection: jest.fn().mockResolvedValue(true)
}));

// Create minimal test server
function createTestServer() {
    const app = express();
    
    // Basic middleware
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: false
    }));
    
    app.use(cors({
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true
    }));
    
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Mock session middleware
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        }
    }));

    // Mock authentication routes
    app.post('/api/auth/register', (req, res) => {
        res.status(201).json({
            success: true,
            user: {
                id: 1,
                email: req.body.email,
                name: req.body.name,
                role: 'user',
                created_at: new Date(),
                email_verified: false
            },
            tokens: {
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
                expiresIn: '24h'
            }
        });
    });

    app.post('/api/auth/login', (req, res) => {
        if (req.body.email === 'test.user@editaliza.com' && req.body.password === 'TestPassword123!') {
            res.json({
                success: true,
                user: {
                    id: 1,
                    email: req.body.email,
                    name: 'Test User',
                    role: 'user'
                },
                tokens: {
                    accessToken: 'mock-access-token',
                    refreshToken: 'mock-refresh-token',
                    expiresIn: '24h'
                }
            });
        } else {
            res.status(401).json({
                error: 'Email ou senha incorretos',
                code: 'INVALID_CREDENTIALS'
            });
        }
    });

    app.get('/api/auth/me', (req, res) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.includes('mock-access-token')) {
            res.json({
                success: true,
                user: {
                    id: 1,
                    email: 'test.user@editaliza.com',
                    name: 'Test User',
                    role: 'user'
                }
            });
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    });

    app.post('/api/auth/logout', (req, res) => {
        res.json({ success: true, message: 'Logout realizado com sucesso' });
    });

    app.get('/api/auth/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            features: {
                registration: true,
                googleOAuth: false,
                passwordReset: true,
                csrf: false
            }
        });
    });

    // Mock plans routes
    app.get('/api/plans', (req, res) => {
        res.json({ success: true, plans: [] });
    });

    app.post('/api/plans', (req, res) => {
        res.status(201).json({
            success: true,
            plan: {
                id: Math.floor(Math.random() * 1000),
                plan_name: req.body.plan_name,
                exam_date: req.body.exam_date,
                user_id: 1,
                created_at: new Date()
            }
        });
    });

    // Error handling middleware
    app.use((error, req, res, next) => {
        console.error('Test server error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    });

    // 404 handler
    app.use('*', (req, res) => {
        res.status(404).json({
            error: 'Route not found',
            code: 'NOT_FOUND'
        });
    });

    return app;
}

module.exports = {
    createTestServer,
    mockDatabase
};