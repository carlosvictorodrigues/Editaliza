/**
 * Script de teste para validar integração dos repositories
 * FASE 4 - Validação da integração
 */

const db = require('./database-postgresql.js');
const { createRepositories } = require('./src/repositories');

async function testRepositoriesIntegration() {
    console.log('🧪 Testando integração dos repositories...\n');
    
    try {
        // Criar instâncias dos repositories
        const repos = createRepositories(db);
        console.log('✅ Repositories criados com sucesso');
        console.log('   Disponíveis:', Object.keys(repos).join(', '));
        
        // Testar conexão com banco
        console.log('\n📊 Testando queries básicas...');
        
        // 1. Testar UserRepository
        console.log('\n1. UserRepository:');
        const userCount = await repos.user.getTotalCount();
        console.log(`   ✅ Total de usuários: ${userCount}`);
        
        // 2. Testar PlanRepository
        console.log('\n2. PlanRepository:');
        // Buscar um usuário de teste
        const testUser = await db.get('SELECT id FROM users LIMIT 1');
        if (testUser) {
            const userPlans = await repos.plan.findByUserId(testUser.id);
            console.log(`   ✅ Planos do usuário ${testUser.id}: ${userPlans.length}`);
        }
        
        // 3. Testar SessionRepository
        console.log('\n3. SessionRepository:');
        const testPlan = await db.get('SELECT id FROM study_plans LIMIT 1');
        if (testPlan) {
            const pendingSessions = await repos.session.countPendingSessions(testPlan.id);
            console.log(`   ✅ Sessões pendentes do plano ${testPlan.id}: ${pendingSessions}`);
        }
        
        // 4. Testar SubjectRepository
        console.log('\n4. SubjectRepository:');
        if (testPlan) {
            const subjects = await repos.subject.findByPlanId(testPlan.id);
            console.log(`   ✅ Disciplinas do plano ${testPlan.id}: ${subjects.length}`);
        }
        
        // 5. Testar TopicRepository
        console.log('\n5. TopicRepository:');
        const testSubject = await db.get('SELECT id FROM subjects LIMIT 1');
        if (testSubject) {
            const topics = await repos.topic.findBySubjectId(testSubject.id);
            console.log(`   ✅ Tópicos da disciplina ${testSubject.id}: ${topics.length}`);
        }
        
        // 6. Testar StatisticsRepository
        console.log('\n6. StatisticsRepository:');
        if (testPlan && testUser) {
            const dashboardMetrics = await repos.statistics.getDashboardMetrics(testPlan.id, testUser.id);
            console.log(`   ✅ Métricas obtidas: total_topics=${dashboardMetrics.total_topics}`);
        }
        
        // 7. Testar AdminRepository
        console.log('\n7. AdminRepository:');
        const systemStats = await repos.admin.getSystemStatistics();
        console.log(`   ✅ Estatísticas do sistema: ${systemStats.total_users} usuários`);
        
        console.log('\n✅ TODOS OS REPOSITORIES ESTÃO FUNCIONANDO!');
        console.log('📌 Integração pronta para uso no server.js\n');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ ERRO NA INTEGRAÇÃO:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Executar teste
console.log('========================================');
console.log('TESTE DE INTEGRAÇÃO DOS REPOSITORIES');
console.log('========================================\n');

testRepositoriesIntegration().then(success => {
    if (success) {
        console.log('🎉 Integração bem-sucedida! Pronto para FASE 4.2');
    } else {
        console.log('🔴 Corrija os erros antes de prosseguir');
    }
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
});