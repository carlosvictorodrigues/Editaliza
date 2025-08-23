const http = require('http');

// Função para fazer login e obter token
function login() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            email: '3@3.com',
            password: '123456'
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
                        reject(new Error('Token não encontrado'));
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
                    resolve({ status: res.statusCode, data: response });
                } catch (error) {
                    resolve({ status: res.statusCode, data: data });
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
        console.log('✅ Endpoint testado');
        
        console.log(`\n📊 RESULTADO:`);
        console.log(`Status: ${result.status}`);
        
        if (result.status === 200) {
            console.log('✅ SUCESSO! Endpoint funcionando!');
            console.log('Data:', JSON.stringify(result.data, null, 2));
            
            if (result.data.completedTopics === 2) {
                console.log('\n🎯 PERFEITO! Dados corretos retornados!');
                console.log(`  - Tópicos concluídos: ${result.data.completedTopics}`);
                console.log(`  - Total de tópicos: ${result.data.totalTopics}`);
                console.log(`  - Progresso: ${result.data.currentProgress}%`);
            } else {
                console.log('\n❌ Dados incorretos. Esperado: 2 tópicos concluídos');
            }
        } else {
            console.log('❌ Endpoint retornou erro');
            console.log('Data:', result.data);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

runTest(); 