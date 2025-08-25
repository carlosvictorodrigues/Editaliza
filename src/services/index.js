/**
 * Services Index
 * FASE 4 - SERVICES LAYER
 * 
 * Centralizes the creation and export of all business logic services.
 * This provides a clean interface for controllers to access services.
 */

const PlanService = require('./planService');
const SessionService = require('./sessionService');
const StatisticsService = require('./statisticsService');

// Import existing services for backward compatibility
// These services will be created later if needed
// const emailService = require('./emailService');
// const authService = require('./authService');
// const userService = require('./userService');

/**
 * Creates and returns instances of all business logic services
 * @param {Object} repositories - Repository instances
 * @param {Object} db - Database instance
 * @returns {Object} Object with all service instances
 */
function createServices(repositories, db) {
    if (!repositories) {
        throw new Error('Repositories instance is required to create services');
    }
    
    if (!db) {
        throw new Error('Database instance is required to create services');
    }

    return {
        // New Phase 4 Services
        plan: new PlanService(repositories, db),
        session: new SessionService(repositories, db),
        statistics: new StatisticsService(repositories, db),
        
        // Existing services (for backward compatibility)
        // email: emailService,
        // auth: authService,
        // user: userService
    };
}

/**
 * Legacy service creation for gradual migration
 * This maintains the old planService exports while adding the new service layer
 */
function createLegacyPlanService(repositories, db) {
    const planService = new PlanService(repositories, db);
    
    // Create wrapper functions to maintain compatibility with existing server.js calls
    return {
        // New class-based service
        service: planService,
        
        // Legacy function exports for backward compatibility
        getSchedulePreview: (planId, userId) => planService.getSchedulePreview(planId, userId),
        getProgress: (planId, userId) => planService.getProgress(planId, userId),
        getDetailedProgress: (planId, userId) => planService.getDetailedProgress(planId, userId),
        getGoalProgress: (planId, userId) => planService.getGoalProgress(planId, userId),
        getRealityCheck: (planId, userId) => planService.getRealityCheck(planId, userId),
        getGamification: (planId, userId) => planService.getGamification(planId, userId),
        getPerformance: (planId, userId) => planService.getPerformance(planId, userId),
        getCompletedSessions: (planId, userId) => planService.getCompletedSessions(planId, userId),
        getUserStats: (planId, userId) => planService.getUserStats(planId, userId),
        getQuestionRadar: (planId, userId) => planService.getQuestionRadar(planId, userId),
        getOverdueCheck: (planId, userId) => planService.getOverdueCheck(planId, userId),
        getActivitySummary: (planId, userId, date) => planService.getActivitySummary(planId, userId, date),
        getSubjects: (planId, userId) => planService.getSubjects(planId, userId)
    };
}

/**
 * Service configuration and initialization helper
 */
function initializeServices(repositories, db, config = {}) {
    console.log('🔧 Initializing Services Layer - Phase 4');
    
    try {
        const services = createServices(repositories, db);
        
        console.log('✅ Services initialized successfully:');
        console.log('  - PlanService: Business logic for study plans');
        console.log('  - SessionService: Session management and analytics');  
        console.log('  - StatisticsService: Dashboard metrics and reports');
        console.log('  - Legacy services: Email, Auth, User');
        
        return services;
    } catch (error) {
        console.error('❌ Failed to initialize services:', error.message);
        throw error;
    }
}

/**
 * Export individual service classes for direct usage
 */
module.exports = {
    // Main service creation function
    createServices,
    
    // Legacy compatibility
    createLegacyPlanService,
    
    // Service initialization
    initializeServices,
    
    // Individual service classes
    PlanService,
    SessionService,  
    StatisticsService
    
    // Existing services (will be added later)
    // emailService,
    // authService,
    // userService
};