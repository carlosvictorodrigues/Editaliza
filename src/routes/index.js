// src/routes/index.js - FASE 8 - Consolidador de Rotas

// Import all modular routes
const plansRoutes = require('./plans.routes');
const subjectsRoutes = require('./subjects.routes');
const topicsRoutes = require('./topics.routes');
const authRoutes = require('./auth.routes');
const profileRoutes = require('./profile.routes');
const scheduleRoutes = require('./schedule.routes');
const sessionsRoutes = require('./sessions.routes');
const statisticsRoutes = require('./statistics.routes');
const gamificationRoutes = require('./gamification.routes');
const adminRoutes = require('./admin.routes');

// FASE 8 - Rotas modularizadas
const legacyRoutes = require('./legacy.routes');
const healthRoutes = require('./health.routes');

/**
 * Configurar todas as rotas modulares
 * @param {Express} app - Instância do Express
 */
function configureRoutes(app) {
    // ==========================================
    // ROTAS PRINCIPAIS DE API
    // ==========================================
    app.use('/api/plans', plansRoutes);
    app.use('/api', subjectsRoutes);
    app.use('/api', topicsRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/sessions', sessionsRoutes);
    app.use('/api', statisticsRoutes);
    app.use('/api', gamificationRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api', scheduleRoutes);

    // ==========================================
    // FASE 8 - ROTAS MODULARIZADAS
    // ==========================================
    
    // Rotas legacy (temporárias - TODO: migrar completamente)
    app.use('/api', legacyRoutes);
    
    // Health checks e métricas
    app.use('/', healthRoutes);

    // ==========================================
    // ROTA PADRÃO
    // ==========================================
    app.get('/', (req, res) => {
        res.redirect('/login.html');
    });
}

module.exports = {
    configureRoutes
};
