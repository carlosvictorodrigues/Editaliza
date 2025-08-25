/**
 * Middleware CSRF simplificado para desenvolvimento/produção
 * Pode ser desabilitado em desenvolvimento via configuração
 */

const crypto = require('crypto');

class CSRFProtection {
    constructor() {
        this.tokens = new Map();
        this.cleanup();
    }

    generateToken(sessionId) {
        const token = crypto.randomBytes(32).toString('hex');
        const key = sessionId || crypto.randomBytes(16).toString('hex');
        
        this.tokens.set(key, {
            token,
            createdAt: Date.now(),
            used: false
        });
        
        return { key, token };
    }

    validateToken(key, token) {
        const stored = this.tokens.get(key);
        
        if (!stored) return false;
        
        // Token expirado (1 hora)
        if (Date.now() - stored.createdAt > 3600000) {
            this.tokens.delete(key);
            return false;
        }
        
        // Token já usado (single-use tokens)
        if (stored.used) {
            return false;
        }
        
        // Validar token
        const isValid = stored.token === token;
        
        if (isValid) {
            stored.used = true;
        }
        
        return isValid;
    }

    cleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.tokens.entries()) {
                if (now - data.createdAt > 3600000) {
                    this.tokens.delete(key);
                }
            }
        }, 60 * 60 * 1000); // Limpar a cada hora
    }
}

const csrfProtection = new CSRFProtection();

// Middleware para verificar CSRF
function verifyCsrf(options = {}) {
    const { 
        skip = false,
        skipInDevelopment = true 
    } = options;
    
    return (req, res, next) => {
        // Skip se configurado
        if (skip) return next();
        
        // Skip em desenvolvimento se configurado
        if (skipInDevelopment && process.env.NODE_ENV === 'development') {
            return next();
        }
        
        // Skip para GET, HEAD, OPTIONS
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }
        
        // Extrair tokens
        const csrfToken = req.headers['x-csrf-token'] || 
                         req.body?._csrf || 
                         req.query?._csrf;
        
        const sessionId = req.session?.id || req.user?.id || req.ip;
        
        // Validar token
        if (!csrfToken || !csrfProtection.validateToken(sessionId, csrfToken)) {
            // Em desenvolvimento, apenas avisar
            if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ CSRF validation failed in development mode - allowing request');
                return next();
            }
            
            return res.status(403).json({
                error: 'CSRF token inválido ou ausente',
                code: 'CSRF_VALIDATION_FAILED'
            });
        }
        
        next();
    };
}

// Endpoint para obter CSRF token
function getCsrfToken(req, res) {
    const sessionId = req.session?.id || req.user?.id || req.ip;
    const { key, token } = csrfProtection.generateToken(sessionId);
    
    res.json({
        success: true,
        csrfToken: token,
        expiresIn: 3600 // 1 hora
    });
}

module.exports = {
    verifyCsrf,
    getCsrfToken,
    csrfProtection
};