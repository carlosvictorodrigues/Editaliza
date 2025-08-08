// server.js - Versão com correções de segurança
const express = require('express');
const db = require('./database.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, query } = require('express-validator'); // <-- CORREÇÃO APLICADA AQUI
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
require('dotenv').config();

// Importar middleware de segurança
const {
    sanitizeMiddleware,
    handleValidationErrors,
    authenticateToken,
    validators,
    bodySizeLimit
} = require('./middleware.js');

const app = express();
// Servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(__dirname));

// Configurações de segurança - Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Configuração CORS mais restritiva
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        // Permitir requisições sem origin (ex: Postman) apenas em desenvolvimento
        if (!origin && process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// Configuração de sessão
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './'
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS em produção
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Middleware para parsing e sanitização
app.use(express.json({ limit: '10mb' }));
app.use(bodySizeLimit('10mb'));
app.use(sanitizeMiddleware);

// Rate limiting global
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { error: 'Muitas requisições. Por favor, tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

// Rate limiting específico para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true
});

// Verificar variáveis de ambiente críticas
const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error(`ERRO: Variáveis de ambiente obrigatórias não definidas: ${missingEnvVars.join(', ')}`);
    console.error('Por favor, crie um arquivo .env baseado no .env.example');
    process.exit(1);
}

// Funções utilitárias para interagir com o banco de dados usando Promises
const dbGet = (sql, params) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
const dbRun = (sql, params) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this) }));

// --- ROTAS DE AUTENTICAÇÃO E USUÁRIO ---

// Rota para registrar um novo usuário
app.post('/register', 
    validators.email,
    validators.password,
    handleValidationErrors,
    async (req, res) => {
        const { email, password } = req.body;
        try {
            const hashedPassword = await bcrypt.hash(password, 12); // Aumentado de 10 para 12
            await dbRun('INSERT INTO users (email, password_hash) VALUES (?,?)', [email, hashedPassword]);
            res.status(201).json({ "message": "Usuário criado com sucesso!" });
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                res.status(400).json({ error: "Este e-mail já está em uso." });
            } else {
                console.error('Erro no registro:', error);
                res.status(500).json({ error: "Erro ao criar usuário." });
            }
        }
    }
);

// Rota para login de usuário
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
                return res.status(401).json({ "error": "E-mail ou senha inválidos." });
            }
            
            // Gerar token com informações mínimas e expiração
            const token = jwt.sign(
                { id: user.id, email: user.email }, 
                process.env.JWT_SECRET, 
                { expiresIn: '24h', issuer: 'editaliza' }
            );
            
            // Salvar informações da sessão
            req.session.userId = user.id;
            req.session.loginTime = new Date();
            
            res.json({ "message": "Login bem-sucedido!", "token": token });
        } catch (error) {
            console.error('Erro no login:', error);
            res.status(500).json({ "error": "Erro no servidor." });
        }
    }
);

// Nova rota para logout
app.post('/logout', authenticateToken, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao fazer logout' });
        }
        res.json({ message: 'Logout realizado com sucesso' });
    });
});

// Rota para solicitar redefinição de senha
app.post('/request-password-reset',
    validators.email,
    handleValidationErrors,
    async (req, res) => {
        const { email } = req.body;
        try {
            const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
            if (user) {
                const token = crypto.randomBytes(32).toString('hex');
                const expires = Date.now() + 3600000; // 1 hora
                await dbRun('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);
                // Em produção, aqui seria enviado um e-mail real
                console.log(`SIMULAÇÃO DE E-MAIL: Link de recuperação para ${user.email}: http://localhost:3000/reset-password.html?token=${token}`);
            }
            // Resposta genérica para evitar enumeração de usuários
            res.json({ message: "Se um usuário com este e-mail existir, um link de recuperação foi enviado." });
        } catch (error) {
            console.error('Erro na recuperação de senha:', error);
            res.status(500).json({ "error": "Erro no servidor ao processar a solicitação." });
        }
    }
);

// Rota para redefinir a senha com um token
app.post('/reset-password',
    body('token').isLength({ min: 32, max: 64 }).withMessage('Token inválido'),
    validators.password,
    handleValidationErrors,
    async (req, res) => {
        const { token, password } = req.body;
        try {
            const user = await dbGet('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?', [token, Date.now()]);
            if (!user) {
                return res.status(400).json({ error: "Token inválido ou expirado." });
            }
            const hashedPassword = await bcrypt.hash(password, 12);
            await dbRun('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hashedPassword, user.id]);
            res.json({ message: "Senha redefinida com sucesso!" });
        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            res.status(500).json({ "error": "Erro no servidor ao redefinir a senha." });
        }
    }
);

// --- ROTAS DE PLANOS (CRUD E CONFIGURAÇÕES) ---

// Obter todos os planos do usuário logado
app.get('/plans', authenticateToken, async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM study_plans WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
        res.json(rows.map(plan => ({...plan, study_hours_per_day: JSON.parse(plan.study_hours_per_day || '{}')})));
    } catch (error) {
        console.error('Erro ao buscar planos:', error);
        res.status(500).json({ "error": "Erro ao buscar planos" });
    }
});

