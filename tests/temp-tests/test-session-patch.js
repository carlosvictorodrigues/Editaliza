/**
 * Teste para verificar a correção da rota PATCH /api/sessions/:sessionId
 * 
 * PROBLEMA IDENTIFICADO:
 * - handleValidationErrors não estava chamando next() quando não havia erros
 * - Isso causava timeout na requisição
 * 
 * SOLUÇÃO APLICADA:
 * - Adicionado "return next()" no handleValidationErrors quando não há erros
 */

const axios = require('axios');

// Configuração
const BASE_URL = 'http://localhost:3000';
// Token válido gerado com user_id = 80
const TOKEN = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ODAsImVtYWlsIjoidGVzdGVAZWRpdGFsaXphLmNvbSIsIm5hbWUiOiJVc3XDoXJpbyBUZXN0ZSIsImlhdCI6MTc1NjMxMjQ4OCwiZXhwIjoxNzU2Mzk4ODg4LCJpc3MiOiJlZGl0YWxpemEifQ.Mn6fTrcLXWBcQCGlPpRUCltFKrjopAigv8W0huayG_I';

async function testSessionPatch() {
    console.log('🧪 Testando correção da rota PATCH /api/sessions/:sessionId\n');
    
    try {
        // 1. Configurar o axios com timeout
        const axiosInstance = axios.create({
            baseURL: BASE_URL,
            timeout: 5000, // 5 segundos de timeout
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        // 2. Testar a rota PATCH
        const sessionId = 3147; // ID da sessão do log fornecido
        console.log(`📤 Enviando PATCH /api/sessions/${sessionId}`);
        console.log('   Body: { status: "Concluído" }\n');
        
        const startTime = Date.now();
        
        const response = await axiosInstance.patch(`/api/sessions/${sessionId}`, {
            status: 'Concluído'
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('✅ Resposta recebida com sucesso!');
        console.log(`⏱️  Tempo de resposta: ${duration}ms`);
        console.log('📥 Status:', response.status);
        console.log('📥 Dados:', JSON.stringify(response.data, null, 2));
        
        // Verificação
        if (duration < 1000) {
            console.log('\n🎉 SUCESSO! A correção funcionou - resposta rápida sem timeout!');
        } else if (duration < 5000) {
            console.log('\n⚠️  AVISO: Resposta demorou mais que o esperado, mas não deu timeout');
        }
        
    } catch (error) {
        console.error('\n❌ Erro no teste:');
        
        if (error.code === 'ECONNABORTED') {
            console.error('   TIMEOUT! A requisição travou após 5 segundos');
            console.error('   ➡️  O problema NÃO foi corrigido completamente');
        } else if (error.response) {
            // Erro do servidor (4xx, 5xx)
            console.error('   Status:', error.response.status);
            console.error('   Erro:', error.response.data);
            
            if (error.response.status === 401) {
                console.error('\n   💡 Dica: O token pode estar expirado. Gere um novo token.');
            } else if (error.response.status === 404) {
                console.error('\n   💡 Dica: A sessão 2966 pode não existir. Verifique o ID.');
            }
        } else {
            console.error('   Erro de conexão:', error.message);
            console.error('\n   💡 Dica: Verifique se o servidor está rodando na porta 3000');
        }
    }
}

// Executar o teste
console.log('========================================');
console.log('  TESTE DE CORREÇÃO - PATCH SESSIONS');
console.log('========================================\n');

testSessionPatch().then(() => {
    console.log('\n========================================');
    process.exit(0);
}).catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});