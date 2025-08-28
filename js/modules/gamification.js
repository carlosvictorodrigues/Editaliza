/**
 * @file js/modules/gamification.js
 * @description Sistema de Gamificação - Versão 3.0 com design rico e interativo
 */

const Gamification = {

    renderGamificationDashboard(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !data) {
            console.error('Container de gamificação ou dados não encontrados.');
            return;
        }

        const { xp, level_info, current_streak, longest_streak, achievements } = data;
        const completedTopics = data.completed_topics_count || 0; // Fallback

        const nextLevel = level_info.nextLevelInfo;
        const progressPercent = nextLevel ? Math.min(100, (completedTopics / nextLevel.threshold) * 100) : 100;

        container.innerHTML = `
            <div class="mb-8">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-2xl font-semibold text-gray-800 flex items-center">
                        <span class="text-2xl mr-3">🏆</span>Seu Progresso de Concurseiro
                    </h3>
                    <button onclick="window.refreshAllMetrics()" class="btn-secondary text-xs py-1 px-3">Atualizar</button>
                </div>

                <!-- Card Principal de Nível -->
                <div class="p-6 rounded-xl shadow-lg text-white transition-all duration-500" style="background: linear-gradient(135deg, ${level_info.color} 0%, #1f2937 100%);">
                    <div class="flex flex-col md:flex-row items-center text-center md:text-left">
                        <div class="relative mb-4 md:mb-0 md:mr-6">
                            <div class="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center text-4xl animate-pulse">${level_info.humorous_title.split(' ').pop()}</div>
                            ${current_streak > 0 ? `<div class="streak-fire" title="${current_streak} dias de streak!">🔥</div>` : ''}
                        </div>
                        <div class="flex-1">
                            <p class="text-lg font-semibold uppercase tracking-wider opacity-80">Nível ${level_info.level}</p>
                            <h4 class="text-3xl font-bold">${level_info.title}</h4>
                            <p class="text-sm italic opacity-90 mt-2">"${level_info.phrase}"</p>
                        </div>
                        <div class="text-center mt-4 md:mt-0 md:ml-6">
                            <p class="text-4xl font-bold">${xp.toLocaleString()}</p>
                            <p class="text-sm uppercase tracking-wider opacity-80">Pontos XP</p>
                        </div>
                    </div>
                    <!-- Barra de Progresso para o Próximo Nível -->
                    ${nextLevel ? `
                    <div class="mt-6">
                        <div class="flex justify-between text-xs font-medium mb-1 opacity-90">
                            <span>Progresso para: ${nextLevel.title}</span>
                            <span>${completedTopics} / ${nextLevel.threshold} Tópicos</span>
                        </div>
                        <div class="w-full bg-white/20 rounded-full h-3">
                            <div class="bg-white h-3 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Conquistas -->
                ${this.renderAchievements(achievements)}
            </div>
        `;
    },

    renderAchievements(achievements) {
        if (!achievements || achievements.length === 0) return '';

        const achievementCards = achievements.map(ach => {
            const achievementInfo = this.getAchievementDetails(ach.achievement_id);
            return `
                <div class="achievement-card bg-white border-2 border-yellow-300 rounded-xl p-3 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" title="${achievementInfo.description} - Desbloqueado em ${new Date(ach.unlocked_at).toLocaleDateString('pt-BR')}">
                    <div class="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl">${achievementInfo.icon}</div>
                    <h5 class="font-bold text-gray-800 text-xs">${achievementInfo.title}</h5>
                </div>
            `;
        }).join('');

        return `
            <div class="mt-8">
                <h4 class="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                    <span class="text-2xl mr-3">🏅</span>Quadro de Medalhas
                </h4>
                <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    ${achievementCards}
                </div>
            </div>
        `;
    },

    getAchievementDetails(achievementId) {
        const [category, threshold] = achievementId.split('_');
        const categoryMap = {
            topics: { list: 'TOPICS', icon: '📚' },
            streak: { list: 'STREAK', icon: '🔥' },
            sessions: { list: 'SESSIONS', icon: '💪' }
        };
        const catInfo = categoryMap[category] || { list: 'TOPICS', icon: '🏅' };
        const achievement = ACHIEVEMENTS[catInfo.list].find(a => a.id === achievementId);
        return achievement ? { ...achievement, icon: catInfo.icon } : { title: 'Conquista', description: 'Você é incrível!', icon: '⭐' };
    }
};

// Adicionar CSS para animações
const style = document.createElement('style');
style.textContent = `
.streak-fire {
    position: absolute;
    top: -10px;
    right: -10px;
    font-size: 2.5rem;
    animation: pulse-fire 1.5s infinite ease-in-out;
    text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #ff7800, 0 0 20px #ff7800;
}
@keyframes pulse-fire {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.15); opacity: 0.9; }
}
`;
document.head.appendChild(style);

window.Gamification = Gamification;
