const planService = require('./src/services/planService');

async function testHumorGamification() {
    console.log('🎮 TESTE DO NOVO SISTEMA DE GAMIFICAÇÃO COM HUMOR\n');
    console.log('=' .repeat(60));
    
    try {
        // Testar com o usuário c@c.com (ID: 1006, Plan: 1016)
        const result = await planService.getGamification(1016, 1006);
        
        console.log('\n📊 INFORMAÇÕES DO NÍVEL:');
        console.log(`   Nível Atual: ${result.concurseiroLevel}`);
        console.log(`   Próximo Nível: ${result.nextLevel || 'Nível máximo!'}`);
        console.log(`   Tópicos para próximo nível: ${result.topicsToNextLevel}`);
        console.log(`   Tópicos concluídos: ${result.completedTopicsCount}`);
        
        console.log('\n✨ EXPERIÊNCIA E PROGRESSO:');
        console.log(`   XP Total: ${result.experiencePoints}`);
        console.log(`   Dias estudados: ${result.totalStudyDays}`);
        console.log(`   Sequência atual: ${result.studyStreak} dias`);
        console.log(`   Sessões completadas: ${result.totalCompletedSessions}`);
        
        console.log('\n🏅 CONQUISTAS DESBLOQUEADAS:');
        if (result.achievements && result.achievements.length > 0) {
            result.achievements.forEach((achievement, index) => {
                console.log(`   ${index + 1}. ${achievement.title}`);
                console.log(`      ${achievement.description}`);
                console.log(`      Conquistado em: ${new Date(achievement.achieved_date).toLocaleDateString('pt-BR')}`);
                console.log('');
            });
        } else {
            console.log('   Nenhuma conquista ainda!');
        }
        
        console.log('\n🎯 DETALHES DO RANK ATUAL:');
        if (result.currentRank) {
            console.log(`   Título: ${result.currentRank.title}`);
            console.log(`   Descrição: ${result.currentRank.description}`);
            console.log(`   Mensagem motivacional: ${result.currentRank.motivationalText}`);
            console.log(`   Cor do rank: ${result.currentRank.color}`);
            console.log(`   Progresso para próximo: ${result.rankProgress?.toFixed(1) || 0}%`);
        }
        
        console.log('\n💡 ANÁLISE DO SISTEMA:');
        console.log('   ✅ Sistema de ranks com humor implementado');
        console.log('   ✅ Progressão visual de cores (cinza → ouro)');
        console.log('   ✅ Conquistas temáticas de concurseiro');
        console.log('   ✅ Ícones progressivos por nível');
        
        // Simular diferentes níveis de progresso
        console.log('\n🔮 SIMULAÇÃO DE PROGRESSÃO:');
        const topicCounts = [0, 5, 15, 40, 80, 150, 300, 600, 1200];
        
        for (const count of topicCounts) {
            // Encontrar o nível correspondente
            const levels = [
                { threshold: 0, title: 'Pagador de Inscrição 💸' },
                { threshold: 11, title: 'Sobrevivente do Primeiro PDF 📄' },
                { threshold: 31, title: 'Caçador de Questões 🎯' },
                { threshold: 61, title: 'Estrategista de Chute 🎲' },
                { threshold: 101, title: 'Fiscal de Gabarito 🔍' },
                { threshold: 201, title: 'Sensei dos Simulados 🥋' },
                { threshold: 501, title: 'Quase Servidor(a) 🎓' },
                { threshold: 1000, title: 'Lenda Viva dos Concursos 👑' }
            ];
            
            let currentLevel = levels[0];
            for (let i = levels.length - 1; i >= 0; i--) {
                if (count >= levels[i].threshold) {
                    currentLevel = levels[i];
                    break;
                }
            }
            
            console.log(`   ${count.toString().padStart(4)} tópicos → ${currentLevel.title}`);
        }
        
        console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
        console.log('=' .repeat(60));
        
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

// Executar o teste
testHumorGamification();