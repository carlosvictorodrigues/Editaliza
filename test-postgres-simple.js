/**
 * TESTE SIMPLES POSTGRESQL - SEM ADAPTERS
 * Teste direto com database-simple-postgres
 */

const db = require('./database-simple-postgres');

async function testPostgreSQL() {
    console.log('🧪 TESTE POSTGRESQL DIRETO');
    console.log('=' .repeat(50) + '\n');

    try {
        // 1. Teste de conexão
        console.log('1️⃣ Testando conexão...');
        await db.testConnection();
        console.log('   ✅ Conectado ao PostgreSQL\n');

        // 2. Teste de consulta simples
        console.log('2️⃣ Teste de consulta simples:');
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        console.log(`   Usuários: ${userCount.count}\n`);

        // 3. Teste de consulta com JOIN
        console.log('3️⃣ Teste de consulta com JOIN:');
        const plansWithUsers = await db.all(`
            SELECT sp.*, u.email, u.name 
            FROM study_plans sp
            JOIN users u ON sp.user_id = u.id
            LIMIT 5
        `);
        console.log(`   Planos com usuários: ${plansWithUsers.length}\n`);

        // 4. Teste de usuário específico
        console.log('4️⃣ Teste de usuário específico:');
        const user = await db.get('SELECT * FROM users WHERE email = $1', ['c@c.com']);
        if (user) {
            console.log(`   ✅ Usuário encontrado: ${user.name} (${user.email})\n`);
        } else {
            console.log(`   ❌ Usuário não encontrado\n`);
        }

        // 5. Health check
        console.log('5️⃣ Health Check:');
        const health = await db.healthCheck();
        console.log(`   Status: ${health.status}`);
        console.log(`   Database: ${health.database}`);
        console.log(`   Pool: ${health.pool.total} conexões\n`);

        // 6. Teste de performance
        console.log('6️⃣ Teste de Performance:');
        const startTime = Date.now();
        
        for (let i = 0; i < 10; i++) {
            await db.all('SELECT * FROM topics LIMIT 10');
        }
        
        const duration = Date.now() - startTime;
        console.log(`   10 queries em ${duration}ms`);
        console.log(`   Média: ${(duration / 10).toFixed(2)}ms por query\n`);

        console.log('=' .repeat(50));
        console.log('✅ TODOS OS TESTES PASSARAM!');
        console.log('\nPostgreSQL funcionando perfeitamente!');

    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n💡 Verifique se:');
        console.log('- PostgreSQL está rodando');
        console.log('- As credenciais estão corretas no .env');
        console.log('- O banco editaliza_db existe');
    }
}

testPostgreSQL();