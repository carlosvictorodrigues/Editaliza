/**
 * Debug direto no repository para verificar o retorno
 */

const { createRepositories } = require('./src/repositories');
const db = require('./database-postgresql.js');

async function testDirectRepository() {
    try {
        console.log('Criando repositories...');
        const repos = createRepositories(db);
        
        console.log('Testando createPlan...');
        const result = await repos.plan.createPlan({
            user_id: 47,
            plan_name: 'Debug Repository Test',
            exam_date: '2025-12-31',
            study_hours_per_day: { '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 },
            daily_question_goal: 50,
            weekly_question_goal: 300,
            session_duration_minutes: 50,
            review_mode: 'completo',
            has_essay: false,
            reta_final_mode: false
        });
        
        console.log('✅ Repository result:', result);
        console.log('📊 Result type:', typeof result);
        console.log('📊 Result keys:', result ? Object.keys(result) : 'null/undefined');
        
        if (result && result.id) {
            console.log('✅ ID found:', result.id);
        } else {
            console.log('❌ ID not found in result');
        }
        
    } catch (error) {
        console.error('❌ Repository error:', error.message);
    } finally {
        process.exit(0);
    }
}

testDirectRepository();