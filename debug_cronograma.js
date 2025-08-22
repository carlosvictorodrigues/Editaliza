const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Fazer login e tentar gerar cronograma com logging detalhado
const debugCronograma = async () => {
    try {
        console.log('🔐 Fazendo login...');
        
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'debug@test.com',
            password: 'test123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Token obtido');
        
        // Dados mínimos para teste
        const cronogramaData = {
            daily_question_goal: 50,
            weekly_question_goal: 300,
            session_duration_minutes: 90,
            study_hours_per_day: {"0":4,"1":8,"2":8,"3":8,"4":8,"5":8,"6":4},
            has_essay: false,  // Simplificar primeiro
            reta_final_mode: false  // Simplificar primeiro
        };
        
        console.log('📅 Tentando gerar cronograma...');
        
        const response = await axios.post(`${BASE_URL}/plans/1019/generate`, cronogramaData, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Cronograma gerado com sucesso!');
        console.log('📊 Resposta:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Erro:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        
        // Se há logs de debug no servidor, vamos vê-los
        if (error.response?.data?.debug) {
            console.error('🔍 Debug do servidor:', error.response.data.debug);
        }
    }
};

debugCronograma();