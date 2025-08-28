console.log('Testing create plan function...');

const { dbRun } = require('./src/config/database.wrapper');

const testCreatePlan = async () => {
    try {
        console.log('Starting test...');
        
        const plan_name = 'Test Plan Direct';
        const exam_date = '2025-12-01';
        const user_id = 40;
        const defaultHours = JSON.stringify({ '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 });
        
        const sql = `
            INSERT INTO study_plans 
            (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, has_essay) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;
        
        console.log('About to run SQL...');
        const result = await dbRun(sql, [user_id, plan_name, exam_date, defaultHours, 50, 300, 50, 'completo', 0, false]);
        
        console.log('SQL completed, result:', result);
        
        const planId = result?.lastID || result?.rows?.[0]?.id || result?.id;
        console.log('Extracted planId:', planId);
        
    } catch (error) {
        console.error('Error:', error.message, error.stack);
    } finally {
        process.exit(0);
    }
};

testCreatePlan();