// Criar um novo plano de estudos
app.post('/plans', 
    authenticateToken,
    validators.text('plan_name', 1, 200),
    validators.date('exam_date'),
    handleValidationErrors,
    async (req, res) => {
        const { plan_name, exam_date } = req.body;
        
        const defaultHours = JSON.stringify({ '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 });
        const sql = `
            INSERT INTO study_plans 
            (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, has_essay) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        try {
            const result = await dbRun(sql, [req.user.id, plan_name, exam_date, defaultHours, 50, 300, 50, 'completo', 0, false]);
            res.status(201).json({ "message": "Plano criado com sucesso!", "newPlanId": result.lastID });
        } catch (error) {
            console.error('Erro ao criar plano:', error);
            res.status(500).json({ "error": "Erro ao criar plano" });
        }
    }
);

// Obter um plano específico do usuário
app.get('/plans/:id', 
    authenticateToken,
    validators.numericId('id'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const row = await dbGet("SELECT * FROM study_plans WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
            if (!row) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });
            if (row.study_hours_per_day) {
                row.study_hours_per_day = JSON.parse(row.study_hours_per_day);
            }
            res.json(row);
        } catch (error) {
            console.error('Erro ao buscar plano:', error);
            res.status(500).json({ "error": "Erro ao buscar plano" });
        }
    }
);

// Apagar um plano e todos os seus dados associados
app.delete('/plans/:planId', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou você não tem permissão." });
            
            await dbRun('BEGIN TRANSACTION');
            await dbRun('DELETE FROM study_sessions WHERE study_plan_id = ?', [planId]);
            await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)', [planId]);
            await dbRun('DELETE FROM subjects WHERE study_plan_id = ?', [planId]);
            await dbRun('DELETE FROM study_plans WHERE id = ?', [planId]);
            await dbRun('COMMIT');
            
            res.json({ message: "Plano e todos os dados associados foram apagados com sucesso" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar plano:', error);
            res.status(500).json({ "error": "Erro ao apagar o plano." });
        }
    }
);

// Atualizar as configurações de um plano
app.patch('/plans/:planId/settings', 
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('daily_question_goal', 0, 500),
    validators.integer('weekly_question_goal', 0, 3500),
    validators.integer('session_duration_minutes', 10, 240),
    body('has_essay').isBoolean().withMessage('has_essay deve ser booleano'),
    validators.jsonField('study_hours_per_day'),
    handleValidationErrors,
    async (req, res) => {
        const { daily_question_goal, weekly_question_goal, review_mode, session_duration_minutes, study_hours_per_day, has_essay } = req.body;
        const hoursJson = JSON.stringify(study_hours_per_day);
        
        // Validar review_mode
        const validReviewModes = ['completo', 'focado'];
        if (review_mode && !validReviewModes.includes(review_mode)) {
            return res.status(400).json({ error: "Modo de revisão inválido" });
        }
        
        const sql = 'UPDATE study_plans SET daily_question_goal = ?, weekly_question_goal = ?, review_mode = ?, session_duration_minutes = ?, study_hours_per_day = ?, has_essay = ? WHERE id = ? AND user_id = ?';
        try {
            const result = await dbRun(sql, [daily_question_goal, weekly_question_goal, review_mode || 'completo', session_duration_minutes, hoursJson, has_essay, req.params.planId, req.user.id]);
            if (result.changes === 0) return res.status(404).json({ error: "Plano não encontrado ou não autorizado." });
            res.json({ message: "Configurações salvas com sucesso!" });
        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            res.status(500).json({ "error": "Erro ao salvar configurações" });
        }
    }
);

// --- ROTAS DE DISCIPLINAS E TÓPICOS ---

// Obter todas as disciplinas de um plano
app.get('/plans/:planId/subjects', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [req.params.planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });
            
            const rows = await dbAll("SELECT * FROM subjects WHERE study_plan_id = ? ORDER BY id DESC", [req.params.planId]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao buscar disciplinas:', error);
            res.status(500).json({ "error": "Erro ao buscar disciplinas" });
        }
    }
);

// Adicionar uma disciplina com seus tópicos a um plano
app.post('/plans/:planId/subjects_with_topics', 
    authenticateToken,
    validators.numericId('planId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    body('topics_list').isString().isLength({ max: 10000 }).withMessage('Lista de tópicos muito longa'),
    handleValidationErrors,
    async (req, res) => {
        const { subject_name, priority_weight, topics_list } = req.body;
        const planId = req.params.planId;
        
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            const topics = topics_list.split('\n').map(t => t.trim()).filter(t => t !== '');
            
            await dbRun('BEGIN TRANSACTION');
            const result = await dbRun('INSERT INTO subjects (study_plan_id, subject_name, priority_weight) VALUES (?,?,?)', [planId, subject_name, priority_weight]);
            const subjectId = result.lastID;
            
            if (topics.length > 0) {
                const insertTopicsStmt = db.prepare('INSERT INTO topics (subject_id, description) VALUES (?,?)');
                topics.forEach(topic => insertTopicsStmt.run(subjectId, topic.substring(0, 500))); // Limitar tamanho do tópico
                await new Promise((resolve, reject) => insertTopicsStmt.finalize(err => err ? reject(err) : resolve()));
            }
            
            await dbRun('COMMIT');
            res.status(201).json({ message: "Disciplina e tópicos adicionados com sucesso!" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao criar disciplina:', error);
            res.status(500).json({ "error": "Erro ao criar a disciplina e tópicos." });
        }
    }
);

// Atualizar uma disciplina
app.patch('/subjects/:subjectId', 
    authenticateToken,
    validators.numericId('subjectId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    handleValidationErrors,
    async (req, res) => {
        const { subject_name, priority_weight } = req.body;
        const sql = `
            UPDATE subjects SET subject_name = ?, priority_weight = ? 
            WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
        `;
        try {
            const result = await dbRun(sql, [subject_name, priority_weight, req.params.subjectId, req.user.id]);
            if (result.changes === 0) return res.status(404).json({ error: "Disciplina não encontrada ou não autorizada." });
            res.json({ message: 'Disciplina atualizada com sucesso!' });
        } catch (error) {
            console.error('Erro ao atualizar disciplina:', error);
            res.status(500).json({ error: "Erro ao atualizar disciplina" });
        }
    }
);

// Apagar uma disciplina
app.delete('/subjects/:subjectId', 
    authenticateToken,
    validators.numericId('subjectId'),
    handleValidationErrors,
    async (req, res) => {
        const subjectId = req.params.subjectId;
        try {
            const subject = await dbGet(`
                SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE s.id = ? AND sp.user_id = ?
            `, [subjectId, req.user.id]);
            if (!subject) return res.status(404).json({ error: "Disciplina não encontrada ou não autorizada." });

            await dbRun('BEGIN TRANSACTION');
            await dbRun('DELETE FROM study_sessions WHERE topic_id IN (SELECT id FROM topics WHERE subject_id = ?)', [subjectId]);
            await dbRun('DELETE FROM topics WHERE subject_id = ?', [subjectId]);
            await dbRun('DELETE FROM subjects WHERE id = ?', [subjectId]);
            await dbRun('COMMIT');
            res.json({ message: "Disciplina e todos os seus dados foram apagados com sucesso" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar disciplina:', error);
            res.status(500).json({ "error": "Erro ao apagar disciplina" });
        }
    }
);

// Obter os tópicos de uma disciplina
app.get('/subjects/:subjectId/topics', 
    authenticateToken,
    validators.numericId('subjectId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const subject = await dbGet(`
                SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE s.id = ? AND sp.user_id = ?
            `, [req.params.subjectId, req.user.id]);
            if (!subject) return res.status(404).json({ error: "Disciplina não encontrada ou não autorizada." });

            const rows = await dbAll("SELECT id, description, status, completion_date FROM topics WHERE subject_id = ? ORDER BY id ASC", [req.params.subjectId]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao buscar tópicos:', error);
            res.status(500).json({ "error": "Erro ao buscar tópicos" });
        }
    }
);

// Atualizar o progresso de múltiplos tópicos
app.patch('/topics/batch_update', 
    authenticateToken,
    body('topics').isArray().withMessage('O corpo deve conter um array de tópicos'),
    body('topics.*.id').isInt().withMessage('ID do tópico inválido'),
    body('topics.*.status').isIn(['Pendente', 'Concluído']).withMessage('Status inválido'),
    body('topics.*.completion_date').optional({ nullable: true }).isISO8601().withMessage('Data de conclusão inválida'),
    handleValidationErrors,
    async (req, res) => {
        const { topics } = req.body;

        try {
            await dbRun('BEGIN TRANSACTION');
            const stmt = db.prepare(`
                UPDATE topics SET status = ?, completion_date = ? 
                WHERE id = ? AND subject_id IN (
                    SELECT id FROM subjects WHERE study_plan_id IN (
                        SELECT id FROM study_plans WHERE user_id = ?
                    )
                )
            `);
            for (const topic of topics) {
                const completionDate = topic.status === 'Concluído' ? topic.completion_date : null;
                await new Promise((resolve, reject) => stmt.run(topic.status, completionDate, topic.id, req.user.id, err => err ? reject(err) : resolve()));
            }
            await new Promise((resolve, reject) => stmt.finalize(err => err ? reject(err) : resolve()));
            await dbRun('COMMIT');
            res.json({ message: "Progresso dos tópicos atualizado com sucesso!" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao atualizar tópicos:', error);
            res.status(500).json({ "error": "Erro ao atualizar os tópicos." });
        }
    }
);

// Atualizar um tópico
app.patch('/topics/:topicId', 
    authenticateToken,
    validators.numericId('topicId'),
    validators.text('description', 1, 500),
    handleValidationErrors,
    async (req, res) => {
        const { description } = req.body;
        const sql = `
            UPDATE topics SET description = ? 
            WHERE id = ? AND subject_id IN (
                SELECT id FROM subjects WHERE study_plan_id IN (
                    SELECT id FROM study_plans WHERE user_id = ?
                )
            )
        `;
        try {
            const result = await dbRun(sql, [description, req.params.topicId, req.user.id]);
            if (result.changes === 0) return res.status(404).json({ error: "Tópico não encontrado ou não autorizado." });
            res.json({ message: 'Tópico atualizado com sucesso!' });
        } catch (error) {
            console.error('Erro ao atualizar tópico:', error);
            res.status(500).json({ error: "Erro ao atualizar tópico" });
        }
    }
);

// Apagar um tópico
app.delete('/topics/:topicId', 
    authenticateToken,
    validators.numericId('topicId'),
    handleValidationErrors,
    async (req, res) => {
        const topicId = req.params.topicId;
        try {
            const topic = await dbGet(`
                SELECT t.id FROM topics t 
                JOIN subjects s ON t.subject_id = s.id
                JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE t.id = ? AND sp.user_id = ?
            `, [topicId, req.user.id]);
            if (!topic) return res.status(404).json({ error: "Tópico não encontrado ou não autorizado." });

            await dbRun('BEGIN TRANSACTION');
            await dbRun('DELETE FROM study_sessions WHERE topic_id = ?', [topicId]);
            await dbRun('DELETE FROM topics WHERE id = ?', [topicId]);
            await dbRun('COMMIT');
            res.json({ message: "Tópico e sessões associadas foram apagados com sucesso" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar tópico:', error);
            res.status(500).json({ "error": "Erro ao apagar tópico" });
        }
    }
);

// --- ROTA DE GERAÇÃO DE CRONOGRAMA OTIMIZADA ---
// PERFORMANCE IMPROVEMENTS:
// 1. Single optimized query instead of N+1 queries
// 2. Batch INSERT with prepared statements
// 3. Optimized algorithm with reduced complexity
// 4. Cached calculations for date operations
// 5. Memory-efficient data structures
app.post('/plans/:planId/generate', 
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('daily_question_goal', 0, 500),
    validators.integer('weekly_question_goal', 0, 3500),
    validators.integer('session_duration_minutes', 10, 240),
    body('has_essay').isBoolean().withMessage('has_essay deve ser booleano'),
    validators.jsonField('study_hours_per_day'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const { daily_question_goal, weekly_question_goal, session_duration_minutes, study_hours_per_day, has_essay } = req.body;
        
        console.time(`[PERF] Generate schedule for plan ${planId}`);
        const startTime = Date.now();

        try {
            await dbRun('BEGIN IMMEDIATE TRANSACTION'); // Immediate lock for better performance
            
            const hoursJson = JSON.stringify(study_hours_per_day);
            await dbRun('UPDATE study_plans SET daily_question_goal = ?, weekly_question_goal = ?, session_duration_minutes = ?, study_hours_per_day = ?, has_essay = ? WHERE id = ? AND user_id = ?', 
                [daily_question_goal, weekly_question_goal, session_duration_minutes, hoursJson, has_essay, planId, req.user.id]);
            
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ?', [planId]);
            if (!plan) {
                await dbRun('ROLLBACK');
                return res.status(404).json({ error: "Plano não encontrado." });
            }

            const totalWeeklyHours = Object.values(study_hours_per_day).reduce((sum, h) => sum + (parseInt(h, 10) || 0), 0);
            if (totalWeeklyHours === 0) {
                await dbRun('ROLLBACK');
                return res.status(400).json({ error: "O cronograma não pode ser gerado porque não há horas de estudo definidas." });
            }

            // OTIMIZAÇÃO 1: Delete com índice otimizado
            await dbRun("DELETE FROM study_sessions WHERE study_plan_id = ?", [planId]);

            // OTIMIZAÇÃO 2: Single JOIN query instead of N+1 queries
            const allTopicsQuery = `
                SELECT 
                    t.id, t.description, t.status, t.completion_date,
                    s.subject_name, s.priority_weight as priority
                FROM topics t
                JOIN subjects s ON t.subject_id = s.id
                WHERE s.study_plan_id = ?
                ORDER BY s.priority_weight DESC, t.id ASC
            `;
            const allTopics = await dbAll(allTopicsQuery, [planId]);
            console.log(`[PERF] Loaded ${allTopics.length} topics in single query`);

            if (allTopics.length === 0) {
                await dbRun('COMMIT');
                return res.json({ message: "Nenhum tópico encontrado para gerar o cronograma." });
            }
            
            const sessionDuration = parseInt(session_duration_minutes, 10) || 50;
            const examDate = new Date(plan.exam_date + 'T23:59:59');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // OTIMIZAÇÃO 3: Pre-calculate available dates for better performance
            const availableDatesCache = new Map();
            const getAvailableDates = (startDate, endDate, weekdayOnly = false) => {
                const cacheKey = `${startDate.getTime()}-${endDate.getTime()}-${weekdayOnly}`;
                if (availableDatesCache.has(cacheKey)) {
                    return availableDatesCache.get(cacheKey);
                }
                
                const dates = [];
                let currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    const dayOfWeek = currentDate.getDay();
                    const shouldSkip = (dayOfWeek === 0) || (weekdayOnly && dayOfWeek === 6);
                    
                    if (!shouldSkip && (study_hours_per_day[dayOfWeek] || 0) > 0) {
                        dates.push({
                            date: new Date(currentDate),
                            dayOfWeek,
                            maxSessions: Math.floor((study_hours_per_day[dayOfWeek] * 60) / sessionDuration)
                        });
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                availableDatesCache.set(cacheKey, dates);
                return dates;
            };

            // OTIMIZAÇÃO 4: Use Map for O(1) agenda lookups instead of nested arrays
            const agenda = new Map();
            const addSessionToAgenda = (date, session) => {
                const dateStr = date.toISOString().split('T')[0];
                if (!agenda.has(dateStr)) {
                    agenda.set(dateStr, []);
                }
                agenda.get(dateStr).push({ ...session, session_date: dateStr });
            };
            
            // Essay sessions (unchanged logic but optimized date iteration)
            if (plan.has_essay) {
                const sundayDates = getAvailableDates(today, examDate).filter(d => d.dayOfWeek === 0);
                for (const dateInfo of sundayDates) {
                    addSessionToAgenda(dateInfo.date, {
                        topicId: null,
                        subjectName: "Redação",
                        topicDescription: "Prática de redação dissertativa-argumentativa, focando em estrutura, coesão e argumentação.",
                        sessionType: 'Redação'
                    });
                }
            }

            // OTIMIZAÇÃO 5: Optimized slot finding with pre-calculated dates
            const findNextAvailableSlot = (startDate, isWeekdayOnly = false) => {
                const availableDates = getAvailableDates(startDate, examDate, isWeekdayOnly);
                
                for (const dateInfo of availableDates) {
                    const dateStr = dateInfo.date.toISOString().split('T')[0];
                    const currentSessions = agenda.get(dateStr)?.length || 0;
                    
                    if (currentSessions < dateInfo.maxSessions) {
                        return dateInfo.date;
                    }
                }
                return null;
            };

            const getNextSaturdayForReview = (date) => {
                const saturdayDates = getAvailableDates(date, examDate).filter(d => d.dayOfWeek === 6);
                for (const dateInfo of saturdayDates) {
                    const dateStr = dateInfo.date.toISOString().split('T')[0];
                    const currentSessions = agenda.get(dateStr)?.length || 0;
                    if (currentSessions < dateInfo.maxSessions) {
                        return dateInfo.date;
                    }
                }
                return findNextAvailableSlot(date, false); // Fallback
            };

            // Review sessions for completed topics (optimized with filter)
            const completedTopics = allTopics.filter(t => t.status === 'Concluído' && t.completion_date);
            console.log(`[PERF] Processing ${completedTopics.length} completed topics for review`);
            
            for (const topic of completedTopics) {
                const baseDate = new Date(topic.completion_date + 'T00:00:00');
                
                // Process all review intervals at once
                [7, 14, 28].forEach(days => {
                    const targetReviewDate = new Date(baseDate);
                    targetReviewDate.setDate(targetReviewDate.getDate() + days);

                    if (targetReviewDate >= today && targetReviewDate <= examDate) {
                        const reviewDay = getNextSaturdayForReview(targetReviewDate);
                        if (reviewDay) {
                            addSessionToAgenda(reviewDay, { 
                                topicId: topic.id, 
                                subjectName: topic.subject_name, 
                                topicDescription: topic.description, 
                                sessionType: `Revisão ${days}D` 
                            });
                        }
                    }
                });
            }
            
            // OTIMIZAÇÃO 6: Improved shuffle algorithm with better distribution
            const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');
            console.log(`[PERF] Processing ${pendingTopics.length} pending topics`);
            
            // Create weighted distribution more efficiently
            const createWeightedTopics = (topics) => {
                const weighted = [];
                for (const topic of topics) {
                    for (let i = 0; i < topic.priority; i++) {
                        weighted.push(topic);
                    }
                }
                // Fisher-Yates shuffle
                for (let i = weighted.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
                }
                return weighted;
            };
            
            const weightedTopics = createWeightedTopics(pendingTopics);
            const uniquePendingTopicsInOrder = [...new Map(weightedTopics.map(item => [item.id, item])).values()];
            
            let currentDateForNewTopics = new Date(today);
            let lastNewTopicDate = null;

            // Schedule new topics with optimized date finding
            for (const topic of uniquePendingTopicsInOrder) {
                const studyDay = findNextAvailableSlot(currentDateForNewTopics, true);
                if (!studyDay) break;

                addSessionToAgenda(studyDay, { 
                    topicId: topic.id, 
                    subjectName: topic.subject_name, 
                    topicDescription: topic.description, 
                    sessionType: 'Novo Tópico' 
                });
                
                lastNewTopicDate = new Date(studyDay);
                currentDateForNewTopics = new Date(studyDay);
                currentDateForNewTopics.setDate(currentDateForNewTopics.getDate() + 1);

                // Schedule reviews for this new topic
                [7, 14, 28].forEach(days => {
                    const targetReviewDate = new Date(studyDay);
                    targetReviewDate.setDate(targetReviewDate.getDate() + days);
                    
                    if (targetReviewDate <= examDate) {
                        const reviewDay = getNextSaturdayForReview(targetReviewDate);
                        if (reviewDay) {
                            addSessionToAgenda(reviewDay, { 
                                topicId: topic.id, 
                                subjectName: topic.subject_name, 
                                topicDescription: topic.description, 
                                sessionType: `Revisão ${days}D` 
                            });
                        }
                    }
                });
            }
            
            // Maintenance phase with directed simulations
            let maintenanceStartDate = lastNewTopicDate ? new Date(lastNewTopicDate) : new Date(today);
            maintenanceStartDate.setDate(maintenanceStartDate.getDate() + 1);

            const SIMULATION_BLOCK_SIZE = 15;
            const simulationBlocks = [];
            for (let i = 0; i < allTopics.length; i += SIMULATION_BLOCK_SIZE) {
                simulationBlocks.push(allTopics.slice(i, i + SIMULATION_BLOCK_SIZE));
            }

            if (simulationBlocks.length > 0) {
                let blockIndex = 0;
                let currentMaintenanceDate = new Date(maintenanceStartDate);
                
                while (true) {
                    const nextStudyDay = findNextAvailableSlot(currentMaintenanceDate, false);
                    if (!nextStudyDay) break;

                    const block = simulationBlocks[blockIndex % simulationBlocks.length];
                    
                    // More efficient topic grouping
                    const topicsBySubject = new Map();
                    for (const topic of block) {
                        if (!topicsBySubject.has(topic.subject_name)) {
                            topicsBySubject.set(topic.subject_name, []);
                        }
                        topicsBySubject.get(topic.subject_name).push(`• ${topic.description}`);
                    }

                    const topicDescriptions = Array.from(topicsBySubject.entries())
                        .map(([subject, topics]) => `**${subject}**\\n${topics.join('\\n')}`)
                        .join('\\n\\n');

                    addSessionToAgenda(nextStudyDay, {
                        topicId: null,
                        subjectName: `Simulado Direcionado #${(blockIndex % simulationBlocks.length) + 1}`,
                        topicDescription: `Revisar e resolver questões dos seguintes tópicos:\\n\\n${topicDescriptions}`,
                        sessionType: 'Simulado Direcionado'
                    });
                    
                    blockIndex++;
                    currentMaintenanceDate = new Date(nextStudyDay);
                    currentMaintenanceDate.setDate(currentMaintenanceDate.getDate() + 1);

                    if (blockIndex > 0 && (blockIndex % simulationBlocks.length === 0)) {
                        break;
                    }
                }
            }

            // Final phase with complete simulations
            let finalPhaseDate = new Date(maintenanceStartDate);
            while (true) {
                const nextStudyDay = findNextAvailableSlot(finalPhaseDate, false);
                if (!nextStudyDay) break;
                
                addSessionToAgenda(nextStudyDay, {
                    topicId: null,
                    subjectName: "Simulado Completo",
                    topicDescription: "Simulado geral cobrindo todos os tópicos do edital. Foque em tempo, estratégia e resistência.",
                    sessionType: 'Simulado Completo'
                });

                finalPhaseDate = new Date(nextStudyDay);
                finalPhaseDate.setDate(finalPhaseDate.getDate() + 1);
            }

            // OTIMIZAÇÃO 7: Batch INSERT with better memory management
            const sessionsToCreate = [];
            for (const [dateStr, sessions] of agenda) {
                for (const session of sessions) {
                    sessionsToCreate.push([
                        planId,
                        session.topicId,
                        session.subjectName,
                        session.topicDescription,
                        session.session_date,
                        session.sessionType,
                        'Pendente'
                    ]);
                }
            }
            
            console.log(`[PERF] Creating ${sessionsToCreate.length} sessions in batch`);

            if (sessionsToCreate.length > 0) {
                const insertSql = 'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
                const stmt = db.prepare(insertSql);
                
                // Process in chunks to avoid memory issues with large datasets
                const BATCH_SIZE = 100;
                for (let i = 0; i < sessionsToCreate.length; i += BATCH_SIZE) {
                    const chunk = sessionsToCreate.slice(i, i + BATCH_SIZE);
                    for (const sessionData of chunk) {
                        stmt.run(...sessionData);
                    }
                }
                
                await new Promise((resolve, reject) => {
                    stmt.finalize(err => err ? reject(err) : resolve());
                });
            }
            
            await dbRun('COMMIT');
            
            const endTime = Date.now();
            console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
            console.log(`[PERF] Total execution time: ${endTime - startTime}ms`);
            console.log(`[PERF] Sessions created: ${sessionsToCreate.length}`);
            
            res.json({
                message: `Seu mapa para a aprovação foi traçado com sucesso. 🗺️`,
                performance: {
                    executionTime: `${endTime - startTime}ms`,
                    sessionsCreated: sessionsToCreate.length,
                    topicsProcessed: allTopics.length
                }
            });

        } catch (error) {
            await dbRun('ROLLBACK');
            console.error("Erro ao gerar cronograma:", error);
            console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
            res.status(500).json({ error: "Ocorreu um erro interno no servidor ao gerar o cronograma." });
        }
    });

