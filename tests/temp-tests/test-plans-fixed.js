// Debug corrigido do problema dos planos
require('dotenv').config();
const { db } = require('./database-simple-postgres');

async function testPlansFixed() {
    console.log('\n🔍 TESTE DOS PLANOS - VERSÃO CORRIGIDA\n');
    
    try {
        // 1. Testar conexão
        console.log('1️⃣ Testando conexão com banco...');
        const testConn = await new Promise((resolve, reject) => {
            db.all('SELECT 1 as test', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log('✅ Conexão OK:', testConn);
        
        // 2. Verificar estrutura da tabela plans
        console.log('\n2️⃣ Verificando estrutura da tabela plans...');
        const tableInfo = await new Promise((resolve, reject) => {
            db.all(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'plans'
                ORDER BY ordinal_position
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log('Colunas da tabela plans:');
        tableInfo.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        // 3. Testar query direta
        console.log('\n3️⃣ Testando query direta de planos...');
        const userId = 1; // usuário de teste
        
        // Query simples primeiro
        const simpleQuery = await new Promise((resolve, reject) => {
            db.all('SELECT COUNT(*) as total FROM plans', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log(`Total de planos no banco: ${simpleQuery[0].total}`);
        
        // Query com WHERE user_id
        console.log(`\n4️⃣ Buscando planos do usuário ${userId}...`);
        const userPlans = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM plans WHERE user_id = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log(`Planos encontrados: ${userPlans.length}`);
        if (userPlans.length > 0) {
            console.log('Primeiro plano:', userPlans[0]);
        }
        
        // 5. Testar através do repository
        console.log('\n5️⃣ Testando através do PlanRepository...');
        const PlanRepository = require('./src/repositories/plan.repository');
        const planRepo = new PlanRepository();
        
        // Testar findAll
        console.log('Testando findAll()...');
        try {
            const allPlans = await planRepo.findAll();
            console.log(`findAll retornou: ${allPlans.length} planos`);
        } catch (error) {
            console.error('Erro em findAll:', error.message);
        }
        
        // Testar findByUserId
        console.log(`\nTestando findByUserId(${userId})...`);
        try {
            const repoUserPlans = await planRepo.findByUserId(userId);
            console.log(`findByUserId retornou: ${repoUserPlans.length} planos`);
        } catch (error) {
            console.error('Erro em findByUserId:', error.message);
        }
        
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
                console.log('Controller retornou:', JSON.stringify(data, null, 2));
                return res;
            },
            status: (code) => {
                console.log(`Status code: ${code}`);
                return res;
            }
        };
        
        try {
            await controller.getPlans(req, res);
        } catch (error) {
            console.error('Erro no controller:', error.message);
        }
        
    } catch (error) {
        console.error('❌ ERRO GERAL:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        console.log('\n✅ Teste concluído');
        process.exit(0);
    }
}

// Executar teste
testPlansFixed();