/**
 * Test User Routes Script
 * 
 * This script tests the new user management routes to ensure
 * they are working correctly after the modular implementation.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Base URL for testing
const BASE_URL = 'http://localhost:3000';

// Test credentials
const TEST_USER = {
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User'
};

/**
 * Test result tracker
 */
let testResults = {
    passed: 0,
    failed: 0,
    total: 0
};

/**
 * Log test result
 */
const logTest = (testName, passed, details = '') => {
    testResults.total++;
    if (passed) {
        testResults.passed++;
        console.log(`✅ ${testName}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${testName} - ${details}`);
    }
};

/**
 * Get auth token for testing
 */
const getAuthToken = async () => {
    try {
        // Try to register user first
        try {
            await axios.post(`${BASE_URL}/auth/register`, TEST_USER);
            console.log('📝 Test user registered');
        } catch (error) {
            if (!error.response?.data?.error?.includes('já está em uso')) {
                throw error;
            }
            console.log('📝 Test user already exists');
        }
        
        // Login to get token
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        
        return loginResponse.data.token;
    } catch (error) {
        console.error('Failed to get auth token:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Test profile routes
 */
const testProfileRoutes = async (token) => {
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
        // Test GET /users/profile
        const profileResponse = await axios.get(`${BASE_URL}/users/profile`, { headers });
        logTest('GET /users/profile', profileResponse.status === 200);
        
        // Test PATCH /users/profile
        const updateData = {
            name: 'Updated Test User',
            phone: '1234567890',
            state: 'SP',
            city: 'São Paulo'
        };
        
        const updateResponse = await axios.patch(`${BASE_URL}/users/profile`, updateData, { headers });
        logTest('PATCH /users/profile', updateResponse.status === 200);
        
        return profileResponse.data;
    } catch (error) {
        logTest('Profile Routes', false, error.response?.data?.error || error.message);
        return null;
    }
};

/**
 * Test settings routes
 */
const testSettingsRoutes = async (token) => {
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
        // Test GET /users/settings
        const settingsResponse = await axios.get(`${BASE_URL}/users/settings`, { headers });
        logTest('GET /users/settings', settingsResponse.status === 200);
        
        // Test PATCH /users/settings
        const settingsData = {
            theme: 'dark',
            language: 'pt-BR',
            auto_save: true
        };
        
        const updateResponse = await axios.patch(`${BASE_URL}/users/settings`, settingsData, { headers });
        logTest('PATCH /users/settings', updateResponse.status === 200);
        
    } catch (error) {
        logTest('Settings Routes', false, error.response?.data?.error || error.message);
    }
};

/**
 * Test preferences routes
 */
const testPreferencesRoutes = async (token) => {
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
        // Test GET /users/preferences
        const preferencesResponse = await axios.get(`${BASE_URL}/users/preferences`, { headers });
        logTest('GET /users/preferences', preferencesResponse.status === 200);
        
        // Test PATCH /users/preferences
        const preferencesData = {
            email_notifications: true,
            push_notifications: false,
            study_reminders: true
        };
        
        const updateResponse = await axios.patch(`${BASE_URL}/users/preferences`, preferencesData, { headers });
        logTest('PATCH /users/preferences', updateResponse.status === 200);
        
    } catch (error) {
        logTest('Preferences Routes', false, error.response?.data?.error || error.message);
    }
};

/**
 * Test statistics routes
 */
const testStatisticsRoutes = async (token) => {
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
        // Test GET /users/statistics
        const statsResponse = await axios.get(`${BASE_URL}/users/statistics`, { headers });
        logTest('GET /users/statistics', statsResponse.status === 200);
        
        // Test POST /users/activity
        const activityData = {
            activity_type: 'study',
            duration: 60,
            metadata: { subject: 'Mathematics' }
        };
        
        const activityResponse = await axios.post(`${BASE_URL}/users/activity`, activityData, { headers });
        logTest('POST /users/activity', activityResponse.status === 200);
        
    } catch (error) {
        logTest('Statistics Routes', false, error.response?.data?.error || error.message);
    }
};

/**
 * Test notification routes
 */