// --- ROTAS DE SESSÕES E DADOS (com validações) ---

// Replanejar tarefas atrasadas
app.post('/plans/:planId/replan', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ error: "Plano não encontrado." });

            const todayStr = new Date().toISOString().split('T')[0];
            const overdueSessions = await dbAll("SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ? ORDER BY session_date, id", [planId, todayStr]);
            
            if (overdueSessions.length === 0) {
                return res.json({ message: "Nenhuma tarefa atrasada para replanejar." });
            }

            const sessionDuration = plan.session_duration_minutes || 50;
            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            const findNextAvailableSlot = async (startDate) => {
                let currentDate = new Date(startDate);
                while (currentDate <= examDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayOfWeek = currentDate.getDay();

                    if (dayOfWeek === 0) { // Pula domingos
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }

                    const totalMinutes = (studyHoursPerDay[dayOfWeek] || 0) * 60;
                    const maxSessions = Math.floor(totalMinutes / sessionDuration);
                    
                    const currentSessionCountResult = await dbGet('SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, dateStr]);
                    const currentSessionCount = currentSessionCountResult.count;

                    if (totalMinutes > 0 && currentSessionCount < maxSessions) {
                        return currentDate;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                return null;
            };
            
            await dbRun('BEGIN TRANSACTION');
            
            let dateForNextSlot = new Date();
            for(const session of overdueSessions) {
                const newDate = await findNextAvailableSlot(dateForNextSlot);
                if (newDate) {
                    const newDateStr = newDate.toISOString().split('T')[0];
                    await dbRun("UPDATE study_sessions SET session_date = ? WHERE id = ?", [newDateStr, session.id]);
                    dateForNextSlot = newDate; 
                } else {
                    break;
                }
            }

            await dbRun("UPDATE study_plans SET postponement_count = postponement_count + 1 WHERE id = ?", [planId]);
            await dbRun('COMMIT');
            
            res.json({ message: `${overdueSessions.length} tarefas atrasadas foram replanejadas com sucesso!` });

        } catch (error) {
            await dbRun('ROLLBACK');
            console.error("Erro ao replanejar:", error);
            res.status(500).json({ error: "Ocorreu um erro interno ao replanejar as tarefas." });
        }
});

