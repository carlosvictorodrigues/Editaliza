/**
 * TEST SETUP CONFIGURATION
 * 
 * Configuração específica para ambiente de testes
 * - Inicialização controlada do servidor
 * - Mock de dependências externas
 * - Configuração de banco de dados de teste
 */

const express = require('express');
const { startServer } = require('../../server');

let testApp;
let testServer;

/**
 * Inicializar servidor para testes
 * @returns {Promise<express.Application>} Instância do app Express
 */
async function setupTestServer() {
    if (testApp) {
        return testApp;
    }

    try {
        // Configurar variáveis de ambiente para teste
        process.env.NODE_ENV = 'test';
        process.env.PORT = 0; // Usar porta aleatória para testes

        // Inicializar servidor
        testServer = await startServer();
        
        // Para testes, precisamos do app Express diretamente
        // Como o startServer retorna um server HTTP, vamos extrair o app
        testApp = testServer._connectionKey ? testServer : testServer.app;

        console.log('✅ Servidor de teste inicializado');
        return testApp;
    } catch (error) {
        console.error('❌ Erro ao inicializar servidor de teste:', error);
        throw error;
    }
}

/**
 * Fechar servidor de teste
 */
async function teardownTestServer() {
    if (testServer && typeof testServer.close === 'function') {
        await new Promise((resolve) => {
            testServer.close(resolve);
        });
        testServer = null;
        testApp = null;
        console.log('✅ Servidor de teste fechado');
    }
}

/**
 * Limpar dados de teste do banco
 */
async function cleanTestData() {
    const { dbRun } = require('../../src/utils/database');
    try {
        // Limpar dados de teste (emails com 'test' no nome)
        await dbRun('DELETE FROM users WHERE email LIKE $1', ['%test%']);
        await dbRun('DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users)');
        console.log('✅ Dados de teste limpos');
    } catch (error) {
        console.warn('⚠️ Erro ao limpar dados de teste:', error.message);
    }
}

module.exports = {
    setupTestServer,
    teardownTestServer,
    cleanTestData
};