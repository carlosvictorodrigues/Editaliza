// tests/database-test-pg.js - Configuração de banco PostgreSQL para testes
const { Client } = require('pg');

// Cliente de teste
let testClient = null;

// Configuração do banco de teste
const testDbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || 'Editaliza@2025#Secure'
};

const createTestDatabase = async () => {
    try {
        // Conectar ao banco
        testClient = new Client(testDbConfig);
        await testClient.connect();
        
        // Criar tabelas necessárias para testes
        await testClient.query(`
            CREATE TABLE IF NOT EXISTS test_users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await testClient.query(`
            CREATE TABLE IF NOT EXISTS test_study_plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES test_users(id),
                plan_name VARCHAR(255) NOT NULL,
                exam_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.info('✅ Banco de teste PostgreSQL criado');
        return testClient;
        
    } catch (error) {
        console.error('Erro ao criar banco de teste:', error);
        throw error;
    }
};

const clearTestDatabase = async () => {
    if (!testClient) return;
    
    try {
        // Limpar dados das tabelas de teste
        await testClient.query('TRUNCATE TABLE test_study_plans CASCADE');
        await testClient.query('TRUNCATE TABLE test_users CASCADE');
        console.info('🧹 Banco de teste limpo');
    } catch (error) {
        console.error('Erro ao limpar banco de teste:', error);
    }
};

const closeTestDatabase = async () => {
    if (!testClient) return;
    
    try {
        // Remover tabelas de teste
        await testClient.query('DROP TABLE IF EXISTS test_study_plans CASCADE');
        await testClient.query('DROP TABLE IF EXISTS test_users CASCADE');
        
        // Fechar conexão
        await testClient.end();
        testClient = null;
        console.info('📴 Conexão com banco de teste fechada');
    } catch (error) {
        console.error('Erro ao fechar banco de teste:', error);
    }
};

const getTestDatabase = () => testClient;

module.exports = {
    createTestDatabase,
    clearTestDatabase,
    closeTestDatabase,
    getTestDatabase
};