// Verificar tarefas atrasadas
app.get('/plans/:planId/overdue_check', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [req.params.planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            const todayStr = new Date().toISOString().split('T')[0];
            const result = await dbGet("SELECT COUNT(id) as count FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?", [req.params.planId, todayStr]);
            res.json(result);
        } catch (error) {
            console.error('Erro ao verificar tarefas atrasadas:', error);
            res.status(500).json({ error: "Erro ao verificar tarefas atrasadas" });
        }
});

// Obter o cronograma de um plano
app.get('/plans/:planId/schedule', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [req.params.planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            const rows = await dbAll("SELECT * FROM study_sessions WHERE study_plan_id = ? ORDER BY session_date ASC, id ASC", [req.params.planId]);
            const groupedByDate = rows.reduce((acc, session) => {
                const date = session.session_date;
                if (!acc[date]) acc[date] = [];
                acc[date].push(session);
                return acc;
            }, {});
            res.json(groupedByDate);
        } catch(err) {
            console.error('Erro ao buscar cronograma:', err);
            res.status(500).json({ "error": "Erro ao buscar cronograma" });
        }
});

// Atualizar uma única sessão de estudo
app.patch('/sessions/:sessionId', 
    authenticateToken,
    validators.numericId('sessionId'),
    body('status').optional().isIn(['Pendente', 'Concluído']).withMessage('Status inválido'),
    body('notes').optional().isString().isLength({ max: 5000 }).withMessage('Notas muito longas'),
    body('questions_solved').optional().isInt({ min: 0, max: 999 }).withMessage('Número de questões inválido'),
    handleValidationErrors,
    async (req, res) => {
        const { status, notes, questions_solved } = req.body;
        const sessionId = req.params.sessionId;
        const userId = req.user.id;

        // Validar se há o que fazer
        let fields = [];
        let params = [];
        if (status !== undefined) { fields.push("status = ?"); params.push(status); }
        if (notes !== undefined) { fields.push("notes = ?"); params.push(notes); }
        if (questions_solved !== undefined) { fields.push("questions_solved = ?"); params.push(questions_solved); }
        if (fields.length === 0) return res.status(400).json({ "error": "Nenhum campo para atualizar." });
        
        try {
            await dbRun('BEGIN TRANSACTION');

            // 1. Atualiza a sessão de estudo
            // CORREÇÃO: Usar acento grave (`) para o SQL e passar parâmetros corretamente
            const sessionUpdateSql = `
                UPDATE study_sessions SET ${fields.join(', ')} 
                WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
            `;
            const result = await dbRun(sessionUpdateSql, [...params, sessionId, userId]);

            if (result.changes === 0) {
                await dbRun('ROLLBACK');
                return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
            }

            // 2. LÓGICA DE SINCRONIZAÇÃO: Se a sessão concluída for um 'Novo Tópico',
            // atualiza o status do tópico mestre correspondente.
            if (status === 'Concluído') {
                const session = await dbGet('SELECT topic_id, session_type, session_date FROM study_sessions WHERE id = ?', [sessionId]);
                
                if (session && session.topic_id && session.session_type === 'Novo Tópico') {
                    const completionDate = session.session_date || new Date().toISOString().split('T')[0];
                    await dbRun('UPDATE topics SET status = ?, completion_date = ? WHERE id = ?', ['Concluído', completionDate, session.topic_id]);
                }
            }
            else if (status === 'Pendente') {
                 const session = await dbGet('SELECT topic_id, session_type FROM study_sessions WHERE id = ?', [sessionId]);
                 if (session && session.topic_id && session.session_type === 'Novo Tópico') {
                    await dbRun('UPDATE topics SET status = ?, completion_date = NULL WHERE id = ?', ['Pendente', session.topic_id]);
                 }
            }

            await dbRun('COMMIT');
            res.json({ "message": "Sessão atualizada com sucesso!" });

        } catch(err) {
            await dbRun('ROLLBACK');
            console.error('Erro ao atualizar sessão:', err);
            res.status(500).json({ "error": "Erro ao atualizar sessão" });
        }
    }
);

