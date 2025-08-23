/**
 * TESTE RÁPIDO - Verificação das Métricas Corrigidas
 * 
 * Este script testa se as correções nas métricas estão funcionando corretamente.
 * Executa cenários que reproduzem o problema reportado.
 */

const { dbGet, dbAll } = require('./src/utils/database');
const planService = require('./src/services/planService');

async function testMetricsCorrection() {
    console.log('🧪 INICIANDO TESTE DAS MÉTRICAS CORRIGIDAS...\n');
    
    try {
        // 1. Buscar um plano de teste para verificar
        const testPlan = await dbGet('SELECT id FROM study_plans LIMIT 1');
        
        if (!testPlan) {
            console.log('❌ Nenhum plano de teste encontrado');
            return;
        }
        
        const planId = testPlan.id;
        console.log(`📋 Testando com Plano ID: ${planId}\n`);
        
        // 2. Verificar estado atual das sessões
        const sessions = await dbAll(
            'SELECT session_type, status, topic_id FROM study_sessions WHERE study_plan_id = ?',
            [planId]
        );
        
        console.log('📊 ESTADO ATUAL DAS SESSÕES:');
        const novoTopicoSessions = sessions.filter(s => s.session_type === 'Novo Tópico');
        const completedSessions = novoTopicoSessions.filter(s => s.status === 'Concluído');
        const uniqueCompletedTopics = new Set(completedSessions.filter(s => s.topic_id).map(s => s.topic_id));
        
        console.log(`- Total de sessões 'Novo Tópico': ${novoTopicoSessions.length}`);
        console.log(`- Sessões 'Concluído': ${completedSessions.length}`);
        console.log(`- Tópicos únicos concluídos: ${uniqueCompletedTopics.size}\n`);
        
        // 3. Testar a função corrigida
        console.log('🔧 TESTANDO FUNÇÃO getSchedulePreview CORRIGIDA:');
        const scheduleData = await planService.getSchedulePreview(planId, 1);
        
        console.log('📈 MÉTRICAS CALCULADAS:');
        console.log(`- completedTopics: ${scheduleData.completedTopics}`);
        console.log(`- totalTopics: ${scheduleData.totalTopics}`);
        console.log(`- pendingTopics: ${scheduleData.pendingTopics}`);
        console.log(`- currentProgress: ${scheduleData.currentProgress}%`);
        console.log(`- progressText: "${scheduleData.status.progressText}"`);
        console.log(`- remainingText: "${scheduleData.status.remainingText}"\n`);
        
        // 4. Verificar consistência
        const expectedCompleted = uniqueCompletedTopics.size;
        const actualCompleted = scheduleData.completedTopics;
        
        console.log('✅ VERIFICAÇÃO DE CONSISTÊNCIA:');
        if (expectedCompleted === actualCompleted) {
            console.log(`✅ CORRETO: Tópicos concluídos calculados corretamente (${actualCompleted})`);
        } else {
            console.log(`❌ ERRO: Esperado ${expectedCompleted}, mas obtido ${actualCompleted}`);
        }
        
        // 5. Verificar se a porcentagem está correta
        const expectedPercentage = scheduleData.totalTopics > 0 
            ? Math.round((actualCompleted / scheduleData.totalTopics) * 100) 
            : 0;
        
        if (expectedPercentage === scheduleData.currentProgress) {
            console.log(`✅ CORRETO: Porcentagem calculada corretamente (${scheduleData.currentProgress}%)`);
        } else {
            console.log(`❌ ERRO: Porcentagem esperada ${expectedPercentage}%, mas obtida ${scheduleData.currentProgress}%`);
        }
        
        // 6. Verificar texto das métricas
        if (scheduleData.status.progressText.includes(`${actualCompleted} tópicos`)) {
            console.log('✅ CORRETO: Texto de progresso atualizado corretamente');
        } else {
            console.log('❌ ERRO: Texto de progresso não está correto');
        }
        
        console.log('\n🎯 TESTE CONCLUÍDO!');
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error.message);
        console.error(error.stack);
    }
}

// Executar o teste se o arquivo for executado diretamente
if (require.main === module) {
    testMetricsCorrection().then(() => {
        console.log('\n✨ Teste finalizado. Verifique os resultados acima.');
        process.exit(0);
    }).catch(error => {
        console.error('❌ ERRO FATAL NO TESTE:', error);
        process.exit(1);
    });
}

module.exports = { testMetricsCorrection };