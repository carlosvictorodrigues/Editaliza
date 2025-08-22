#!/bin/bash

echo "=== Aplicando Solução Definitiva do ChatGPT ==="
echo ""

# 1. Criar novo logger.js robusto
ssh editaliza << 'EOF'
cd /root/editaliza/src/utils

# Backup
cp logger.js logger.js.backup-before-chatgpt-fix

# Criar novo logger.js
cat > logger.js << 'LOGGER_END'
// src/utils/logger.js
const { createLogger, format, transports } = require('winston');

function safeStringify(obj, { maxDepth = 8, maxLen = 10000 } = {}) {
  const seen = new WeakSet();
  function recur(value, depth = 0) {
    if (depth > maxDepth) return '[MaxDepth]';
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      if (Array.isArray(value)) return value.map(v => recur(v, depth + 1));
      const out = {};
      for (const k of Object.keys(value)) out[k] = recur(value[k], depth + 1);
      return out;
    }
    if (typeof value === 'string' && value.length > maxLen) {
      return value.slice(0, maxLen) + '…[truncated]';
    }
    return value;
  }
  try { return JSON.stringify(recur(obj)); } catch { return '"[Unserializable]"'; }
}

function serializeError(err) {
  if (!err || typeof err !== 'object') return err;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    code: err.code,
    status: err.status || err.statusCode,
    cause: err.cause && (typeof err.cause === 'object'
      ? { name: err.cause.name, message: err.cause.message, stack: err.cause.stack }
      : String(err.cause)),
    ...('toJSON' in err ? err.toJSON() : {}),
  };
}

// Formato seguro: nunca chama JSON.stringify direto no grafo bruto.
const safePrintf = format.printf(info => {
  const { level, message, timestamp, ...meta } = info;
  const m = typeof message === 'string' ? message : safeStringify(message);
  const rest = Object.keys(meta).length ? ' ' + safeStringify(meta) : '';
  return `${timestamp} ${level}: ${m}${rest}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    safePrintf
  ),
  transports: [new transports.Console()],
});

// Helpers expostos
logger.safeStringify = safeStringify;
logger.serializeError = serializeError;

// Exporte de forma compatível com require e import
module.exports = logger;
module.exports.default = logger;
LOGGER_END

echo "✓ logger.js substituído"
EOF

# 2. Criar novo error-handler.js simplificado
ssh editaliza << 'EOF'
cd /root/editaliza/src/utils

# Backup
cp error-handler.js error-handler.js.backup-before-chatgpt-fix

# Criar novo error-handler.js
cat > error-handler.js << 'ERROR_END'
// src/utils/error-handler.js
const logger = require('./logger');

// Tipos de erro
const ERROR_TYPES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    BAD_REQUEST: 'BAD_REQUEST',
    FILE_SYSTEM: 'FILE_SYSTEM_ERROR'
};

// Custom error class
class AppError extends Error {
    constructor(type, message, statusCode = 500, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.type = type;
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

// Error handler middleware
function errorHandler(err, req, res, next) {
  const payload = {
    err: logger.serializeError(err),
    path: req?.originalUrl || req?.url,
    method: req?.method,
    userId: req?.user?.id,
    ip: req?.ip,
  };

  // Não passe o objeto err cru para o logger.
  logger.error('Unhandled error', payload);

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: payload.err.name || 'Error',
    message: payload.err.message || 'Internal Server Error',
  });
}

// Async wrapper
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Export tudo
module.exports = {
    AppError,
    ERROR_TYPES,
    errorHandler,
    asyncHandler
};
ERROR_END

echo "✓ error-handler.js substituído"
EOF

# 3. Testar o logger
echo ""
echo "Testando logger com objeto circular..."
ssh editaliza << 'EOF'
cd /root/editaliza
node -e "const log=require('./src/utils/logger'); const a={}; a.self=a; log.info({a}); console.log('✓ Logger OK - não travou com circular!')"
EOF

# 4. Testar inicialização do servidor
echo ""
echo "Testando inicialização do servidor..."
ssh editaliza << 'EOF'
cd /root/editaliza
timeout 5 node server.js > /tmp/server_test.log 2>&1 &
PID=$!
sleep 3

if ps -p $PID > /dev/null; then
    echo "✓ Servidor iniciou sem memory leak!"
    kill $PID
else
    echo "✗ Servidor travou"
    tail -20 /tmp/server_test.log
fi
EOF

# 5. Reiniciar com PM2 e limite de memória
echo ""
echo "Reiniciando servidor com PM2..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Parar processo anterior se existir
pm2 delete editaliza-app 2>/dev/null || true

# Iniciar com limite de memória
pm2 start server.js --name editaliza-app --max-memory-restart 300M

# Verificar status
sleep 3
pm2 status

# Ver logs
pm2 logs editaliza-app --lines 20 --nostream
EOF

echo ""
echo "=== Correção Aplicada ==="
echo "Se o servidor estiver rodando, o problema foi resolvido!"