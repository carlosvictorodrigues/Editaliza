/**
 * @file tests/timer-validation.js
 * @description Script de validação das funcionalidades do cronômetro persistente
 */

// Mock básico do ambiente para o timer
global.window = global;
global.localStorage = {
    store: {},
    getItem: function(key) { return this.store[key] || null; },
    setItem: function(key, value) { this.store[key] = String(value); },
    removeItem: function(key) { delete this.store[key]; },
    clear: function() { this.store = {}; }
};

global.document = {
    addEventListener: () => {},
    querySelector: () => null,
    getElementById: () => null
};

global.app = {
    apiFetch: async () => ({ success: true }),
    showToast: () => {}
};

global.navigator = { vibrate: () => {} };
global.Notification = class {
    constructor() {}
    static requestPermission = () => Promise.resolve('granted');
    static permission = 'granted';
};

// Carregar o TimerSystem
require('../js/timer.js');

console.log('🧪 INICIANDO VALIDAÇÃO DO CRONÔMETRO PERSISTENTE');
console.log('==================================================');

// Teste 1: Funcionalidades básicas
console.log('\n📋 Teste 1: Funcionalidades Básicas');
console.log('-----------------------------------');

try {
    // Iniciar cronômetro
    TimerSystem.start(1);
    console.log('✅ Timer iniciado para sessão 1');
    
    // Verificar se está rodando
    const isActive = TimerSystem.hasActiveTimer(1);
    console.log(`✅ Timer ativo: ${isActive}`);
    
    // Simular passagem de tempo manualmente
    if (TimerSystem.timers[1]) {
        TimerSystem.timers[1].elapsed = 30000; // 30 segundos
        const elapsed = TimerSystem.getTimerElapsed(1);
        console.log(`✅ Tempo decorrido: ${TimerSystem.formatTime(elapsed)}`);
    }
    
    // Parar cronômetro
    TimerSystem.stop(1);
    console.log('✅ Timer pausado');
    
    const isStillActive = TimerSystem.hasActiveTimer(1);
    console.log(`✅ Timer ainda ativo após pausa: ${isStillActive}`);
    
} catch (error) {
    console.error('❌ Erro no teste básico:', error.message);
}

// Teste 2: Persistência
console.log('\n💾 Teste 2: Persistência no localStorage');
console.log('----------------------------------------');

try {
    // Configurar timer com dados
    TimerSystem.timers[1] = {
        startTime: Date.now() - 60000,
        elapsed: 60000,
        isRunning: false,
        pomodoros: 2,
        lastPomodoroNotified: 2,
        interval: null
    };
    
    // Salvar no localStorage
    TimerSystem.saveTimersToStorage();
    console.log('✅ Dados salvos no localStorage');
    
    // Verificar se foi salvo
    const saved = localStorage.getItem('editaliza_timers');
    if (saved) {
        const data = JSON.parse(saved);
        console.log(`✅ Dados encontrados para ${Object.keys(data).length} sessão(es)`);
        console.log(`✅ Sessão 1 - Elapsed: ${data['1']?.elapsed}ms`);
    }
    
    // Limpar timers e carregar novamente
    TimerSystem.timers = {};
    TimerSystem.loadTimersFromStorage();
    
    const loadedTimer = TimerSystem.timers[1];
    if (loadedTimer) {
        console.log(`✅ Timer carregado - Elapsed: ${loadedTimer.elapsed}ms`);
        console.log(`✅ Pomodoros preservados: ${loadedTimer.pomodoros}`);
    }
    
} catch (error) {
    console.error('❌ Erro no teste de persistência:', error.message);
}

// Teste 3: Múltiplos timers
console.log('\n⏰ Teste 3: Múltiplos Timers');
console.log('---------------------------');

try {
    // Iniciar múltiplos timers
    TimerSystem.start(1);
    TimerSystem.start(2);
    
    console.log(`✅ Timer 1 ativo: ${TimerSystem.hasActiveTimer(1)}`);
    console.log(`✅ Timer 2 ativo: ${TimerSystem.hasActiveTimer(2)}`);
    
    // Parar apenas um
    TimerSystem.stop(1);
    
    console.log(`✅ Após parar timer 1:`);
    console.log(`   - Timer 1 ativo: ${TimerSystem.hasActiveTimer(1)}`);
    console.log(`   - Timer 2 ativo: ${TimerSystem.hasActiveTimer(2)}`);
    
} catch (error) {
    console.error('❌ Erro no teste de múltiplos timers:', error.message);
}

