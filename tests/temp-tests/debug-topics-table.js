/**
 * Debug específico da tabela topics para identificar colunas que não existem
 */

require('dotenv').config();
const db = require('./database-simple-postgres');

async function checkTopicsTable() {
    console.log('🔍 ANALISANDO TABELA TOPICS EM DETALHES...\n');

    try {
        // Verificar estrutura detalhada da tabela topics no schema app
        console.log('📊 ESTRUTURA DA TABELA app.topics:');
        
        const columns = await db.all(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns 
            WHERE table_schema = 'app' AND table_name = 'topics'
            ORDER BY ordinal_position
        `);
        
        columns.forEach(col => {
            console.log(`  📋 ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });

        console.log('\n📊 ESTRUTURA DA TABELA public.topics:');
        
        const columnsPublic = await db.all(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'topics'
            ORDER BY ordinal_position
        `);
        
        columnsPublic.forEach(col => {
            console.log(`  📋 ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });

        // Testar inserção na tabela app.topics
        console.log('\n🧪 TESTANDO INSERÇÃO NA TABELA app.topics:');

        // Primeiro, buscar um subject_id válido
        const subject = await db.get('SELECT id FROM app.subjects LIMIT 1');
        if (!subject) {
            console.log('❌ Nenhum subject encontrado para teste');
            return;
        }

        console.log(`📋 Usando subject_id: ${subject.id}`);

        // Tentar inserção básica com apenas campos obrigatórios
        try {
            const query = `
                INSERT INTO app.topics (
                    subject_id, topic_name, created_at, updated_at
                ) VALUES (
                    $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING id
            `;
            
            const result = await db.get(query, [subject.id, 'Teste Debug Topic']);
            console.log(`✅ Inserção bem-sucedida! ID: ${result.id}`);
            
            // Limpar o teste
            await db.run('DELETE FROM app.topics WHERE id = $1', [result.id]);
            console.log('🧹 Registro de teste removido');
            
        } catch (insertError) {
            console.log(`❌ Erro na inserção: ${insertError.message}`);
            
            // Verificar se é erro de constraint
            if (insertError.message.includes('violates') || insertError.message.includes('constraint')) {
                console.log('🔍 Erro relacionado a constraint. Verificando constraints...');
                
                try {
                    const constraints = await db.all(`
                        SELECT 
                            tc.constraint_name,
                            tc.constraint_type,
                            ccu.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                        WHERE tc.table_schema = 'app' AND tc.table_name = 'topics'
                        ORDER BY tc.constraint_type, tc.constraint_name
                    `);
                    
                    console.log('🔗 CONSTRAINTS ENCONTRADAS:');
                    constraints.forEach(c => {
                        console.log(`  ⚡ ${c.constraint_type}: ${c.constraint_name} (${c.column_name})`);
                    });
                } catch (constraintError) {
                    console.log(`❌ Erro ao verificar constraints: ${constraintError.message}`);
                }
            }
        }

        // Verificar também a tabela subjects
        console.log('\n📊 ESTRUTURA DA TABELA app.subjects:');
        
        const subjectsColumns = await db.all(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'app' AND table_name = 'subjects'
            ORDER BY ordinal_position
        `);
        
        subjectsColumns.forEach(col => {
            console.log(`  📋 ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });

        console.log('\n✅ ANÁLISE CONCLUÍDA!');

    } catch (error) {
        console.error('❌ ERRO NA ANÁLISE:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

// Executar análise
checkTopicsTable();