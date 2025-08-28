const express = require('express');
const { authenticateToken } = require('./src/middleware/auth.middleware');
const { dbRun } = require('./src/config/database.wrapper');

const app = express();
app.use(express.json());

// Minimal test route
app.post('/minimal-test', authenticateToken, async (req, res) => {
    console.log('[MINIMAL] POST request received');
    console.log('[MINIMAL] Body:', req.body);
    console.log('[MINIMAL] User:', req.user);
    
    try {
        const { plan_name, exam_date } = req.body;
        
        if (!plan_name) {
            return res.status(400).json({ error: 'plan_name required' });
        }
        
        if (!exam_date) {
            return res.status(400).json({ error: 'exam_date required' });
        }
        
        const defaultHours = JSON.stringify({ '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 });
        
        const sql = `
            INSERT INTO study_plans 
            (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, has_essay) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;
        
        console.log('[MINIMAL] About to run database query...');
        const result = await dbRun(sql, [req.user.id, plan_name, exam_date, defaultHours, 50, 300, 50, 'completo', 0, false]);
        console.log('[MINIMAL] Database query completed:', result);
        
        const planId = result?.lastID || result?.id;
        
        if (!planId) {
            console.error('[MINIMAL] No planId extracted');
            return res.status(500).json({ error: 'Failed to create plan' });
        }
        
        console.log('[MINIMAL] Success, planId:', planId);
        res.status(201).json({ 
            message: 'Plan created successfully!', 
            newPlanId: planId 
        });
        
    } catch (error) {
        console.error('[MINIMAL] Error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`Minimal test server running on port ${PORT}`);
});