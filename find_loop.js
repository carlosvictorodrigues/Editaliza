// Script para identificar onde está o loop infinito
console.log('=== Detectando Loop Infinito ===\n');

// Interceptar console.log para rastrear origem
const originalLog = console.log;
let logCount = 0;
const logMap = new Map();

console.log = function(...args) {
    const msg = args.join(' ');
    const stack = new Error().stack;
    
    // Contar quantas vezes cada mensagem aparece
    if (!logMap.has(msg)) {
        logMap.set(msg, { count: 0, stack: stack });
    }
    logMap.get(msg).count++;
    
    logCount++;
    
    // Se uma mensagem aparecer mais de 5 vezes, mostrar de onde vem
    if (logMap.get(msg).count === 5) {
        originalLog(`\n⚠️ LOOP DETECTADO: "${msg}" apareceu 5 vezes`);
        originalLog('Stack trace:');
        originalLog(stack);
        originalLog('\n');
    }
    
    // Parar após 50 logs para não travar
    if (logCount > 50) {
        originalLog('\n❌ Mais de 50 logs detectados - parando execução');
        originalLog('\nMensagens mais frequentes:');
        
        const sorted = Array.from(logMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5);
        
        for (const [msg, data] of sorted) {
            originalLog(`  ${data.count}x: "${msg.substring(0, 100)}..."`);
        }
        
        process.exit(1);
    }
    
    // Ainda logar normalmente
    return originalLog.apply(console, args);
};

// Carregar o servidor
try {
    require('./server.js');
} catch (err) {
    console.log('Erro ao carregar servidor:', err.message);
}