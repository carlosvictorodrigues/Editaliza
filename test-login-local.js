// Script para testar login com PostgreSQL
const fetch = require('node-fetch');

async function testLogin() {
    const baseUrl = 'http://localhost:3001';
    
    try {
        // 1. Registrar novo usuário
        console.log('📝 Registrando novo usuário...');
        const registerResponse = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'postgres@test.com',
                password: 'postgres123',
                name: 'Usuário Teste PostgreSQL'
            })
        });
        
        const registerData = await registerResponse.json();
        console.log('Registro:', registerData);
        
        // 2. Fazer login
        console.log('\n🔐 Fazendo login...');
        const loginResponse = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'teste@editaliza.com',
                password: 'teste123'
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('Login:', loginData);
        
        if (loginData.token) {
            console.log('✅ Login bem-sucedido com PostgreSQL!');
            console.log('Token recebido:', loginData.token.substring(0, 20) + '...');
            
            // 3. Verificar acesso autenticado
            console.log('\n🔍 Verificando acesso autenticado...');
            const profileResponse = await fetch(`${baseUrl}/api/auth/user`, {
                headers: {
                    'Authorization': `Bearer ${loginData.token}`
                }
            });
            
            const profileData = await profileResponse.json();
            console.log('Perfil do usuário:', profileData);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testLogin();