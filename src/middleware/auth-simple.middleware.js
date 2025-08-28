/**
 * Simple Auth Middleware - Debugging Version
 * 
 * This is a simplified version of the auth middleware to isolate the JWT validation issue.
 * It removes all the complex features that might be causing the infinite loop.
 */

const jwt = require('jsonwebtoken');

/**
 * Simple JWT authentication middleware
 */
function authenticateTokenSimple(options = {}) {
    const {
        required = true,
        logFailures = true
    } = options;

    return async (req, res, next) => {
        try {
            console.log(`[AUTH_SIMPLE] Processing ${req.method} ${req.path}`);
            
            // Extract token from Authorization header
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.startsWith('Bearer ') 
                ? authHeader.substring(7) 
                : null;

            // Token not provided
            if (!token) {
                if (!required) {
                    req.user = null;
                    return next();
                }

                console.log('[AUTH_SIMPLE] No token provided');
                return res.status(401).json({
                    error: 'Token de autenticação não fornecido',
                    code: 'AUTH_TOKEN_MISSING'
                });
            }

            console.log(`[AUTH_SIMPLE] Token found: ${token.substring(0, 50)}...`);

            // Validate token
            try {
                const secret = process.env.JWT_SECRET;
                console.log(`[AUTH_SIMPLE] Using secret: ${secret?.substring(0, 20)}...`);
                
                const decoded = jwt.verify(token, secret, {
                    issuer: 'editaliza',
                    algorithms: ['HS256']
                });

                console.log('[AUTH_SIMPLE] Token validated successfully');
                console.log(`[AUTH_SIMPLE] User: ${decoded.email}`);

                // Set user info
                req.user = {
                    id: decoded.id,
                    email: decoded.email,
                    name: decoded.name,
                    role: decoded.role || 'user',
                    iat: decoded.iat,
                    exp: decoded.exp
                };

                console.log('[AUTH_SIMPLE] User set on request, proceeding to next middleware');
                next();

            } catch (error) {
                console.log(`[AUTH_SIMPLE] Token validation error: ${error.message}`);
                
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        error: 'Token expirado. Por favor, faça login novamente.',
                        code: 'AUTH_TOKEN_EXPIRED'
                    });
                }

                return res.status(401).json({
                    error: 'Token inválido',
                    code: 'AUTH_TOKEN_INVALID',
                    details: error.message
                });
            }

        } catch (error) {
            console.error('[AUTH_SIMPLE] Unexpected error:', error);
            return res.status(500).json({
                error: 'Erro interno do servidor',
                code: 'AUTH_INTERNAL_ERROR'
            });
        }
    };
}

module.exports = {
    authenticateTokenSimple
};