const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testSimpleRequest() {
    try {
        console.log('🌐 === TESTE SIMPLES DE REQUISIÇÃO ===\n');
        
        const baseURL = 'http://localhost:3000';
        const jwtSecret = 'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N';
        
        // 1. Criar token válido
        console.log('1️⃣ Criando token...');
        const token = jwt.sign(
            { 
                id: 1006, 
                email: 'c@c.com',
                name: 'Test User'
            },
            jwtSecret,
            { 
                expiresIn: '24h',
                issuer: 'editaliza' 
            }
        );
        
        console.log(`Token: ${token.substring(0, 50)}...`);
        
        // 2. Testar uma rota simples primeiro (GET /plans)
        console.log('\n2️⃣ Testando rota GET /plans...');
        
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
        console.log('Headers de resposta:', plansResponse.headers);
        
        if (plansResponse.status !== 200) {
            console.log('❌ Falha na rota /plans:', plansResponse.data);
            return;
        }
        
        console.log(`✅ Rota /plans funcionou! ${plansResponse.data.length} planos encontrados`);
        
        // 3. Verificar se o plano 1017 está na lista
        const plan1017 = plansResponse.data.find(p => p.id === 1017);
        if (!plan1017) {
            console.log('❌ Plano 1017 não está na lista de planos do usuário');
            console.log('Planos disponíveis:', plansResponse.data.map(p => ({ id: p.id, name: p.plan_name })));
            return;
        }
        
        console.log(`✅ Plano 1017 encontrado: ${plan1017.plan_name}`);
        
        // 4. Testar rota GET específica do plano
        console.log('\n3️⃣ Testando rota GET /plans/1017...');
        
        const planResponse = await axios({
            method: 'GET',
            url: `${baseURL}/plans/1017`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        console.log('Status:', planResponse.status);
        
        if (planResponse.status !== 200) {
            console.log('❌ Falha na rota /plans/1017:', planResponse.data);
            return;
        }
        
        console.log('✅ Rota /plans/1017 funcionou!');
        
        // 5. Finalmente testar a geração de cronograma
        console.log('\n4️⃣ Testando geração de cronograma...');
        
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
        
        console.log('\n5️⃣ Resposta da geração:');
        console.log('Status:', generateResponse.status);
        console.log('Headers:', generateResponse.headers);
        console.log('Data:', JSON.stringify(generateResponse.data, null, 2));
        
        if (generateResponse.status === 200) {
            console.log('\n🎉 === CRONOGRAMA DO PLANO 1017 GERADO COM SUCESSO ===');
        } else {
            console.log('\n❌ === ERRO NA GERAÇÃO DO CRONOGRAMA DO PLANO 1017 ===');
        }
        
    } catch (error) {
        console.error('\n💥 === ERRO ===');
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('❌ Nenhuma resposta recebida:', error.message);
        } else {
            console.error('❌ Erro na configuração:', error.message);
        }
        
        console.error('Stack:', error.stack);
    }
}

testSimpleRequest();