const axios = require('axios');

async function testCreateUserAndGenerate() {
    try {
        console.log('👤 === TESTE DE CRIAÇÃO DE USUÁRIO E GERAÇÃO DE CRONOGRAMA ===\n');
        
        const baseURL = 'http://localhost:3000';
        const testEmail = `test_${Date.now()}@editaliza.com`;
        const testPassword = 'test123456';
        
        // 1. Criar um novo usuário
        console.log('1️⃣ Criando novo usuário de teste...');
        console.log(`Email: ${testEmail}`);
        console.log(`Senha: ${testPassword}`);
        
        const registerResponse = await axios({
            method: 'POST',
            url: `${baseURL}/auth/register`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                email: testEmail,
                password: testPassword,
                name: 'Usuário de Teste'
            },
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        if (registerResponse.status !== 201) {
            console.error('❌ Falha na criação do usuário:', registerResponse.status, registerResponse.data);
            return;
        }
        
        console.log('✅ Usuário criado com sucesso!');
        
        // 2. Fazer login
        console.log('\n2️⃣ Fazendo login...');
        
        const loginResponse = await axios({
            method: 'POST',
            url: `${baseURL}/auth/login`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                email: testEmail,
                password: testPassword
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
        
        // 3. Criar um plano de estudos
        console.log('\n3️⃣ Criando plano de estudos...');
        
        const planData = {
            plan_name: 'Plano de Teste',
            exam_date: '2025-12-31'
        };
        
        const planResponse = await axios({
            method: 'POST',
            url: `${baseURL}/plans`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: planData,
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        if (planResponse.status !== 201) {
            console.error('❌ Falha na criação do plano:', planResponse.status, planResponse.data);
            return;
        }
        
        console.log('Resposta completa da criação do plano:', JSON.stringify(planResponse.data, null, 2));
        
        const planId = planResponse.data.newPlanId || planResponse.data.planId || planResponse.data.id;
        console.log(`✅ Plano criado com sucesso! ID: ${planId}`);
        
        // 4. Adicionar disciplinas e tópicos
        console.log('\n4️⃣ Adicionando disciplinas e tópicos...');
        
        const subjectData = {
            subject_name: 'Matemática',
            priority_weight: 4,
            topics_list: 'Álgebra Linear\nGeometria Analítica\nCálculo Diferencial\nEstatística\nProbabilidade'
        };
        
        const subjectResponse = await axios({
            method: 'POST',
            url: `${baseURL}/plans/${planId}/subjects_with_topics`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: subjectData,
            validateStatus: function (status) {
                return status < 600;
            }
        });
        
        if (subjectResponse.status !== 201) {
            console.error('❌ Falha na criação da disciplina:', subjectResponse.status, subjectResponse.data);
            return;
        }
        
        console.log('✅ Disciplina e tópicos criados com sucesso!');
        
        // 5. Tentar gerar cronograma
        console.log('\n5️⃣ Gerando cronograma...');
        
        const generateData = {
            daily_question_goal: 50,
            weekly_question_goal: 350,
            session_duration_minutes: 50,
            study_hours_per_day: {
                "0": 1,
                "1": 2, 
                "2": 2,
                "3": 2,
                "4": 2,
                "5": 2,
                "6": 1
            },
            has_essay: false,
            reta_final_mode: false
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
            console.log('\n🎉 === CRONOGRAMA GERADO COM SUCESSO ===');
            
            // Verificar se as sessões foram criadas
            console.log('\n7️⃣ Verificando sessões criadas...');
            
            const scheduleResponse = await axios({
                method: 'GET',
                url: `${baseURL}/plans/${planId}/schedule`,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                validateStatus: function (status) {
                    return status < 600;
                }
            });
            
            if (scheduleResponse.status === 200) {
                const sessions = scheduleResponse.data;
                console.log(`✅ ${sessions.length} sessões criadas:`);
                sessions.slice(0, 5).forEach(session => {
                    console.log(`   - ${session.session_date}: ${session.subject_name} - ${session.session_type}`);
                });
                if (sessions.length > 5) {
                    console.log(`   ... e mais ${sessions.length - 5} sessões`);
                }
            }
            
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
testCreateUserAndGenerate();