// Atualizar status de múltiplas sessões
app.patch('/sessions/batch_update_status', 
    authenticateToken,
    body('sessions').isArray().withMessage('O corpo deve conter um array de sessões'),
    body('sessions.*.id').isInt().withMessage('ID da sessão inválido'),
    body('sessions.*.status').isIn(['Pendente', 'Concluído']).withMessage('Status inválido'),
    handleValidationErrors,
    async (req, res) => {
        const { sessions } = req.body;
        const userId = req.user.id;

        try {
            await dbRun('BEGIN TRANSACTION');
            
            const stmt = db.prepare(`
                UPDATE study_sessions 
                SET status = ? 
                WHERE id = ? AND EXISTS (
                    SELECT 1 FROM study_plans
                    WHERE study_plans.id = study_sessions.study_plan_id
                    AND study_plans.user_id = ?
                )
            `);

            for (const session of sessions) {
                const sessionId = parseInt(session.id, 10);
                if (isNaN(sessionId)) continue;

                await new Promise((resolve, reject) => {
                    stmt.run(session.status, sessionId, userId, function(err) {
                        if (err) return reject(err);
                        if (this.changes === 0) {
                            console.warn(`Sessão ${sessionId} não encontrada ou não autorizada para o usuário ${userId}.`);
                        }
                        resolve();
                    });
                });
            }
            
            await new Promise((resolve, reject) => stmt.finalize(err => err ? reject(err) : resolve()));
            await dbRun('COMMIT');
            
            res.json({ message: "Missão Cumprida! Seu cérebro agradece. 💪" });

        } catch (error) {
            await dbRun('ROLLBACK');
            console.error("ERRO no /sessions/batch_update_status:", error);
            res.status(500).json({ "error": "Ocorreu um erro no servidor ao atualizar as sessões." });
        }
});

