/**
 * Debug do controller de plans
 */

const express = require('express');
const plansController = require('./src/controllers/plans.controller');

// Mock request object
const mockReq = {
    user: { id: 47 },
    body: {
        plan_name: 'Debug Controller Test',
        exam_date: '2025-12-31'
    }
};

// Mock response object
const mockRes = {
    json: (data) => {
        console.log('📊 Response JSON:', JSON.stringify(data, null, 2));
    },
    status: (code) => {
        console.log('📊 Response Status:', code);
        return mockRes;
    }
};

async function testController() {
    try {
        console.log('Testando controller createPlan...');
        await plansController.createPlan(mockReq, mockRes);
    } catch (error) {
        console.error('❌ Controller error:', error.message);
    } finally {
        process.exit(0);
    }
}

testController();