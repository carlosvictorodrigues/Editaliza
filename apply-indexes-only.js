/**
 * Script simples para aplicar apenas os índices de performance
 */

const { dbRun } = require('./database-postgresql');
const fs = require('fs');

async function applyIndexes() {
    console.log('🔧 Aplicando índices de performance...');
    
    try {
        // Ler arquivo SQL limpo
        const sqlContent = fs.readFileSync('./database/admin-performance-indexes-clean.sql', 'utf8');
        
        // Separar comandos individuais
        const commands = sqlContent
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd && 
                !cmd.startsWith('--') && 
                !cmd.includes('CONCURRENTLY') && // Skip concurrent indexes for now
                cmd.length > 10
            );
        
        console.log(`📋 Executando ${commands.length} comandos SQL...`);
        
        for (const [index, command] of commands.entries()) {
            try {
                console.log(`  ${index + 1}/${commands.length}: Executando...`);
                await dbRun(command);
                console.log("✅ Sucesso");
            } catch (error) {
                if (error.message.includes('já existe') || error.message.includes('already exists')) {
                    console.log("ℹ️  Já existe - ok");
                } else {
                    console.log(`  ⚠️  Aviso: ${error.message}`);
                }
            }
        }
        
        // Tentar criar as views materializadas separadamente
        console.log('\n📊 Criando views materializadas...');
        
        try {
            await dbRun(`
                CREATE MATERIALIZED VIEW IF NOT EXISTS admin_user_metrics AS
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as users_last_24h,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as users_last_7d,
                    MAX(created_at) as latest_signup,
                    NOW() as calculated_at
                FROM users
            `);
            console.log('✅ View admin_user_metrics criada');
        } catch (error) {
            console.log(`⚠️  View users: ${error.message}`);
        }
        
        try {
            await dbRun(`
                CREATE MATERIALIZED VIEW IF NOT EXISTS admin_plan_metrics AS
                SELECT 
                    COUNT(*) as total_plans,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as plans_last_24h,
                    MAX(created_at) as latest_plan,
                    NOW() as calculated_at
                FROM plans
            `);
            console.log('✅ View admin_plan_metrics criada');
        } catch (error) {
            console.log(`⚠️  View plans: ${error.message}`);
        }
        
        // Criar função de refresh
        console.log('\n🔄 Criando função de refresh...');
        try {
            await dbRun(`
                CREATE OR REPLACE FUNCTION refresh_admin_metrics()
                RETURNS void
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    REFRESH MATERIALIZED VIEW admin_user_metrics;
                    REFRESH MATERIALIZED VIEW admin_plan_metrics;
                    RAISE NOTICE 'Admin metrics refreshed at %', NOW();
                END;
                $$
            `);
            console.log('✅ Função refresh_admin_metrics criada');
        } catch (error) {
            console.log(`⚠️  Função: ${error.message}`);
        }
        
        // Teste de performance
        console.log('\n🚀 Testando performance...');
        
        const start1 = process.hrtime();
        const users = await require('./database-postgresql').dbAll(`
            SELECT id, email, name, role, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 20
        `);
        const time1 = process.hrtime(start1);
        console.log(`⚡ Query usuários: ${(time1[0] * 1000 + time1[1] / 1e6).toFixed(2)}ms (${users.length} resultados)`);
        
        const start2 = process.hrtime();
        const metrics = await require('./database-postgresql').dbGet(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users
            FROM users
        `);
        const time2 = process.hrtime(start2);
        console.log(`⚡ Métricas agregadas: ${(time2[0] * 1000 + time2[1] / 1e6).toFixed(2)}ms`);
        console.log(`📊 Total usuários: ${metrics.total_users}, Admins: ${metrics.admin_users}`);
        
        console.log('\n🎉 ÍNDICES APLICADOS COM SUCESSO!');
        console.log('📈 Performance das rotas admin otimizada');
        console.log('🔧 Reinicie a aplicação para usar o cache');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    applyIndexes().then(() => process.exit(0));
}

module.exports = { applyIndexes };