const testNotificationRoutes = async (token) => {
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
        // Test GET /users/notifications
        const notificationsResponse = await axios.get(`${BASE_URL}/users/notifications`, { headers });
        logTest('GET /users/notifications', notificationsResponse.status === 200);
        
        // Test PATCH /users/notifications
        const notificationData = {
            email_notifications: true,
            marketing_emails: false
        };
        
        const updateResponse = await axios.patch(`${BASE_URL}/users/notifications`, notificationData, { headers });
        logTest('PATCH /users/notifications', updateResponse.status === 200);
        
    } catch (error) {
        logTest('Notification Routes', false, error.response?.data?.error || error.message);
    }
};

/**
 * Test privacy routes
 */
const testPrivacyRoutes = async (token) => {
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
        // Test GET /users/privacy
        const privacyResponse = await axios.get(`${BASE_URL}/users/privacy`, { headers });
        logTest('GET /users/privacy', privacyResponse.status === 200);
        
        // Test PATCH /users/privacy
        const privacyData = {
            profile_visibility: 'private',
            show_email: false,
            allow_contact: true
        };
        
        const updateResponse = await axios.patch(`${BASE_URL}/users/privacy`, privacyData, { headers });
        logTest('PATCH /users/privacy', updateResponse.status === 200);
        
    } catch (error) {
        logTest('Privacy Routes', false, error.response?.data?.error || error.message);
    }
};

/**
 * Test backward compatibility with legacy routes
 */
const testBackwardCompatibility = async (token) => {
    const headers = { Authorization: `Bearer ${token}` };
    
    try {
        // Test that old /profile route still works (should be commented out but let's check)
        try {
            const legacyResponse = await axios.get(`${BASE_URL}/profile`, { headers });
            logTest('Legacy /profile route compatibility', false, 'Legacy route should be disabled');
        } catch (error) {
            // Good - legacy route should be disabled
            logTest('Legacy routes properly disabled', error.response?.status === 404);
        }
        
    } catch (error) {
        logTest('Backward Compatibility Test', false, error.message);
    }
};

/**
 * Main test runner
 */
const runTests = async () => {
    console.log('🧪 Testing User Management Routes');
    console.log('=================================\n');
    
    try {
        // Get authentication token
        console.log('🔐 Getting authentication token...');
        const token = await getAuthToken();
        console.log('✅ Authentication successful\n');
        
        // Run all tests
        console.log('📝 Testing Profile Routes...');
        await testProfileRoutes(token);
        
        console.log('\n⚙️ Testing Settings Routes...');
        await testSettingsRoutes(token);
        
        console.log('\n🔔 Testing Preferences Routes...');
        await testPreferencesRoutes(token);
        
        console.log('\n📊 Testing Statistics Routes...');
        await testStatisticsRoutes(token);
        
        console.log('\n🔔 Testing Notification Routes...');
        await testNotificationRoutes(token);
        
        console.log('\n🔒 Testing Privacy Routes...');
        await testPrivacyRoutes(token);
        
        console.log('\n🔄 Testing Backward Compatibility...');
        await testBackwardCompatibility(token);
        
        // Print summary
        console.log('\n📋 Test Summary');
        console.log('================');
        console.log(`Total Tests: ${testResults.total}`);
        console.log(`Passed: ${testResults.passed} ✅`);
        console.log(`Failed: ${testResults.failed} ❌`);
        console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
        
        if (testResults.failed === 0) {
            console.log('\n🎉 All tests passed! User management system is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Please check the implementation.');
        }
        
    } catch (error) {
        console.error('❌ Test setup failed:', error.message);
        console.error('Make sure the server is running on localhost:3000');
    }
};

/**
 * Check if server is running
 */
const checkServer = async () => {
    try {
        await axios.get(`${BASE_URL}/health`);
        return true;
    } catch (error) {
        return false;
    }
};

// Main execution
const main = async () => {
    console.log('🔍 Checking if server is running...');
    
    const serverRunning = await checkServer();
    if (!serverRunning) {
        console.log('❌ Server is not running on localhost:3000');
        console.log('Please start the server with: npm start');
        process.exit(1);
    }
    
    console.log('✅ Server is running\n');
    await runTests();
};

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n⚠️ Tests interrupted');
    process.exit(1);
});

// Run tests
main().catch(console.error);