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

        console.log('🎮 [Gamification Module] Dados recebidos:', data);
        
        // Processar dados vindos do backend - podem ter nomes diferentes
        const xp = data.xp || data.experiencePoints || 0;
        console.log('🎮 [Gamification Module] XP processado:', xp);
        const achievements = data.achievements || [];
        const completedTopics = data.completed_topics_count || data.completedTopicsCount || 0;
        const completedSessions = data.totalCompletedSessions || data.completed_sessions || completedTopics; // Usar sessões se disponível
        const current_streak = data.current_streak || data.studyStreak || 0;
        const longest_streak = data.longest_streak || 0;
        
        // Processar informações de nível
        let level_info = data.level_info || {};
        if (data.concurseiroLevel && !level_info.title) {
            // Dados vindo do formato antigo do backend
            level_info = {
                title: data.concurseiroLevel,
                level: parseInt(data.concurseiroLevel.match(/\d+/) || ['1'])[0],
                color: '#3B82F6',
                phrase: 'Continue estudando!',
                humorous_title: data.concurseiroLevel
            };
        }
        
        // Verificar se nextLevelInfo existe, senão usar valores padrão
        const nextLevel = level_info?.next_level_info || level_info?.nextLevelInfo || 
                         data.nextLevel || null;
        // Usar sessões para calcular o progresso
        const sessionsToNextLevel = data.sessionsToNextLevel || data.topicsToNextLevel || 0;
        const progressPercent = nextLevel && nextLevel.threshold ? Math.min(100, (completedSessions / nextLevel.threshold) * 100) : 100;

        container.innerHTML = `
            <div class="mb-8">
                <div class="mb-4">
                    <h3 class="text-2xl font-semibold text-gray-800 flex items-center">
                        <span class="text-2xl mr-3">🏆</span>Seu Progresso de Concurseiro
                    </h3>
                </div>

                <!-- Card Principal de Nível -->
                <div class="bg-white rounded-xl shadow-md border-2 border-gray-100 p-6 transition-all duration-500">
                    <div class="flex flex-col md:flex-row items-center gap-6">
                        <!-- Ícone do Nível -->
                        <div class="relative">
                            <div class="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center text-3xl shadow-inner">
                                ${level_info.icon || level_info.emoji || '🌟'}
                            </div>
                            ${current_streak > 0 ? `
                            <div class="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg">
                                ${current_streak}
                            </div>
                            ` : ''}
                        </div>
                        
                        <!-- Informações do Nível -->
                        <div class="flex-1 text-center md:text-left">
                            <p class="text-sm font-medium text-gray-500 uppercase tracking-wider">Nível ${level_info.level || 1}</p>
                            <h4 class="text-2xl font-bold text-gray-800 mt-1">${level_info.title || 'Iniciante'}</h4>
                            <p class="text-sm text-gray-600 italic mt-2">"${level_info.phrase || 'Continue estudando!'}"</p>
                        </div>
                        
                        <!-- XP -->
                        <div class="text-center bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg px-6 py-4">
                            <p class="text-3xl font-bold text-orange-600">${xp ? xp.toLocaleString() : '0'}</p>
                            <p class="text-xs font-medium text-gray-600 uppercase tracking-wider">Pontos XP</p>
                        </div>
                    </div>
                    
                    <!-- Barra de Progresso para o Próximo Nível -->
                    ${nextLevel && (nextLevel.title || nextLevel.threshold) ? `
                    <div class="mt-6 bg-gray-50 rounded-lg p-4">
                        <div class="flex justify-between text-sm font-medium mb-2">
                            <span class="text-gray-600">Próximo nível: <span class="text-gray-800 font-bold">${nextLevel.title || 'Próximo Nível'}</span></span>
                            <span class="text-blue-600">${completedSessions} / ${nextLevel.threshold || 100} Sessões</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div class="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500 relative" style="width: ${progressPercent}%">
                                <div class="absolute inset-0 bg-white/30 animate-pulse"></div>
                            </div>
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
            let achievementInfo;
            
            if (ach.title && ach.description) {
                // Formato do backend com title/description
                // Remover ícone do título se estiver incluído
                const titleClean = ach.title.replace(/^[\u{1F300}-\u{1FAD6}]\s*/u, '');
                
                // Buscar a conquista real pelo título limpo para obter o ícone correto
                let icon = '🏆';
                if (window.EDITALIZA_ACHIEVEMENTS) {
                    const allAchievements = [
                        ...EDITALIZA_ACHIEVEMENTS.TOPICS,
                        ...EDITALIZA_ACHIEVEMENTS.STREAK,
                        ...EDITALIZA_ACHIEVEMENTS.SESSIONS
                    ];
                    const realAch = allAchievements.find(a => 
                        a.title.includes(titleClean) || titleClean.includes(a.title.replace(/^[\u{1F300}-\u{1FAD6}]\s*/u, ''))
                    );
                    if (realAch) {
                        icon = realAch.icon;
                    }
                }
                
                achievementInfo = {
                    title: titleClean,
                    description: ach.description,
                    icon: icon
                };
            } else if (ach.achievement_id) {
                // Formato do DB com achievement_id
                achievementInfo = this.getAchievementDetails(ach.achievement_id);
            } else {
                // Fallback
                achievementInfo = { title: 'Conquista', description: 'Parabéns!', icon: '⭐' };
            }
            
            const unlockDate = ach.unlocked_at || ach.achieved_date;
            const dateStr = unlockDate ? new Date(unlockDate).toLocaleDateString('pt-BR') : 'Hoje';
            
            return `
                <div class="achievement-card bg-white border-2 border-yellow-300 rounded-xl p-3 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" title="${achievementInfo.description} - Desbloqueado em ${dateStr}">
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
        // Buscar conquista real do mapeamento EDITALIZA_ACHIEVEMENTS
        if (!window.EDITALIZA_ACHIEVEMENTS) {
            console.warn('EDITALIZA_ACHIEVEMENTS não carregado');
            return { title: 'Conquista', description: 'Parabéns!', icon: '⭐' };
        }
        
        // Procurar em todas as categorias
        const allAchievements = [
            ...EDITALIZA_ACHIEVEMENTS.TOPICS,
            ...EDITALIZA_ACHIEVEMENTS.STREAK,
            ...EDITALIZA_ACHIEVEMENTS.SESSIONS
        ];
        
        const achievement = allAchievements.find(ach => ach.id === achievementId);
        
        if (achievement) {
            return {
                title: achievement.title,
                description: achievement.description,
                icon: achievement.icon
            };
        }
        
        // Fallback se não encontrar
        const [category, threshold] = achievementId.split('_');
        const categoryMap = {
            topics: '📚',
            streak: '🔥', 
            sessions: '⏱️'
        };
        const icon = categoryMap[category] || '⭐';
        
        return {
            title: `Conquista ${category} ${threshold}`,
            description: `Parabéns pela conquista!`,
            icon: icon
        };
    },

    renderOverdueAlert(overdueData, containerId = 'overdue-alert-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const count = overdueData.count || 0;

        if (count > 0) {
            container.innerHTML = `
                <div id="overdueAlert" class="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl mb-8 shadow-2xl p-8 text-white transform transition-all duration-500 hover:scale-[1.02]" role="alert">
                    <div class="flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0 md:space-x-8">
                        <!-- Left Side: Icon and Title -->
                        <div class="flex items-center space-x-6">
                            <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                                <span class="text-5xl">🔥</span>
                            </div>
                            <div>
                                <p class="font-bold text-2xl">Atenção, Futuro Servidor!</p>
                                <p class="text-lg opacity-90">Você tem <strong class="font-extrabold">${count}</strong> tarefa(s) atrasada(s).</p>
                                <p class="text-sm opacity-80 mt-1">Não deixe a peteca cair. Replaneje agora para manter o ritmo!</p>
                            </div>
                        </div>

                        <!-- Right Side: Actions -->
                        <div class="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full md:w-auto">
                            <button id="replanButton" class="w-full sm:w-auto btn-primary bg-white text-red-600 font-bold py-4 px-8 rounded-xl shadow-lg hover:bg-gray-100 transition-all duration-300 flex items-center justify-center space-x-3 text-lg">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path></svg>
                                <span>Replanejar Agora</span>
                            </button>
                            <button id="showReplanDetailsButton" class="w-full sm:w-auto text-white font-medium py-2 px-4 rounded-lg hover:bg-white/10 transition-colors text-sm flex items-center justify-center space-x-2">
                                <span>Ver Detalhes</span>
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                            </button>
                        </div>
                    </div>
                    <!-- Collapsible Details Section -->
                    <div id="replanDetails" class="hidden mt-6 p-6 bg-black/20 rounded-xl border border-white/20">
                        <div id="replanDetailsContent">
                            <!-- Content will be loaded here by the event listener -->
                            <p class="text-center">Carregando detalhes da estratégia...</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
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

// Expor globalmente sem ESM
window.Gamification = Gamification;
window.gamification = Gamification; // Alias minúsculo para compatibilidade
