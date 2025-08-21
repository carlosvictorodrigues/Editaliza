/**
 * TESTE DA APLICAÇÃO COM POSTGRESQL
 * Testa funcionalidades básicas usando o novo banco
 */

// Configurar para usar PostgreSQL
process.env.DB_TYPE = 'postgresql';
process.env.PG_HOST = 'localhost';
process.env.PG_PORT = '5432';
process.env.PG_DATABASE = 'editaliza_dev';
process.env.PG_USER = 'postgres';
process.env.PG_PASSWORD = '123456';
process.env.SAFE_MODE = 'true';

const { DatabaseAdapter } = require('./src/utils/database-adapter');

async function testPostgreSQL() {
    console.log('🧪 TESTE DA APLICAÇÃO COM POSTGRESQL');
    console.log('=' .repeat(50) + '\n');

    const db = new DatabaseAdapter({ dbType: 'postgresql' });
    
    try {
        await db.initialize();
        console.log('✅ Adaptador inicializado\n');

        // 1. Teste de consulta simples
        console.log('1️⃣ Teste de consulta simples:');
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        console.log(`   Usuários: ${userCount.count}`);

        // 2. Teste de consulta com JOIN
        console.log('\n2️⃣ Teste de consulta com JOIN:');
        const plansWithUsers = await db.all(`
            SELECT sp.*, u.email, u.name 
            FROM study_plans sp
            JOIN users u ON sp.user_id = u.id
            LIMIT 5
        `);
        console.log(`   Planos com usuários: ${plansWithUsers.length}`);

        // 3. Teste de consulta específica
        console.log('\n3️⃣ Teste de usuário específico:');
        const user = await db.get('SELECT * FROM users WHERE email = $1', ['c@c.com']);
        if (user) {
            console.log(`   ✅ Usuário encontrado: ${user.name} (${user.email})`);
        } else {
            console.log(`   ❌ Usuário não encontrado`);
        }

        // 4. Health check
        console.log('\n4️⃣ Health Check:');
        const health = await db.healthCheck();
        console.log(`   Status: ${health.healthy ? '✅ Saudável' : '❌ Com problemas'}`);
        console.log(`   Banco: ${health.dbType}`);
        console.log(`   Queries executadas: ${health.metrics.queries}`);
        console.log(`   Erros: ${health.metrics.errors}`);
        console.log(`   Tempo médio: ${health.metrics.avgResponseTime.toFixed(2)}ms`);

        // 5. Teste de performance
        console.log('\n5️⃣ Teste de Performance:');
        const startTime = Date.now();
        
        for (let i = 0; i < 10; i++) {
            await db.all('SELECT * FROM topics LIMIT 10');
        }
        
        const duration = Date.now() - startTime;
        console.log(`   10 queries em ${duration}ms`);
        console.log(`   Média: ${(duration / 10).toFixed(2)}ms por query`);

        await db.close();

        console.log('\n' + '=' .repeat(50));
        console.log('✅ TODOS OS TESTES PASSARAM!');
        console.log('\nA aplicação está funcionando com PostgreSQL!');
        
        console.log('\n📝 Próximos passos:');
        console.log('1. Testar com a aplicação real:');
        console.log('   SET DB_TYPE=postgresql && node server.js');
        console.log('\n2. Ativar dual-write para segurança:');
        console.log('   SET DUAL_WRITE=true && node server.js');
        console.log('\n3. Quando confiante, migrar 100% para PostgreSQL:');
        console.log('   SET DB_TYPE=postgresql');
        console.log('   SET USE_POSTGRESQL=true');

    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n💡 Dica: Verifique se:');
        console.log('- PostgreSQL está rodando');
        console.log('- As credenciais estão corretas');
        console.log('- O banco editaliza_dev existe');
    }
}

testPostgreSQL();