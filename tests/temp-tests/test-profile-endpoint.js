const jwt = require('jsonwebtoken');
const axios = require('axios');

// Gerar token de teste
const testUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User'
};

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura_aqui_2024';
const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });

console.log('Token gerado:', token);

// Testar endpoint
async function testProfileEndpoint() {
    try {
        console.log('Testando GET /api/profile...');
        
        const response = await axios.get('http://localhost:3001/api/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 segundos timeout
        });
        
        console.log('✅ Sucesso!');
        console.log('Status:', response.status);
        console.log('Dados:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ Erro:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Dados:', error.response.data);
        } else if (error.request) {
            console.log('Timeout ou erro de rede:', error.message);
        } else {
            console.log('Erro:', error.message);
        }
    }
}

testProfileEndpoint();