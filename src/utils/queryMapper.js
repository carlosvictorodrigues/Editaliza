/**
 * MAPEADOR DE QUERIES SQL - EDITALIZA
 * Traduz queries entre SQLite e PostgreSQL
 * Mantém 100% compatibilidade com código existente
 */

const { securityLog } = require('./security');

/**
 * Mapas de tradução SQL
 */
const SQL_MAPPINGS = {
    // Tipos de dados
    dataTypes: {
        sqlite: {
            'INTEGER PRIMARY KEY AUTOINCREMENT': 'SERIAL PRIMARY KEY',
            'INTEGER': 'INTEGER',
            'TEXT': 'TEXT',
            'BOOLEAN': 'BOOLEAN',
            'REAL': 'REAL',
            'DATETIME': 'TIMESTAMP',
            'BLOB': 'BYTEA'
        },
        postgresql: {
            'SERIAL PRIMARY KEY': 'INTEGER PRIMARY KEY AUTOINCREMENT',
            'INTEGER': 'INTEGER',
            'TEXT': 'TEXT',
            'BOOLEAN': 'BOOLEAN',
            'REAL': 'REAL',
            'TIMESTAMP': 'DATETIME',
            'BYTEA': 'BLOB'
        }
    },
    
    // Funções específicas
    functions: {
        sqlite: {
            'CURRENT_TIMESTAMP': 'NOW()',
            'DATETIME(\'now\')': 'NOW()',
            'DATE(\'now\')': 'CURRENT_DATE',
            'SUBSTR(': 'SUBSTRING(',
            'LENGTH(': 'LENGTH(',
            'COALESCE(': 'COALESCE(',
            'RANDOM()': 'RANDOM()',
            'ABS(': 'ABS(',
            'ROUND(': 'ROUND(',
            'LOWER(': 'LOWER(',
            'UPPER(': 'UPPER(',
            'TRIM(': 'TRIM('
        },
        postgresql: {
            'NOW()': 'CURRENT_TIMESTAMP',
            'CURRENT_DATE': 'DATE(\'now\')',
            'SUBSTRING(': 'SUBSTR(',
            'LENGTH(': 'LENGTH(',
            'COALESCE(': 'COALESCE(',
            'RANDOM()': 'RANDOM()',
            'ABS(': 'ABS(',
            'ROUND(': 'ROUND(',
            'LOWER(': 'LOWER(',
            'UPPER(': 'UPPER(',
            'TRIM(': 'TRIM('
        }
    },
    
    // Operadores específicos
    operators: {
        sqlite: {
            'LIKE': 'LIKE',
            'GLOB': 'LIKE', // PostgreSQL não tem GLOB, usar LIKE
            'MATCH': '~', // PostgreSQL usa regex
            '||': '||' // Concatenação
        },
        postgresql: {
            'LIKE': 'LIKE',
            'ILIKE': 'LIKE', // SQLite não tem ILIKE
            '~': 'LIKE', // Fallback para LIKE
            '||': '||'
        }
    },
    
    // Pragmas SQLite (ignorados no PostgreSQL)
    pragmas: [
        'PRAGMA journal_mode',
        'PRAGMA synchronous',
        'PRAGMA cache_size',
        'PRAGMA temp_store',
        'PRAGMA mmap_size',
        'PRAGMA foreign_keys',
        'PRAGMA auto_vacuum'
    ]
};

/**
 * Queries específicas para cada banco
 */
const DIALECT_QUERIES = {
    // Informações de esquema
    tableInfo: {
        sqlite: 'PRAGMA table_info(?)',
        postgresql: `
            SELECT 
                column_name as name,
                data_type as type,
                is_nullable as "notnull",
                column_default as "dflt_value",
                CASE WHEN column_name = 'id' THEN 1 ELSE 0 END as pk
            FROM information_schema.columns 
            WHERE table_name = $1 
            ORDER BY ordinal_position
        `
    },
    
    // Listar tabelas
    listTables: {
        sqlite: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        postgresql: `
            SELECT table_name as name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `
    },
    
    // Verificar se tabela existe
    tableExists: {
        sqlite: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        postgresql: `
            SELECT table_name as name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        `
    },
    
    // Adicionar coluna
    addColumn: {
        sqlite: 'ALTER TABLE "{table}" ADD COLUMN "{column}" {definition}',
        postgresql: 'ALTER TABLE "{table}" ADD COLUMN "{column}" {definition}'
    },
    
    // Verificar se coluna existe
    columnExists: {
        sqlite: 'PRAGMA table_info("{table}")',
        postgresql: `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
        `
    },
    
    // Sequência para IDs
    lastInsertId: {
        sqlite: 'SELECT last_insert_rowid() as id',
        postgresql: 'SELECT lastval() as id'
    },
    
    // Limit e Offset
    pagination: {
        sqlite: 'LIMIT {limit} OFFSET {offset}',
        postgresql: 'LIMIT {limit} OFFSET {offset}'
    }
};

