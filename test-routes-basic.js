/**
 * TESTE BÁSICO DE ROTAS - VERIFICAÇÃO SIMPLES
 * 
 * Este script testa se as rotas principais estão respondendo
 * sem entrar em detalhes de autenticação ou CSRF
 */

const axios = require('axios');
const colors = require('colors/safe');

// Configuração
const BASE_URL = 'http://localhost:3000';

const log = {
    success: (msg) => console.log(colors.green('✅ ' + msg)),
    error: (msg) => console.log(colors.red('❌ ' + msg)),
    info: (msg) => console.log(colors.blue('ℹ️  ' + msg)),
    warning: (msg) => console.log(colors.yellow('⚠️  ' + msg)),
    section: (msg) => console.log(colors.cyan('\n' + '='.repeat(50) + '\n' + msg + '\n' + '='.repeat(50)))
};

// Testa uma rota específica
async function testRoute(method, path, expectedStatuses = [200], description = '') {
    try {
        const response = await axios({
            method,
            url: `${BASE_URL}${path}`,
            validateStatus: () => true // Aceita qualquer status code
        });
        
        const status = response.status;
        const success = expectedStatuses.includes(status);
        
        if (success) {
            log.success(`${method} ${path} - Status ${status} ${description}`);
            return { success: true, status, path };
        } else {
            log.warning(`${method} ${path} - Status ${status} (esperado: ${expectedStatuses.join('|')}) ${description}`);
            return { success: false, status, path, expected: expectedStatuses };
        }
        
    } catch (error) {
        log.error(`${method} ${path} - Erro: ${error.message} ${description}`);
        return { success: false, error: error.message, path };
    }
}

