const http = require('http');

async function testGamificationEndpoint() {
    try {
        console.log('=== TESTE DO ENDPOINT DA API DE GAMIFICAÇÃO ===\n');
        
        const userId = 1006;
        const planId = 1016;
        
        // Simular uma chamada HTTP para o endpoint
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/plans/${planId}/gamification`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer dummy-token' // Para teste
            }
        };
        
        console.log(`🔗 Testando: http://localhost:3000/plans/${planId}/gamification`);
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`📡 Status: ${res.statusCode}`);
                console.log(`📋 Headers: ${JSON.stringify(res.headers, null, 2)}`);
                
                try {
                    const result = JSON.parse(data);
                    console.log('\n✅ Resposta da API:');
                    console.log(JSON.stringify(result, null, 2));
                    
                    if (result.error) {
                        console.log('\n❌ Erro encontrado na resposta da API!');
                        console.log('Mensagem:', result.error);
                    } else if (result.success) {
                        console.log('\n✅ API respondeu com sucesso!');
                        console.log('Nível:', result.data?.concurseiroLevel);
                        console.log('XP:', result.data?.experiencePoints);
                        console.log('Tópicos concluídos:', result.data?.completedTopicsCount);
                    }
                } catch (parseError) {
                    console.error('❌ Erro ao fazer parse da resposta:', parseError);
                    console.log('Resposta raw:', data);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Erro na requisição HTTP:', error.message);
            console.log('\n💡 Dicas para resolver:');
            console.log('1. Certifique-se de que o servidor está rodando na porta 3000');
            console.log('2. Execute: npm start ou node server.js');
            console.log('3. Verifique se não há erros no servidor');
        });
        
        req.setTimeout(5000, () => {
            console.error('❌ Timeout: Servidor não respondeu em 5 segundos');
            req.destroy();
        });
        
        req.end();
        
    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    }
}

// Testar também o endpoint direto no código se o servidor não estiver rodando
async function testDirectService() {
    try {
        console.log('\n=== TESTE DIRETO DO SERVIÇO (SEM HTTP) ===\n');
        
        const planService = require('./src/services/planService');
        const result = await planService.getGamification(1016, 1006);
        
        console.log('✅ Serviço funcionando diretamente:');
        console.log(`   Nível: ${result.concurseiroLevel}`);
        console.log(`   XP: ${result.experiencePoints}`);
        console.log(`   Tópicos: ${result.completedTopicsCount}`);
        console.log(`   Conquistas: ${result.achievements.length}`);
        
    } catch (error) {
        console.error('❌ Erro no serviço direto:', error.message);
    }
}

console.log('Iniciando testes...');
testGamificationEndpoint();

// Esperar um pouco e testar direto também
setTimeout(testDirectService, 6000);