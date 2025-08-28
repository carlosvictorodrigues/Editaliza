/**
 * TESTE ESPECÍFICO PARA ROTA /api/profile
 * Identifica exatamente onde está travando
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TIMEOUT = 2000; // 2 segundos apenas

async function testarProfileStep() {
    console.log('🚀 TESTE ESPECÍFICO - ROTA /api/profile');
    
    let token = null;
    
    try {
        // 1. Fazer login primeiro
        console.log('\n1️⃣ Fazendo login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'teste.diagnostico@email.com',
            password: 'senha123'
        }, { timeout: 5000 });
        
        if (loginResponse.data.token) {
            token = loginResponse.data.token;
            console.log(`✅ Login OK! Token: ${token.substring(0, 20)}...`);
        } else {
            throw new Error('Token não encontrado na resposta do login');
        }
        
        // 2. Testar /api/profile com diferentes timeouts
        const timeouts = [1000, 2000, 3000, 5000];
        
        for (const timeout of timeouts) {
            console.log(`\n2️⃣ Testando /api/profile com timeout ${timeout}ms...`);
            
            try {
                const startTime = Date.now();
                const response = await axios.get(`${BASE_URL}/api/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    timeout
                });
                
                const endTime = Date.now();
                console.log(`✅ SUCESSO! Resposta em ${endTime - startTime}ms`);
                console.log(`📋 Dados:`, JSON.stringify(response.data, null, 2));
                return; // Sucesso, sair do loop
                
            } catch (error) {
                if (error.code === 'ECONNABORTED') {
                    console.log(`⏰ TIMEOUT após ${timeout}ms`);
                } else {
                    console.log(`❌ ERRO: ${error.message}`);
                    if (error.response) {
                        console.log(`📋 Status: ${error.response.status}`);
                        console.log(`📋 Response:`, error.response.data);
                    }
                }
            }
        }
        
        // 3. Se chegou aqui, todas as tentativas falharam
        console.log('\n❌ TODAS AS TENTATIVAS FALHARAM - ROTA DEFINITIVAMENTE TRAVANDO');
        
        // 4. Testar rota similar que funciona para comparar
        console.log('\n3️⃣ Testando rota similar que funciona (/api/plans)...');
        try {
            const plansResponse = await axios.get(`${BASE_URL}/api/plans`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 2000
            });
            console.log(`✅ /api/plans funciona perfeitamente: ${plansResponse.status}`);
        } catch (error) {
            console.log(`❌ /api/plans também falhou: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`💥 ERRO NO TESTE: ${error.message}`);
    }
}

// 5. Testar sem autenticação para ver se é problema do middleware
async function testarSemAuth() {
    console.log('\n4️⃣ Testando /api/profile SEM autenticação...');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/profile`, {
            timeout: 2000
        });
        console.log(`🤔 Sem auth deu status: ${response.status}`);
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.log(`❌ AINDA TRAVA mesmo sem auth - problema não é no middleware de auth`);
        } else if (error.response && error.response.status === 401) {
            console.log(`✅ Sem auth retorna 401 rapidamente - middleware de auth não está travando`);
        } else {
            console.log(`❌ Erro inesperado: ${error.message}`);
        }
    }
}

async function executarTeste() {
    await testarProfileStep();
    await testarSemAuth();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 CONCLUSÃO DO TESTE ESPECÍFICO');
    console.log('='.repeat(50));
    console.log('Se a rota trava mesmo sem autenticação = problema na rota/controller');
    console.log('Se só trava com autenticação = problema no middleware');
    console.log('='.repeat(50));
}

if (require.main === module) {
    executarTeste().catch(console.error);
}

module.exports = { testarProfileStep, testarSemAuth };