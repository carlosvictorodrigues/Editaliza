// Gerador de nonce para CSP segura
const crypto = require('crypto');

const generateNonce = () => {
    return crypto.randomBytes(16).toString('base64');
};

module.exports = { generateNonce };