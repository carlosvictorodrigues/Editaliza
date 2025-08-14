/**
 * OTIMIZAÇÕES DE PERFORMANCE DO BANCO DE DADOS
 * Previne problemas N+1 e implementa transações atômicas
 */

const db = require('../../database');

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
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                let completedQueries = 0;
                let hasError = false;

                const executeNext = () => {
                    if (completedQueries >= this.queries.length) {
                        if (hasError) {
                            db.run('ROLLBACK', (err) => {
                                if (err) console.error('Erro no rollback:', err);
                                reject(new Error('Transação falhou e foi revertida'));
                            });
                        } else {
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('Erro no commit:', err);
                                    reject(err);
                                } else {
                                    resolve('Transação executada com sucesso');
                                }
                            });
                        }
                        return;
                    }

                    const { query, params } = this.queries[completedQueries];
                    
                    db.run(query, params, function(err) {
                        if (err) {
                            console.error(`Erro na query ${completedQueries + 1}:`, err);
                            hasError = true;
                        }
                        completedQueries++;
                        executeNext();
                    });
                };

                executeNext();
            });
        });
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

        db.all(optimizedQuery, conditions, (err, rows) => {
            if (err) {
                return reject(err);
            }

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

        db.all(query, [planId], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
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

        db.all(query, params, (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
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