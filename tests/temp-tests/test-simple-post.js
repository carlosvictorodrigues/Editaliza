const express = require('express');
const { authenticateToken } = require('./src/middleware/auth.middleware');
const plansController = require('./src/controllers/plans.controller');

const app = express();
app.use(express.json());

// Simple test route without validation middleware
app.post('/test-plans', authenticateToken, async (req, res) => {
    console.log('[TEST] Received POST request');
    console.log('[TEST] Body:', req.body);
    console.log('[TEST] User:', req.user);
    
    try {
        await plansController.createPlan(req, res);
    } catch (error) {
        console.error('[TEST] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});