// Agendar uma sessão de reforço
app.post('/sessions/:sessionId/reinforce', 
    authenticateToken,
    validators.numericId('sessionId'),
    handleValidationErrors,
    async (req, res) => {
        const sessionId = req.params.sessionId;
        try {
            const session = await dbGet('SELECT ss.* FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE ss.id = ? AND sp.user_id = ?', [sessionId, req.user.id]);
            if (!session || !session.topic_id) return res.status(404).json({ error: "Sessão original não encontrada ou não é um tópico estudável." });
            
            const reinforceDate = new Date();
            reinforceDate.setDate(reinforceDate.getDate() + 3);
            const reinforceDateStr = reinforceDate.toISOString().split('T')[0];
            
            const sql = 'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
            await dbRun(sql, [session.study_plan_id, session.topic_id, session.subject_name, session.topic_description, reinforceDateStr, 'Reforço Extra', 'Pendente']);
            
            res.status(201).json({ message: `Sessão de reforço agendada para ${reinforceDate.toLocaleDateString('pt-BR')}!` });
        } catch (error) {
            console.error('Erro ao agendar reforço:', error);
            res.status(500).json({ error: "Erro ao agendar a sessão de reforço." });
        }
});

// Adiar uma sessão de estudo
app.patch('/sessions/:sessionId/postpone', 
    authenticateToken,
    validators.numericId('sessionId'),
    body('days').custom((value) => {
        return value === 'next' || (Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 30);
    }).withMessage('Número de dias inválido'),
    handleValidationErrors,
    async (req, res) => {
        const { days } = req.body;
        const sessionId = req.params.sessionId;

        try {
            const session = await dbGet('SELECT * FROM study_sessions WHERE id = ?', [sessionId]);
            if (!session) return res.status(404).json({ error: "Sessão não encontrada." });

            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [session.study_plan_id, req.user.id]);
            if (!plan) return res.status(403).json({ error: "Não autorizado." });

            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            const findNextStudyDay = (date) => {
                let nextDay = new Date(date);
                while (nextDay <= examDate) {
                    if (nextDay.getDay() !== 0 && studyHoursPerDay[nextDay.getDay()] > 0) return nextDay;
                    nextDay.setDate(nextDay.getDate() + 1);
                }
                return null;
            };

            let targetDate = new Date(session.session_date + 'T00:00:00');
            if (days === 'next') {
                targetDate.setDate(targetDate.getDate() + 1);
            } else {
                targetDate.setDate(targetDate.getDate() + parseInt(days, 10));
            }

            const newDate = findNextStudyDay(targetDate);

            if (!newDate) {
                return res.status(400).json({ error: "Não há dias de estudo disponíveis para adiar a tarefa." });
            }

            const newDateStr = newDate.toISOString().split('T')[0];
            await dbRun("UPDATE study_sessions SET session_date = ? WHERE id = ?", [newDateStr, sessionId]);

            res.json({ message: `Tarefa adiada para ${newDate.toLocaleDateString('pt-BR')}!` });

        } catch (error) {
            console.error("Erro ao adiar tarefa:", error);
            res.status(500).json({ error: "Erro interno ao adiar a tarefa." });
        }
});

// Obter dados de progresso do plano
app.get('/plans/:planId/progress', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const completedTopicsResult = await dbAll('SELECT DISTINCT topic_id FROM study_sessions WHERE study_plan_id = ? AND session_type = "Novo Tópico" AND status = "Concluído" AND topic_id IS NOT NULL', [planId]);
            const allTopicsInPlan = await dbAll('SELECT s.subject_name, t.id FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [planId]);
            
            if (allTopicsInPlan.length === 0) return res.json({ totalProgress: 0, subjectProgress: {} });

            const completedTopics = new Set(completedTopicsResult.map(r => r.topic_id));
            const totalProgress = (completedTopics.size / allTopicsInPlan.length) * 100;
            
            const subjectStats = {};
            allTopicsInPlan.forEach(topic => {
                if (!subjectStats[topic.subject_name]) {
                    subjectStats[topic.subject_name] = { total: 0, completed: 0 };
                }
                subjectStats[topic.subject_name].total++;
                if (completedTopics.has(topic.id)) {
                    subjectStats[topic.subject_name].completed++;
                }
            });
            
            const subjectProgress = {};
            for (const subject in subjectStats) {
                const stats = subjectStats[subject];
                subjectProgress[subject] = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
            }
            res.json({ totalProgress, subjectProgress });
        } catch (error) {
            console.error('Erro ao calcular progresso:', error);
            res.status(500).json({ "error": "Erro ao calcular progresso" });
        }
});

