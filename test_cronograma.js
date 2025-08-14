const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Dados de teste
const TEST_USER_CREDENTIALS = {
    email: 'c@c.com',
    password: '123456'
};

const TEST_PLAN_ID = 1017; // TJPE2025

const TEST_CRONOGRAMA_DATA = {
    daily_question_goal: 50,
    weekly_question_goal: 300,
    session_duration_minutes: 90,
    study_hours_per_day: {"0":4,"1":8,"2":8,"3":8,"4":8,"5":8,"6":4},
    has_essay: true,
    reta_final_mode: true
};

/**
 * Get auth token for testing
 */
const getAuthToken = async () => {
    try {
        console.log('🔐 Fazendo login para obter token...');
        
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, TEST_USER_CREDENTIALS);
        
        if (loginResponse.data.token) {
            console.log('✅ Token obtido com sucesso');
            return loginResponse.data.token;
        } else {
            throw new Error('Token não retornado no login');
        }
    } catch (error) {
        console.error('❌ Falha ao obter token de autenticação:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Test cronograma generation
 */
const testCronogramaGeneration = async (token) => {
    try {
        console.log(`\n📅 Testando geração de cronograma para plano ${TEST_PLAN_ID}...`);
        
        const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        console.log('📤 Enviando dados:', JSON.stringify(TEST_CRONOGRAMA_DATA, null, 2));
        
        const response = await axios.post(`${BASE_URL}/plans/${TEST_PLAN_ID}/generate`, TEST_CRONOGRAMA_DATA, { headers });
        
        console.log('✅ Cronograma gerado com sucesso!');
        console.log('📊 Resposta:', JSON.stringify(response.data, null, 2));
        
        return response.data;
        
    } catch (error) {
        console.error('❌ Erro ao gerar cronograma:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Stack:', error.stack);
        throw error;
    }
};

/**
 * Test cronograma retrieval
 */
const testCronogramaRetrieval = async (token) => {
    try {
        console.log(`\n📋 Testando recuperação de cronograma para plano ${TEST_PLAN_ID}...`);
        
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const response = await axios.get(`${BASE_URL}/plans/${TEST_PLAN_ID}/sessions`, { headers });
        
        console.log('✅ Cronograma recuperado com sucesso!');
        console.log(`📊 Total de sessões: ${response.data.length}`);
        
        if (response.data.length > 0) {
            console.log('📅 Primeira sessão:', JSON.stringify(response.data[0], null, 2));
        }
        
        return response.data;
        
    } catch (error) {
        console.error('❌ Erro ao recuperar cronograma:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
};

/**
 * Main test function
 */
const runTests = async () => {
    try {
        console.log('🚀 Iniciando testes do cronograma...\n');
        
        // 1. Get authentication token
        const token = await getAuthToken();
        
        // 2. Test cronograma generation
        await testCronogramaGeneration(token);
        
        // 3. Test cronograma retrieval
        await testCronogramaRetrieval(token);
        
        console.log('\n🎉 Todos os testes passaram com sucesso!');
        
    } catch (error) {
        console.error('\n💥 Teste falhou:', error.message);
        process.exit(1);
    }
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests, getAuthToken, testCronogramaGeneration, testCronogramaRetrieval };