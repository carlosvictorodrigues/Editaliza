// Teste direto do authController

const authController = require('./src/controllers/authController');

async function testController() {
    console.log('\n🔍 TESTE DIRETO DO CONTROLLER\n');
    
    // Mock do request e response
    const req = {
        body: {
            email: `test_${Date.now()}@test.com`,
            password: 'Test123!@#',
            name: 'Test User'
        },
        ip: '127.0.0.1',
        headers: {
            'user-agent': 'test-script'
        }
    };
    
    const res = {
        statusCode: null,
        jsonData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonData = data;
            console.log(`\nResposta (${this.statusCode || 200}):`, JSON.stringify(data, null, 2));
            process.exit(0);
        }
    };
    
    try {
        console.log('Chamando authController.register...');
        await authController.register(req, res);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Executar teste com timeout
testController();

// Timeout de segurança
setTimeout(() => {
    console.error('\n⏰ TIMEOUT - Controller travou após 5 segundos');
    process.exit(1);
}, 5000);