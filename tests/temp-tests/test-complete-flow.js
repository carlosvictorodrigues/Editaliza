// Teste completo do fluxo da aplicação Editaliza
require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:3000';
let authToken = '';
let userId = null;
let planId = null;
let sessionIds = [];

// Função auxiliar para fazer requisições
async function apiRequest(method, endpoint, data = null, token = null) {
    const config = {
        method,
        url: \,
        headers: {}
    };
    
    if (token) {
        config.headers['Authorization'] = \;
    }
    
    if (data) {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status 
        };
    }
}

async function runCompleteTest() {
    console.log('🚀 INICIANDO TESTE COMPLETO DO SISTEMA EDITALIZA\n');
    
    // 1. LOGIN
    console.log('1️⃣ FAZENDO LOGIN...');
    const loginResult = await apiRequest('POST', '/api/auth/login', {
        email: 'ui@ui.com',
        password: '123456'
    });
    
    if (\!loginResult.success) {
        console.error('❌ Erro no login:', loginResult.error);
        return;
    }
    
    authToken = loginResult.data.token;
    userId = loginResult.data.user.id;
    console.log('✅ Login bem-sucedido\!');
    console.log('   User ID:', userId);
    
    // 2. BUSCAR PLANOS EXISTENTES
    console.log('\n2️⃣ VERIFICANDO PLANOS EXISTENTES...');
    const plansResult = await apiRequest('GET', '/api/plans', null, authToken);
    
    if (plansResult.success && plansResult.data.length > 0) {
        console.log('✅ Planos encontrados:', plansResult.data.length);
        plansResult.data.forEach(plan => {
            console.log(\);
        });
    } else {
        console.log('   Nenhum plano encontrado');
    }
}

// Executar teste
runCompleteTest().catch(console.error);
