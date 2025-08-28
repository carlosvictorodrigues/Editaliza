// Teste direto do authRepository

const authRepository = require('./src/repositories/authRepository');

async function testAuthRepository() {
    console.log('\n🔍 TESTE DO AUTH REPOSITORY\n');
    
    try {
        // 1. Testar findUserByEmail
        console.log('1️⃣ Testando findUserByEmail...');
        console.time('findUserByEmail');
        
        const email = 'nonexistent@test.com';
        const user = await authRepository.findUserByEmail(email);
        
        console.timeEnd('findUserByEmail');
        console.log('Resultado:', user);
        
        // 2. Testar createUser
        console.log('\n2️⃣ Testando createUser...');
        console.time('createUser');
        
        const newUser = {
            email: `test_${Date.now()}@example.com`,
            password: '$2a$10$test.hash',
            name: 'Test User'
        };
        
        const created = await authRepository.createUser(newUser);
        console.timeEnd('createUser');
        console.log('Usuário criado:', created);
        
        // 3. Testar findUserById
        if (created && created.id) {
            console.log('\n3️⃣ Testando findUserById...');
            console.time('findUserById');
            
            const found = await authRepository.findUserById(created.id);
            console.timeEnd('findUserById');
            console.log('Usuário encontrado:', found ? found.email : 'não encontrado');
        }
        
        console.log('\n✨ TESTE COMPLETO!');
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
    }
    
    // Forçar saída após 5 segundos
    setTimeout(() => {
        console.log('\n⏰ Timeout - encerrando processo');
        process.exit(0);
    }, 5000);
}

// Executar teste
testAuthRepository();