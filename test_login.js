const http = require('http');

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
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('Response:', data);
        try {
            const response = JSON.parse(data);
            if (response.token) {
                console.log('✅ Token obtido:', response.token.substring(0, 20) + '...');
                
                // Agora testar o endpoint schedule_preview
                testSchedulePreview(response.token);
            } else {
                console.log('❌ Token não encontrado na resposta');
            }
        } catch (error) {
            console.log('❌ Erro ao parsear resposta:', error.message);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Erro na requisição:', error.message);
});

req.write(postData);
req.end();

function testSchedulePreview(token) {
    console.log('\n🔍 Testando endpoint schedule_preview...');
    
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
        console.log(`Status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log('Response:', data);
            try {
                const response = JSON.parse(data);
                if (response.completedTopics !== undefined) {
                    console.log(`\n🎯 RESULTADO FINAL:`);
                    console.log(`  - Tópicos concluídos: ${response.completedTopics}`);
                    console.log(`  - Total de tópicos: ${response.totalTopics}`);
                    console.log(`  - Progresso: ${response.currentProgress}%`);
                    
                    if (response.completedTopics === 2) {
                        console.log('✅ SUCESSO! O endpoint está retornando os dados corretos!');
                    } else {
                        console.log('❌ PROBLEMA! O endpoint não está retornando os dados corretos.');
                    }
                }
            } catch (error) {
                console.log('❌ Erro ao parsear resposta:', error.message);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Erro na requisição:', error.message);
    });

    req.end();
} 