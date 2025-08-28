const db = require('./database-postgresql.js');

async function testCreatePlan() {
    console.log('🔍 DEBUGGING CREATE PLAN ISSUE');
    
    try {
        // 1. Verificar estrutura da tabela
        console.log('\n1️⃣ Verificando estrutura da tabela study_plans...');
        const tableInfo = await new Promise((resolve, reject) => {
            db.all(`SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = 'study_plans' 
                    AND table_schema = 'app'`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('Estrutura da tabela study_plans:');
        tableInfo.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        // 2. Testar INSERT simples
        console.log('\n2️⃣ Testando INSERT simples...');
        const defaultHours = JSON.stringify({ '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 });
        
        const result = await new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO study_plans 
                (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, has_essay) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `;
            
            const params = [22, 'Teste Debug Plan', '2026-03-15', defaultHours, 50, 300, 50, 'completo', 0, false];
            
            db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log('Callback this context:', this);
                    resolve(this);
                }
            });
        });
        
        console.log('Result:', result);
        console.log('Plan ID:', result?.lastID || result?.id);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

testCreatePlan();