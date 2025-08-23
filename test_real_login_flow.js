const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const util = require('util');

// Conectar ao banco de dados
const db = new sqlite3.Database('./db.sqlite');
const dbGet = util.promisify(db.get.bind(db));
const dbRun = util.promisify(db.run.bind(db));

async function testRealLoginFlow() {
    try {
        console.log('🔄 === TESTE DE FLUXO DE LOGIN REAL ===\n');
        
        const baseURL = 'http://localhost:3000';
        
        // 1. Verificar usuário e criar/atualizar senha
        console.log('1️⃣ Preparando usuário para teste...');
        
        const user = await dbGet('SELECT * FROM users WHERE email = ?', ['c@c.com']);
        if (!user) {
            console.error('❌ Usuário c@c.com não encontrado');
            return;
        }
        
        console.log(`✅ Usuário encontrado: ${user.email} (ID: ${user.id})`);
        
        // 2. Definir uma senha conhecida para teste
        const testPassword = 'test123456';
        const hashedPassword = await bcrypt.hash(testPassword, 12);
        
        console.log('2️⃣ Atualizando senha do usuário para teste...');
        await dbRun('UPDATE users SET password_hash = ?, auth_provider = ? WHERE id = ?', [hashedPassword, 'local', user.id]);
        console.log('✅ Senha atualizada');
        
        // 3. Fazer login real
        console.log('\n3️⃣ Fazendo login real...');
        
        const loginResponse = await axios({
            method: 'POST',
            url: `${baseURL}/auth/login`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                email: 'c@c.com',
                password: testPassword
            },
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        console.log('Status do login:', loginResponse.status);
        
        if (loginResponse.status !== 200) {
            console.error('❌ Falha no login:', loginResponse.data);
            return;
        }
        
        const { token } = loginResponse.data;
        console.log('✅ Login bem-sucedido!');
        console.log(`Token recebido: ${token.substring(0, 50)}...`);
        
        // 4. Testar rota de planos
        console.log('\n4️⃣ Testando rota /plans com token real...');
        
        const plansResponse = await axios({
            method: 'GET',
            url: `${baseURL}/plans`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        console.log('Status:', plansResponse.status);
        
        if (plansResponse.status !== 200) {
            console.error('❌ Falha na rota /plans:', plansResponse.data);
            return;
        }
        
        console.log(`✅ Rota /plans funcionou! ${plansResponse.data.length} planos encontrados`);
        
        const plan1017 = plansResponse.data.find(p => p.id === 1017);
        if (!plan1017) {
            console.log('❌ Plano 1017 não encontrado na lista');
            console.log('Planos disponíveis:', plansResponse.data.map(p => ({ id: p.id, name: p.plan_name })));
            return;
        }
        
        console.log(`✅ Plano 1017 encontrado: ${plan1017.plan_name}`);
        
        // 5. Testar geração de cronograma
        console.log('\n5️⃣ Testando geração de cronograma para plano 1017...');
        
        const generateData = {
            daily_question_goal: 50,
            weekly_question_goal: 350,
            session_duration_minutes: 50,
            study_hours_per_day: {
                "0": 2,
                "1": 2, 
                "2": 2,
                "3": 2,
                "4": 2,
                "5": 2,
                "6": 2
            },
            has_essay: true,
            reta_final_mode: true
        };
        
        console.log('Parâmetros:', JSON.stringify(generateData, null, 2));
        
        const generateResponse = await axios({
            method: 'POST',
            url: `${baseURL}/plans/1017/generate`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: generateData,
            timeout: 60000,
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        console.log('\n6️⃣ Resposta da geração:');
        console.log('Status:', generateResponse.status);
        console.log('Data:', JSON.stringify(generateResponse.data, null, 2));
        
        if (generateResponse.status === 200) {
            console.log('\n🎉 === CRONOGRAMA DO PLANO 1017 GERADO COM SUCESSO ===');
            console.log('Performance:', generateResponse.data.performance);
            console.log('Reta Final:', generateResponse.data.retaFinal);
        } else {
            console.log('\n❌ === ERRO NA GERAÇÃO DO CRONOGRAMA ===');
            console.log('Status:', generateResponse.status);
            console.log('Error:', generateResponse.data);
        }
        
    } catch (error) {
        console.error('\n💥 === ERRO NO TESTE ===');
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
        
        console.error('Stack:', error.stack);
    } finally {
        db.close();
    }
}

testRealLoginFlow();