async function runBasicTests() {
    console.log(colors.bold.cyan(`
╔════════════════════════════════════════════════════════════╗
║           TESTE BÁSICO DE ROTAS - SISTEMA EDITALIZA       ║
║              Verificação de Endpoint Responses            ║
╚════════════════════════════════════════════════════════════╝
    `));
    
    const testResults = [];
    
    // ============================================================================
    // ROTAS PÚBLICAS E HEALTH CHECK
    // ============================================================================
    log.section('ROTAS BÁSICAS DO SISTEMA');
    
    testResults.push(await testRoute('GET', '/health', [200], '- Health check do sistema'));
    testResults.push(await testRoute('GET', '/', [200, 304], '- Página inicial'));
    testResults.push(await testRoute('GET', '/login.html', [200, 304], '- Página de login'));
    testResults.push(await testRoute('GET', '/register.html', [200, 304], '- Página de registro'));
    
    // ============================================================================
    // ROTAS DE AUTENTICAÇÃO (sem dados, só estrutura)
    // ============================================================================
    log.section('FASE 1: ROTAS DE AUTENTICAÇÃO');
    
    testResults.push(await testRoute('GET', '/api/auth/csrf-token', [200], '- CSRF token endpoint'));
    testResults.push(await testRoute('POST', '/api/auth/register', [400, 422, 429], '- Register endpoint (sem dados)'));
    testResults.push(await testRoute('POST', '/api/auth/login', [400, 401, 422, 429], '- Login endpoint (sem dados)'));
    testResults.push(await testRoute('GET', '/api/auth/me', [401], '- Protected route (sem auth)'));
    
    // ============================================================================
    // ROTAS DE PERFIL (protegidas)
    // ============================================================================
    log.section('FASE 2: ROTAS DE PERFIL');
    
    testResults.push(await testRoute('GET', '/api/users/profile', [401], '- Get profile (protected)'));
    testResults.push(await testRoute('PATCH', '/api/users/profile', [401], '- Update profile (protected)'));
    
    // ============================================================================
    // ROTAS DE PLANOS (protegidas)
    // ============================================================================
    log.section('FASE 3: ROTAS DE PLANOS');
    
    testResults.push(await testRoute('GET', '/api/plans', [401], '- List plans (protected)'));
    testResults.push(await testRoute('POST', '/api/plans', [401], '- Create plan (protected)'));
    
    // ============================================================================
    // ROTAS DE SUBJECTS/TOPICS (protegidas)
    // ============================================================================
    log.section('FASE 4: SUBJECTS & TOPICS');
    
    testResults.push(await testRoute('GET', '/api/plans/1/subjects_with_topics', [401], '- List subjects (protected)'));
    testResults.push(await testRoute('POST', '/api/plans/1/subjects_with_topics', [401], '- Create subject (protected)'));
    
    // ============================================================================
    // ROTAS DE SESSÕES (protegidas)
    // ============================================================================
    log.section('FASE 5: SESSÕES DE ESTUDO');
    
    testResults.push(await testRoute('GET', '/api/sessions/by-date/1', [401], '- Sessions by date (protected)'));
    testResults.push(await testRoute('GET', '/api/sessions/overdue-check/1', [401], '- Overdue check (protected)'));
    
    // ============================================================================
    // ROTAS DE ESTATÍSTICAS (protegidas)
    // ============================================================================
    log.section('FASE 6: ESTATÍSTICAS');
    
    testResults.push(await testRoute('GET', '/api/plans/1/statistics', [401], '- Plan statistics (protected)'));
    testResults.push(await testRoute('GET', '/api/plans/1/detailed_progress', [401], '- Detailed progress (protected)'));
    
    // ============================================================================
    // ROTAS DE GAMIFICAÇÃO (protegidas)
    // ============================================================================
    log.section('FASE 7: GAMIFICAÇÃO');
    
    testResults.push(await testRoute('GET', '/api/plans/1/gamification', [401], '- Gamification data (protected)'));
    
    // ============================================================================
    // ROTAS DE ADMIN (protegidas)
    // ============================================================================
    log.section('FASE 8: ADMINISTRAÇÃO');
    
    testResults.push(await testRoute('GET', '/api/admin/system/health', [401, 403], '- Admin health (protected)'));
    testResults.push(await testRoute('GET', '/api/admin/system/metrics', [401, 403], '- Admin metrics (protected)'));
    testResults.push(await testRoute('GET', '/api/admin/users', [401, 403], '- Admin users list (protected)'));
    
    // ============================================================================
    // ROTAS DE CRONOGRAMA (protegidas)
    // ============================================================================
    log.section('FASE 9: GERAÇÃO DE CRONOGRAMA');
    
    testResults.push(await testRoute('POST', '/api/plans/1/generate', [401], '- Generate schedule (protected)'));
    testResults.push(await testRoute('GET', '/api/schedules/1', [401], '- Get schedules (protected)'));
    
    // ============================================================================
    // RELATÓRIO FINAL
    // ============================================================================
    log.section('RELATÓRIO FINAL');
    
    const totalTests = testResults.length;
    const passedTests = testResults.filter(result => result.success).length;
    const failedTests = testResults.filter(result => !result.success);
    
    console.log(`\nTotal de rotas testadas: ${totalTests}`);
    console.log(`Rotas funcionando: ${colors.green(passedTests)}`);
    console.log(`Rotas com problemas: ${colors.red(totalTests - passedTests)}`);
    
    if (failedTests.length > 0) {
        console.log(`\n${colors.yellow('Rotas com problemas:')}`);
        failedTests.forEach(result => {
            console.log(`  ${colors.red('❌')} ${result.path} - ${result.error || 'Status inesperado: ' + result.status}`);
        });
    }
    
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    console.log(`\nTaxa de sucesso: ${successRate}%`);
    
    if (passedTests >= totalTests * 0.8) {
        console.log(colors.bold.green('\n🎉 A MAIORIA DAS ROTAS ESTÁ FUNCIONANDO CORRETAMENTE!'));
        console.log(colors.green('✅ O sistema migrado está respondendo adequadamente'));
    } else {
        console.log(colors.bold.red('\n⚠️  MUITAS ROTAS COM PROBLEMAS - REVISAR MIGRAÇÃO'));
    }
}

// Executar testes
runBasicTests().catch(console.error);