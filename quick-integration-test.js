/**
 * TESTE RÁPIDO DE INTEGRAÇÃO - VERIFICAÇÃO ESSENCIAL
 * Foca nos endpoints mais críticos de cada fase
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function quickTest(method, path, expectedStatuses = [200]) {
    try {
        const response = await axios({
            method,
            url: `${BASE_URL}${path}`,
            validateStatus: () => true,
            timeout: 5000
        });
        
        return {
            success: expectedStatuses.includes(response.status),
            status: response.status,
            path: `${method} ${path}`
        };
    } catch (error) {
        return {
            success: false,
            status: 'ERROR',
            path: `${method} ${path}`,
            error: error.message
        };
    }
}

async function runQuickTests() {
    console.log('🚀 TESTE RÁPIDO DE INTEGRAÇÃO - SISTEMA EDITALIZA\n');
    
    const tests = [
        // Básicas
        { method: 'GET', path: '/health', expected: [200], phase: 'SYSTEM' },
        { method: 'GET', path: '/', expected: [200, 304], phase: 'SYSTEM' },
        
        // Fase 1: Auth routes
        { method: 'GET', path: '/api/auth/csrf-token', expected: [200], phase: 'FASE1-AUTH' },
        { method: 'POST', path: '/api/auth/register', expected: [400, 403, 422], phase: 'FASE1-AUTH' },
        { method: 'GET', path: '/api/auth/me', expected: [401, 404], phase: 'FASE1-AUTH' },
        
        // Fase 2: Profile (protegidas)
        { method: 'GET', path: '/api/users/profile', expected: [401], phase: 'FASE2-PROFILE' },
        
        // Fase 3: Plans (protegidas)
        { method: 'GET', path: '/api/plans', expected: [401], phase: 'FASE3-PLANS' },
        
        // Fase 4: Subjects
        { method: 'GET', path: '/api/plans/1/subjects_with_topics', expected: [401], phase: 'FASE4-SUBJECTS' },
        
        // Fase 5: Sessions
        { method: 'GET', path: '/api/sessions/by-date/1', expected: [401, 404], phase: 'FASE5-SESSIONS' },
        
        // Fase 6: Statistics
        { method: 'GET', path: '/api/plans/1/statistics', expected: [401], phase: 'FASE6-STATS' },
        
        // Fase 7: Gamification
        { method: 'GET', path: '/api/plans/1/gamification', expected: [401], phase: 'FASE7-GAMIF' },
        
        // Fase 8: Admin
        { method: 'GET', path: '/api/admin/users', expected: [401, 403, 404], phase: 'FASE8-ADMIN' },
        
        // Fase 9: Schedule generation
        { method: 'POST', path: '/api/plans/1/generate', expected: [401], phase: 'FASE9-SCHEDULE' }
    ];
    
    const results = {};
    
    // Executar todos os testes
    for (const test of tests) {
        const result = await quickTest(test.method, test.path, test.expected);
        
        if (!results[test.phase]) results[test.phase] = [];
        results[test.phase].push({ ...result, expected: test.expected });
    }
    
    // Relatório por fase
    console.log('RESULTADOS POR FASE:');
    console.log('====================\n');
    
    let totalTests = 0;
    let totalPassed = 0;
    
    for (const [phase, phaseResults] of Object.entries(results)) {
        const phasePassed = phaseResults.filter(r => r.success).length;
        const phaseTotal = phaseResults.length;
        totalTests += phaseTotal;
        totalPassed += phasePassed;
        
        const status = phasePassed === phaseTotal ? '✅' : 
                      phasePassed > 0 ? '⚠️' : '❌';
        
        console.log(`${status} ${phase}: ${phasePassed}/${phaseTotal} testes passando`);
        
        // Mostrar falhas
        const failures = phaseResults.filter(r => !r.success);
        if (failures.length > 0) {
            failures.forEach(f => {
                console.log(`   ❌ ${f.path} - Status: ${f.status} (esperado: ${f.expected.join('|')})`);
            });
        }
        console.log('');
    }
    
    // Resumo final
    const successRate = ((totalPassed / totalTests) * 100).toFixed(1);
    console.log('RESUMO FINAL:');
    console.log('=============');
    console.log(`Taxa de sucesso: ${successRate}% (${totalPassed}/${totalTests})`);
    
    if (totalPassed >= totalTests * 0.8) {
        console.log('\n🎉 SISTEMA FUNCIONANDO BEM! A maioria das rotas está operacional');
    } else if (totalPassed >= totalTests * 0.5) {
        console.log('\n⚠️ SISTEMA PARCIALMENTE FUNCIONAL. Algumas rotas precisam de ajustes');
    } else {
        console.log('\n❌ SISTEMA COM PROBLEMAS CRÍTICOS. Revisar migração urgentemente');
    }
    
    // Diagnóstico específico
    console.log('\nDIAGNÓSTICO:');
    console.log('============');
    
    const systemWorking = results['SYSTEM']?.every(r => r.success);
    if (systemWorking) {
        console.log('✅ Sistema básico funcionando (health check, páginas estáticas)');
    } else {
        console.log('❌ Problemas no sistema básico');
    }
    
    const authRoutes = results['FASE1-AUTH'] || [];
    const authWorking = authRoutes.filter(r => r.success).length;
    if (authWorking >= authRoutes.length * 0.5) {
        console.log('✅ Rotas de autenticação respondendo (algumas podem ter status CSRF/403 esperados)');
    } else {
        console.log('❌ Problemas nas rotas de autenticação');
    }
    
    // Verificar quantas fases estão funcionando
    const workingPhases = Object.entries(results).filter(([phase, phaseResults]) => {
        return phaseResults.filter(r => r.success).length >= phaseResults.length * 0.5;
    }).length;
    
    console.log(`\n📊 ${workingPhases}/${Object.keys(results).length} fases funcionando adequadamente`);
    
    return { totalPassed, totalTests, successRate: parseFloat(successRate) };
}

// Executar
runQuickTests()
.then(result => {
    console.log(`\n✅ Teste concluído: ${result.successRate}% de sucesso`);
    process.exit(result.successRate >= 70 ? 0 : 1);
})
.catch(error => {
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
});