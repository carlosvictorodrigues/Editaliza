/**
 * Feature Flags Configuration Module
 * 
 * Centralizes feature toggles and application capabilities:
 * - Feature flags for A/B testing
 * - Environment-based feature toggles
 * - Gradual rollout controls
 * - Premium feature gates
 * 
 * PHASE 7: Configuration Modularization
 * Created: 2025-08-25
 */

const environment = require('./environment');

/**
 * Core Feature Flags
 * Controls basic application functionality
 */
const coreFeatures = {
    // Authentication features
    userRegistration: process.env.FEATURE_REGISTRATION !== 'false',
    googleOAuth: process.env.FEATURE_GOOGLE_OAUTH !== 'false',
    passwordReset: process.env.FEATURE_PASSWORD_RESET !== 'false',
    emailVerification: process.env.FEATURE_EMAIL_VERIFICATION === 'true',
    
    // Profile features
    profilePhotos: process.env.FEATURE_PROFILE_PHOTOS !== 'false',
    profileCustomization: process.env.FEATURE_PROFILE_CUSTOMIZATION !== 'false',
    
    // Core study features
    planGeneration: process.env.FEATURE_PLAN_GENERATION !== 'false',
    scheduleGeneration: process.env.FEATURE_SCHEDULE_GENERATION !== 'false',
    progressTracking: process.env.FEATURE_PROGRESS_TRACKING !== 'false',
    
    // Social features
    planSharing: process.env.FEATURE_PLAN_SHARING !== 'false',
    achievements: process.env.FEATURE_ACHIEVEMENTS !== 'false',
    leaderboards: process.env.FEATURE_LEADERBOARDS === 'true'
};

/**
 * Advanced Feature Flags
 * Controls advanced and experimental functionality
 */
const advancedFeatures = {
    // Analytics and insights
    detailedStatistics: process.env.FEATURE_DETAILED_STATS !== 'false',
    performanceInsights: process.env.FEATURE_PERFORMANCE_INSIGHTS === 'true',
    predictiveAnalytics: process.env.FEATURE_PREDICTIVE_ANALYTICS === 'true',
    
    // AI-powered features
    smartRecommendations: process.env.FEATURE_SMART_RECOMMENDATIONS === 'true',
    adaptivePlanning: process.env.FEATURE_ADAPTIVE_PLANNING === 'true',
    aiTutor: process.env.FEATURE_AI_TUTOR === 'true',
    
    // Collaboration features
    studyGroups: process.env.FEATURE_STUDY_GROUPS === 'true',
    peerReviews: process.env.FEATURE_PEER_REVIEWS === 'true',
    mentorship: process.env.FEATURE_MENTORSHIP === 'true',
    
    // Content features
    videoLessons: process.env.FEATURE_VIDEO_LESSONS === 'true',
    interactiveExercises: process.env.FEATURE_INTERACTIVE_EXERCISES === 'true',
    simulatedExams: process.env.FEATURE_SIMULATED_EXAMS !== 'false'
};

/**
 * Premium Feature Flags
 * Controls premium/paid functionality
 */
const premiumFeatures = {
    // Export features
    pdfExport: process.env.FEATURE_PDF_EXPORT !== 'false',
    excelExport: process.env.FEATURE_EXCEL_EXPORT === 'true',
    calendarSync: process.env.FEATURE_CALENDAR_SYNC === 'true',
    
    // Advanced planning
    multipleExamPlans: process.env.FEATURE_MULTIPLE_PLANS === 'true',
    customTemplates: process.env.FEATURE_CUSTOM_TEMPLATES === 'true',
    advancedScheduling: process.env.FEATURE_ADVANCED_SCHEDULING === 'true',
    
    // Premium content
    exclusiveContent: process.env.FEATURE_EXCLUSIVE_CONTENT === 'true',
    personalizedCoaching: process.env.FEATURE_PERSONAL_COACHING === 'true',
    prioritySupport: process.env.FEATURE_PRIORITY_SUPPORT === 'true',
    
    // Advanced analytics
    detailedReports: process.env.FEATURE_DETAILED_REPORTS === 'true',
    performanceTrends: process.env.FEATURE_PERFORMANCE_TRENDS === 'true',
    competitiveAnalysis: process.env.FEATURE_COMPETITIVE_ANALYSIS === 'true'
};

/**
 * Administrative Feature Flags
 * Controls admin and system functionality
 */
const adminFeatures = {
    // System administration
    adminPanel: process.env.FEATURE_ADMIN_PANEL !== 'false',
    systemMetrics: process.env.FEATURE_SYSTEM_METRICS !== 'false',
    userManagement: process.env.FEATURE_USER_MANAGEMENT !== 'false',
    
    // Content management
    contentEditor: process.env.FEATURE_CONTENT_EDITOR === 'true',
    bulkOperations: process.env.FEATURE_BULK_OPERATIONS === 'true',
    dataExport: process.env.FEATURE_DATA_EXPORT !== 'false',
    
    // System monitoring
    performanceMonitoring: process.env.FEATURE_PERFORMANCE_MONITORING !== 'false',
    errorTracking: process.env.FEATURE_ERROR_TRACKING !== 'false',
    auditLogging: process.env.FEATURE_AUDIT_LOGGING !== 'false'
};

/**
 * Experimental Feature Flags
 * Controls features in development/testing
 */
