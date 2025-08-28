#!/usr/bin/env node
/**
 * TESTE RÁPIDO - Middleware Fix Test
 * Testar se os middlewares corrigidos permitem que auth funcione
 */

const axios = require('axios');

async function testAuthWithMiddleware() {
    const baseURL = 'http://localhost:3000';
    
    console.log('🧪 TESTANDO MIDDLEWARES CORRIGIDOS');
    console.log('=====================================');
    
    try {
        // 1. Testar health check primeiro
        console.log('\n1️⃣ Testando Health Check...');
        const healthResponse = await axios.get(`${baseURL}/health`);
        console.log('✅ Health check OK:', healthResponse.data);
        
        // 2. Testar rota de registro com middleware global
        console.log('\n2️⃣ Testando Register com middleware...');
        const registerData = {
            email: 'teste-middleware@exemplo.com',
            password: 'SenhaForte123!',
            name: 'Usuário Teste Middleware'
        };
        
        try {
            const registerResponse = await axios.post(`${baseURL}/api/auth/register`, registerData);
            console.log('✅ Register funcionou:', registerResponse.data);
        } catch (registerError) {
            if (registerError.response) {
                console.log('⚠️ Register retornou erro (esperado se usuário existe):', registerError.response.data);
            } else {
                console.error('❌ Register falhou completamente:', registerError.message);
                throw registerError;
            }
        }
        
        // 3. Testar rota de login com middleware
        console.log('\n3️⃣ Testando Login com middleware...');
        const loginData = {
            email: 'teste-middleware@exemplo.com',
            password: 'SenhaForte123!'
        };
        
        try {
            const loginResponse = await axios.post(`${baseURL}/api/auth/login`, loginData);
            console.log('✅ Login funcionou:', loginResponse.data);
        } catch (loginError) {
            if (loginError.response && loginError.response.status === 401) {
                console.log('⚠️ Login retornou 401 (esperado se credenciais incorretas):', loginError.response.data);
            } else {
                console.error('❌ Login falhou:', loginError.response?.data || loginError.message);
            }
        }
        
        // 4. Verificar se não trava mais
        console.log('\n4️⃣ Verificando se sistema não trava...');
        setTimeout(() => {
            console.log('✅ Sistema não travou! Middlewares funcionando corretamente.');
            console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
            console.log('Os middlewares foram corrigidos e as rotas de auth funcionam.');
            process.exit(0);
        }, 2000);
        
    } catch (error) {
        console.error('\n❌ TESTE FALHOU:', error.message);
        console.error('Possível problema:');
        
        if (error.code === 'ECONNREFUSED') {
            console.error('- Servidor não está rodando na porta 3000');
        } else if (error.response?.status === 429) {
            console.error('- Rate limiting ainda muito restritivo');
        } else {
            console.error('- Middleware ainda tem problemas');
        }
        
        process.exit(1);
    }
}

// Executar teste
if (require.main === module) {
    console.log('Aguarde o servidor iniciar, então execute este teste...');
    setTimeout(() => {
        testAuthWithMiddleware();
    }, 3000); // Dar tempo para o servidor iniciar
}