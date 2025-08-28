/**
 * TESTE ESPECÍFICO PARA DEBUG DA CRIAÇÃO DE PLANOS
 * Vamos testar diretamente o repository e identificar o problema
 */

const db = require('./database-postgresql.js');

async function testDirectPlanCreation() {
    try {
        console.log('🧪 TESTE DIRETO DE CRIAÇÃO DE PLANO\n');
        
        // 1. Primeiro testar se podemos inserir diretamente no banco
        console.log('1. Testando INSERT direto no banco...');
        
        const directInsertQuery = `
            INSERT INTO study_plans (
                user_id, plan_name, exam_date,
                daily_question_goal, weekly_question_goal,
                session_duration_minutes, review_mode,
                has_essay, reta_final_mode, study_hours_per_day,
                created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP
            ) RETURNING id
        `;
        
        const params = [
            12, // user_id do teste anterior
            'Teste Direto PostgreSQL',
            '2025-11-25',
            50,
            300,
            50,
            'completo',
            false,
            false,
            '{"0": 0, "1": 4, "2": 4, "3": 4, "4": 4, "5": 4, "6": 0}'
        ];
        
        console.log('Query:', directInsertQuery);
        console.log('Params:', params);
        
        const result = await db.query(directInsertQuery, params);
        console.log('✅ INSERT direto funcionou!');
        console.log('Resultado:', result.rows[0]);
        
        const planId = result.rows[0].id;
        
        // 2. Agora testar usando o repository
        console.log('\n2. Testando via Repository...');
        
        const { createRepositories } = require('./src/repositories');
        const repos = createRepositories(db);
        
        const planData = {
            user_id: 12,
            plan_name: 'Teste Repository',
            exam_date: '2025-11-25',
            daily_question_goal: 50,
            weekly_question_goal: 300,
            session_duration_minutes: 50,
            review_mode: 'completo',
            has_essay: false,
            reta_final_mode: false,
            study_hours_per_day: { "0": 0, "1": 4, "2": 4, "3": 4, "4": 4, "5": 4, "6": 0 }
        };
        
        console.log('Dados para repository:', planData);
        
        const repoResult = await repos.plan.createPlan(planData);
        console.log('✅ Repository funcionou!');
        console.log('Resultado:', repoResult);
        
        // 3. Testar via controller
        console.log('\n3. Testando via Controller...');
        
        const plansController = require('./src/controllers/plans.controller');
        
        // Simular req e res
        const mockReq = {
            user: { id: 12 },
            body: {
                plan_name: 'Teste Controller',
                exam_date: '2025-11-25',
                description: 'Teste do controller'
            }
        };
        
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    console.log(`✅ Controller respondeu com status ${code}:`);
                    console.log(data);
                    return data;
                }
            })
        };
        
        // Esta é a função que deveria estar funcionando
        console.log('Chamando plansController.createPlan...');
        await plansController.createPlan(mockReq, mockRes);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Stack:', error.stack);
        
        if (error.code) {
            console.error('Código do erro PostgreSQL:', error.code);
        }
        if (error.detail) {
            console.error('Detalhe:', error.detail);
        }
    }
    
    process.exit(0);
}

testDirectPlanCreation();