// Obter progresso das metas de questões
app.get('/plans/:planId/goal_progress', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();
        const firstDayOfWeek = new Date();
        firstDayOfWeek.setDate(firstDayOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const firstDayOfWeekStr = firstDayOfWeek.toISOString().split('T')[0];
        try {
            const plan = await dbGet('SELECT daily_question_goal, weekly_question_goal FROM study_plans WHERE id = ?', [planId]);
            if (!plan) return res.status(404).json({ error: "Plano não encontrado" });
            const dailyResult = await dbGet('SELECT SUM(questions_solved) as total FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, today]);
            const weeklyResult = await dbGet('SELECT SUM(questions_solved) as total FROM study_sessions WHERE study_plan_id = ? AND session_date >= ? AND session_date <= ?', [planId, firstDayOfWeekStr, today]);
            res.json({
                dailyGoal: plan.daily_question_goal,
                dailyProgress: dailyResult.total || 0,
                weeklyGoal: plan.weekly_question_goal,
                weeklyProgress: weeklyResult.total || 0
            });
        } catch (error) {
            console.error('Erro ao buscar progresso de metas:', error);
            res.status(500).json({ error: "Erro ao buscar progresso de metas" });
        }
});

// Obter radar de questões (pontos fracos)
app.get('/plans/:planId/question_radar', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const sql = `
            SELECT t.description as topic_description, s.subject_name, COALESCE(SUM(ss.questions_solved), 0) as total_questions
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN study_sessions ss ON t.id = ss.topic_id AND s.study_plan_id = ss.study_plan_id
            WHERE s.study_plan_id = ? 
              AND t.id IN (SELECT DISTINCT topic_id FROM study_sessions WHERE study_plan_id = ? AND session_date <= ? AND topic_id IS NOT NULL)
            GROUP BY t.id
            HAVING total_questions < 10
            ORDER BY total_questions ASC, s.subject_name
        `;
        try {
            const rows = await dbAll(sql, [req.params.planId, req.params.planId, todayStr]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao buscar radar de questões:', error);
            res.status(500).json({ "error": "Erro ao buscar radar de questões" });
        }
});

// Obter dados para revisão
app.get('/plans/:planId/review_data', 
    authenticateToken,
    validators.numericId('planId'),
    (req, res, next) => {
        // Workaround for query validation in this setup
        const { query, validationResult } = require('express-validator');
        query('date').isISO8601().withMessage('Data inválida')(req, res, next);
    },
    (req, res, next) => {
        const { query, validationResult } = require('express-validator');
        query('type').isIn(['semanal', 'mensal']).withMessage('Tipo de revisão inválido')(req, res, next);
    },
    handleValidationErrors,
    async (req, res) => {
        const { date, type } = req.query;
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT review_mode FROM study_plans WHERE id = ?', [planId]);
            if (!plan) return res.status(404).json({ error: "Plano não encontrado" });
            const reviewDate = new Date(date + 'T00:00:00');
            const daysToLookBack = type === 'mensal' ? 28 : 7;
            const startDate = new Date(reviewDate);
            startDate.setDate(reviewDate.getDate() - (daysToLookBack - 1));
            const reviewDateStr = reviewDate.toISOString().split('T')[0];
            const startDateStr = startDate.toISOString().split('T')[0];
            let sql = `
                SELECT DISTINCT s.subject_name, ss.topic_description, ss.topic_id
                FROM study_sessions ss
                JOIN topics t ON ss.topic_id = t.id
                JOIN subjects s ON t.subject_id = s.id
                WHERE ss.study_plan_id = ? 
                  AND ss.session_type = 'Novo Tópico'
                  AND ss.session_date >= ? AND ss.session_date <= ?
            `;
            let params = [planId, startDateStr, reviewDateStr];
            if (plan.review_mode === 'focado') {
                sql += ` AND (SELECT COALESCE(SUM(questions_solved), 0) FROM study_sessions WHERE topic_id = ss.topic_id AND study_plan_id = ?) < 10`;
                params.push(planId);
            }
            sql += ` ORDER BY s.subject_name, ss.topic_description`;
            const rows = await dbAll(sql, params);
            const groupedBySubject = rows.reduce((acc, row) => {
                if (!acc[row.subject_name]) acc[row.subject_name] = [];
                acc[row.subject_name].push(row.topic_description);
                return acc;
            }, {});
            res.json(groupedBySubject);
        } catch (error) {
            console.error('Erro ao buscar dados de revisão:', error);
            res.status(500).json({ error: "Erro ao buscar dados de revisão" });
        }
});
// COLE TODO ESTE BLOCO NOVO AQUI
// AÇÃO 1.2: NOVA ROTA PARA ANÁLISE DETALHADA
app.get('/plans/:planId/detailed_progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            const subjects = await dbAll('SELECT id, subject_name FROM subjects WHERE study_plan_id = ?', [planId]);
            const topics = await dbAll(`
                SELECT 
                    t.id, t.description, t.status, t.subject_id, 
                    COALESCE(ss.total_time, 0) as time_studied 
                FROM topics t 
                LEFT JOIN (
                    SELECT topic_id, SUM(time_studied_seconds) as total_time 
                    FROM study_sessions 
                    WHERE study_plan_id = ? AND topic_id IS NOT NULL
                    GROUP BY topic_id
                ) ss ON t.id = ss.topic_id 
                WHERE t.subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)
            `, [planId, planId]);

            const subjectData = subjects.map(subject => {
                const subjectTopics = topics.filter(t => t.subject_id === subject.id);
                const completedTopics = subjectTopics.filter(t => t.status === 'Concluído').length;
                const totalTime = subjectTopics.reduce((sum, t) => sum + t.time_studied, 0);

                return {
                    id: subject.id,
                    name: subject.subject_name,
                    progress: subjectTopics.length > 0 ? (completedTopics / subjectTopics.length) * 100 : 0,
                    totalTime: totalTime,
                    topics: subjectTopics.map(t => ({
                        id: t.id,
                        description: t.description,
                        status: t.status,
                        timeStudied: t.time_studied
                    }))
                };
            });

            const totalTopicsInPlan = topics.length;
            const totalCompletedTopics = topics.filter(t => t.status === 'Concluído').length;
            const totalProgress = totalTopicsInPlan > 0 ? (totalCompletedTopics / totalTopicsInPlan) * 100 : 0;

            res.json({
                totalProgress,
                subjectDetails: subjectData
            });

        } catch (error) {
            console.error('Erro ao buscar progresso detalhado:', error);
            res.status(500).json({ "error": "Erro ao buscar progresso detalhado" });
        }
    }
);
// Obter diagnóstico de performance (reality check)
app.get('/plans/:planId/realitycheck', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet("SELECT * FROM study_plans WHERE id = ? AND user_id = ?", [planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado" });
            
            const sessions = await dbAll("SELECT status, topic_id, session_date, session_type FROM study_sessions WHERE study_plan_id = ?", [planId]);
            const totalTopicsResult = await dbGet('SELECT COUNT(t.id) as total FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [planId]);
            const totalTopics = totalTopicsResult.total;

            if (totalTopics === 0) {
                return res.json({ message: "Adicione tópicos ao seu plano para ver as projeções." });
            }

            const today = new Date(); today.setHours(0, 0, 0, 0);
            const examDate = new Date(plan.exam_date + 'T23:59:59');
            
            const newTopicSessions = sessions.filter(s => s.session_type === 'Novo Tópico');
            const completedTopics = new Set(newTopicSessions.filter(s => s.status === 'Concluído').map(r => r.topic_id));
            const topicsCompletedCount = completedTopics.size;
            const topicsRemaining = totalTopics - topicsCompletedCount;

            const futureNewTopics = newTopicSessions.filter(s => new Date(s.session_date) >= today && s.status === 'Pendente');
            const isMaintenanceMode = totalTopics > 0 && futureNewTopics.length === 0;

            const firstSessionDateResult = await dbGet("SELECT MIN(session_date) as first_date FROM study_sessions WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído'", [planId]);
            const firstSessionDate = firstSessionDateResult.first_date ? new Date(firstSessionDateResult.first_date + 'T00:00:00') : today;

            const daysSinceStart = Math.max(1, Math.ceil((today - firstSessionDate) / (1000 * 60 * 60 * 24)));
            const daysRemainingForExam = Math.max(1, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));
            
            const currentPace = topicsCompletedCount / daysSinceStart;
            const requiredPace = topicsRemaining / daysRemainingForExam;

            let status, primaryMessage, secondaryMessage, motivationalMessage;

            if (isMaintenanceMode) {
                status = 'completed';
                primaryMessage = `Parabéns! Você concluiu <strong>100%</strong> do edital.`;
                secondaryMessage = `Seu cronograma entrou no Modo de Manutenção Avançada, com foco em revisões e simulados.`;
                motivationalMessage = `Agora é a hora de aprimorar. Mantenha a consistência até a aprovação!`;
            } else {
// COLE ESTE NOVO BLOCO NO LUGAR DO ANTIGO
        let projectedCompletionPercentage = 0;
        if (totalTopics > 0) {
            if (currentPace > 0) {
                const projectedTopicsToComplete = currentPace * daysRemainingForExam;
                const totalProjectedCompleted = topicsCompletedCount + projectedTopicsToComplete;
                projectedCompletionPercentage = Math.min(100, (totalProjectedCompleted / totalTopics) * 100);
            } else if (topicsCompletedCount > 0) {
                projectedCompletionPercentage = (topicsCompletedCount / totalTopics) * 100;
    }
}

                if (currentPace >= requiredPace) {
                    status = 'on-track';
                    primaryMessage = `Mantendo o ritmo, sua projeção é de concluir <strong>${projectedCompletionPercentage.toFixed(0)}%</strong> do edital.`;
                    secondaryMessage = `Excelente trabalho! Seu ritmo atual é suficiente para cobrir todo o conteúdo necessário a tempo.`;
                    motivationalMessage = `A consistência está trazendo resultados. Continue assim!`;
                } else {
                    status = 'off-track';
                    primaryMessage = `Nesse ritmo, você completará apenas <strong>${projectedCompletionPercentage.toFixed(0)}%</strong> do edital até a prova.`;
                    secondaryMessage = `Para concluir 100%, seu ritmo precisa aumentar para <strong>${requiredPace.toFixed(1)} tópicos/dia</strong>.`;
                    motivationalMessage = `Não desanime! Pequenos ajustes na rotina podem fazer uma grande diferença.`;
                }
            }

            res.json({
                requiredPace: isFinite(requiredPace) ? `${requiredPace.toFixed(1)} tópicos/dia` : "N/A",
                postponementCount: plan.postponement_count,
                status,
                primaryMessage,
                secondaryMessage,
                motivationalMessage,
                isMaintenanceMode
            });

        } catch (error) {
            console.error('Erro no reality check:', error);
            res.status(500).json({ "error": "Erro ao calcular diagnóstico" });
        }
});
// Endpoint para registrar tempo de estudo
app.post('/sessions/:sessionId/time',
    authenticateToken,
    validators.numericId('sessionId'),
    body('seconds').isInt({ min: 0, max: 86400 }).withMessage('Tempo inválido'),
    handleValidationErrors,
    async (req, res) => {
        const { seconds } = req.body;
        const sessionId = req.params.sessionId;
        const userId = req.user.id;

        try {
            // Verificar se a sessão pertence ao usuário
            const session = await dbGet(`
                SELECT ss.* FROM study_sessions ss 
                JOIN study_plans sp ON ss.study_plan_id = sp.id 
                WHERE ss.id = ? AND sp.user_id = ?
            `, [sessionId, userId]);

            if (!session) {
                return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
            }

            // Atualizar o total de tempo na sessão
            await dbRun(`
                UPDATE study_sessions 
                SET time_studied_seconds = COALESCE(time_studied_seconds, 0) + ?
                WHERE id = ?
            `, [seconds, sessionId]);

            res.json({ 
                message: "Tempo registrado com sucesso!", 
                totalTime: (session.time_studied_seconds || 0) + seconds 
            });

        } catch (error) {
            console.error('Erro ao salvar tempo de estudo:', error);
            res.status(500).json({ error: "Erro ao registrar tempo de estudo." });
        }
    }
);

