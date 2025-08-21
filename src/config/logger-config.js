/**
 * Configuração de Logger Otimizada
 * Controla o que deve ou não aparecer nos logs
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    VERBOSE: 4
};

// Nível de log baseado no ambiente
const currentLevel = process.env.NODE_ENV === 'production' 
    ? LOG_LEVELS.INFO 
    : LOG_LEVELS.DEBUG;

// Configurações do que logar
const logConfig = {
    // Desabilitar logs verbosos em produção
    postgresql: {
        queries: process.env.LOG_SQL === 'true', // Só se explicitamente habilitado
        params: false, // NUNCA logar parâmetros (podem ter dados sensíveis)
        results: false // Não logar resultados completos
    },
    
    security: {
        loginAttempts: true, // Sempre logar tentativas de login
        authErrors: true,    // Sempre logar erros de auth
        queryDetails: false  // Não logar detalhes de queries
    },
    
    performance: {
        slowQueries: true,      // Queries > 1000ms
        slowEndpoints: true,    // Endpoints > 2000ms
        memoryWarnings: true    // Quando usar > 80% da memória
    },
    
    errors: {
        stackTrace: process.env.NODE_ENV !== 'production', // Stack trace só em dev
        userDetails: false  // Não logar dados do usuário em erros
    }
};

// Lista de mensagens para ignorar completamente
const ignorePatterns = [
    /MODULE_NOT_FOUND.*\/opt\/Editaliza-sv/,  // Erro de diretório antigo
    /Failed to prune sessions/,                // Erro já resolvido
    /email service not configured/,            // Warning esperado
    /permission denied.*Permission denied/     // Redundante
];

// Função para filtrar logs
function shouldLog(message, level = LOG_LEVELS.INFO) {
    // Verificar nível
    if (level > currentLevel) return false;
    
    // Verificar padrões ignorados
    if (typeof message === 'string') {
        for (const pattern of ignorePatterns) {
            if (pattern.test(message)) return false;
        }
    }
    
    return true;
}

// Logger customizado
class CleanLogger {
    constructor(category) {
        this.category = category;
        this.startTime = Date.now();
    }
    
    error(message, data = {}) {
        if (!shouldLog(message, LOG_LEVELS.ERROR)) return;
        
        const log = {
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            category: this.category,
            message,
            ...(logConfig.errors.stackTrace && data.stack ? { stack: data.stack } : {})
        };
        
        console.error(this.format(log));
    }
    
    warn(message, data = {}) {
        if (!shouldLog(message, LOG_LEVELS.WARN)) return;
        
        const log = {
            timestamp: new Date().toISOString(),
            level: 'WARN',
            category: this.category,
            message
        };
        
        console.warn(this.format(log));
    }
    
    info(message, data = {}) {
        if (!shouldLog(message, LOG_LEVELS.INFO)) return;
        
        const log = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            category: this.category,
            message
        };
        
        console.log(this.format(log));
    }
    
    debug(message, data = {}) {
        if (!shouldLog(message, LOG_LEVELS.DEBUG)) return;
        
        // Não logar em produção
        if (process.env.NODE_ENV === 'production') return;
        
        const log = {
            timestamp: new Date().toISOString(),
            level: 'DEBUG',
            category: this.category,
            message,
            data
        };
        
        console.log(this.format(log));
    }
    
    // Métricas de performance
    performance(operation, duration) {
        if (duration > 1000 && logConfig.performance.slowQueries) {
            this.warn(`Operação lenta: ${operation} (${duration}ms)`);
        }
    }
    
    // Formato limpo e conciso
    format(log) {
        const time = new Date(log.timestamp).toLocaleTimeString('pt-BR');
        const level = log.level.padEnd(5);
        const category = log.category ? `[${log.category}]` : '';
        
        // Formato compacto para produção
        if (process.env.NODE_ENV === 'production') {
            return `${time} ${level} ${category} ${log.message}`;
        }
        
        // Formato mais detalhado para desenvolvimento
        return `${time} ${level} ${category} ${log.message} ${log.data ? JSON.stringify(log.data) : ''}`;
    }
}

// Factory para criar loggers por categoria
function createLogger(category) {
    return new CleanLogger(category);
}

// Logger para PostgreSQL com filtros
function logPostgres(query, params, result) {
    if (!logConfig.postgresql.queries) return;
    
    const logger = createLogger('DB');
    
    // Simplificar query para log
    const simplifiedQuery = query
        .replace(/\s+/g, ' ')
        .substring(0, 100) + (query.length > 100 ? '...' : '');
    
    logger.debug(simplifiedQuery);
}

// Logger para segurança com filtros
function logSecurity(event, data) {
    if (!logConfig.security.loginAttempts && event === 'login_attempt') return;
    if (!logConfig.security.authErrors && event.includes('auth_error')) return;
    
    const logger = createLogger('SECURITY');
    
    // Remover dados sensíveis
    const safeData = { ...data };
    delete safeData.password;
    delete safeData.token;
    delete safeData.password_hash;
    
    logger.info(event, safeData);
}

module.exports = {
    createLogger,
    logPostgres,
    logSecurity,
    logConfig,
    shouldLog
};