// Script para aplicar tabelas adicionais
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function applyAdditionalTables() {
    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d'
    });
    
    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL\n');
        
        // Ler o arquivo SQL
        const sqlContent = fs.readFileSync('create-additional-tables.sql', 'utf8');
        
        // Dividir por statements (remover comentários de echo)
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('\\echo'));
        
        console.log('📊 Executando ' + statements.length + ' comandos SQL...\n');
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await client.query(statement);
                    // Extrair o nome da operação
                    const match = statement.match(/CREATE\s+(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+(\w+)|ALTER\s+TABLE\s+(\w+)/i);
                    if (match) {
                        const type = match[1] || 'COLUMN';
                        const name = match[2] || match[3];
                        console.log(`✅ ${type} ${name} criado/atualizado`);
                    }
                } catch (err) {
                    console.error(`⚠️  Erro ao executar: ${statement.substring(0, 50)}...`);
                    console.error(`   Erro: ${err.message}`);
                }
            }
        }
        
        console.log('\n✨ Todas as tabelas adicionais foram processadas!');
        
        // Verificar total de tabelas
        const result = await client.query(`
            SELECT COUNT(*) as count 
            FROM pg_tables 
            WHERE schemaname = 'public'
        `);
        
        console.log(`\n📋 Total de tabelas no banco: ${result.rows[0].count}`);
        
    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    } finally {
        await client.end();
    }
}

applyAdditionalTables();