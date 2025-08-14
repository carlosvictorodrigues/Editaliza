const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const bcrypt = require('bcrypt');
const axios = require('axios');

// Conectar ao banco de dados
const db = new sqlite3.Database('./db.sqlite');
const dbGet = util.promisify(db.get.bind(db));
const dbAll = util.promisify(db.all.bind(db));
const dbRun = util.promisify(db.run.bind(db));

async function testPlan1017Specific() {
    try {
        console.log('🎯 === TESTE ESPECÍFICO DO PLANO 1017 ===\n');
        
        // 1. Verificar o plano 1017 e seu usuário
        console.log('1️⃣ Verificando plano 1017...');
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ?', [1017]);
        
        if (!plan) {
            console.error('❌ Plano 1017 não encontrado!');
            return;
        }
        
        console.log(`✅ Plano encontrado: ${plan.plan_name} (User ID: ${plan.user_id})`);
        
        // 2. Verificar o usuário dono do plano
        console.log('\n2️⃣ Verificando usuário dono do plano...');
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [plan.user_id]);
        
        if (!user) {
            console.error(`❌ Usuário com ID ${plan.user_id} não encontrado!`);
            return;
        }
        
        console.log(`✅ Usuário encontrado: ${user.email} (ID: ${user.id})`);
        
        // 3. Verificar se há senha ou se é usuário OAuth
        if (user.auth_provider === 'google') {
            console.log('⚠️ Usuário é OAuth Google, não posso testar com senha');
            
            // Criar um token diretamente para teste
            const jwt = require('jsonwebtoken');
            const jwtSecret = 'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N';
            
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    name: user.name 
                },
                jwtSecret,
                { 
                    expiresIn: '24h',
                    issuer: 'editaliza' 
                }
            );
            
            console.log('✅ Token direto gerado para teste');
            
            // Testar geração de cronograma diretamente
            await testGenerateWithToken(token, 1017);
            
        } else if (user.password_hash) {
            console.log('✅ Usuário tem senha, mas precisaríamos da senha original para testar');
            console.log('   Criando token diretamente para teste...');
            
            const jwt = require('jsonwebtoken');
            const jwtSecret = 'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N';
            
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    name: user.name 
                },
                jwtSecret,
                { 
                    expiresIn: '24h',
                    issuer: 'editaliza' 
                }
            );
            
            console.log('✅ Token direto gerado para teste');
            
            // Testar geração de cronograma diretamente
            await testGenerateWithToken(token, 1017);
        } else {
            console.error('❌ Usuário não tem senha nem é OAuth');
            return;
        }
        
        // 4. Verificar dados do plano
        console.log('\n4️⃣ Verificando dados do plano 1017...');
        
        const subjects = await dbAll('SELECT * FROM subjects WHERE study_plan_id = ?', [1017]);
        console.log(`   - Disciplinas: ${subjects.length}`);
        
        const topics = await dbAll('SELECT t.* FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [1017]);
        console.log(`   - Tópicos: ${topics.length}`);
        
        const sessions = await dbAll('SELECT * FROM study_sessions WHERE study_plan_id = ?', [1017]);
        console.log(`   - Sessões existentes: ${sessions.length}`);
        
        if (subjects.length === 0) {
            console.error('❌ Plano não tem disciplinas!');
            return;
        }
        
        if (topics.length === 0) {
            console.error('❌ Plano não tem tópicos!');
            return;
        }
        
        console.log('✅ Plano tem dados suficientes para gerar cronograma');
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        db.close();
    }
}

async function testGenerateWithToken(token, planId) {
    try {
        console.log('\n5️⃣ Testando geração de cronograma...');
        
        const baseURL = 'http://localhost:3000';
        
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
            url: `${baseURL}/plans/${planId}/generate`,
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
        } else {
            console.log('\n❌ === ERRO NA GERAÇÃO DO CRONOGRAMA DO PLANO 1017 ===');
            console.log('Status Code:', generateResponse.status);
            console.log('Error:', generateResponse.data);
        }
        
    } catch (error) {
        console.error('\n💥 === ERRO NO TESTE HTTP ===');
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Executar teste
testPlan1017Specific();