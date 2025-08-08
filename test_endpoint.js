const http = require('http');

// Função para fazer login e obter token
function login() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            email: '3@3.com',
            password: '3'
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.token) {
                        resolve(response.token);
                    } else {
                        reject(new Error('Token não encontrado na resposta'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// Função para testar o endpoint schedule_preview
function testSchedulePreview(token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/plans/1/schedule_preview',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

// Executar teste
async function runTest() {
    try {
        console.log('🔐 Fazendo login...');
        const token = await login();
        console.log('✅ Login realizado com sucesso');
        
        console.log('🔍 Testando endpoint schedule_preview...');
        const result = await testSchedulePreview(token);
        console.log('✅ Endpoint testado com sucesso');
        
        console.log('\n📊 RESULTADO:');
        console.log(JSON.stringify(result, null, 2));
        
        // Verificar se os dados estão corretos
        if (result.completedTopics !== undefined) {
            console.log(`\n🎯 TÓPICOS CONCLUÍDOS: ${result.completedTopics}`);
            console.log(`📚 TOTAL DE TÓPICOS: ${result.totalTopics}`);
            console.log(`📈 PROGRESSO: ${result.currentProgress}%`);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

runTest(); 