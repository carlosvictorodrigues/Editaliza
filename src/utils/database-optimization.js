/**
 * OTIMIZAÇÕES DE PERFORMANCE DO BANCO DE DADOS
 * Previne problemas N+1 e implementa transações atômicas
 */

const { dbGet, dbAll, dbRun } = require('./database');

/**
 * Classe para gerenciar transações atômicas
 */
class DatabaseTransaction {
    constructor() {
        this.queries = [];
        this.rollbackQueries = [];
    }

    /**
     * Adicionar query à transação
     * @param {string} query - SQL query
     * @param {Array} params - Parâmetros da query
     * @param {string} rollbackQuery - Query para rollback (opcional)
     * @param {Array} rollbackParams - Parâmetros do rollback (opcional)
     */
    addQuery(query, params = [], rollbackQuery = null, rollbackParams = []) {
        this.queries.push({ query, params });
        if (rollbackQuery) {
            this.rollbackQueries.unshift({ query: rollbackQuery, params: rollbackParams });
        }
    }

    /**
     * Executar todas as queries em uma transação atômica
     * @returns {Promise} - Resultado da transação
     */
    async execute() {
        try {
            await dbRun('BEGIN TRANSACTION');
            
            for (const { query, params } of this.queries) {
                await dbRun(query, params);
            }
            
            await dbRun('COMMIT');
            return 'Transação executada com sucesso';
        } catch (error) {
            console.error('Erro na transação:', error);
            try {
                await dbRun('ROLLBACK');
            } catch (rollbackError) {
                console.error('Erro no rollback:', rollbackError);
            }
            throw new Error('Transação falhou e foi revertida');
        }
    }
}

/**
 * Executar múltiplas queries de forma otimizada (previne N+1)
 * @param {string} baseQuery - Query base
 * @param {Array} conditions - Array de condições para IN clause
 * @param {string} keyField - Campo chave para agrupamento
 * @returns {Promise<Object>} - Resultados agrupados por chave
 */
function executeOptimizedBatch(baseQuery, conditions, keyField) {
    return new Promise((resolve, reject) => {
        if (!conditions || conditions.length === 0) {
            return resolve({});
        }

        // Criar placeholders para IN clause
        const placeholders = conditions.map(() => '?').join(',');
        const optimizedQuery = baseQuery.replace('?', `(${placeholders})`);

        dbAll(optimizedQuery, conditions).then(rows => {
            // Agrupar resultados por chave
            const groupedResults = {};
            rows.forEach(row => {
                const key = row[keyField];
                if (!groupedResults[key]) {
                    groupedResults[key] = [];
                }
                groupedResults[key].push(row);
            });

            resolve(groupedResults);
        }).catch(err => {
            reject(err);
        });
    });
}

/**
 * Buscar dados relacionados de forma otimizada
 * @param {Array} parentIds - IDs dos registros pais
 * @param {string} tableName - Nome da tabela filha
 * @param {string} foreignKey - Chave estrangeira
 * @param {string} additionalWhere - Condições WHERE adicionais
 * @returns {Promise<Object>} - Dados relacionados agrupados
 */
async function fetchRelatedData(parentIds, tableName, foreignKey, additionalWhere = '') {
    if (!parentIds || parentIds.length === 0) {
        return {};
    }

    const placeholders = parentIds.map(() => '?').join(',');
    const whereClause = additionalWhere ? `AND ${additionalWhere}` : '';
    
    const query = `
        SELECT * FROM ${tableName} 
        WHERE ${foreignKey} IN (${placeholders}) ${whereClause}
        ORDER BY ${foreignKey}
    `;

    return executeOptimizedBatch(query, parentIds, foreignKey);
}

/**
 * Buscar tópicos com suas disciplinas de forma otimizada
 * @param {number} planId - ID do plano de estudo
 * @returns {Promise<Array>} - Tópicos com disciplinas
 */
async function fetchTopicsWithSubjects(planId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                t.id,
                t.description,
                t.status,
                t.completion_date,
                t.priority_weight as topic_priority,
                s.id as subject_id,
                s.subject_name,
                s.priority_weight as subject_priority
            FROM topics t
            INNER JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = ?
            ORDER BY s.priority_weight DESC, t.priority_weight DESC
        `;

        dbAll(query, [planId]).then(rows => {
            resolve(rows);
        }).catch(err => {
            reject(err);
        });
    });
}

/**
 * Buscar sessões de estudo com dados relacionados de forma otimizada
 * @param {number} planId - ID do plano de estudo
 * @param {string} dateFilter - Filtro de data (opcional)
 * @returns {Promise<Array>} - Sessões com dados relacionados
 */
async function fetchSessionsWithRelatedData(planId, dateFilter = null) {
    return new Promise((resolve, reject) => {
        let query = `
            SELECT 
                ss.id,
                ss.topic_id,
                ss.subject_name,
                ss.topic_description,
                ss.session_date,
                ss.session_type,
                ss.status,
                ss.notes,
                ss.questions_solved,
                ss.time_studied_seconds,
                ss.postpone_count,
                t.priority_weight as topic_priority,
                s.priority_weight as subject_priority
            FROM study_sessions ss
            LEFT JOIN topics t ON ss.topic_id = t.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            WHERE ss.study_plan_id = ?
        `;

        const params = [planId];

        if (dateFilter) {
            query += ` AND ss.session_date = ?`;
            params.push(dateFilter);
        }

        query += ` ORDER BY ss.session_date DESC`;

        dbAll(query, params).then(rows => {
            resolve(rows);
        }).catch(err => {
            reject(err);
        });
    });
}

/**
 * Atualizar múltiplos tópicos de forma otimizada
 * @param {Array} updates - Array de atualizações {id, status, completion_date}
 * @param {number} userId - ID do usuário para validação
 * @returns {Promise} - Resultado da operação
 */
async function updateMultipleTopics(updates, userId) {
    const transaction = new DatabaseTransaction();

    for (const update of updates) {
        const query = `
            UPDATE topics SET status = ?, completion_date = ?
            WHERE id = ? AND subject_id IN (
                SELECT s.id FROM subjects s 
                INNER JOIN study_plans sp ON s.study_plan_id = sp.id
                WHERE sp.user_id = ?
            )
        `;
        
        transaction.addQuery(query, [
            update.status,
            update.completion_date,
            update.id,
            userId
        ]);
    }

    return transaction.execute();
}

/**
 * Cache simples em memória para queries frequentes
 */
class QueryCache {
    constructor(ttl = 300000) { // 5 minutos padrão
        this.cache = new Map();
        this.ttl = ttl;
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + this.ttl
        });
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

// Instância global do cache
const globalCache = new QueryCache();

/**
 * Wrapper para executar queries com cache
 * @param {string} cacheKey - Chave do cache
 * @param {Function} queryFn - Função que executa a query
 * @returns {Promise} - Resultado da query (cachado ou novo)
 */
async function executeCachedQuery(cacheKey, queryFn) {
    // Verificar cache primeiro
    const cachedResult = globalCache.get(cacheKey);
    if (cachedResult !== null) {
        return cachedResult;
    }

    // Executar query e cachear resultado
    const result = await queryFn();
    globalCache.set(cacheKey, result);
    return result;
}

module.exports = {
    DatabaseTransaction,
    executeOptimizedBatch,
    fetchRelatedData,
    fetchTopicsWithSubjects,
    fetchSessionsWithRelatedData,
    updateMultipleTopics,
    QueryCache,
    globalCache,
    executeCachedQuery
};