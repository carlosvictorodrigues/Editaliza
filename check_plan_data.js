const db = require('./database-simple-postgres');

async function checkPlanData() {
    try {
        // Buscar usuário
        const user = await db.get('SELECT id, email FROM users WHERE email = $1', ['c@c.com']);
        console.log('Usuário:', user);
        
        if (user) {
            // Buscar planos do usuário
            const plans = await db.all('SELECT id, plan_name, exam_date, created_at FROM study_plans WHERE user_id = $1', [user.id]);
            console.log('\nPlanos do usuário:');
            plans.forEach(plan => {
                console.log(`- ID: ${plan.id}, Nome: ${plan.plan_name}, Data da Prova: ${plan.exam_date}, Criado em: ${plan.created_at}`);
            });
            
            if (plans.length > 0) {
                // Pegar o plano mais recente
                const latestPlan = plans[plans.length - 1];
                console.log('\nÚltimo plano criado:', latestPlan);
                console.log('exam_date está definido?', !!latestPlan.exam_date);
                console.log('Tipo do exam_date:', typeof latestPlan.exam_date);
            }
        }
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        process.exit();
    }
}

checkPlanData();