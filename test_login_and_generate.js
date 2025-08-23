const axios = require('axios');

async function testLoginAndGenerate() {
    try {
        console.log('🔐 === TESTE DE LOGIN E GERAÇÃO DE CRONOGRAMA ===\n');
        
        const baseURL = 'http://localhost:3000';
        
        // 1. Fazer login para obter token válido
        console.log('1️⃣ Fazendo login...');
        
        const loginResponse = await axios({
            method: 'POST',
            url: `${baseURL}/auth/login`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                email: 'debug@test.com',
                password: 'debug123' // Senha padrão para debug
            },
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        if (loginResponse.status !== 200) {
            console.error('❌ Falha no login:', loginResponse.status, loginResponse.data);
            return;
        }
        
        const { token } = loginResponse.data;
        console.log('✅ Login realizado com sucesso!');
        console.log(`Token obtido: ${token.substring(0, 50)}...`);
        
        // 2. Obter lista de planos do usuário
        console.log('\n2️⃣ Obtendo planos do usuário...');
        
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
        
        if (plansResponse.status !== 200) {
            console.error('❌ Falha ao obter planos:', plansResponse.status, plansResponse.data);
            return;
        }
        
        const plans = plansResponse.data;
        console.log(`✅ ${plans.length} planos encontrados:`);
        plans.forEach(plan => {
            console.log(`   - ID: ${plan.id}, Nome: ${plan.plan_name}`);
        });
        
        if (plans.length === 0) {
            console.error('❌ Nenhum plano encontrado!');
            return;
        }
        
        // 3. Usar o primeiro plano disponível
        const planId = plans[0].id;
        console.log(`\n3️⃣ Usando plano ID: ${planId}`);
        
        // 4. Verificar se o plano tem disciplinas e tópicos
        console.log('\n4️⃣ Verificando disciplinas do plano...');
        
        const subjectsResponse = await axios({
            method: 'GET',
            url: `${baseURL}/plans/${planId}/subjects_with_topics`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        if (subjectsResponse.status !== 200) {
            console.error('❌ Falha ao obter disciplinas:', subjectsResponse.status, subjectsResponse.data);
            return;
        }
        
        const subjects = subjectsResponse.data;
        console.log(`✅ ${subjects.length} disciplinas encontradas`);
        
        let totalTopics = 0;
        subjects.forEach(subject => {
            totalTopics += subject.topics.length;
            console.log(`   - ${subject.subject_name}: ${subject.topics.length} tópicos`);
        });
        
        if (totalTopics === 0) {
            console.error('❌ Nenhum tópico encontrado! É necessário ter tópicos para gerar cronograma.');
            return;
        }
        
        console.log(`\n📊 Total de tópicos: ${totalTopics}`);
        
        // 5. Tentar gerar cronograma
        console.log('\n5️⃣ Gerando cronograma...');
        
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
            reta_final_mode: false // Testar primeiro sem modo reta final
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
            timeout: 60000, // 60 segundos de timeout
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        console.log('\n6️⃣ Resposta da geração:');
        console.log('Status:', generateResponse.status);
        console.log('Data:', JSON.stringify(generateResponse.data, null, 2));
        
        if (generateResponse.status === 200) {
            console.log('\n🎉 === CRONOGRAMA GERADO COM SUCESSO ===');
        } else {
            console.log('\n❌ === ERRO NA GERAÇÃO DO CRONOGRAMA ===');
            console.log('Status Code:', generateResponse.status);
            console.log('Error:', generateResponse.data);
        }
        
    } catch (error) {
        console.error('\n💥 === ERRO NO TESTE ===');
        
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Servidor não está rodando');
        } else if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('❌ Nenhuma resposta recebida do servidor');
        } else {
            console.error('❌ Erro:', error.message);
        }
        
        console.error('\nStack trace:', error.stack);
    }
}

// Executar teste
testLoginAndGenerate();