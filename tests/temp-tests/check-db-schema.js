const db = require('./database-postgres-direct');

async function checkStudySessionsSchema() {
    console.log('🔍 Verificando esquema da tabela study_sessions...');
    try {
        // Get table schema
        const tableSchemaResult = await db.get(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_name = 'study_sessions'
            LIMIT 1;
        `);

        if (tableSchemaResult) {
            console.log('\n--- Informações da Tabela study_sessions ---');
            console.log(`Esquema: ${tableSchemaResult.table_schema}`);
            console.log(`Nome da Tabela: ${tableSchemaResult.table_name}`);
            console.log('----------------------------------------');
        } else {
            console.log('❌ Tabela study_sessions não encontrada.');
            console.log('Certifique-se de que o banco de dados e o nome da tabela estão corretos.');
            return;
        }

        // Get column details
        const columns = await db.all(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'study_sessions'
            ORDER BY ordinal_position;
        `);

        if (columns.length === 0) {
            console.log('❌ Tabela study_sessions encontrada, mas sem colunas.');
            return;
        }

        console.log('\n--- Colunas da Tabela study_sessions ---');
        columns.forEach(col => {
            console.log(`Nome: ${col.column_name}, Tipo: ${col.data_type}, Nulo: ${col.is_nullable}, Padrão: ${col.column_default}`);
        });
        console.log('----------------------------------------');

        const timeStudiedExists = columns.some(col => col.column_name === 'time_studied_seconds');
        const questionsSolvedExists = columns.some(col => col.column_name === 'questions_solved');

        if (timeStudiedExists) {
            console.log('✅ Coluna time_studied_seconds encontrada.');
        } else {
            console.log('❌ Coluna time_studied_seconds NÃO encontrada.');
        }

        if (questionsSolvedExists) {
            console.log('✅ Coluna questions_solved encontrada.');
        } else {
            console.log('❌ Coluna questions_solved NÃO encontrada.');
        }

    } catch (error) {
        console.error('❌ Erro ao verificar o esquema do banco de dados:', error.message);
        console.error('Detalhes do erro:', error);
    } finally {
        await db.close();
        console.log('\nVerificação concluída.');
    }
}

checkStudySessionsSchema();
