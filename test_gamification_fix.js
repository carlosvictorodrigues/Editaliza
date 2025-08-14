const path = require('path');

// Simular o ambiente do servidor
process.env.NODE_ENV = 'development';

// Simular módulos necessários
const planService = require('./src/services/planService');

async function testGamificationFix() {
    try {
        console.log('=== TESTE DA CORREÇÃO DA GAMIFICAÇÃO ===\n');
        
        const userId = 1006; // ID do usuário c@c.com
        const planId = 1016; // ID do plano de estudo
        
        console.log(`Testando gamificação para usuário ${userId}, plano ${planId}...`);
        
        // Tentar obter dados de gamificação
        const gamificationData = await planService.getGamification(planId, userId);
        
        console.log('✅ Correção bem-sucedida! Dados de gamificação obtidos:');
        console.log('\n📊 ESTATÍSTICAS:');
        console.log(`   XP atual: ${gamificationData.experiencePoints}`);
        console.log(`   Nível: ${gamificationData.concurseiroLevel}`);
        console.log(`   Rank atual: ${gamificationData.currentRank.title}`);
        console.log(`   Descrição: ${gamificationData.currentRank.description}`);
        console.log(`   Próximo rank: ${gamificationData.nextRank ? gamificationData.nextRank.title : 'Rank máximo!'}`);
        console.log(`   Progresso do rank: ${gamificationData.rankProgress.toFixed(1)}%`);
        
        console.log('\n🏆 CONQUISTAS:');
        if (gamificationData.achievements && gamificationData.achievements.length > 0) {
            gamificationData.achievements.forEach((achievement, index) => {
                console.log(`   ${index + 1}. ${achievement.title}: ${achievement.description}`);
            });
        } else {
            console.log('   Nenhuma conquista ainda (normal para usuário sem sessões concluídas)');
        }
        
        console.log('\n📈 OUTRAS ESTATÍSTICAS:');
        console.log(`   Sequência atual: ${gamificationData.studyStreak || gamificationData.currentStreak} dias`);
        console.log(`   Dias únicos de estudo: ${gamificationData.totalStudyDays}`);
        console.log(`   Total de sessões concluídas: ${gamificationData.totalCompletedSessions}`);
        console.log(`   Total de tópicos concluídos: ${gamificationData.completedTopicsCount}`);
        console.log(`   Tópicos até próximo rank: ${gamificationData.topicsToNextLevel || 'N/A'}`);
        
    } catch (error) {
        console.error('❌ Erro ainda persiste:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testGamificationFix();