// --- ROTA DE GAMIFICAÇÃO ---
app.get('/plans/:planId/gamification', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;

        try {
            const plan = await dbGet("SELECT id FROM study_plans WHERE id = ? AND user_id = ?", [planId, userId]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            // 1. Calcular Tópicos Concluídos e Nível
            const completedTopicsResult = await dbGet(`
                SELECT COUNT(DISTINCT topic_id) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL
            `, [planId]);
            const completedTopicsCount = completedTopicsResult.count || 0;

            const levels = [
                { threshold: 0, title: 'Aspirante a Servidor(a) 🌱' },
                { threshold: 11, title: 'Pagador(a) de Inscrição 💸' },
                { threshold: 31, title: 'Acima da Nota de Corte (nos simulados) 😉' },
                { threshold: 51, title: 'Mestre dos Grupos de WhatsApp de Concurso 📲' },
                { threshold: 101, title: 'Gabaritador(a) da prova de Português da FGV 🎯' },
                { threshold: 201, title: 'Terror do Cespe/Cebraspe 👹' },
                { threshold: 351, title: 'Veterano(a) de 7 Bancas Diferentes 😎' },
                { threshold: 501, title: '✨ Lenda Viva: Assinante Vitalício do Diário Oficial ✨' }
            ];

            let currentLevel = levels[0];
            let nextLevel = null;
            for (let i = levels.length - 1; i >= 0; i--) {
                if (completedTopicsCount >= levels[i].threshold) {
                    currentLevel = levels[i];
                    if (i < levels.length - 1) {
                        nextLevel = levels[i + 1];
                    }
                    break;
                }
            }
            
            const topicsToNextLevel = nextLevel ? nextLevel.threshold - completedTopicsCount : 0;

            // 2. Calcular Sequência de Estudos (Streak)
            const completedSessions = await dbAll(`
                SELECT DISTINCT session_date FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Concluído' ORDER BY session_date DESC
            `, [planId]);
            
            let studyStreak = 0;
            if (completedSessions.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);

                const lastStudyDate = new Date(completedSessions[0].session_date + 'T00:00:00');
                
                if (lastStudyDate.getTime() === today.getTime() || lastStudyDate.getTime() === yesterday.getTime()) {
                    studyStreak = 1;
                    let currentDate = new Date(lastStudyDate);
                    for (let i = 1; i < completedSessions.length; i++) {
                        const previousDay = new Date(currentDate);
                        previousDay.setDate(currentDate.getDate() - 1);
                        const nextStudyDate = new Date(completedSessions[i].session_date + 'T00:00:00');
                        if (nextStudyDate.getTime() === previousDay.getTime()) {
                            studyStreak++;
                            currentDate = nextStudyDate;
                        } else {
                            break;
                        }
                    }
                }
            }
            
            // 3. Contar tarefas de hoje
            const todayStr = new Date().toISOString().split('T')[0];
            const todayTasksResult = await dbGet(`
                SELECT 
                    COUNT(id) as total, 
                    SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) as completed 
                FROM study_sessions 
                WHERE study_plan_id = ? AND session_date = ?
            `, [planId, todayStr]);

            res.json({
                completedTopicsCount,
                concurseiroLevel: currentLevel.title,
                nextLevel: nextLevel ? nextLevel.title : null,
                topicsToNextLevel,
                studyStreak,
                completedTodayCount: todayTasksResult.completed || 0,
                totalTodayCount: todayTasksResult.total || 0,
            });

        } catch (error) {
            console.error("Erro na rota de gamificação:", error);
            res.status(500).json({ "error": "Erro ao buscar dados de gamificação." });
        }
});
// Rota padrão - redireciona para login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Tratamento de erros global
app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origem não permitida' });
    }
    console.error('Erro não tratado:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('Para começar, crie um arquivo .env baseado no .env.example');
});
