const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testCronogramaHTTP() {
    try {
        console.log('🌐 === TESTE HTTP DA GERAÇÃO DE CRONOGRAMA ===\n');
        
        const baseURL = 'http://localhost:3000';
        const planId = 1019; // Usar plano que pertence ao usuário debug@test.com
        
        // Gerar token para o usuário debug@test.com (user_id: 1013)
        const token = jwt.sign(
            { id: 1013, email: 'debug@test.com' },
            'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N',
            { expiresIn: '1h' }
        );
        
        console.log('1️⃣ Token gerado para debug@test.com (user_id: 1013)');
        
        // Parâmetros para a requisição
        const requestData = {
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
        
        console.log('2️⃣ Parâmetros da requisição:', JSON.stringify(requestData, null, 2));
        
        // Fazer requisição para gerar cronograma
        console.log('\n3️⃣ Fazendo requisição HTTP...');
        
        const response = await axios({
            method: 'POST',
            url: `${baseURL}/plans/${planId}/generate`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: requestData,
            timeout: 30000, // 30 segundos de timeout
            validateStatus: function (status) {
                return status < 600; // Aceitar qualquer status < 600 para capturar erros
            }
        });
        
        console.log('\n4️⃣ Resposta recebida:');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
        if (response.status === 200) {
            console.log('\n✅ === CRONOGRAMA GERADO COM SUCESSO ===');
        } else {
            console.log('\n❌ === ERRO NA GERAÇÃO DO CRONOGRAMA ===');
            console.log('Status Code:', response.status);
            console.log('Error:', response.data);
        }
        
    } catch (error) {
        console.error('\n💥 === ERRO HTTP ===');
        
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Servidor não está rodando. Por favor, inicie o servidor primeiro.');
        } else if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Status Text:', error.response.statusText);
            console.error('Headers:', error.response.headers);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('❌ Nenhuma resposta recebida do servidor');
            console.error('Request:', error.request);
        } else {
            console.error('❌ Erro na configuração da requisição:', error.message);
        }
        
        console.error('\nStack trace:', error.stack);
    }
}

// Executar teste
testCronogramaHTTP();