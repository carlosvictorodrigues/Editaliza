/**
 * TESTE DIAGNÓSTICO COMPLETO - SISTEMA EDITALIZA
 * 
 * Identifica exatamente onde o sistema está falhando
 * Testa cada endpoint individualmente com timeouts curtos
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
const TIMEOUT = 5000; // 5 segundos para cada requisição

// Configuração do axios com timeout
const api = axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT,
    validateStatus: function (status) {
        return status < 500; // Aceita qualquer status < 500 para análise
    }
});

// Resultados do diagnóstico
const diagnostico = {
    timestamp: new Date().toISOString(),
    servidor_online: false,
    rotas_funcionando: [],
    rotas_com_erro: [],
    rotas_travando: [],
    resumo: {}
};

// Lista de endpoints para testar
const endpoints = [
    // Health Check
    { method: 'GET', url: '/health', desc: 'Health Check Básico', auth: false },
    { method: 'GET', url: '/api/health', desc: 'API Health Check', auth: false },
    
    // Autenticação
    { method: 'POST', url: '/api/auth/register', desc: 'Registro de Usuário', auth: false, data: {
        name: 'Teste Diagnóstico',
        email: 'teste.diagnostico@email.com',
        password: 'senha123'
    }},
    { method: 'POST', url: '/api/auth/login', desc: 'Login de Usuário', auth: false, data: {
        email: 'teste.diagnostico@email.com',
        password: 'senha123'
    }},
    
    // Profile (com autenticação)
    { method: 'GET', url: '/api/profile', desc: 'Perfil do Usuário', auth: true },
    
    // Plans
    { method: 'GET', url: '/api/plans', desc: 'Lista de Planos', auth: true },
    { method: 'POST', url: '/api/plans', desc: 'Criar Plano', auth: true, data: {
        name: 'Plano Teste Diagnóstico',
        description: 'Plano criado para teste diagnóstico',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
    }},
    
    // Subjects
    { method: 'GET', url: '/api/subjects', desc: 'Lista de Matérias', auth: true },
    
    // Admin (sem autenticação específica)
    { method: 'GET', url: '/api/admin/health', desc: 'Admin Health', auth: false },
    
    // Gamification
    { method: 'GET', url: '/api/gamification/stats', desc: 'Estatísticas de Gamificação', auth: true },
    
    // Sessões
    { method: 'GET', url: '/api/sessions', desc: 'Sessões de Estudo', auth: true }
];

let authToken = null;

/**
 * Testa um endpoint específico
 */
async function testarEndpoint(endpoint) {
    const { method, url, desc, auth, data } = endpoint;
    
    console.log(`\n🔍 Testando: ${method} ${url} - ${desc}`);
    
    try {
        const config = {
            method: method.toLowerCase(),
            url,
            timeout: TIMEOUT
        };
        
        // Adicionar dados se necessário
        if (data) {
            config.data = data;
        }
        
        // Adicionar token de autenticação se necessário
        if (auth && authToken) {
            config.headers = {
                'Authorization': `Bearer ${authToken}`
            };
        }
        
        const startTime = Date.now();
        const response = await api(config);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const resultado = {
            endpoint: `${method} ${url}`,
            desc,
            status: response.status,
            success: response.status >= 200 && response.status < 300,
            responseTime: `${responseTime}ms`,
            data: response.data ? JSON.stringify(response.data).substring(0, 200) + '...' : null
        };
        
        if (resultado.success) {
            console.log(`✅ SUCESSO (${response.status}) - ${responseTime}ms`);
            diagnostico.rotas_funcionando.push(resultado);
            
            // Se for login bem-sucedido, salvar token
            if (url === '/api/auth/login' && response.data && response.data.token) {
                authToken = response.data.token;
                console.log(`🔑 Token de autenticação obtido: ${authToken.substring(0, 20)}...`);
            }
        } else {
            console.log(`⚠️ ERRO HTTP (${response.status}) - ${responseTime}ms`);
            console.log(`📋 Response: ${JSON.stringify(response.data).substring(0, 200)}`);
            diagnostico.rotas_com_erro.push(resultado);
        }
        
        return resultado;
        
    } catch (error) {
        console.log(`❌ FALHOU: ${error.message}`);
        
        const resultado = {
            endpoint: `${method} ${url}`,
            desc,
            error: error.code || error.message,
            timeout: error.code === 'ECONNABORTED' || error.message.includes('timeout'),
            connection: error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND'
        };
        
        if (resultado.timeout) {
            diagnostico.rotas_travando.push(resultado);
        } else {
            diagnostico.rotas_com_erro.push(resultado);
        }
        
        return resultado;
    }
}

/**
 * Testa se o servidor está online
 */
