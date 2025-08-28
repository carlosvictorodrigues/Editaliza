/**
 * Teste de debug para verificar o problema no PATCH /api/sessions/:sessionId
 * 
 * PROBLEMA: 
 * - Método do controller é chamado mas trava ao executar query no banco
 * 
 * DIAGNÓSTICO APLICADO:
 * - Adicionado logs detalhados em cada ponto do fluxo
 * - Adicionado timeout nas queries do banco para evitar travamento infinito
 * - Melhorado error handling
 */

const axios = require('axios');

// Configuração
const BASE_URL = 'http://localhost:3000';

// Token de teste válido - você pode precisar gerar um novo
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ODAsImVtYWlsIjoidGVzdGUuY29tcGxldG8uMTc1NjMxMjI4MjY3M0BlZGl0YWxpemEuY29tIiwibmFtZSI6IlVzdcOhcmlvIFRlc3RlIDE3NTYzMTIyODI2NzMiLCJpYXQiOjE3NTYzMTIyODIsImV4cCI6MTc1NjM5ODY4MiwiaXNzIjoiZWRpdGFsaXphIn0.2HsLQNRAQUj4kebQ8st0wayFQIZpm2e71t-_8oikjHY';

// ID da sessão para testar (ajuste conforme necessário)
const SESSION_ID = 3147;

async function testSessionUpdate() {
    console.log('🔍 DEBUG: Testando atualização de sessão\n');
    console.log('==================================================');
    console.log('CONFIGURAÇÃO DO TESTE:');
    console.log('- URL Base:', BASE_URL);
    console.log('- Session ID:', SESSION_ID);
    console.log('- Token (primeiros 20 chars):', TEST_TOKEN.substring(0, 20) + '...');
    console.log('==================================================\n');
    
    try {
        const axiosInstance = axios.create({
            baseURL: BASE_URL,
            timeout: 10000, // 10 segundos
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`📤 Enviando: PATCH /api/sessions/${SESSION_ID}`);
        console.log('📦 Body:', JSON.stringify({ status: 'Concluído' }));
        console.log('\n⏳ Aguardando resposta...\n');
        
        const startTime = Date.now();
        
        const response = await axiosInstance.patch(`/api/sessions/${SESSION_ID}`, {
            status: 'Concluído'
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('✅ SUCESSO! Resposta recebida');
        console.log('==================================================');
        console.log('⏱️  Tempo de resposta:', duration, 'ms');
        console.log('📊 Status HTTP:', response.status);
        console.log('📥 Dados recebidos:', JSON.stringify(response.data, null, 2));
        console.log('==================================================\n');
        
        // Análise do tempo de resposta
        if (duration < 100) {
            console.log('⚡ EXCELENTE: Resposta muito rápida!');
        } else if (duration < 500) {
            console.log('✅ BOM: Tempo de resposta aceitável');
        } else if (duration < 2000) {
            console.log('⚠️  ATENÇÃO: Resposta um pouco lenta');
        } else {
            console.log('🐌 PROBLEMA: Resposta muito lenta (possível problema de performance)');
        }
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE');
        console.error('==================================================');
        
        if (error.code === 'ECONNABORTED') {
            console.error('⏱️  TIMEOUT! A requisição travou após 10 segundos');
            console.error('\n🔍 DIAGNÓSTICO:');
            console.error('- O problema persiste mesmo com os logs adicionados');
            console.error('- Provável problema no banco de dados ou conexão');
            console.error('\n📋 PRÓXIMOS PASSOS:');
            console.error('1. Verificar logs do servidor para ver onde parou');
            console.error('2. Verificar se o banco de dados está respondendo');
            console.error('3. Testar a query diretamente no banco');
            
        } else if (error.response) {
            console.error('📊 Status HTTP:', error.response.status);
            console.error('📥 Resposta do servidor:', error.response.data);
            
            if (error.response.status === 401) {
                console.error('\n🔐 Token expirado ou inválido');
                console.error('➡️  Gere um novo token de teste');
            } else if (error.response.status === 404) {
                console.error('\n🔍 Sessão não encontrada');
                console.error('➡️  Verifique se a sessão', SESSION_ID, 'existe no banco');
            } else if (error.response.status === 500) {
                console.error('\n💥 Erro interno do servidor');
                console.error('➡️  Verifique os logs do servidor para mais detalhes');
                if (error.response.data.details) {
                    console.error('➡️  Detalhes:', error.response.data.details);
                }
            }
            
        } else {
            console.error('🔌 Erro de conexão:', error.message);
            console.error('\n📋 VERIFICAR:');
            console.error('- O servidor está rodando?');
            console.error('- A porta 3000 está correta?');
            console.error('- Há algum firewall bloqueando?');
        }
        
        console.error('==================================================');
    }
}

// Executar o teste
console.log('==================================================');
console.log('    TESTE DE DEBUG - UPDATE SESSION STATUS');
console.log('==================================================\n');

testSessionUpdate().then(() => {
    console.log('\n🏁 Teste finalizado');
    process.exit(0);
}).catch(err => {
    console.error('\n💥 Erro fatal:', err);
    process.exit(1);
});