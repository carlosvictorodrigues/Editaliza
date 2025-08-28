// Debug direto do problema dos planos
require('dotenv').config();
const db = require('./database-simple-postgres');

async function testPlansDirectly() {
    console.log('\n🔍 TESTE DIRETO DOS PLANOS\n');
    
    try {
        // 1. Testar conexão
        console.log('1️⃣ Testando conexão com banco...');
        const testConn = await db.query('SELECT 1 as test');
        console.log('✅ Conexão OK:', testConn.rows);
        
        // 2. Verificar estrutura da tabela plans
        console.log('\n2️⃣ Verificando estrutura da tabela plans...');
        const tableInfo = await db.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'plans'
            ORDER BY ordinal_position
        `);
        console.log('Colunas da tabela plans:');
        tableInfo.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        // 3. Testar query direta
        console.log('\n3️⃣ Testando query direta de planos...');
        const userId = 1; // usuário de teste
        
        // Query simples primeiro
        const simpleQuery = await db.query('SELECT COUNT(*) as total FROM plans');
        console.log(`Total de planos no banco: ${simpleQuery.rows[0].total}`);
        
        // Query com WHERE user_id
        console.log(`\n4️⃣ Buscando planos do usuário ${userId}...`);
        const userPlans = await db.query(
            'SELECT * FROM plans WHERE user_id = $1',
            [userId]
        );
        console.log(`Planos encontrados: ${userPlans.rows.length}`);
        if (userPlans.rows.length > 0) {
            console.log('Primeiro plano:', userPlans.rows[0]);
        }
        
        // 5. Testar através do repository
        console.log('\n5️⃣ Testando através do PlanRepository...');
        const PlanRepository = require('./src/repositories/plan.repository');
        const planRepo = new PlanRepository();
        
        // Testar findAll
        console.log('Testando findAll()...');
        const allPlans = await planRepo.findAll();
        console.log(`findAll retornou: ${allPlans.length} planos`);
        
        // Testar findByUserId
        console.log(`\nTestando findByUserId(${userId})...`);
        const repoUserPlans = await planRepo.findByUserId(userId);
        console.log(`findByUserId retornou: ${repoUserPlans.length} planos`);
        
        // 6. Testar através do controller (sem auth)
        console.log('\n6️⃣ Testando através do PlansController...');
        const PlansController = require('./src/controllers/plans.controller');
        const controller = new PlansController();
        
        // Simular req/res
        const req = {
            user: { id: userId },
            params: {},
            body: {},
            query: {}
        };
        
        const res = {
            json: (data) => {
                console.log('Controller retornou:', data);
                return res;
            },
            status: (code) => {
                console.log(`Status code: ${code}`);
                return res;
            }
        };
        
        await controller.getPlans(req, res);
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Fechar conexão
        await db.end();
        console.log('\n✅ Teste concluído');
        process.exit(0);
    }
}

// Executar teste
testPlansDirectly();