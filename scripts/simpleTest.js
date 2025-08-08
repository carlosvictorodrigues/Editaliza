/**
 * Simple Test for User Routes
 * 
 * Basic test to verify the user routes are accessible
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

/**
 * Make HTTP request
 */
const makeRequest = (path, options = {}) => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: BASE_URL,
            port: PORT,
            path: path,
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
};

/**
 * Test server accessibility
 */
const testServerAccess = async () => {
    console.log('🔍 Testing server accessibility...\n');
    
    try {
        // Test health endpoint
        const healthResponse = await makeRequest('/health');
        console.log(`✅ Health check: ${healthResponse.statusCode}`);
        
        // Test that new user routes respond (should return 401 without auth)
        const userRoutes = [
            '/users/profile',
            '/users/settings', 
            '/users/preferences',
            '/users/statistics'
        ];
        
        for (const route of userRoutes) {
            try {
                const response = await makeRequest(route);
                if (response.statusCode === 401) {
                    console.log(`✅ ${route}: Properly protected (401)`);
                } else if (response.statusCode === 404) {
                    console.log(`❌ ${route}: Not found (404) - Route may not be registered`);
                } else {
                    console.log(`⚠️  ${route}: Unexpected status ${response.statusCode}`);
                }
            } catch (error) {
                console.log(`❌ ${route}: Connection error - ${error.message}`);
            }
        }
        
        // Test that legacy routes are disabled (should return 404)
        const legacyRoutes = ['/profile'];
        
        console.log('\n🔄 Testing legacy route deprecation...');
        for (const route of legacyRoutes) {
            try {
                const response = await makeRequest(route);
                if (response.statusCode === 404) {
                    console.log(`✅ ${route}: Properly deprecated (404)`);
                } else {
                    console.log(`⚠️  ${route}: Still accessible (${response.statusCode}) - Should be deprecated`);
                }
            } catch (error) {
                console.log(`❌ ${route}: Connection error - ${error.message}`);
            }
        }
        
        console.log('\n🎉 Basic connectivity test completed!');
        console.log('Server appears to be running and routes are registered.');
        
    } catch (error) {
        console.error('❌ Server connection failed:', error.message);
        console.error('Make sure the server is running on localhost:3000');
    }
};

// Run test
testServerAccess();