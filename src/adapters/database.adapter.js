/**
 * Database Adapter - FASE 4.1 INTEGRATION
 * 
 * Adaptador para transição suave entre queries SQLite legacy e repositories PostgreSQL.
 * Permite migração gradual sem quebrar funcionalidades existentes.
 * 
 * ESTRATÉGIA:
 * 1. Intercepta chamadas dbGet, dbAll, dbRun
 * 2. Redireciona para repositories quando possível
 * 3. Mantém compatibilidade com código legacy
 * 4. Logs para monitoramento da migração
 */

const logger = require('../utils/logger');

class DatabaseAdapter {
    constructor(repositories, legacyDb) {
        this.repos = repositories;
        this.db = legacyDb;
        
        // Contadores para monitoramento
        this.stats = {
            legacyCalls: 0,
            repositoryCalls: 0,
            errors: 0
        };
        
        // Bind methods
        this.dbGet = this.legacyDbGet.bind(this);
        this.dbAll = this.legacyDbAll.bind(this);
        this.dbRun = this.legacyDbRun.bind(this);
    }

    /**
     * Substitui dbGet com inteligência para usar repositories quando possível
     */
    async legacyDbGet(sql, params = []) {
        this.stats.legacyCalls++;
        
        try {
            // Log para monitoramento (apenas primeiros 100 caracteres)
            logger.info(`[DB_ADAPTER] dbGet: ${sql.substring(0, 100)}...`, {
                params: params.length,
                type: 'legacy'
            });

            // Tentar usar repository específico baseado na query
            const repositoryResult = this.tryUseRepository('GET', sql, params);
            if (repositoryResult) {
                this.stats.repositoryCalls++;
                return repositoryResult;
            }

            // Fallback para método legacy
            return new Promise((resolve, reject) => {
                this.db.get(sql, params, (err, row) => {
                    if (err) {
                        this.stats.errors++;
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });

        } catch (error) {
            this.stats.errors++;
            logger.error('[DB_ADAPTER] Error in legacyDbGet:', error);
            throw error;
        }
    }

    /**
     * Substitui dbAll com inteligência para usar repositories quando possível
     */
    async legacyDbAll(sql, params = []) {
        this.stats.legacyCalls++;
        
        try {
            logger.info(`[DB_ADAPTER] dbAll: ${sql.substring(0, 100)}...`, {
                params: params.length,
                type: 'legacy'
            });

            // Tentar usar repository específico
            const repositoryResult = this.tryUseRepository('ALL', sql, params);
            if (repositoryResult) {
                this.stats.repositoryCalls++;
                return repositoryResult;
            }

            // Fallback para método legacy
            return new Promise((resolve, reject) => {
                this.db.all(sql, params, (err, rows) => {
                    if (err) {
                        this.stats.errors++;
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });

        } catch (error) {
            this.stats.errors++;
            logger.error('[DB_ADAPTER] Error in legacyDbAll:', error);
            throw error;
        }
    }

    /**
     * Substitui dbRun com inteligência para usar repositories quando possível
     */
    async legacyDbRun(sql, params = []) {
        this.stats.legacyCalls++;
        
        try {
            logger.info(`[DB_ADAPTER] dbRun: ${sql.substring(0, 100)}...`, {
                params: params.length,
                type: 'legacy'
            });

            // Tentar usar repository específico
            const repositoryResult = this.tryUseRepository('RUN', sql, params);
            if (repositoryResult) {
                this.stats.repositoryCalls++;
                return repositoryResult;
            }

            // Fallback para método legacy
            return new Promise((resolve, reject) => {
                this.db.run(sql, params, function(err) {
                    if (err) {
                        this.stats.errors++;
                        reject(err);
                    } else {
                        resolve(this);
                    }
                });
            });

        } catch (error) {
            this.stats.errors++;
            logger.error('[DB_ADAPTER] Error in legacyDbRun:', error);
            throw error;
        }
    }

    /**
     * Tenta usar repository baseado na análise da query SQL
     * FASE 4.1 - Implementação incremental
     */
    tryUseRepository(method, sql, params) {
        try {
            const sqlLower = sql.toLowerCase().trim();

            // USERS QUERIES
            if (sqlLower.includes('from users') || sqlLower.includes('into users')) {
                return this.handleUsersQuery(method, sqlLower, params);
            }

            // PLANS QUERIES  
            if (sqlLower.includes('from study_plans') || sqlLower.includes('into study_plans')) {
                return this.handlePlansQuery(method, sqlLower, params);
            }

            // SUBJECTS QUERIES
            if (sqlLower.includes('from subjects') || sqlLower.includes('into subjects')) {
                return this.handleSubjectsQuery(method, sqlLower, params);
            }

            // TOPICS QUERIES
            if (sqlLower.includes('from topics') || sqlLower.includes('into topics')) {
                return this.handleTopicsQuery(method, sqlLower, params);
            }

            // SESSIONS QUERIES
            if (sqlLower.includes('from study_sessions') || sqlLower.includes('into study_sessions')) {
                return this.handleSessionsQuery(method, sqlLower, params);
            }

            // Não encontrou correspondência - usar legacy
            return null;

        } catch (error) {
            logger.warn('[DB_ADAPTER] Error trying repository, using legacy:', error.message);
            return null;
        }
    }

    /**
     * Handlers específicos para cada entidade
     */
    async handleUsersQuery(method, sql, params) {
        // SELECT * FROM users WHERE email = ?
        if (method === 'GET' && sql.includes('where email = $1')) {
            return this.repos.user.findByEmail(params[0]);
        }

        // SELECT * FROM users WHERE id = ?
        if (method === 'GET' && sql.includes('where id = $1')) {
            return this.repos.user.findById(params[0]);
        }

        // SELECT * FROM users WHERE google_id = ?
        if (method === 'GET' && sql.includes('where google_id = $1')) {
            return this.repos.user.findByGoogleId(params[0]);
        }

        return null;
    }

    async handlePlansQuery(method, sql, params) {
        // SELECT * FROM study_plans WHERE user_id = ?
        if (method === 'ALL' && sql.includes('where user_id = $1') && sql.includes('order by id desc')) {
            return this.repos.plan.findByUserId(params[0]);
        }

        // SELECT * FROM study_plans WHERE id = ? AND user_id = ?
        if (method === 'GET' && sql.includes('where id = $1 and user_id = $2')) {
            return this.repos.plan.findByIdAndUserId(params[0], params[1]);
        }

        return null;
    }

    async handleSubjectsQuery(method, sql, params) {
        // SELECT * FROM subjects WHERE study_plan_id = ?
        if (method === 'ALL' && sql.includes('where study_plan_id = $1')) {
            return this.repos.subject.findByPlanId(params[0]);
        }

        return null;
    }

    async handleTopicsQuery(method, sql, params) {
        // SELECT * FROM topics WHERE subject_id = ?
        if (method === 'ALL' && sql.includes('where subject_id = $1')) {
            return this.repos.topic.findBySubjectId(params[0]);
        }

        return null;
    }

    async handleSessionsQuery(method, sql, params) {
        // SELECT * FROM study_sessions WHERE user_id = ?
        if (method === 'ALL' && sql.includes('where user_id = $1')) {
            return this.repos.session.findByUserId(params[0]);
        }

        return null;
    }

    /**
     * Métricas para monitoramento da migração
     */
    getStats() {
        const total = this.stats.legacyCalls + this.stats.repositoryCalls;
        return {
            ...this.stats,
            total,
            repositoryUsage: total > 0 ? (this.stats.repositoryCalls / total * 100).toFixed(2) + '%' : '0%',
            errorRate: total > 0 ? (this.stats.errors / total * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Reset de estatísticas (útil para testes)
     */
    resetStats() {
        this.stats = {
            legacyCalls: 0,
            repositoryCalls: 0,
            errors: 0
        };
    }

    /**
     * Log periódico de estatísticas
     */
    logStats() {
        const stats = this.getStats();
        logger.info('[DB_ADAPTER] Migration Stats:', stats);
    }
}

module.exports = DatabaseAdapter;