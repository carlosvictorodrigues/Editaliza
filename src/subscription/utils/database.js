// database.js - Wrapper para compatibilidade Promise com SQLite
const originalDb = require('../../../database-postgresql.js');

class DatabaseWrapper {
    constructor(db) {
        this.db = db;
    }

    /**
     * Executa query que retorna uma única linha
     * @param {string} sql - Query SQL
     * @param {Array} params - Parâmetros da query
     * @returns {Promise<Object|null>} - Resultado da query
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    /**
     * Executa query que retorna múltiplas linhas
     * @param {string} sql - Query SQL
     * @param {Array} params - Parâmetros da query
     * @returns {Promise<Array>} - Resultado da query
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Executa query de modificação (INSERT, UPDATE, DELETE)
     * @param {string} sql - Query SQL
     * @param {Array} params - Parâmetros da query
     * @returns {Promise<Object>} - Resultado com lastID e changes
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }

    /**
     * Executa múltiplas queries em transação
     * @param {Function} callback - Função que recebe o wrapper da transação
     * @returns {Promise<any>} - Resultado da transação
     */
    async transaction(callback) {
        await this.run('BEGIN TRANSACTION');
        
        try {
            const result = await callback(this);
            await this.run('COMMIT');
            return result;
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    /**
     * Fecha a conexão com o banco
     * @returns {Promise<void>}
     */
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Executa PRAGMA
     * @param {string} pragma - Comando PRAGMA
     * @returns {Promise<any>} - Resultado do PRAGMA
     */
    pragma(pragma) {
        return this.get(`PRAGMA ${pragma}`);
    }

    /**
     * Obtém informações de uma tabela
     * @param {string} tableName - Nome da tabela
     * @returns {Promise<Array>} - Informações das colunas
     */
    async getTableInfo(tableName) {
        // Validar nome da tabela para segurança
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
            throw new Error('Nome de tabela inválido');
        }
        
        return await this.all(`PRAGMA table_info("${tableName}")`);
    }

    /**
     * Verifica se uma tabela existe
     * @param {string} tableName - Nome da tabela
     * @returns {Promise<boolean>} - Se a tabela existe
     */
    async tableExists(tableName) {
        const result = await this.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tableName]
        );
        return !!result;
    }

    /**
     * Lista todas as tabelas
     * @returns {Promise<Array>} - Lista de nomes de tabelas
     */
    async listTables() {
        const rows = await this.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        return rows.map(row => row.name);
    }

    /**
     * Obtém estatísticas do banco
     * @returns {Promise<Object>} - Estatísticas
     */
    async getStats() {
        const [pageCount, pageSize, freePages] = await Promise.all([
            this.pragma('page_count'),
            this.pragma('page_size'),
            this.pragma('freelist_count')
        ]);

        const totalSize = pageCount.page_count * pageSize.page_size;
        const freeSize = freePages.freelist_count * pageSize.page_size;
        const usedSize = totalSize - freeSize;

        return {
            totalSize,
            usedSize,
            freeSize,
            pages: {
                total: pageCount.page_count,
                free: freePages.freelist_count,
                used: pageCount.page_count - freePages.freelist_count
            },
            pageSize: pageSize.page_size
        };
    }

    /**
     * Executa VACUUM para otimizar o banco
     * @returns {Promise<void>}
     */
    async vacuum() {
        await this.run('VACUUM');
    }

    /**
     * Executa ANALYZE para atualizar estatísticas
     * @returns {Promise<void>}
     */
    async analyze() {
        await this.run('ANALYZE');
    }

    /**
     * Verifica integridade do banco
     * @returns {Promise<Object>} - Resultado da verificação
     */
    async checkIntegrity() {
        const result = await this.get('PRAGMA integrity_check');
        return {
            isValid: result.integrity_check === 'ok',
            message: result.integrity_check
        };
    }
}

// Criar wrapper da instância existente
const dbWrapper = new DatabaseWrapper(originalDb);

module.exports = dbWrapper;