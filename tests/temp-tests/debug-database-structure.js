/**
 * Debug script para verificar a estrutura do banco PostgreSQL
 * OBJETIVO: Identificar exatamente quais colunas/constraints existem
 */

require('dotenv').config();
const db = require('./database-simple-postgres');

async function checkDatabaseStructure() {
    console.log('🔍 ANALISANDO ESTRUTURA DO BANCO POSTGRESQL...\n');

    try {
        // Verificar schemas disponíveis
        console.log('📂 SCHEMAS DISPONÍVEIS:');
        const schemas = await db.all(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast') 
            ORDER BY schema_name
        `);
        schemas.forEach(s => console.log(`  - ${s.schema_name}`));
        console.log('');

        // Verificar tabelas em ambos os schemas
        const schemasToCheck = ['public', 'app'];
        
        for (const schemaName of schemasToCheck) {
            console.log(`📊 TABELAS NO SCHEMA '${schemaName.toUpperCase()}':`);
            
            try {
                const tables = await db.all(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                `, [schemaName]);
                
                if (tables.length === 0) {
                    console.log(`  ❌ Nenhuma tabela encontrada no schema '${schemaName}'`);
                } else {
                    tables.forEach(t => console.log(`  ✅ ${t.table_name}`));
                    
                    // Para cada tabela importante, verificar estrutura
                    const importantTables = ['study_plans', 'subjects', 'topics', 'study_sessions'];
                    
                    for (const tableName of importantTables) {
                        if (tables.find(t => t.table_name === tableName)) {
                            console.log(`\n🔧 ESTRUTURA DA TABELA ${schemaName}.${tableName}:`);
                            
                            const columns = await db.all(`
                                SELECT 
                                    column_name,
                                    data_type,
                                    is_nullable,
                                    column_default,
                                    character_maximum_length
                                FROM information_schema.columns 
                                WHERE table_schema = $1 AND table_name = $2
                                ORDER BY ordinal_position
                            `, [schemaName, tableName]);
                            
                            columns.forEach(col => {
                                console.log(`  📋 ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
                            });
                            
                            // Verificar constraints
                            const constraints = await db.all(`
                                SELECT 
                                    constraint_name,
                                    constraint_type,
                                    column_name
                                FROM information_schema.table_constraints tc
                                JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                                WHERE tc.table_schema = $1 AND tc.table_name = $2
                                ORDER BY constraint_type, constraint_name
                            `, [schemaName, tableName]);
                            
                            if (constraints.length > 0) {
                                console.log(`\n🔗 CONSTRAINTS DA TABELA ${schemaName}.${tableName}:`);
                                constraints.forEach(c => {
                                    console.log(`  ⚡ ${c.constraint_type}: ${c.constraint_name} (${c.column_name})`);
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.log(`  ❌ Erro ao acessar schema '${schemaName}': ${error.message}`);
            }
            
            console.log('');
        }

        // Verificar schema atual da conexão
        console.log('🎯 CONFIGURAÇÃO DA CONEXÃO:');
        const currentSchema = await db.get('SELECT current_schema() as schema');
        console.log(`  Schema atual: ${currentSchema.schema}`);
        
        const searchPath = await db.get('SHOW search_path');
        console.log(`  Search path: ${searchPath.search_path}`);

        // Testar uma query simples em cada schema para ver qual funciona
        console.log('\n🧪 TESTE DE ACESSO ÀS TABELAS:');
        
        for (const schemaName of schemasToCheck) {
            console.log(`\nTestando schema '${schemaName}':`);
            
            try {
                // Testar study_plans
                const planCount = await db.get(`SELECT COUNT(*) as count FROM ${schemaName}.study_plans`);
                console.log(`  ✅ study_plans: ${planCount.count} registros`);
            } catch (e) {
                console.log(`  ❌ study_plans: ${e.message}`);
            }
            
            try {
                // Testar subjects  
                const subjectCount = await db.get(`SELECT COUNT(*) as count FROM ${schemaName}.subjects`);
                console.log(`  ✅ subjects: ${subjectCount.count} registros`);
            } catch (e) {
                console.log(`  ❌ subjects: ${e.message}`);
            }
            
            try {
                // Testar topics
                const topicCount = await db.get(`SELECT COUNT(*) as count FROM ${schemaName}.topics`);
                console.log(`  ✅ topics: ${topicCount.count} registros`);
            } catch (e) {
                console.log(`  ❌ topics: ${e.message}`);
            }
        }

        console.log('\n✅ ANÁLISE CONCLUÍDA!');
        process.exit(0);

    } catch (error) {
        console.error('❌ ERRO NA ANÁLISE:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Executar análise
checkDatabaseStructure();