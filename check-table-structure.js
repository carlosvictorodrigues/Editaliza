/**
 * Verificar estrutura das tabelas
 */

const { dbAll } = require('./database-postgresql');

async function checkTableStructure() {
    console.log('🔍 Verificando estrutura das tabelas...\n');
    
    try {
        // Verificar colunas da tabela users
        console.log('📋 Estrutura da tabela USERS:');
        console.log('-----------------------------');
        
        const userColumns = await dbAll(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        
        console.table(userColumns);
        
        // Verificar colunas da tabela plans
        console.log('\n📋 Estrutura da tabela PLANS:');
        console.log('-----------------------------');
        
        const planColumns = await dbAll(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'plans'
            ORDER BY ordinal_position
        `);
        
        console.table(planColumns);
        
        // Verificar outras tabelas importantes
        const tables = ['sessions', 'schedules', 'tasks', 'progress'];
        
        for (const table of tables) {
            console.log(`\n📋 Estrutura da tabela ${table.toUpperCase()}:`);
            console.log('-----------------------------');
            
            try {
                const columns = await dbAll(`
                    SELECT column_name, data_type
                    FROM information_schema.columns 
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                `, [table]);
                
                if (columns.length > 0) {
                    console.table(columns);
                } else {
                    console.log('⚠️  Tabela não encontrada ou vazia');
                }
            } catch (error) {
                console.log(`⚠️  Erro: ${error.message}`);
            }
        }
        
        // Verificar views materializadas criadas
        console.log('\n🏗️  Views materializadas:');
        console.log('-------------------------');
        
        const views = await dbAll(`
            SELECT schemaname, matviewname as viewname 
            FROM pg_matviews
            WHERE matviewname LIKE '%admin%'
        `);
        
        if (views.length > 0) {
            console.table(views);
            
            // Testar conteúdo das views
            for (const view of views) {
                console.log(`\n📊 Conteúdo da view ${view.viewname}:`);
                try {
                    const content = await dbAll(`SELECT * FROM ${view.viewname} LIMIT 1`);
                    console.table(content);
                } catch (error) {
                    console.log(`⚠️  Erro ao consultar: ${error.message}`);
                }
            }
        } else {
            console.log('⚠️  Nenhuma view materializada encontrada');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

if (require.main === module) {
    checkTableStructure().then(() => process.exit(0));
}

module.exports = { checkTableStructure };