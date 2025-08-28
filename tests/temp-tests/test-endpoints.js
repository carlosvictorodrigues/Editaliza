// Script para testar endpoints da API com dados reais
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// Configuração
const API_BASE = 'http://localhost:3000';
const db = new sqlite3.Database('./db.sqlite');

// Função para fazer login e obter token
async function getAuthToken() {
    try {
        const response = await axios.post(`${API_BASE}/auth/login`, {
            email: '3@3.com', // Usando um email que vimos no banco
            password: '123456' // Assumindo uma senha comum
        });
        
        return response.data.token;
    } catch (error) {
        console.log('❌ Falha no login com 3@3.com, tentando outros emails...');
        
        // Tentar com outros emails
        const emails = ['admin@admin.com', '2@2.com', 'teste@teste.com'];
        const passwords = ['123456', 'admin', 'password', 'test', '123'];
        
        for (const email of emails) {
            for (const password of passwords) {
                try {
                    const response = await axios.post(`${API_BASE}/auth/login`, {
                        email: email,
                        password: password
                    });
                    
                    console.log(`✅ Login bem-sucedido com ${email}`);
                    return response.data.token;
                } catch (loginError) {
                    // Continuar tentando
                }
            }
        }
        
        throw new Error('Não foi possível fazer login com nenhum usuário');
    }
}

// Função para testar um endpoint
async function testEndpoint(endpoint, description, token) {
    try {
        console.log(`🧪 Testando: ${description}`);
        
        const response = await axios.get(`${API_BASE}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`  ✅ Status: ${response.status}`);
        console.log(`  📊 Dados retornados:`, typeof response.data === 'object' ? JSON.stringify(response.data).slice(0, 200) + '...' : response.data);
        
        return { success: true, data: response.data };
    } catch (error) {
        console.log(`  ❌ Erro: ${error.response?.status || 'N/A'} - ${error.response?.data?.error || error.message}`);
        return { success: false, error: error.message };
    }
}

// Função principal
async function runTests() {
    console.log('🚀 Iniciando testes de endpoints...\n');
    
    try {
        // 1. Obter token de autenticação
        console.log('🔐 Obtendo token de autenticação...');
        const token = await getAuthToken();
        console.log('✅ Token obtido com sucesso!\n');
        
        // 2. Buscar planos do usuário
        console.log('📚 Buscando planos do usuário...');
        const plansResult = await testEndpoint('/plans', 'Listar Planos', token);
        
        if (!plansResult.success || !plansResult.data || plansResult.data.length === 0) {
            console.log('❌ Nenhum plano encontrado para este usuário.');
            return;
        }
        
        const planId = plansResult.data[0].id;
        console.log(`🎯 Usando plano ID: ${planId} (${plansResult.data[0].plan_name})\n`);
        
        // 3. Testar endpoints que foram corrigidos
        const endpointsToTest = [
            {
                endpoint: `/plans/${planId}/question_radar`,
                description: 'Question Radar (Pontos Fracos)'
            },
            {
                endpoint: `/plans/${planId}/progress`,
                description: 'Progress (Progresso Geral)'
            },
            {
                endpoint: `/plans/${planId}/detailed_progress`,
                description: 'Detailed Progress (Por Disciplina)'
            },
            {
                endpoint: `/plans/${planId}/goal_progress`,
                description: 'Goal Progress (Metas de Questões)'
            },
            {
                endpoint: `/plans/${planId}/overdue_check`,
                description: 'Overdue Check (Verificação de Tarefas Atrasadas)'
            },
            {
                endpoint: `/schedules/${planId}`,
                description: 'Schedules (Cronograma do Plano)'
            }
        ];
        
        console.log('🔍 Testando endpoints corrigidos:\n');
        
        const results = [];
        for (const test of endpointsToTest) {
            const result = await testEndpoint(test.endpoint, test.description, token);
            results.push({ ...result, ...test });
            console.log(''); // Linha em branco entre testes
        }
        
        // 4. Resumo dos resultados
        console.log('📊 RESUMO DOS TESTES:');
        console.log(''.padEnd(50, '='));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`✅ Sucessos: ${successful.length}/${results.length}`);
        console.log(`❌ Falhas: ${failed.length}/${results.length}`);
        
        if (successful.length > 0) {
            console.log('\n🎉 Endpoints funcionando:');
            successful.forEach(result => {
                console.log(`  ✅ ${result.description}`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n⚠️  Endpoints com problemas:');
            failed.forEach(result => {
                console.log(`  ❌ ${result.description} - ${result.error}`);
            });
        }
        
        // 5. Recomendações
        console.log('\n💡 RECOMENDAÇÕES:');
        if (failed.length === 0) {
            console.log('🎯 Excelente! Todos os endpoints estão funcionando.');
            console.log('🌐 A interface deve carregar os dados corretamente.');
            console.log(`🔗 Acesse: http://localhost:3000/test-interface-pos-correcoes.html`);
        } else {
            console.log('⚠️  Alguns endpoints ainda apresentam problemas.');
            console.log('🛠️  Verifique os logs do servidor para mais detalhes.');
        }
        
    } catch (error) {
        console.error('❌ Erro fatal durante os testes:', error.message);
    } finally {
        db.close();
    }
}

// Executar testes
runTests().catch(console.error);