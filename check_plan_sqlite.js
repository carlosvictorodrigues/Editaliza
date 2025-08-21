const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new Database(dbPath);

try {
    // Buscar usuário
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get('c@c.com');
    console.log('Usuário:', user);
    
    if (user) {
        // Buscar planos do usuário
        const plans = db.prepare('SELECT id, plan_name, exam_date, created_at FROM study_plans WHERE user_id = ?').all(user.id);
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
            
            // Verificar estrutura da tabela
            const tableInfo = db.prepare('PRAGMA table_info(study_plans)').all();
            console.log('\nColunas da tabela study_plans:');
            tableInfo.forEach(col => {
                if (col.name === 'exam_date') {
                    console.log(`- ${col.name}: tipo=${col.type}, not_null=${col.notnull}, default=${col.dflt_value}`);
                }
            });
        }
    }
} catch (error) {
    console.error('Erro:', error);
} finally {
    db.close();
}