/**
 * @file js/modules/gamification.js
 * @description Gamification dashboard and metrics system
 * @version 2.0 - Modularized for performance
 */

const Gamification = {
    // Dashboard de gamificação com métricas precisas
    renderGamificationDashboard(gamificationData, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !gamificationData) return;
        
        // Usar dados reais do backend com próximo nível
        const safeData = {
            currentStreak: gamificationData.studyStreak || 0,
            totalXP: gamificationData.experiencePoints || 0,
            totalStudyDays: gamificationData.totalStudyDays || 0,
            levelName: gamificationData.concurseiroLevel || 'Aspirante a Servidor(a) 🌱',
            nextLevel: gamificationData.nextLevel || null,
            topicsToNextLevel: gamificationData.topicsToNextLevel || 0,
            achievementsCount: gamificationData.achievements ? gamificationData.achievements.length : 0,
            achievements: gamificationData.achievements || [],
            completedTopicsCount: gamificationData.completedTopicsCount || 0,
            totalCompletedSessions: gamificationData.totalCompletedSessions || 0
        };

        // Obter ícone e título limpo do nível atual
        const levelIcon = safeData.levelName.split(' ').pop();
        const levelTitle = safeData.levelName.replace(levelIcon, '').trim();

        // Cards únicos com informações não duplicadas e métricas corretas
        container.innerHTML = `
            <div class="mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                        <span class="text-2xl mr-3">📊</span>Estatísticas de Desempenho
                    </h3>
                    <div class="text-sm text-gray-500 italic">
                        <span class="w-2 h-2 bg-green-500 rounded-full inline-block mr-2 animate-pulse"></span>
                        Atualizado em tempo real
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Nível Atual -->
                    <div class="bg-slate-50 border border-gray-200 p-6 rounded-xl shadow-inner text-center">
                        <div class="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">${levelIcon}</span>
                        </div>
                        <p class="text-lg font-semibold text-orange-800 uppercase tracking-wider mb-1">Nível Atual</p>
                        <p class="text-2xl font-bold text-orange-600">${levelTitle}</p>
                    </div>
                    
                    <!-- Total de Dias de Estudo -->
                    <div class="bg-slate-50 border border-gray-200 p-6 rounded-xl shadow-inner text-center">
                        <div class="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">📅</span>
                        </div>
                        <p class="text-lg font-semibold text-editaliza-blue uppercase tracking-wider mb-1">Total de Dias</p>
                        <p class="text-4xl font-bold text-editaliza-blue">${safeData.totalStudyDays}</p>
                        <p class="text-xs text-editaliza-blue mt-1">${safeData.totalStudyDays === 1 ? 'dia estudado' : 'dias estudados'}</p>
                    </div>
                    
                    <!-- Experiência Total -->
                    <div class="bg-slate-50 border border-gray-200 p-6 rounded-xl shadow-inner text-center">
                        <div class="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">✨</span>
                        </div>
                        <p class="text-lg font-semibold text-purple-800 uppercase tracking-wider mb-1">Experiência</p>
                        <p class="text-4xl font-bold text-purple-600">${safeData.totalXP.toLocaleString()}</p>
                        <p class="text-xs text-purple-600 mt-1">pontos XP totais</p>
                    </div>
                    
                    <!-- Conquistas -->
                    <div class="bg-slate-50 border border-gray-200 p-6 rounded-xl shadow-inner text-center">
                        <div class="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">🏅</span>
                        </div>
                        <p class="text-lg font-semibold text-green-800 uppercase tracking-wider mb-1">Conquistas</p>
                        <p class="text-4xl font-bold text-green-700">${safeData.achievementsCount}</p>
                        <p class="text-xs text-green-700 mt-1">${safeData.achievementsCount === 1 ? 'medalha obtida' : 'medalhas obtidas'}</p>
                    </div>
                </div>
            </div>
        `;

        // Se houver conquistas, renderizar seção adicional
        if (safeData.achievements && safeData.achievements.length > 0) {
            container.innerHTML += this.renderAchievements(safeData.achievements);
        }

        // Se houver informações de próximo nível, renderizar progresso
        if (safeData.nextLevel && safeData.topicsToNextLevel !== undefined) {
            container.innerHTML += this.renderLevelProgress(safeData);
        }
    },

    // Renderizar conquistas obtidas
    renderAchievements(achievements) {
        const achievementCards = achievements.slice(0, 6).map(achievement => {
            const achievementIcons = {
                'Primeiro Estudo': '🌟',
                'Sequência de 3 dias': '🔥',
                'Sequência de 7 dias': '💪',
                'Primeiro Simulado': '🎯',
                '10 Tópicos Concluídos': '📚',
                '50 Tópicos Concluídos': '🏆',
                'Nível Avançado': '⭐',
                'default': '🏅'
            };

            const icon = achievementIcons[achievement.title] || achievementIcons.default;
            const achievedDate = new Date(achievement.achieved_date).toLocaleDateString('pt-BR');

            return `
                <div class="achievement-card bg-white border-2 border-yellow-200 rounded-xl p-4 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                    <div class="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span class="text-2xl">${icon}</span>
                    </div>
                    <h4 class="font-bold text-gray-800 text-sm mb-1">${achievement.title}</h4>
                    <p class="text-xs text-gray-600 mb-2">${achievement.description}</p>
                    <p class="text-xs text-yellow-600 font-medium">${achievedDate}</p>
                </div>
            `;
        }).join('');

        return `
            <div class="mt-8">
                <h4 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <span class="text-2xl mr-3">🏅</span>Suas Conquistas Recentes
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    ${achievementCards}
                </div>
                ${achievements.length > 6 ? `
                    <div class="text-center mt-4">
                        <p class="text-sm text-gray-500">E mais ${achievements.length - 6} conquistas!</p>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Renderizar progresso para próximo nível
    renderLevelProgress(data) {
        if (!data.nextLevel) return '';

        const currentIcon = data.levelName.split(' ').pop();
        const currentTitle = data.levelName.replace(currentIcon, '').trim();

        const nextIcon = data.nextLevel.split(' ').pop();
        const nextTitle = data.nextLevel.replace(nextIcon, '').trim();

        const totalNeeded = (data.completedTopicsCount || 0) + (data.topicsToNextLevel || 0);
        const progressPercent = totalNeeded > 0
            ? Math.max(0, Math.min(100, (data.completedTopicsCount / totalNeeded) * 100))
            : 0;

        return `
            <div class="mt-8">
                <h4 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <span class="text-2xl mr-3">🎖️</span>Progresso de Nível
                </h4>
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-inner">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-center">
                            <div class="text-3xl mb-2">${currentIcon}</div>
                            <p class="text-sm font-semibold text-gray-700">Nível Atual</p>
                            <p class="text-xs text-gray-600">${currentTitle}</p>
                        </div>
                        <div class="flex-1 mx-6">
                            <div class="relative">
                                <div class="w-full bg-gray-200 rounded-full h-4">
                                    <div class="bg-gradient-to-r from-editaliza-blue to-purple-600 h-4 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                                </div>
                                <div class="text-center mt-2">
                                    <span class="text-sm font-bold text-editaliza-blue">${progressPercent.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-3xl mb-2">${nextIcon}</div>
                            <p class="text-sm font-semibold text-gray-700">Próximo Nível</p>
                            <p class="text-xs text-gray-600">${nextTitle}</p>
                        </div>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600">
                            ${data.topicsToNextLevel} tópicos restantes para o próximo nível
                        </p>
                    </div>
                </div>
            </div>
        `;
    },

    // Renderizar alerta de tarefas atrasadas
    renderOverdueAlert(count, containerId = 'overdue-alert-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (count > 0) {
            container.innerHTML = `
                <div id="overdueAlert" class="overdue-alert-card p-8 rounded-3xl mb-8 shadow-xl animate-glow" role="alert" style="background: linear-gradient(135deg, #fef2f2 0%, #fef3c7 50%, #fef7cd 100%) !important; border: 2px solid #f87171 !important; background-image: radial-gradient(circle at top right, rgba(239, 68, 68, 0.1) 0%, transparent 50%), radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.1) 0%, transparent 50%) !important;">
                    <div class="flex items-start space-x-6">
                        <div class="flex-shrink-0">
                            <div class="w-20 h-20 bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse border-4 border-white">
                                <svg class="w-10 h-10 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-grow">
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center space-x-3">
                                    <h3 class="text-2xl font-bold text-red-800">⚠️ Atenção!</h3>
                                    <div class="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                                </div>
                                <span class="bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center space-x-2 shadow-lg">
                                    <span class="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                                    <span>${count} atrasada${count > 1 ? 's' : ''}</span>
                                    <span class="text-lg">🚨</span>
                                </span>
                            </div>
                            <p class="text-gray-800 font-bold text-lg mb-3">Você tem ${count} tarefa${count > 1 ? 's' : ''} atrasada${count > 1 ? 's' : ''}.</p>
                            <p class="text-gray-700 text-base mb-6 leading-relaxed">Não se preocupe! Podemos reorganizar seu cronograma automaticamente para você voltar aos trilhos. 💪</p>
                            
                            <!-- Action Section -->
                            <div class="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                                <button id="showReplanDetailsButton" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold px-6 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-3 border-2 border-blue-200">
                                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-lg">Ver Detalhes</span>
                                    <span class="text-xl">📋</span>
                                </button>
                                
                                <button id="replanButton" class="flex-1 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:via-orange-700 hover:to-amber-700 text-white font-bold px-6 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-3 border-2 border-red-200 animate-pulse">
                                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-lg">Replanejar Agora</span>
                                    <span class="text-2xl">🚀</span>
                                </button>
                                
                                <button onclick="document.getElementById('overdueAlert').style.display='none'" class="sm:w-auto px-6 py-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-2xl transition-colors duration-300 flex items-center justify-center border-2 border-gray-200 hover:border-gray-300">
                                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                    </svg>
                                    Depois
                                </button>
                            </div>
                            
                            <!-- Seção de detalhes do replanejamento (inicialmente oculta) -->
                            <div id="replanDetails" class="hidden mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 shadow-lg">
                                <div class="flex items-center mb-4">
                                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                                        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                    </div>
                                    <h4 class="font-bold text-lg text-blue-800">📋 Estratégia de Replanejamento</h4>
                                </div>
                                <div id="replanDetailsContent" class="text-base text-blue-700">
                                    <div class="animate-pulse flex items-center space-x-2">
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce"></div>
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
                                        <span class="ml-2">Carregando detalhes...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    },

    // Sistema de métricas em tempo real
    async updateMetrics(planId, forceRefresh = false) {
        if (!planId) return null;

        try {
            const data = window.app?.getGamificationData ? 
                await window.app.getGamificationData(planId, forceRefresh) : null;
            
            if (data) {
                this.renderGamificationDashboard(data, 'gamification-dashboard');
                return data;
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar métricas de gamificação:', error);
        }

        return null;
    },

    // Sistema de notificações de conquistas
    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-5 z-50 bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-6 rounded-2xl shadow-2xl transform translate-x-full opacity-0 transition-all duration-500';
        
        const achievementIcons = {
            'Primeiro Estudo': '🌟',
            'Sequência de 3 dias': '🔥',
            'Sequência de 7 dias': '💪',
            'Primeiro Simulado': '🎯',
            '10 Tópicos Concluídos': '📚',
            '50 Tópicos Concluídos': '🏆',
            'default': '🏅'
        };

        const icon = achievementIcons[achievement.title] || achievementIcons.default;

        notification.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <span class="text-3xl">${icon}</span>
                </div>
                <div>
                    <h4 class="font-bold text-lg mb-1">🎉 Nova Conquista!</h4>
                    <p class="font-semibold">${achievement.title}</p>
                    <p class="text-sm opacity-90">${achievement.description}</p>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animar entrada
        requestAnimationFrame(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
        });

        // Remover após 5 segundos
        setTimeout(() => {
            notification.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 500);
        }, 5000);

        // Som de conquista (se suportado)
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance('Nova conquista desbloqueada!');
            utterance.volume = 0.1;
            utterance.rate = 1.2;
            speechSynthesis.speak(utterance);
        }
    },

    // Animação de progressão de XP
    animateXPGain(xpGained, totalXP) {
        const xpElements = document.querySelectorAll('.xp-counter');
        xpElements.forEach(element => {
            const startXP = totalXP - xpGained;
            const endXP = totalXP;
            const duration = 2000; // 2 segundos
            const startTime = Date.now();

            const updateCounter = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animação easing
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const currentXP = Math.round(startXP + (endXP - startXP) * easedProgress);
                
                element.textContent = currentXP.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                }
            };

            requestAnimationFrame(updateCounter);
        });

        // Mostrar XP flutuante
        this.showFloatingXP(xpGained);
    },

    // Mostrar XP flutuante
    showFloatingXP(xpGained) {
        const floatingXP = document.createElement('div');
        floatingXP.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none';
        floatingXP.innerHTML = `
            <div class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-full text-xl font-bold shadow-2xl animate-bounce">
                +${xpGained} XP ✨
            </div>
        `;

        document.body.appendChild(floatingXP);

        // Animar e remover
        setTimeout(() => {
            floatingXP.style.transform = 'translate(-50%, -200px)';
            floatingXP.style.opacity = '0';
            floatingXP.style.transition = 'all 1s ease-out';
            
            setTimeout(() => {
                if (floatingXP.parentNode) {
                    floatingXP.remove();
                }
            }, 1000);
        }, 1000);
    }
};

// Disponibilizar globalmente para compatibilidade
window.Gamification = Gamification;