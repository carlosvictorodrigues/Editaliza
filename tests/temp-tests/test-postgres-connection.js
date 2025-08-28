// Teste de conexão com PostgreSQL
const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
    console.log('🔧 Testando conexão com PostgreSQL...\n');
    
    // Configuração do banco
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d'
    };
    
    console.log('Configuração:');
    console.log('Host:', config.host);
    console.log('Port:', config.port);
    console.log('Database:', config.database);
    console.log('User:', config.user);
    console.log('Password:', '***' + config.password.slice(-3));
    console.log('');
    
    const client = new Client(config);
    
    try {
        console.log('📊 Tentando conectar...');
        await client.connect();
        console.log('✅ Conectado com sucesso!');
        
        // Testar query simples
        const result = await client.query('SELECT NOW()');
        console.log('⏰ Hora do servidor:', result.rows[0].now);
        
        // Verificar tabelas
        const tables = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        if (tables.rows.length > 0) {
            console.log('\n📋 Tabelas encontradas:');
            tables.rows.forEach(row => {
                console.log('  -', row.tablename);
            });
        } else {
            console.log('\n⚠️ Nenhuma tabela encontrada no banco');
        }
        
        await client.end();
        console.log('\n✨ Teste concluído com sucesso!');
        
    } catch (error) {
        console.error('\n❌ Erro na conexão:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Possíveis soluções:');
            console.log('1. Verifique se o PostgreSQL está rodando');
            console.log('2. Verifique se a porta 5432 está aberta');
            console.log('3. Execute: net start postgresql-x64-17');
        } else if (error.code === '3D000') {
            console.log('\n💡 Banco de dados não existe!');
            console.log('Execute o seguinte comando como administrador:');
            console.log('"C:\\Program Files\\PostgreSQL\\17\\bin\\psql" -U postgres -c "CREATE DATABASE editaliza_db;"');
        } else if (error.code === '28P01') {
            console.log('\n💡 Erro de autenticação!');
            console.log('1. Verifique se o usuário existe');
            console.log('2. Verifique a senha');
            console.log('3. Execute os comandos SQL em setup-postgres-manual.sql');
        }
        
        await client.end();
        process.exit(1);
    }
}

testConnection().catch(console.error);