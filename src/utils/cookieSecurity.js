/**
 * Cookie Security Utils - HMAC signing for OAuth fallback cookies
 * Prevents cookie fixation attacks on .editaliza.com.br domain
 */

const crypto = require('crypto');

/**
 * Sign a value with HMAC-SHA256
 * @param {string} val - Value to sign
 * @param {string} secret - Secret key (defaults to SESSION_SECRET)
 * @returns {string} Signed value in format: value.signature
 */
function signCookie(val, secret = process.env.SESSION_SECRET) {
    if (!val) return null;
    if (!secret) {
        console.error('⚠️ SESSION_SECRET not configured for cookie signing');
        return val; // Fallback inseguro, mas não quebra o fluxo
    }
    
    const signature = crypto
        .createHmac('sha256', secret)
        .update(val)
        .digest('base64url');
    
    return `${val}.${signature}`;
}

/**
 * Verify and extract signed cookie value
 * @param {string} signed - Signed value to verify
 * @param {string} secret - Secret key (defaults to SESSION_SECRET)
 * @returns {string|null} Original value if valid, null if tampered
 */
function verifyCookie(signed, secret = process.env.SESSION_SECRET) {
    if (!signed || typeof signed !== 'string') return null;
    if (!secret) {
        console.error('⚠️ SESSION_SECRET not configured for cookie verification');
        return null;
    }
    
    const lastDot = signed.lastIndexOf('.');
    if (lastDot < 0) return null;
    
    const val = signed.slice(0, lastDot);
    const providedSignature = signed.slice(lastDot + 1);
    
    // Recalcular assinatura
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(val)
        .digest('base64url');
    
    // Comparação timing-safe para prevenir timing attacks
    try {
        const match = crypto.timingSafeEqual(
            Buffer.from(providedSignature),
            Buffer.from(expectedSignature)
        );
        
        return match ? val : null;
    } catch (err) {
        // Buffers de tamanhos diferentes ou outro erro
        return null;
    }
}

/**
 * Base configuration for OAuth fallback cookies
 */
const OAUTH_COOKIE_CONFIG = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: '.editaliza.com.br',
    path: '/auth', // Limitado apenas às rotas de autenticação
    maxAge: 10 * 60 * 1000 // 10 minutos
};

module.exports = {
    signCookie,
    verifyCookie,
    OAUTH_COOKIE_CONFIG
};