async function testarServidorOnline() {
    console.log('\n🌐 Testando se servidor está online...');
    
    try {
        const response = await api.get('/', { timeout: 3000 });
        diagnostico.servidor_online = true;
        console.log('✅ Servidor online!');
        return true;
    } catch (error) {
        console.log(`❌ Servidor offline ou inacessível: ${error.message}`);
        diagnostico.servidor_online = false;
        return false;
    }
}

/**
 * Gera relatório final
 */
function gerarRelatorio() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO DIAGNÓSTICO COMPLETO');
    console.log('='.repeat(60));
    
    console.log(`\n🌐 SERVIDOR: ${diagnostico.servidor_online ? '✅ Online' : '❌ Offline'}`);
    
    console.log(`\n✅ ROTAS FUNCIONANDO: ${diagnostico.rotas_funcionando.length}`);
    diagnostico.rotas_funcionando.forEach(rota => {
        console.log(`   ${rota.endpoint} - ${rota.desc} (${rota.status}) ${rota.responseTime}`);
    });
    
    console.log(`\n⚠️ ROTAS COM ERRO: ${diagnostico.rotas_com_erro.length}`);
    diagnostico.rotas_com_erro.forEach(rota => {
        console.log(`   ${rota.endpoint} - ${rota.desc} (${rota.status || rota.error})`);
    });
    
    console.log(`\n❌ ROTAS TRAVANDO/TIMEOUT: ${diagnostico.rotas_travando.length}`);
    diagnostico.rotas_travando.forEach(rota => {
        console.log(`   ${rota.endpoint} - ${rota.desc} (${rota.error})`);
    });
    
    // Resumo
    const total = endpoints.length;
    const funcionando = diagnostico.rotas_funcionando.length;
    const erro = diagnostico.rotas_com_erro.length;
    const travando = diagnostico.rotas_travando.length;
    
    diagnostico.resumo = {
        total,
        funcionando,
        erro,
        travando,
        percentual_sucesso: ((funcionando / total) * 100).toFixed(1) + '%'
    };
    
    console.log('\n📈 RESUMO:');
    console.log(`   Total de rotas testadas: ${total}`);
    console.log(`   Funcionando: ${funcionando} (${diagnostico.resumo.percentual_sucesso})`);
    console.log(`   Com erro: ${erro}`);
    console.log(`   Travando: ${travando}`);
    
    // Identificar problema principal
    console.log('\n🎯 DIAGNÓSTICO:');
    if (!diagnostico.servidor_online) {
        console.log('❌ PROBLEMA PRINCIPAL: Servidor não está online ou acessível');
    } else if (travando > 0) {
        console.log('❌ PROBLEMA PRINCIPAL: Algumas rotas estão travando (timeout)');
        console.log('   📝 Possíveis causas: middleware de autenticação, conexão com banco, loops infinitos');
    } else if (erro > funcionando) {
        console.log('❌ PROBLEMA PRINCIPAL: Muitas rotas com erro HTTP');
        console.log('   📝 Possíveis causas: configuração de rotas, controllers, middlewares');
    } else {
        console.log('✅ SISTEMA FUNCIONANDO: Maioria das rotas respondendo corretamente');
    }
}

/**
 * Salvar resultados em arquivo
 */
function salvarResultados() {
    const filename = `diagnostico-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(diagnostico, null, 2));
    console.log(`\n💾 Resultados salvos em: ${filename}`);
}

/**
 * Executar diagnóstico completo
 */
async function executarDiagnostico() {
    console.log('🚀 INICIANDO DIAGNÓSTICO COMPLETO DO SISTEMA EDITALIZA');
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log(`⏱️ Timeout por requisição: ${TIMEOUT}ms`);
    
    // 1. Testar se servidor está online
    const servidorOnline = await testarServidorOnline();
    
    if (!servidorOnline) {
        console.log('\n❌ DIAGNÓSTICO INTERROMPIDO: Servidor não está acessível');
        gerarRelatorio();
        salvarResultados();
        return;
    }
    
    // 2. Testar todos os endpoints
    console.log('\n🔍 Testando endpoints individuais...');
    
    for (const endpoint of endpoints) {
        await testarEndpoint(endpoint);
        // Pequena pausa entre requisições
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 3. Gerar relatório final
    gerarRelatorio();
    salvarResultados();
    
    console.log('\n🏁 DIAGNÓSTICO CONCLUÍDO!');
}

// Executar diagnóstico
if (require.main === module) {
    executarDiagnostico().catch(error => {
        console.error('\n💥 ERRO FATAL NO DIAGNÓSTICO:', error);
        process.exit(1);
    });
}

module.exports = { executarDiagnostico, testarEndpoint, BASE_URL };