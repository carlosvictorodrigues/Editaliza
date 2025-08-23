const fetch = require('node-fetch');
const planService = require('./src/services/planService');

async function testDetailedProgress() {
    console.log('=== TESTE DO ENDPOINT DE PROGRESSO DETALHADO ===\n');
    
    const userId = 1006;
    const planId = 1016;
    
    try {
        // Teste 1: Testar serviço diretamente
        console.log('📊 Teste 1: Chamando serviço diretamente...');
        const result = await planService.getDetailedProgress(planId, userId);
        
        console.log('✅ Serviço funcionando!');
        console.log(`   Progresso Total: ${result.totalProgress}%`);
        console.log(`   Disciplinas: ${result.subjectDetails ? result.subjectDetails.length : 0}`);
        
        if (result.subjectDetails && result.subjectDetails.length > 0) {
            console.log('\n📚 Detalhes das Disciplinas:');
            result.subjectDetails.forEach(subject => {
                console.log(`   - ${subject.name}: ${subject.progress}% (${subject.totalTime}s de estudo)`);
                console.log(`     Tópicos: ${subject.topics ? subject.topics.length : 0}`);
            });
        }
        
        // Teste 2: Verificar estrutura dos dados
        console.log('\n🔍 Teste 2: Verificando estrutura dos dados...');
        const hasRequiredFields = 
            result.hasOwnProperty('totalProgress') &&
            result.hasOwnProperty('subjectDetails') &&
            Array.isArray(result.subjectDetails);
        
        if (hasRequiredFields) {
            console.log('✅ Estrutura de dados correta!');
        } else {
            console.log('❌ Estrutura de dados incorreta!');
            console.log('   Dados recebidos:', JSON.stringify(result, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Erro ao testar progresso detalhado:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

// Executar teste
testDetailedProgress();