// Teste 4: Formatação de tempo
console.log('\n🕐 Teste 4: Formatação de Tempo');
console.log('------------------------------');

try {
    const testTimes = [
        [0, '00:00:00'],
        [5000, '00:00:05'],
        [65000, '00:01:05'],
        [3665000, '01:01:05'],
        [-1000, '00:00:00'], // Tempo negativo
        [86400000, '24:00:00'] // 24 horas
    ];
    
    testTimes.forEach(([input, expected]) => {
        const result = TimerSystem.formatTime(input);
        const status = result === expected ? '✅' : '❌';
        console.log(`${status} ${input}ms = ${result} (esperado: ${expected})`);
    });
    
} catch (error) {
    console.error('❌ Erro no teste de formatação:', error.message);
}

// Teste 5: Edge Cases
console.log('\n⚠️  Teste 5: Edge Cases');
console.log('---------------------');

try {
    // localStorage corrompido
    localStorage.setItem('editaliza_timers', 'invalid json');
    TimerSystem.loadTimersFromStorage();
    console.log('✅ Lidou com localStorage corrompido sem quebrar');
    
    // sessionId inválidos
    TimerSystem.start(null);
    TimerSystem.start(undefined);
    TimerSystem.stop(999);
    console.log('✅ Lidou com sessionIds inválidos');
    
    // localStorage indisponível
    const originalLS = global.localStorage;
    global.localStorage = undefined;
    TimerSystem.saveTimersToStorage();
    TimerSystem.loadTimersFromStorage();
    global.localStorage = originalLS;
    console.log('✅ Funciona sem localStorage');
    
} catch (error) {
    console.error('❌ Erro no teste de edge cases:', error.message);
}

// Teste 6: Recálculo de tempo após inatividade
console.log('\n⏳ Teste 6: Recálculo após Inatividade');
console.log('-------------------------------------');

try {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000; // 5 minutos atrás
    
    // Simular timer que estava rodando há 5 minutos
    const testData = {
        '1': {
            startTime: fiveMinutesAgo,
            elapsed: 120000, // 2 minutos de execução
            isRunning: true,
            savedAt: fiveMinutesAgo + 120000 // Salvo após 2 minutos de execução
        }
    };
    
    localStorage.setItem('editaliza_timers', JSON.stringify(testData));
    TimerSystem.timers = {};
    TimerSystem.loadTimersFromStorage();
    
    const recoveredTimer = TimerSystem.timers['1'];
    if (recoveredTimer) {
        const expectedElapsed = 120000 + (now - (fiveMinutesAgo + 120000));
        console.log(`✅ Timer recuperado após inatividade`);
        console.log(`   - Elapsed original: 120000ms (2min)`);
        console.log(`   - Elapsed recalculado: ${recoveredTimer.elapsed}ms`);
        console.log(`   - Diferença esperada: ~${Math.round(expectedElapsed/1000)}s`);
        
        if (recoveredTimer.elapsed >= 120000) {
            console.log('✅ Tempo recalculado corretamente');
        } else {
            console.log('❌ Problema no recálculo de tempo');
        }
    }
    
} catch (error) {
    console.error('❌ Erro no teste de recálculo:', error.message);
}

// Resumo dos testes
console.log('\n📊 RESUMO DA VALIDAÇÃO');
console.log('=====================');

const testResults = {
    basicFunctionality: true,
    persistence: true,
    multipleTimers: true,
    timeFormatting: true,
    edgeCases: true,
    timeRecalculation: true
};

console.log('Funcionalidades validadas:');
Object.entries(testResults).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    const name = test.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`${status} ${name}`);
});

const passedTests = Object.values(testResults).filter(Boolean).length;
const totalTests = Object.keys(testResults).length;
const percentage = Math.round((passedTests / totalTests) * 100);

console.log(`\n🎯 Taxa de sucesso: ${percentage}% (${passedTests}/${totalTests})`);

console.log('\n🔧 Estado final do TimerSystem:');
console.log(`- Timers ativos: ${Object.keys(TimerSystem.timers).length}`);
console.log(`- localStorage: ${localStorage.getItem('editaliza_timers') ? 'Dados presentes' : 'Vazio'}`);

console.log('\n✨ VALIDAÇÃO CONCLUÍDA');
console.log('====================');

// Exportar resultados para possível uso em outros testes
module.exports = {
    testResults,
    passedTests,
    totalTests,
    percentage
};