// Teste direto do authService

const authService = require('./src/services/authService');

async function testAuthService() {
    console.log('\n🔍 TESTE DO AUTH SERVICE\n');
    
    try {
        // 1. Testar registro
        console.log('1️⃣ Testando registro via authService...');
        console.time('register');
        
        const userData = {
            email: `test_${Date.now()}@example.com`,
            password: 'Test123!@#',
            name: 'Test User'
        };
        
        // Mock do request
        const req = {
            ip: '127.0.0.1',
            headers: {
                'user-agent': 'test-script'
            }
        };
        
        const result = await Promise.race([
            authService.register(userData, req),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout após 3 segundos')), 3000)
            )
        ]);
        
        console.timeEnd('register');
        console.log('✅ Resultado:', result);
        
        console.log('\n✨ TESTE COMPLETO!');
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        if (error.message.includes('Timeout')) {
            console.error('⏰ O authService está travando em algum ponto');
        }
    }
    
    // Forçar saída
    setTimeout(() => {
        console.log('\n⏰ Encerrando processo');
        process.exit(0);
    }, 5000);
}

// Executar teste
testAuthService();