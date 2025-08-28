// Test do Sistema Editaliza v2.0

const fs = require('fs');

// Configuração para output colorido
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, type = 'info') {
    const color = {
        success: colors.green,
        error: colors.red,
        warning: colors.yellow,
        info: colors.blue,
        test: colors.cyan
    }[type] || colors.reset;
    
    console.log(`${color}${message}${colors.reset}`);
}

async function testAPI(endpoint, options = {}) {
    const baseUrl = 'http://localhost:3000';
    const url = baseUrl + endpoint;
    
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        
        const data = await response.json().catch(() => null);
        
        return {
            status: response.status,
            ok: response.ok,
            data,
            headers: response.headers
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message
        };
    }
}

async function runTests() {
    log('\n========================================', 'test');
    log('   TESTE COMPLETO DO SISTEMA EDITALIZA', 'test');
    log('========================================\n', 'test');
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };
    
    // 1. TESTE DE HEALTH CHECK
    log('\n📋 1. HEALTH CHECK', 'info');
    let test = await testAPI('/health');
    results.total++;
    if (test.ok) {
        log('✅ Health check funcionando', 'success');
        log(`   Database: ${test.data.database}`, 'info');
        log(`   Version: ${test.data.version}`, 'info');
        results.passed++;
    } else {
        log('❌ Health check falhou', 'error');
        results.failed++;
    }
    results.tests.push({ name: 'Health Check', passed: test.ok });
    
    // 2. TESTE DE REGISTRO
    log('\n📋 2. REGISTRO DE USUÁRIO', 'info');
    const randomUser = `user_${Date.now()}@test.com`;
    test = await testAPI('/api/auth/register', {
        method: 'POST',
        body: {
            email: randomUser,
            password: 'Test123!@#',
            name: 'Test User'
        }
    });
    results.total++;
    let authToken = null;
    let userId = null;
    
    if (test.ok && test.data.token) {
        log('✅ Registro funcionando', 'success');
        authToken = test.data.token;
        userId = test.data.user?.id;
        log(`   Token recebido: ${authToken.substring(0, 20)}...`, 'info');
        results.passed++;
    } else {
        log('❌ Registro falhou', 'error');
        log(`   Erro: ${test.data?.error || 'Unknown'}`, 'error');
        results.failed++;
    }
    results.tests.push({ name: 'Registro', passed: test.ok });
    
    // 3. TESTE DE LOGIN
    log('\n📋 3. LOGIN', 'info');
    test = await testAPI('/api/auth/login', {
        method: 'POST',
        body: {
            email: randomUser,
            password: 'Test123!@#'
        }
    });
    results.total++;
    
    if (test.ok && test.data.token) {
        log('✅ Login funcionando', 'success');
        authToken = test.data.token; // Atualiza o token
        results.passed++;
    } else {
        log('❌ Login falhou', 'error');
        results.failed++;
    }
    results.tests.push({ name: 'Login', passed: test.ok });
    
    // 4. TESTE DE CRIAÇÃO DE PLANO
    log('\n📋 4. CRIAÇÃO DE PLANO', 'info');
    let planId = null;
    
    if (authToken) {
        test = await testAPI('/api/plans', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: {
                goal: 'Passar no concurso dos sonhos',
                deadline: '2025-12-31',
                study_hours_per_day: 4
            }
        });
        results.total++;
        
        if (test.ok && test.data.id) {
            log('✅ Criação de plano funcionando', 'success');
            planId = test.data.id;
            log(`   Plano ID: ${planId}`, 'info');
            results.passed++;
        } else {
            log('❌ Criação de plano falhou', 'error');
            log(`   Erro: ${test.data?.error || JSON.stringify(test.data)}`, 'error');
            results.failed++;
        }
        results.tests.push({ name: 'Criar Plano', passed: test.ok });
    }
    
    // 5. TESTE DE ADICIONAR DISCIPLINAS
    log('\n📋 5. ADICIONAR DISCIPLINAS', 'info');
    
    if (authToken && planId) {
        test = await testAPI(`/api/plans/${planId}/subjects_with_topics`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: {
                subject_name: 'Português',
                priority_weight: 5,
                topics_list: 'Gramática\nInterpretação de texto\nRedação'
            }
        });
        results.total++;
        
        if (test.ok) {
            log('✅ Adicionar disciplinas funcionando', 'success');
            results.passed++;
        } else {
            log('❌ Adicionar disciplinas falhou', 'error');
            log(`   Erro: ${test.data?.error || JSON.stringify(test.data)}`, 'error');
            results.failed++;
        }
        results.tests.push({ name: 'Adicionar Disciplinas', passed: test.ok });
    }
    
    // 6. TESTE DE GAMIFICAÇÃO
    log('\n📋 6. SISTEMA DE GAMIFICAÇÃO', 'info');
    
    if (authToken) {
        // 6.1 Ver estatísticas
        test = await testAPI('/api/gamification/stats', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        results.total++;
        
        if (test.ok) {
            log('✅ Estatísticas de gamificação funcionando', 'success');
            log(`   XP Total: ${test.data.xp_total || 0}`, 'info');
            log(`   Nível: ${test.data.level || 1}`, 'info');
            results.passed++;
        } else {
            log('❌ Estatísticas de gamificação falharam', 'error');
            results.failed++;
        }
        results.tests.push({ name: 'Gamificação Stats', passed: test.ok });
        
        // 6.2 Adicionar XP
        test = await testAPI('/api/gamification/add-xp', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: {
                points: 100,
                reason: 'Completou sessão de estudos'
            }
        });
        results.total++;
        
        if (test.ok) {
            log('✅ Sistema de XP funcionando', 'success');
            results.passed++;
        } else {
            log('❌ Sistema de XP falhou', 'error');
            results.failed++;
        }
        results.tests.push({ name: 'Adicionar XP', passed: test.ok });
    }
    
    // 7. TESTE DE CRONOGRAMA
    log('\n📋 7. CRONOGRAMA', 'info');
    
    if (authToken && planId) {
        test = await testAPI('/api/schedules/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: {
                plan_id: planId
            }
        });
        results.total++;
        
        if (test.ok) {
            log('✅ Geração de cronograma funcionando', 'success');
            results.passed++;
        } else {
            log('❌ Geração de cronograma falhou', 'error');
            log(`   Erro: ${test.data?.error || JSON.stringify(test.data)}`, 'error');
            results.failed++;
        }
        results.tests.push({ name: 'Gerar Cronograma', passed: test.ok });
    }
    
    // 8. TESTE DE ROTAS ADMIN
    log('\n📋 8. ROTAS ADMIN', 'info');
    
    if (authToken) {
        test = await testAPI('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        results.total++;
        
        // Esperamos 403 (não autorizado) para usuário normal
        if (test.status === 403) {
            log('✅ Proteção admin funcionando (403 esperado)', 'success');
            results.passed++;
        } else {
            log('⚠️ Verificar proteção admin', 'warning');
            results.failed++;
        }
        results.tests.push({ name: 'Proteção Admin', passed: test.status === 403 });
    }
    
    // RESUMO FINAL
    log('\n========================================', 'test');
    log('           RESUMO DOS TESTES', 'test');
    log('========================================', 'test');
    
    log(`\nTotal de testes: ${results.total}`, 'info');
    log(`✅ Passou: ${results.passed}`, 'success');
    log(`❌ Falhou: ${results.failed}`, 'error');
    log(`Taxa de sucesso: ${((results.passed/results.total)*100).toFixed(1)}%`, 
        results.passed === results.total ? 'success' : 'warning');
    
    // Salvar resultados
    const timestamp = Date.now();
    fs.writeFileSync(
        `test-results-${timestamp}.json`, 
        JSON.stringify(results, null, 2)
    );
    
    log(`\n📁 Resultados salvos em: test-results-${timestamp}.json`, 'info');
    
    // Status table
    log('\n📊 STATUS DETALHADO:', 'info');
    console.table(results.tests);
    
    return results;
}

// Executar testes
runTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
    log(`\n❌ Erro fatal: ${error.message}`, 'error');
    process.exit(1);
});