/**
 * Traduzir query entre dialetos
 */
function translateQuery(query, fromDialect, toDialect) {
    if (!query || fromDialect === toDialect) {
        return query;
    }
    
    let translatedQuery = query;
    
    try {
        // Log da tradução
        if (process.env.LOG_SQL_TRANSLATION === 'true') {
            securityLog('sql_translation_start', {
                from: fromDialect,
                to: toDialect,
                original: query.substring(0, 100) + '...'
            });
        }
        
        // 1. Traduzir tipos de dados (apenas em contextos de definição de coluna)
        const dataTypeMap = SQL_MAPPINGS.dataTypes[fromDialect] || {};
        for (const [from, to] of Object.entries(dataTypeMap)) {
            // Apenas substituir tipos quando precedidos por espaço ou começo de linha
            // e seguidos por espaço, vírgula, parênteses ou fim de linha
            const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(^|\\s)${escapedFrom}(?=\\s|,|\\)|$)`, 'gi');
            translatedQuery = translatedQuery.replace(regex, (match, prefix) => {
                return prefix + to;
            });
        }
        
        // 2. Traduzir funções (apenas quando seguidas de parênteses)
        const functionMap = SQL_MAPPINGS.functions[fromDialect] || {};
        for (const [from, to] of Object.entries(functionMap)) {
            // Para funções como CURRENT_TIMESTAMP, DATETIME('now'), etc.
            const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Se a função já tem parênteses, buscar exatamente
            if (from.includes('(')) {
                const regex = new RegExp(escapedFrom, 'gi');
                translatedQuery = translatedQuery.replace(regex, to);
            } else {
                // Se não tem parênteses, buscar palavra completa seguida de espaço ou fim
                const regex = new RegExp(`\\b${escapedFrom}(?=\\s|$|,|\\))`, 'gi');
                translatedQuery = translatedQuery.replace(regex, to);
            }
        }
        
        // 3. Traduzir operadores (apenas palavras completas)
        const operatorMap = SQL_MAPPINGS.operators[fromDialect] || {};
        for (const [from, to] of Object.entries(operatorMap)) {
            const regex = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            translatedQuery = translatedQuery.replace(regex, to);
        }
        
        // 4. Remover PRAGMAs se traduzindo do SQLite para PostgreSQL
        if (fromDialect === 'sqlite' && toDialect === 'postgresql') {
            SQL_MAPPINGS.pragmas.forEach(pragma => {
                const regex = new RegExp(`${pragma}[^;]*;?`, 'gi');
                translatedQuery = translatedQuery.replace(regex, '');
            });
        }
        
        // 5. Traduzir placeholders de parâmetros
        if (fromDialect === 'sqlite' && toDialect === 'postgresql') {
            // SQLite usa ? ou :name, PostgreSQL usa $1, $2, etc.
            translatedQuery = translatedQuery.replace(/\?/g, (match, offset, string) => {
                const paramIndex = (string.substring(0, offset).match(/\?/g) || []).length + 1;
                return `$${paramIndex}`;
            });
        } else if (fromDialect === 'postgresql' && toDialect === 'sqlite') {
            // PostgreSQL $1, $2 -> SQLite ?
            translatedQuery = translatedQuery.replace(/\$\d+/g, '?');
        }
        
        // Log do resultado
        if (process.env.LOG_SQL_TRANSLATION === 'true') {
            securityLog('sql_translation_complete', {
                from: fromDialect,
                to: toDialect,
                translated: translatedQuery.substring(0, 100) + '...'
            });
        }
        
        return translatedQuery.trim();
        
    } catch (error) {
        securityLog('sql_translation_error', {
            error: error.message,
            from: fromDialect,
            to: toDialect,
            query: query.substring(0, 100)
        });
        
        // Em caso de erro, retornar query original
        return query;
    }
}

/**
 * Obter query específica para dialeto
 */
function getDialectQuery(queryType, dialect, params = {}) {
    const queries = DIALECT_QUERIES[queryType];
    if (!queries || !queries[dialect]) {
        throw new Error(`Query '${queryType}' não suportada para dialeto '${dialect}'`);
    }
    
    let query = queries[dialect];
    
    // Substituir parâmetros na query
    for (const [key, value] of Object.entries(params)) {
        const placeholder = `{${key}}`;
        query = query.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return query;
}

/**
 * Traduzir parâmetros entre dialetos
 */
function translateParams(params, fromDialect, toDialect) {
    if (!params || fromDialect === toDialect) {
        return params;
    }
    
    // Array de parâmetros permanece igual
    if (Array.isArray(params)) {
        return params;
    }
    
    // Objeto de parâmetros pode precisar de ajustes
    if (typeof params === 'object') {
        const translated = {};
        
        for (const [key, value] of Object.entries(params)) {
            // Traduzir valores especiais
            let translatedValue = value;
            
            if (typeof value === 'string') {
                // Traduzir funções SQL em valores
                if (fromDialect === 'sqlite' && toDialect === 'postgresql') {
                    if (value === 'CURRENT_TIMESTAMP') translatedValue = 'NOW()';
                    if (value === "DATETIME('now')") translatedValue = 'NOW()';
                } else if (fromDialect === 'postgresql' && toDialect === 'sqlite') {
                    if (value === 'NOW()') translatedValue = 'CURRENT_TIMESTAMP';
                }
            }
            
            translated[key] = translatedValue;
        }
        
        return translated;
    }
    
    return params;
}

/**
 * Mapear resultados entre dialetos
 */
function mapResults(results, fromDialect, toDialect) {
    if (!results || fromDialect === toDialect) {
        return results;
    }
    
    try {
        // Resultados são geralmente arrays de objetos
        if (Array.isArray(results)) {
            return results.map(row => mapSingleResult(row, fromDialect, toDialect));
        }
        
        // Resultado único
        if (typeof results === 'object') {
            return mapSingleResult(results, fromDialect, toDialect);
        }
        
        return results;
        
    } catch (error) {
        securityLog('result_mapping_error', {
            error: error.message,
            from: fromDialect,
            to: toDialect
        });
        return results;
    }
}

/**
 * Mapear resultado individual
 */
function mapSingleResult(row, fromDialect, toDialect) {
    if (!row || typeof row !== 'object') {
        return row;
    }
    
    const mapped = {};
    
    for (const [key, value] of Object.entries(row)) {
        let mappedKey = key;
        let mappedValue = value;
        
        // Mapear nomes de colunas específicos
        if (fromDialect === 'postgresql' && toDialect === 'sqlite') {
            // PostgreSQL information_schema para formato SQLite
            if (key === 'column_name') mappedKey = 'name';
            if (key === 'data_type') mappedKey = 'type';
            if (key === 'is_nullable') {
                mappedKey = 'notnull';
                mappedValue = value === 'NO' ? 1 : 0;
            }
        }
        
        // Mapear valores de data/hora
        if (value instanceof Date) {
            if (toDialect === 'sqlite') {
                mappedValue = value.toISOString();
            } else if (toDialect === 'postgresql') {
                mappedValue = value;
            }
        }
        
        mapped[mappedKey] = mappedValue;
    }
    
    return mapped;
}

/**
 * Verificar se query é específica de um dialeto
 */
function isDialectSpecific(query, dialect) {
    if (!query || typeof query !== 'string') {
        return false;
    }
    
    const lowerQuery = query.toLowerCase();
    
    if (dialect === 'sqlite') {
        return lowerQuery.includes('pragma ') || 
               lowerQuery.includes('autoincrement') ||
               lowerQuery.includes('sqlite_master');
    }
    
    if (dialect === 'postgresql') {
        return lowerQuery.includes('information_schema') ||
               lowerQuery.includes('serial') ||
               lowerQuery.includes('::') || // Type casting
               lowerQuery.includes('$1') || // Parameter placeholder
               lowerQuery.includes('returning');
    }
    
    return false;
}

/**
 * Adaptar CREATE TABLE entre dialetos
 */
function adaptCreateTable(sql, fromDialect, toDialect) {
    if (fromDialect === toDialect) {
        return sql;
    }
    
    let adaptedSql = sql;
    
    if (fromDialect === 'sqlite' && toDialect === 'postgresql') {
        // SQLite -> PostgreSQL
        adaptedSql = adaptedSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
        adaptedSql = adaptedSql.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT NOW()');
        adaptedSql = adaptedSql.replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT TRUE');
        adaptedSql = adaptedSql.replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT FALSE');
    } else if (fromDialect === 'postgresql' && toDialect === 'sqlite') {
        // PostgreSQL -> SQLite
        adaptedSql = adaptedSql.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
        adaptedSql = adaptedSql.replace(/TIMESTAMP DEFAULT NOW\(\)/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        adaptedSql = adaptedSql.replace(/BOOLEAN DEFAULT TRUE/gi, 'BOOLEAN DEFAULT 1');
        adaptedSql = adaptedSql.replace(/BOOLEAN DEFAULT FALSE/gi, 'BOOLEAN DEFAULT 0');
    }
    
    return adaptedSql;
}

module.exports = {
    translateQuery,
    getDialectQuery,
    translateParams,
    mapResults,
    isDialectSpecific,
    adaptCreateTable,
    SQL_MAPPINGS,
    DIALECT_QUERIES
};