const experimentalFeatures = {
    // Beta features
    newDashboard: process.env.EXPERIMENT_NEW_DASHBOARD === 'true',
    enhancedNotifications: process.env.EXPERIMENT_ENHANCED_NOTIFICATIONS === 'true',
    voiceCommands: process.env.EXPERIMENT_VOICE_COMMANDS === 'true',
    
    // A/B testing
    alternateLayout: process.env.EXPERIMENT_ALTERNATE_LAYOUT === 'true',
    improvedOnboarding: process.env.EXPERIMENT_IMPROVED_ONBOARDING === 'true',
    gamifiedExperience: process.env.EXPERIMENT_GAMIFIED_EXPERIENCE === 'true',
    
    // Development features
    debugMode: process.env.EXPERIMENT_DEBUG_MODE === 'true' && environment.IS_DEVELOPMENT,
    performanceTesting: process.env.EXPERIMENT_PERFORMANCE_TESTING === 'true',
    betaAPI: process.env.EXPERIMENT_BETA_API === 'true'
};

/**
 * Feature Categories
 * Organized groupings of related features
 */
const featureCategories = {
    core: coreFeatures,
    advanced: advancedFeatures,
    premium: premiumFeatures,
    admin: adminFeatures,
    experimental: experimentalFeatures
};

/**
 * Check if Feature is Enabled
 * @param {string} featureName - Name of the feature to check
 * @param {string} category - Category of the feature (optional)
 * @returns {boolean} True if feature is enabled
 */
function isFeatureEnabled(featureName, category = null) {
    if (category) {
        return featureCategories[category]?.[featureName] === true;
    }
    
    // Search across all categories
    for (const categoryName in featureCategories) {
        if (featureCategories[categoryName][featureName] === true) {
            return true;
        }
    }
    
    return false;
}

/**
 * Get Enabled Features by Category
 * @param {string} category - Feature category
 * @returns {Array} List of enabled features in category
 */
function getEnabledFeatures(category) {
    if (!featureCategories[category]) {
        return [];
    }
    
    return Object.entries(featureCategories[category])
        .filter(([name, enabled]) => enabled)
        .map(([name]) => name);
}

/**
 * Get All Enabled Features
 * @returns {object} Object with all enabled features by category
 */
function getAllEnabledFeatures() {
    const enabled = {};
    
    for (const category in featureCategories) {
        enabled[category] = getEnabledFeatures(category);
    }
    
    return enabled;
}

/**
 * Feature Flag Middleware
 * Middleware to check feature flags in routes
 * @param {string} featureName - Name of the feature to check
 * @param {string} category - Category of the feature
 * @returns {Function} Express middleware function
 */
function requireFeature(featureName, category = null) {
    return (req, res, next) => {
        if (isFeatureEnabled(featureName, category)) {
            next();
        } else {
            res.status(403).json({
                error: 'Feature not available',
                feature: featureName,
                code: 'FEATURE_DISABLED'
            });
        }
    };
}

/**
 * Premium Feature Middleware
 * Checks both feature flag and user subscription
 * @param {string} featureName - Name of the premium feature
 * @returns {Function} Express middleware function
 */
function requirePremiumFeature(featureName) {
    return (req, res, next) => {
        // Check feature flag first
        if (!isFeatureEnabled(featureName, 'premium')) {
            return res.status(403).json({
                error: 'Premium feature not available',
                feature: featureName,
                code: 'PREMIUM_FEATURE_DISABLED'
            });
        }
        
        // TODO: Add subscription check here
        // For now, allow all authenticated users
        next();
    };
}

/**
 * Feature Configuration Summary
 * @returns {object} Summary of feature configuration
 */
function getFeatureInfo() {
    const summary = {
        categories: Object.keys(featureCategories).length,
        totalFeatures: 0,
        enabledFeatures: 0,
        byCategory: {}
    };
    
    for (const category in featureCategories) {
        const categoryFeatures = featureCategories[category];
        const totalInCategory = Object.keys(categoryFeatures).length;
        const enabledInCategory = Object.values(categoryFeatures).filter(Boolean).length;
        
        summary.totalFeatures += totalInCategory;
        summary.enabledFeatures += enabledInCategory;
        
        summary.byCategory[category] = {
            total: totalInCategory,
            enabled: enabledInCategory,
            percentage: Math.round((enabledInCategory / totalInCategory) * 100)
        };
    }
    
    return summary;
}

/**
 * Initialize Feature Configuration
 * Validates and logs feature flag status
 */
function initializeFeatureConfig() {
    if (environment.IS_DEVELOPMENT) {
        const info = getFeatureInfo();
        console.log('✅ Feature flags configuration loaded:');
        console.log(`   Total features: ${info.enabledFeatures}/${info.totalFeatures} enabled`);
        
        for (const category in info.byCategory) {
            const cat = info.byCategory[category];
            console.log(`   - ${category}: ${cat.enabled}/${cat.total} (${cat.percentage}%)`);
        }
        
        // Log experimental features if any are enabled
        const experimentalEnabled = getEnabledFeatures('experimental');
        if (experimentalEnabled.length > 0) {
            console.log('⚠️ Experimental features enabled:', experimentalEnabled.join(', '));
        }
    }
    
    return {
        categories: featureCategories,
        isEnabled: isFeatureEnabled,
        getEnabled: getEnabledFeatures,
        getAllEnabled: getAllEnabledFeatures,
        requireFeature,
        requirePremiumFeature,
        getInfo: getFeatureInfo
    };
}

module.exports = initializeFeatureConfig();