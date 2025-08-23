const https = require('https');

// Configurar para aceitar certificados auto-assinados (apenas para testes locais)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Dados de teste
const credentials = {
    email: '3@3.com',
    password: '123465'
};

async function testOverdueAPI() {
    console.log('🔐 Fazendo login...');
    
    // 1. Fazer login
    const loginResponse = await makeRequest('POST', '/login', credentials);
    
    if (!loginResponse.token) {
        console.error('❌ Falha no login:', loginResponse);
        return;
    }
    
    console.log('✅ Login realizado com sucesso');
    const token = loginResponse.token;
    
    // 2. Buscar planos do usuário
    console.log('\n📋 Buscando planos...');
    const plansResponse = await makeRequest('GET', '/plans', null, token);
    
    if (!plansResponse || plansResponse.length === 0) {
        console.error('❌ Nenhum plano encontrado');
        return;
    }
    
    const planId = plansResponse[0].id;
    console.log(`✅ Plano encontrado: ${plansResponse[0].plan_name} (ID: ${planId})`);
    
    // 3. Verificar tarefas atrasadas
    console.log('\n⚠️  Verificando tarefas atrasadas...');
    const overdueResponse = await makeRequest('GET', `/plans/${planId}/overdue_check`, null, token);
    
    console.log('📊 Resposta do overdue_check:');
    console.log(JSON.stringify(overdueResponse, null, 2));
    
    // Analisar a resposta
    if (Array.isArray(overdueResponse)) {
        console.log(`\n✅ ${overdueResponse.length} tarefas atrasadas encontradas na API`);
        if (overdueResponse.length > 0) {
            console.log('\n📝 Primeiras 3 tarefas atrasadas:');
            overdueResponse.slice(0, 3).forEach((task, index) => {
                console.log(`${index + 1}. ${task.subject_name}: ${task.topic_description}`);
                console.log(`   Data: ${task.session_date}, Tipo: ${task.session_type}`);
            });
        }
        
        console.log('\n🔧 PROBLEMA IDENTIFICADO:');
        console.log('   - A API retorna um array de tarefas atrasadas');
        console.log('   - O frontend espera um objeto com propriedade "count"');
        console.log('   - É necessário ajustar o endpoint ou o frontend');
    } else if (overdueResponse.count !== undefined) {
        console.log(`\n✅ Formato correto - ${overdueResponse.count} tarefas atrasadas`);
    } else {
        console.log('\n❓ Formato de resposta desconhecido');
    }
}

function makeRequest(method, path, data, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (e) {
                    resolve(data);
                }
            });
        });
        
        req.on('error', (e) => {
            reject(e);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Executar teste
testOverdueAPI().catch(console.error);