const axios = require('axios');
const { dbRun, dbGet } = require('./src/utils/database'); // Assuming this path is correct

const BASE_URL = 'http://localhost:3000';

async function registerUser(email, password, planType) {
    console.log('🧪 Registrando usuário ' + email + ' com plano ' + planType + '...\n');

    try {
        // 1. Register user
        console.log('1️⃣ Registrando usuário ' + email + '...');
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
            email: email,
            password: password,
            name: 'Test User' // You can customize the name
        }, {
            validateStatus: () => true
        });

        let userId = null;
        if (registerResponse.status === 201 || registerResponse.status === 200) {
            console.log('   ✅ Usuário ' + email + ' criado com sucesso!');
            userId = registerResponse.data.userId;
            console.log('   ID:', userId);
        } else if (registerResponse.data?.error?.includes('já está em uso')) {
            console.log('   ⚠️ Usuário ' + email + ' já existe. Tentando buscar ID...');
            const user = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
            if (user) {
                userId = user.id;
                console.log('   ID do usuário existente:', userId);
            } else {
                console.log('   ❌ Não foi possível obter o ID do usuário existente.');
                return;
            }
        } else {
            console.log('   ❌ Erro ao criar usuário:', registerResponse.data);
            return;
        }

        // 2. Update subscription plan
        if (userId) {
            console.log('\n2️⃣ Atualizando plano de assinatura para ' + planType + '...');
            const durationDays = 365; // For 'anual' plan

            const updateQuery = `
                UPDATE users SET 
                    plan_type = ?,
                    plan_status = 'active',
                    plan_expiry = NOW() + INTERVAL '${durationDays} days',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            const updateParams = [planType, userId];

            await dbRun(updateQuery, updateParams);
            console.log('   ✅ Plano de assinatura atualizado para ' + planType + ' para o usuário ' + email + '!');
        } else {
            console.log('   ❌ Não foi possível atualizar o plano: userId não encontrado.');
        }

        // 3. Try to login (optional, for verification)
        console.log('\n3️⃣ Testando login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: email,
            password: password
        }, {
            validateStatus: () => true
        });

        if (loginResponse.status === 200) {
            console.log('   ✅ Login funcionando!');
            console.log('   Token:', loginResponse.data.token?.substring(0, 50) + '...');
            console.log('\n✅ Usuário ' + email + ' pronto para uso com plano ' + planType + '!');
            console.log('📝 Credenciais:');
            console.log('   Email: ' + email);
            console.log('   Senha: ' + password);
        } else {
            console.log('   ❌ Login falhou:', loginResponse.data);
        }

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    }
}

// Get arguments from command line
const args = process.argv.slice(2);
const emailArg = args[0];
const passwordArg = args[1];
const planTypeArg = args[2] || 'free'; // Default to 'free' if not provided

if (!emailArg || !passwordArg) {
    console.log('Uso: node register-user.js <email> <senha> [tipo_plano]');
    console.log('Exemplo: node register-user.js u@u.com 123456 anual');
} else {
    registerUser(emailArg, passwordArg, planTypeArg);
}
