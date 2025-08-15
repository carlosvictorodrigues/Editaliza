const rateLimit = require('express-rate-limit');

/**
 * Rate limiting service for email operations
 * Prevents abuse of password recovery and other email features
 */
class EmailRateLimitService {
    constructor() {
        this.emailAttempts = new Map(); // Store email attempts in memory
        this.ipAttempts = new Map(); // Store IP-based attempts
        
        // Configuration
        this.config = {
            // Email-based limits (per email address)
            emailWindow: 15 * 60 * 1000, // 15 minutes
            emailMaxAttempts: 3, // 3 attempts per email per 15 minutes
            
            // IP-based limits (per IP address)
            ipWindow: 60 * 60 * 1000, // 1 hour
            ipMaxAttempts: 10, // 10 attempts per IP per hour
            
            // Global limits
            globalWindow: 5 * 60 * 1000, // 5 minutes
            globalMaxAttempts: 2, // 2 attempts per 5 minutes globally per email
        };

        // Clean up old entries periodically
        setInterval(() => {
            this.cleanupOldEntries();
        }, 5 * 60 * 1000); // Clean every 5 minutes
    }

    /**
     * Check if email sending is allowed for a specific email address
     */
    isEmailAllowed(email) {
        const now = Date.now();
        const emailKey = email.toLowerCase();
        
        if (!this.emailAttempts.has(emailKey)) {
            return true;
        }

        const attempts = this.emailAttempts.get(emailKey);
        const validAttempts = attempts.filter(timestamp => 
            now - timestamp < this.config.emailWindow
        );

        return validAttempts.length < this.config.emailMaxAttempts;
    }

    /**
     * Check if email sending is allowed for a specific IP address
     */
    isIPAllowed(ip) {
        const now = Date.now();
        
        if (!this.ipAttempts.has(ip)) {
            return true;
        }

        const attempts = this.ipAttempts.get(ip);
        const validAttempts = attempts.filter(timestamp => 
            now - timestamp < this.config.ipWindow
        );

        return validAttempts.length < this.config.ipMaxAttempts;
    }

    /**
     * Record an email attempt for both email and IP
     */
    recordEmailAttempt(email, ip) {
        const now = Date.now();
        const emailKey = email.toLowerCase();

        // Record email attempt
        if (!this.emailAttempts.has(emailKey)) {
            this.emailAttempts.set(emailKey, []);
        }
        this.emailAttempts.get(emailKey).push(now);

        // Record IP attempt
        if (!this.ipAttempts.has(ip)) {
            this.ipAttempts.set(ip, []);
        }
        this.ipAttempts.get(ip).push(now);
    }

    /**
     * Get remaining time until next attempt is allowed for email
     */
    getEmailCooldownTime(email) {
        const emailKey = email.toLowerCase();
        
        if (!this.emailAttempts.has(emailKey)) {
            return 0;
        }

        const attempts = this.emailAttempts.get(emailKey);
        if (attempts.length < this.config.emailMaxAttempts) {
            return 0;
        }

        const oldestValidAttempt = Math.min(...attempts.slice(-this.config.emailMaxAttempts));
        const remainingTime = this.config.emailWindow - (Date.now() - oldestValidAttempt);
        
        return Math.max(0, Math.ceil(remainingTime / 1000 / 60)); // Return minutes
    }

    /**
     * Get remaining time until next attempt is allowed for IP
     */
    getIPCooldownTime(ip) {
        if (!this.ipAttempts.has(ip)) {
            return 0;
        }

        const attempts = this.ipAttempts.get(ip);
        if (attempts.length < this.config.ipMaxAttempts) {
            return 0;
        }

        const oldestValidAttempt = Math.min(...attempts.slice(-this.config.ipMaxAttempts));
        const remainingTime = this.config.ipWindow - (Date.now() - oldestValidAttempt);
        
        return Math.max(0, Math.ceil(remainingTime / 1000 / 60)); // Return minutes
    }

    /**
     * Check if both email and IP are allowed, and return appropriate error messages
     */
    checkLimits(email, ip) {
        const emailAllowed = this.isEmailAllowed(email);
        const ipAllowed = this.isIPAllowed(ip);

        if (!emailAllowed) {
            const cooldownMinutes = this.getEmailCooldownTime(email);
            return {
                allowed: false,
                reason: 'email_limit',
                message: `Muitas tentativas para este e-mail. Tente novamente em ${cooldownMinutes} minutos.`,
                cooldownMinutes
            };
        }

        if (!ipAllowed) {
            const cooldownMinutes = this.getIPCooldownTime(ip);
            return {
                allowed: false,
                reason: 'ip_limit',
                message: `Muitas tentativas deste IP. Tente novamente em ${cooldownMinutes} minutos.`,
                cooldownMinutes
            };
        }

        return {
            allowed: true,
            reason: null,
            message: null
        };
    }

    /**
     * Clean up old entries to prevent memory leaks
     */
    cleanupOldEntries() {
        const now = Date.now();

        // Clean email attempts
        for (const [email, attempts] of this.emailAttempts.entries()) {
            const validAttempts = attempts.filter(timestamp => 
                now - timestamp < this.config.emailWindow
            );
            
            if (validAttempts.length === 0) {
                this.emailAttempts.delete(email);
            } else {
                this.emailAttempts.set(email, validAttempts);
            }
        }

        // Clean IP attempts
        for (const [ip, attempts] of this.ipAttempts.entries()) {
            const validAttempts = attempts.filter(timestamp => 
                now - timestamp < this.config.ipWindow
            );
            
            if (validAttempts.length === 0) {
                this.ipAttempts.delete(ip);
            } else {
                this.ipAttempts.set(ip, validAttempts);
            }
        }
    }

    /**
     * Get current statistics
     */
    getStats() {
        return {
            totalEmailsTracked: this.emailAttempts.size,
            totalIPsTracked: this.ipAttempts.size,
            config: this.config
        };
    }

    /**
     * Reset limits for a specific email (admin function)
     */
    resetEmailLimits(email) {
        const emailKey = email.toLowerCase();
        this.emailAttempts.delete(emailKey);
    }

    /**
     * Reset limits for a specific IP (admin function)
     */
    resetIPLimits(ip) {
        this.ipAttempts.delete(ip);
    }
}

/**
 * Create Express rate limiter middleware for password recovery endpoint
 */
function createPasswordRecoveryRateLimit() {
    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // Limit each IP to 5 requests per windowMs
        message: {
            error: 'Muitas tentativas de recuperação de senha. Tente novamente em 15 minutos.',
            retryAfter: 15 * 60 // seconds
        },
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        keyGenerator: (req) => {
            // Combine IP and email for more precise limiting
            return `${req.ip}:${req.body.email || 'no-email'}`;
        },
        skip: (req) => {
            // Skip rate limiting in test environment
            return process.env.NODE_ENV === 'test';
        }
    });
}

// Create singleton instance
const emailRateLimitService = new EmailRateLimitService();

module.exports = {
    emailRateLimitService,
    createPasswordRecoveryRateLimit
};