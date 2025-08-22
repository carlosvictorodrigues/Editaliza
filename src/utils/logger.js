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
