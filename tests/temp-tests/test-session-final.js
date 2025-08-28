/**
 * Teste final para verificar se a correção do PATCH /api/sessions/:sessionId funcionou
 */

const axios = require('axios');

async function testSessionPatch() {
    console.log('🧪 Teste Final - PATCH /api/sessions/:sessionId\n');
    
    try {
        // 1. Fazer login primeiro para obter token válido
        console.log('1️⃣ Registrando novo usuário de teste...');
        const timestamp = Date.now();
        const email = `test.session.${timestamp}@editaliza.com`;
        const password = 'Test@123!';
        
        const registerResponse = await axios.post('http://localhost:3000/api/auth/register', {
            name: 'Test User',
            email: email,
            password: password,
            confirmPassword: password
        });
        
        const token = registerResponse.data.token;
        const userId = registerResponse.data.user.id;
        console.log('✅ Usuário registrado - Token obtido\n');
        console.log('   User ID:', userId);
        
        // 2. Configurar axios com token
        const api = axios.create({
            baseURL: 'http://localhost:3000',
            timeout: 10000,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        // 3. Testar PATCH em uma sessão existente
        const sessionId = 3331; // ID do log anterior
        console.log(`2️⃣ Testando PATCH /api/sessions/${sessionId}`);
        console.log('   Body: { status: "Concluído" }\n');
        
        const startTime = Date.now();
        const response = await api.patch(`/api/sessions/${sessionId}`, {
            status: 'Concluído'
        });
        const duration = Date.now() - startTime;
        
        console.log('✅ SUCESSO! Sessão atualizada');
        console.log('⏱️  Tempo de resposta:', duration, 'ms');
        console.log('📥 Resposta:', JSON.stringify(response.data, null, 2));
        
        if (duration < 1000) {
            console.log('\n🎉 PROBLEMA RESOLVIDO! Resposta rápida e sem timeout!');
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:');
        
        if (error.code === 'ECONNABORTED') {
            console.error('   TIMEOUT - Query ainda está travando');
        } else if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Erro:', error.response.data);
            
            if (error.response.status === 500) {
                console.error('\n   💡 Erro 500 - Verificar logs do servidor para mais detalhes');
            } else if (error.response.status === 404) {
                console.error('\n   💡 Sessão não encontrada - Pode ter sido deletada');
            } else if (error.response.status === 401) {
                console.error('\n   💡 Token inválido - Login pode ter falhado');
            }
        } else {
            console.error('   Erro:', error.message);
        }
    }
}

console.log('==================================================');
console.log('         TESTE FINAL - CORREÇÃO COMPLETA');
console.log('==================================================\n');

testSessionPatch();