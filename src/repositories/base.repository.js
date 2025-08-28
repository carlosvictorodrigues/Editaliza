/**
 * Base Repository
 * Classe base com métodos comuns para todos os repositories
 * Implementa padrões de acesso a dados e tratamento de erros
 */

class BaseRepository {
    constructor(db) {
        if (!db) {
            throw new Error('Database instance is required for repository');
        }
        
        // DEBUG: Ver que tipo de db está sendo passado
        console.log('[BASE_REPOSITORY] Inicializado com db:', {
            constructor: db.constructor?.name,
            hasRun: typeof db.run,
            hasGet: typeof db.get,
            hasAll: typeof db.all,
            isAdapter: !!db.legacyDbRun
        });
        
        this.db = db;
    }

    /**
     * Executa uma query SELECT e retorna múltiplos resultados
     */
    async findAll(query, params = []) {
        try {
            const result = await this.db.all(query, params);
            return result || [];
        } catch (error) {
            console.error('Repository findAll error:', error);
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Executa uma query SELECT e retorna um único resultado
     */
    async findOne(query, params = []) {
        try {
            // Usar db.get sem callback retorna Promise
            const result = await this.db.get(query, params);
            return result || null;
        } catch (error) {
            console.error('Repository findOne error:', error);
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Executa uma query INSERT e retorna o ID inserido
     * FASE 4.1 - CORRIGIDO PARA POSTGRESQL
     */
    async create(query, params = []) {
        try {
            console.log('[BASE_REPO] CREATE - Query:', query.substring(0, 100) + '...');
            console.log('[BASE_REPO] CREATE - Params:', params);
            
            // Para PostgreSQL, sempre use RETURNING para obter ID
            let finalQuery = query;
            if (!query.toUpperCase().includes('RETURNING') && query.toUpperCase().includes('INSERT')) {
                finalQuery = query.replace(/;?$/, ' RETURNING id;');
                console.log('[BASE_REPO] CREATE - Adicionado RETURNING id');
            }
            
            const result = await this.db.get(finalQuery, params);
            console.log('[BASE_REPO] CREATE - Result:', result);
            
            // Para PostgreSQL com RETURNING, retorna o ID diretamente
            if (result && result.id !== undefined) {
                console.log('[BASE_REPO] CREATE - ID encontrado:', result.id, typeof result.id);
                return result.id;
            }
            
            // Fallback
            console.warn('[BASE_REPO] CREATE - ID não encontrado no result, usando fallback');
            return result?.lastID || result;
        } catch (error) {
            console.error('[BASE_REPO] Repository create error:', error);
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Executa qualquer query (usado para queries complexas)
     */
    async execute(query, params = []) {
        try {
            if (query.trim().toUpperCase().startsWith('SELECT')) {
                return this.findAll(query, params);
            } else {
                const result = await this.db.run(query, params);
                return result;
            }
        } catch (error) {
            console.error('Repository execute error:', error);
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Executa uma query UPDATE e retorna número de linhas afetadas
     */
    async update(query, params = []) {
        try {
            const result = await this.db.run(query, params);
            return result.changes || 0;
        } catch (error) {
            console.error('Repository update error:', error);
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Executa uma query DELETE e retorna número de linhas afetadas
     */
    async delete(query, params = []) {
        try {
            const result = await this.db.run(query, params);
            return result.changes || 0;
        } catch (error) {
            console.error('Repository delete error:', error);
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Executa uma transação com múltiplas queries
     * COMPATIBILIDADE: PostgreSQL usa BEGIN, SQLite usa BEGIN TRANSACTION
     */
    async transaction(callback) {
        try {
            // PostgreSQL correto: apenas BEGIN
            await this.db.run('BEGIN');
            const result = await callback(this);
            await this.db.run('COMMIT');
            return result;
        } catch (error) {
            try {
                await this.db.run('ROLLBACK');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
            console.error('Repository transaction error:', error);
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Conta registros com condições opcionais
     */
    async count(table, conditions = '', params = []) {
        try {
            const whereClause = conditions ? `WHERE ${conditions}` : '';
            const query = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
            const result = await this.db.get(query, params);
            return result?.count || 0;
        } catch (error) {
            console.error('Repository count error:', error);
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Verifica se um registro existe
     */
    async exists(table, conditions, params = []) {
        const count = await this.count(table, conditions, params);
        return count > 0;
    }

    /**
     * Tratamento padronizado de erros de banco de dados
     */
    handleDatabaseError(error) {
        // Erros SQLite
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return new Error('Registro duplicado');
        }
        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return new Error('Violação de chave estrangeira');
        }
        
        // Erros PostgreSQL
        if (error.code === '23505') { // unique_violation
            return new Error('Registro duplicado');
        }
        if (error.code === '23503') { // foreign_key_violation
            return new Error('Violação de chave estrangeira');
        }
        if (error.code === '42P01') { // undefined_table
            return new Error('Tabela não encontrada');
        }
        if (error.code === '42703') { // undefined_column
            return new Error('Coluna não encontrada');
        }
        
        // Erros gerais
        if (error.message?.includes('no such table')) {
            return new Error('Tabela não encontrada');
        }
        if (error.message?.includes('no such column')) {
            return new Error('Coluna não encontrada');
        }
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            return new Error('Tabela não encontrada');
        }
        
        return error;
    }

    /**
     * Helpers para construção de queries (PostgreSQL $1, $2, ...)
     */
    buildInsertQuery(table, data) {
        const columns = Object.keys(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(data);
        
        return {
            query: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            params: values
        };
    }

    buildUpdateQuery(table, data, conditions, conditionParams = []) {
        const columns = Object.keys(data);
        const updates = columns.map((key, i) => `${key} = $${i + 1}`).join(', ');
        const values = Object.values(data);
        // const startIndex = values.length + 1; // unused
        
        return {
            query: `UPDATE ${table} SET ${updates} WHERE ${conditions}`,
            params: [...values, ...conditionParams]
        };
    }

    /**
     * Helper para sanitização de inputs
     */
    sanitize(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    }

    /**
     * Helper para paginação (PostgreSQL)
     */
    paginate(query, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        return `${query} LIMIT $${1} OFFSET $${2}`;
    }

    /**
     * Helper para converter valores temporais
     */
    getCurrentTimestamp() {
        // PostgreSQL padrão
        return 'CURRENT_TIMESTAMP';
    }

    /**
     * Helper para datas
     */
    getCurrentDate() {
        return 'CURRENT_DATE';
    }
}

module.exports = BaseRepository;