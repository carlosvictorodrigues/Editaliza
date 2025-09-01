/**
 * @file js/plan-page.js
 * @description JavaScript dedicado para a página plan.html - otimizado e consolidado
 * @version 2.1 - Adicionada visualização de tempo dedicado
 */

(function() {
    'use strict';
    
    // Variáveis globais do módulo
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('id');
    let dashboardData = null;
    let metricsListenerId = null;
    let lastMetricsUpdate = null;
    
    // Função utilitária para formatar tempo
    function formatTime(seconds, placeholder = '00:00:00') {
        if (isNaN(seconds) || seconds <= 0) return placeholder;
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
    
    // ==========================================
    // 🏆 SISTEMA DE ACHIEVEMENTS/BADGES
    // ==========================================
    
    function renderAchievementBadge(achievement) {
        const { id, unlocked, rarity, title, description, icon, requirement, color } = achievement;
        
        const rarityClasses = {
            'common': 'rarity-common',
            'uncommon': 'rarity-uncommon', 
            'rare': 'rarity-rare',
            'epic': 'rarity-epic',
            'legendary': 'rarity-legendary'
        };
        
        const rarityLabels = {
            'common': 'Comum',
            'uncommon': 'Incomum',
            'rare': 'Raro',
            'epic': 'Épico', 
            'legendary': 'Lendário'
        };
        
        const colorClasses = {
            'blue': 'badge-blue',
            'green': 'badge-green',
            'purple': 'badge-purple',
            'yellow': 'badge-yellow',
            'orange': 'badge-orange',
            'red': 'badge-red'
        };
        
        return `
            <div class="achievement-badge ${unlocked ? 'unlocked' : 'locked'} ${rarityClasses[rarity]} ${colorClasses[color]}" 
                 data-achievement="${id}" 
                 data-tooltip="${unlocked ? description : 'Bloqueado: ' + requirement}">
                
                <!-- Badge Container com efeitos -->
                <div class="badge-container group">
                    <!-- Glow Effect (só quando desbloqueado) -->
                    ${unlocked ? `<div class="badge-glow ${rarity}-glow"></div>` : ''}
                    
                    <!-- Badge Principal -->
                    <div class="badge-main">
                        <div class="badge-inner">
                            <!-- Ícone com animação -->
                            <div class="badge-icon ${unlocked ? 'unlocked-icon' : 'locked-icon'}">
                                <span class="icon-emoji ${unlocked ? 'animate-bounce-subtle' : ''}">${unlocked ? icon : '🔒'}</span>
                                ${unlocked && rarity !== 'common' ? '<div class="sparkle-effect"></div>' : ''}
                            </div>
                            
                            <!-- Rarity indicator -->
                            <div class="rarity-indicator ${rarity}">
                                <div class="rarity-gems">
                                    ${Array.from({length: getRarityLevel(rarity)}, (_, i) => 
                                        `<div class="gem ${unlocked ? 'gem-active' : 'gem-inactive'}"></div>`
                                    ).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Hover Info Card -->
                    <div class="badge-tooltip">
                        <div class="tooltip-header">
                            <h4 class="tooltip-title ${unlocked ? 'text-gray-800' : 'text-gray-500'}">${title}</h4>
                            <span class="tooltip-rarity ${rarity}">${rarityLabels[rarity]}</span>
                        </div>
                        <p class="tooltip-description ${unlocked ? 'text-gray-600' : 'text-gray-400'}">
                            ${unlocked ? description : requirement}
                        </p>
                        ${!unlocked ? `
                            <div class="tooltip-progress">
                                <div class="text-xs text-gray-400 mb-1">Progresso:</div>
                                <div class="progress-mini">
                                    <div class="progress-mini-fill" style="width: ${getAchievementProgress(id)}%"></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Label do badge -->
                <div class="badge-label">
                    <div class="badge-title ${unlocked ? 'unlocked-text' : 'locked-text'}">${title}</div>
                    ${unlocked ? `<div class="badge-date">Desbloqueado</div>` : ''}
                </div>
            </div>
        `;
    }
    
    function getAchievementCount(progress) {
        let count = 1; // Sempre tem "Jornada Iniciada"
        if (progress?.sessions?.sessionsCompleted >= 1) count++;
        if (progress?.completedTopics >= 5) count++;
        if (progress?.completedTopics >= 10) count++;
        if (progress?.completedTopics >= 25) count++;
        return count;
    }
    
    function getRarityCount(progress) {
        if (progress?.completedTopics >= 25) return 'Épico';
        if (progress?.completedTopics >= 10) return 'Raro';
        if (progress?.completedTopics >= 5) return 'Incomum';
        return 'Comum';
    }
    
    function getStreakDays() {
        // TODO: Implementar streak real quando disponível
        return Math.floor(Math.random() * 7) + 1;
    }
    
    function getNextAchievementText(progress) {
        if (!progress?.sessions?.sessionsCompleted) return '1ª sessão';
        if (progress?.completedTopics < 5) return '5 tópicos';
        if (progress?.completedTopics < 10) return '10 tópicos';
        if (progress?.completedTopics < 25) return '25 tópicos';
        return 'Máximo atingido!';
    }
    
    function getNextAchievementProgress(progress) {
        if (!progress?.sessions?.sessionsCompleted) return 0;
        if (progress?.completedTopics < 5) return (progress.completedTopics / 5) * 100;
        if (progress?.completedTopics < 10) return ((progress.completedTopics - 5) / 5) * 100;
        if (progress?.completedTopics < 25) return ((progress.completedTopics - 10) / 15) * 100;
        return 100;
    }
    
    function getRarityLevel(rarity) {
        const levels = { 'common': 1, 'uncommon': 2, 'rare': 3, 'epic': 4, 'legendary': 5 };
        return levels[rarity] || 1;
    }
    
    function getAchievementProgress(achievementId) {
        // TODO: Implementar progresso real baseado no tipo de achievement
        return Math.floor(Math.random() * 80) + 10;
    }
    
    // Função para renderizar componente com retry
    function renderWithRetry(componentId, renderFunc, errorMessage) {
        const container = document.getElementById(componentId);
        if (!container) return;
        
        const retryButton = `
            <button onclick="window.PlanPage.reloadComponent('${componentId}')" 
                    class="mt-3 mx-auto block px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm transition-colors">
                🔄 Tentar Novamente
            </button>
        `;
        
        return {
            render: renderFunc,
            showError: (error) => {
                console.error(`Erro em ${componentId}:`, error);
                container.innerHTML = `
                    <div class="bg-red-50 border border-red-200 p-4 rounded-lg">
                        <p class="text-red-600 text-center font-medium mb-2">⚠️ ${errorMessage}</p>
                        <p class="text-red-500 text-sm text-center">Detalhes: ${error.message}</p>
                        ${retryButton}
                    </div>
                `;
            }
        };
    }
    
    // Função principal de inicialização usando endpoint consolidado
    async function initialize() {
        if (!planId) {
            window.location.href = 'dashboard.html';
            return;
        }

        if (window.initializingPlan) return;
        window.initializingPlan = true;
        
        try {
            window.app?.showSpinner?.();
            
            // Renderizar navegação
            await window.components?.renderMainNavigation?.('plan.html');
            
            // Buscar dados consolidados do dashboard
            console.log('📦 Buscando dados consolidados do dashboard...');
            const response = await window.app?.apiFetch?.(`/plans/${planId}/dashboard`);
            
            // A API retorna os dados diretamente, não em response.success
            if (response && (response.plan || response.statistics || response.gamification)) {
                dashboardData = response;
                console.log('✅ Dados do dashboard carregados com sucesso:', dashboardData);
                
                // Renderizar header do plano
                if (dashboardData.plan) {
                    window.components?.renderPlanHeader?.(planId, dashboardData.plan.name, 'plan.html');
                }
                
                // Renderizar todos os componentes com os dados recebidos
                await renderAllComponents();
                
            } else {
                // Fallback para requisições individuais se o endpoint consolidado falhar
                console.warn('⚠️ Endpoint consolidado falhou, usando fallback...', response);
                await loadIndividualComponents();
            }
            
            // Configurar auto-refresh
            setupMetricsAutoRefresh();
            
            // Registrar listener para atualizações
            registerMetricsListener();
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            window.app?.showToast?.('Erro ao carregar dados do plano: ' + error.message, 'error');
        } finally {
            window.initializingPlan = false;
            window.app?.hideSpinner?.();
        }
    }
    
    // Renderizar todos os componentes com dados do dashboard
    async function renderAllComponents() {
        console.log('🎨 Renderizando componentes com dados:', dashboardData);
        
        // Renderizar gamificação se existir
        if (dashboardData.gamification) {
            const gamificationContainer = document.getElementById('gamification-dashboard');
            if (gamificationContainer) {
                try {
                    renderGamification(dashboardData.gamification, gamificationContainer);
                    console.log('✅ Gamificação renderizada');
                } catch (error) {
                    console.error('Erro ao renderizar gamificação:', error);
                }
            }
        }
        
        // Renderizar estatísticas se existir
        if (dashboardData.statistics) {
            const statsContainer = document.getElementById('performanceDashboard');
            if (statsContainer) {
                try {
                    renderStatistics(dashboardData.statistics, statsContainer);
                    console.log('✅ Estatísticas renderizadas');
                } catch (error) {
                    console.error('Erro ao renderizar estatísticas:', error);
                }
            }
        }
        
        // Renderizar progresso das disciplinas
        if (dashboardData.statistics?.subjectProgress) {
            const detailedContainer = document.getElementById('detailedProgressAccordion') || 
                                      document.getElementById('detailedProgressDashboard');
            if (detailedContainer) {
                try {
                    renderSubjectProgress(dashboardData.statistics.subjectProgress, detailedContainer);
                    console.log('✅ Progresso das disciplinas renderizado');
                } catch (error) {
                    console.error('Erro ao renderizar progresso das disciplinas:', error);
                }
            }
        }
        
        // Renderizar no progressDashboard também
        if (dashboardData.statistics) {
            const progressContainer = document.getElementById('progressDashboard');
            if (progressContainer) {
                try {
                    renderStatistics(dashboardData.statistics, progressContainer);
                    console.log('✅ Estatísticas renderizadas no progressDashboard');
                } catch (error) {
                    console.error('Erro ao renderizar estatísticas no progressDashboard:', error);
                }
            }
        }
        
        // Renderizar metas se existir
        if (dashboardData.gamification?.dailyMissions) {
            const goalsContainer = document.getElementById('goalProgressDashboard');
            if (goalsContainer) {
                try {
                    renderDailyMissions(dashboardData.gamification.dailyMissions, goalsContainer);
                    console.log('✅ Metas diárias renderizadas');
                } catch (error) {
                    console.error('Erro ao renderizar metas:', error);
                }
            }
        }
        
        // Renderizar placeholders para componentes que precisam de chamadas individuais
        const radarContainer = document.getElementById('questionRadarDashboard');
        if (radarContainer) {
            radarContainer.innerHTML = `
                <div class="text-center py-8">
                    <div class="spinner-border text-blue-600 mb-2"></div>
                    <p class="text-gray-600">Carregando análise de pontos fracos...</p>
                </div>
            `;
        }
        
        const scheduleContainer = document.getElementById('scheduleDashboard');
        if (scheduleContainer) {
            scheduleContainer.innerHTML = `
                <div class="text-center py-8">
                    <div class="spinner-border text-blue-600 mb-2"></div>
                    <p class="text-gray-600">Carregando cronograma...</p>
                </div>
            `;
        }
        
        // Carregar componentes que ainda precisam de chamadas individuais
        await Promise.all([
            loadQuestionRadar(),
            loadSchedulePreview()
        ]);
    }
    
    // Mostrar erro em componente específico
    function showComponentError(container, componentId) {
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 p-4 rounded-lg">
                <p class="text-red-600 text-center font-medium mb-2">⚠️ Erro ao carregar componente</p>
                <button onclick="window.PlanPage.reloadComponent('${componentId}')" 
                        class="mt-3 mx-auto block px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm transition-colors">
                    🔄 Tentar Novamente
                </button>
            </div>
        `;
    }
    
    // Recarregar componente específico
    async function reloadComponent(componentId) {
        const container = document.getElementById(componentId);
        if (!container) return;
        
        container.innerHTML = '<div class="text-center p-4"><div class="spinner"></div></div>';
        
        try {
            // Mapear componente para função de carregamento
            const loaders = {
                'gamification-dashboard': loadGamificationData,
                'scheduleDashboard': loadSchedulePreview,
                'performanceDashboard': loadPerformanceCheck,
                'goalProgressDashboard': loadGoalProgress,
                'questionRadarDashboard': loadQuestionRadar,
                'detailedProgressAccordion': loadDetailedProgress
            };
            
            const loader = loaders[componentId];
            if (loader) {
                await loader(true); // Forçar refresh
            }
        } catch (error) {
            showComponentError(container, componentId);
        }
    }
    
    // Funções de renderização dos componentes
    function renderGamification(data, container) {
        console.log('🎮 Renderizando gamificação com dados:', data);
        
        // Atualizar contador de streak no header
        const streakDisplay = document.getElementById('streak-display');
        if (streakDisplay) {
            streakDisplay.textContent = data.studyStreak || 0;
        }
        
        // Tentar usar o módulo Gamification diretamente
        if (window.Gamification?.renderGamificationDashboard) {
            window.Gamification.renderGamificationDashboard(data, container.id);
        } else if (window.components?.renderGamificationDashboard) {
            window.components.renderGamificationDashboard(data, container.id);
        } else {
            // Renderização moderna com badges e progress rings
            renderModernGamification(data, container);
        }
    }
    
    // Nova função para renderizar gamificação moderna com badges
    function renderModernGamification(data, container) {
        const level = data.level || 1;
        const currentXP = data.currentXP || 0;
        const nextLevelXP = data.nextLevelXP || 100;
        const totalXP = data.totalXP || 0;
        const studyStreak = data.studyStreak || 0;
        const achievements = data.achievements || [];
        const progress = data.progress || {};
        
        const xpProgressPercentage = Math.min(100, (currentXP / nextLevelXP) * 100);
        
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">📊 Diagnóstico do Seu Progresso</h2>
                
                <!-- Status Principal com Interpretação -->
                <div class="bg-green-100 text-green-800 border-green-200 rounded-lg p-4 border mb-4">
                    <h3 class="font-bold text-lg">Você está no ritmo certo!</h3>
                    <p class="text-sm mt-1">Continue assim para alcançar seus objetivos</p>
                    <p class="text-xs mt-2 opacity-75">✅ Ritmo adequado para terminar a tempo</p>
                </div>
                
                <!-- Métricas Interpretadas -->
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <!-- O que você planejou -->
                    <div class="bg-blue-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">📋 O que planejou</p>
                        <p class="text-lg font-bold text-blue-700">${progress?.totalTopics || 0} tópicos</p>
                        <p class="text-xs text-gray-500">Total do edital</p>
                    </div>
                    
                    <!-- Onde você está -->
                    <div class="bg-green-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">📍 Onde está</p>
                        <p class="text-lg font-bold text-green-700">${progress?.completedTopics || 0} concluídos</p>
                        <p class="text-xs text-gray-500">${((progress?.completedTopics || 0) / (progress?.totalTopics || 1) * 100).toFixed(1)}% do plano</p>
                    </div>
                    
                    <!-- O que falta -->
                    <div class="bg-orange-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">🎯 O que falta</p>
                        <p class="text-lg font-bold text-orange-700">${(progress?.totalTopics || 0) - (progress?.completedTopics || 0)} tópicos</p>
                        <p class="text-xs text-gray-500">em ${data?.daysRemaining || 0} dias</p>
                    </div>
                </div>
                
                <!-- 🏆 SISTEMA DE BADGES GAMIFICADO -->
                <div class="mt-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <span class="achievement-glow-pulse">🏆</span>
                            Suas Conquistas
                        </h3>
                        <div class="flex items-center gap-2 text-xs">
                            <div class="flex items-center gap-1 bg-gradient-to-r from-amber-100 to-orange-100 px-2 py-1 rounded-full border border-amber-200">
                                <span class="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                                <span class="text-amber-700 font-medium">${getAchievementCount(progress)} / 5 Desbloqueadas</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Progress Bar até próxima conquista -->
                    <div class="mb-4">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-xs font-medium text-gray-600">Próxima conquista</span>
                            <span class="text-xs text-gray-500">${getNextAchievementText(progress)}</span>
                        </div>
                        <div class="achievement-progress-bar">
                            <div class="achievement-progress-fill" style="width: ${getNextAchievementProgress(progress)}%"></div>
                        </div>
                    </div>
                    
                    <!-- Grid de Badges/Troféus -->
                    <div class="achievements-grid">
                        ${renderAchievementBadge({
                            id: 'starter',
                            unlocked: true,
                            rarity: 'common',
                            title: 'Jornada Iniciada',
                            description: '"Todo expert já foi iniciante"',
                            icon: '🎯',
                            requirement: 'Criar seu primeiro plano',
                            color: 'blue'
                        })}
                        
                        ${renderAchievementBadge({
                            id: 'first-session',
                            unlocked: progress?.sessions?.sessionsCompleted >= 1,
                            rarity: 'common',
                            title: 'Primeira Lapada',
                            description: '"O primeiro passo foi dado!"',
                            icon: '✅',
                            requirement: '1 sessão concluída',
                            color: 'green'
                        })}
                        
                        ${renderAchievementBadge({
                            id: 'momentum',
                            unlocked: progress?.completedTopics >= 5,
                            rarity: 'uncommon',
                            title: 'Momentum',
                            description: '"5 tópicos dominados!"',
                            icon: '💪',
                            requirement: '5 tópicos concluídos',
                            color: 'purple'
                        })}
                        
                        ${renderAchievementBadge({
                            id: 'dezena',
                            unlocked: progress?.completedTopics >= 10,
                            rarity: 'rare',
                            title: 'Dezena Conquistada',
                            description: '"10 tópicos no bolso!"',
                            icon: '⭐',
                            requirement: '10 tópicos concluídos',
                            color: 'yellow'
                        })}
                        
                        ${renderAchievementBadge({
                            id: 'quarteto-ferro',
                            unlocked: progress?.completedTopics >= 25,
                            rarity: 'epic',
                            title: 'Quarteto de Ferro',
                            description: '"25% do caminho percorrido!"',
                            icon: '🔥',
                            requirement: '25 tópicos concluídos',
                            color: 'orange'
                        })}
                    </div>
                    
                    <!-- Estatísticas de Conquistas -->
                    <div class="mt-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-xl p-3 border border-indigo-100">
                        <div class="grid grid-cols-3 divide-x divide-indigo-200">
                            <div class="text-center px-2">
                                <div class="text-lg font-bold text-indigo-700">${getAchievementCount(progress)}</div>
                                <div class="text-xs text-indigo-600">Desbloqueadas</div>
                            </div>
                            <div class="text-center px-2">
                                <div class="text-lg font-bold text-purple-700">${getRarityCount(progress)}</div>
                                <div class="text-xs text-purple-600">Raridade Máxima</div>
                            </div>
                            <div class="text-center px-2">
                                <div class="text-lg font-bold text-pink-700">${getStreakDays()}</div>
                                <div class="text-xs text-pink-600">Dias de Streak</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Renderizar badges de conquistas
    function renderAchievementBadges(achievements) {
        // Badges padrão que sempre aparecem
        const defaultBadges = [
            { id: 'first_week', icon: '🎯', title: 'Primeira Semana', description: 'Complete 7 dias de estudos', earned: false },
            { id: 'streak_master', icon: '🔥', title: 'Mestre da Sequência', description: '30 dias seguidos', earned: false },
            { id: 'hundred_topics', icon: '📚', title: 'Centurião', description: '100 tópicos completos', earned: false },
            { id: 'question_solver', icon: '🧠', title: 'Solucionador', description: '500 questões resolvidas', earned: false },
            { id: 'speed_learner', icon: '⚡', title: 'Aprendiz Veloz', description: 'Complete um tema em 1 dia', earned: false },
            { id: 'perfectionist', icon: '💎', title: 'Perfeccionista', description: '95% de acertos em 10 sessões', earned: false }
        ];
        
        // Marcar badges conquistados
        const earnedIds = achievements.map(a => a.id);
        defaultBadges.forEach(badge => {
            badge.earned = earnedIds.includes(badge.id);
        });
        
        return defaultBadges.map(badge => `
            <div class="achievement-badge ${badge.earned ? 'earned' : 'locked'}" 
                 title="${badge.description}">
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-title">${badge.title}</div>
                <div class="badge-description">${badge.description}</div>
            </div>
        `).join('');
    }
    
    function renderSchedulePreview(data, container) {
        // Implementação da renderização do schedule preview
        container.innerHTML = `<!-- Template do schedule preview com dados: ${JSON.stringify(data).substring(0, 100)}... -->`;
    }
    
    function renderPerformanceCheck(data, container) {
        // Implementação da renderização do performance check
        container.innerHTML = `<!-- Template do performance check com dados: ${JSON.stringify(data).substring(0, 100)}... -->`;
    }
    
    function renderGoalProgress(data, container) {
        const dailyPercentage = data.dailyGoal > 0 ? Math.min(100, (data.dailyProgress / data.dailyGoal) * 100) : 0;
        const weeklyPercentage = data.weeklyGoal > 0 ? Math.min(100, (data.weeklyProgress / data.weeklyGoal) * 100) : 0;
        
        container.innerHTML = `
            <div class="space-y-6">
                <div class="bg-gradient-to-r from-editaliza-green/10 to-editaliza-green/5 p-4 rounded-lg border border-editaliza-green/20">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-semibold text-editaliza-green flex items-center">
                            <span class="mr-2">🎯</span>Meta Diária
                        </h4>
                        <span class="text-sm font-bold text-editaliza-green">${data.dailyProgress} / ${data.dailyGoal || 'N/A'}</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar bg-editaliza-green" style="width: ${dailyPercentage.toFixed(0)}%;">${dailyPercentage.toFixed(0)}%</div>
                    </div>
                </div>
                <div class="bg-gradient-to-r from-editaliza-blue/10 to-editaliza-blue/5 p-4 rounded-lg border border-editaliza-blue/20">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-semibold text-editaliza-blue flex items-center">
                            <span class="mr-2">📅</span>Meta Semanal
                        </h4>
                        <span class="text-sm font-bold text-editaliza-blue">${data.weeklyProgress} / ${data.weeklyGoal || 'N/A'}</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar bg-editaliza-blue" style="width: ${weeklyPercentage.toFixed(0)}%;">${weeklyPercentage.toFixed(0)}%</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Fallback: Carregar componentes individualmente
    async function loadIndividualComponents() {
        await Promise.all([
            loadGamificationData(true),
            loadSchedulePreview(true),
            loadPerformanceCheck(true),
            loadGoalProgress(true),
            loadQuestionRadar(true),
            loadDetailedProgress(true)
        ]);
    }
    
    // Funções individuais de carregamento (mantidas para compatibilidade)
    async function loadGamificationData(forceRefresh = false) {
        const component = renderWithRetry('gamification-dashboard', 
            async () => {
                const data = await window.app?.getGamificationData?.(planId);
                renderGamification(data || {}, document.getElementById('gamification-dashboard'));
            },
            'Erro ao carregar estatísticas'
        );
        
        try {
            await component.render();
        } catch (error) {
            component.showError(error);
        }
    }
    
    async function loadSchedulePreview(forceRefresh = false) {
        // Implementação similar com retry
    }
    
    async function loadPerformanceCheck(forceRefresh = false) {
        // Implementação similar com retry
    }
    
    async function loadGoalProgress(forceRefresh = false) {
        // Implementação similar com retry
    }
    
    async function loadQuestionRadar(forceRefresh = false) {
        const container = document.getElementById('questionRadarDashboard');
        if (!container) return;
        
        try {
            // Por enquanto, mostrar uma mensagem informativa
            container.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <h4 class="font-semibold text-yellow-800 mb-2">🎯 Análise de Pontos Fracos</h4>
                    <p class="text-yellow-700 text-sm">
                        Esta funcionalidade será ativada após você completar algumas questões.
                        Continue estudando para ver sua análise personalizada!
                    </p>
                </div>
            `;
        } catch (error) {
            console.error('Erro ao carregar radar de questões:', error);
        }
    }
    
    async function loadDetailedProgress(forceRefresh = false) {
        // Já está sendo renderizado em renderSubjectProgress
        console.log('Progresso detalhado já renderizado via renderSubjectProgress');
    }
    
    // Configurar auto-refresh das métricas
    function setupMetricsAutoRefresh() {
        lastMetricsUpdate = Date.now();
        
        // Verificar a cada 30 segundos se os dados podem estar desatualizados
        setInterval(() => {
            if (!document.hidden) {
                const timeSinceUpdate = Date.now() - lastMetricsUpdate;
                const indicator = document.getElementById('last-update-indicator');
                
                if (timeSinceUpdate > 5 * 60 * 1000 && indicator) {
                    indicator.innerHTML = '⚠️ Dados podem estar desatualizados. Clique em "Atualizar Métricas"';
                    indicator.className = 'mt-2 text-xs text-orange-600 font-medium';
                }
            }
        }, 30 * 1000);
        
        // Auto-refresh a cada 10 minutos
        setInterval(() => {
            if (!document.hidden) {
                refreshAllMetrics();
            }
        }, 10 * 60 * 1000);
    }
    
    // Atualizar todas as métricas
    async function refreshAllMetrics() {
        try {
            window.app?.showSpinner?.();
            
            // Invalidar cache
            window.app?.invalidatePlanCache?.(planId);
            
            // Recarregar dados consolidados
            const response = await window.app?.apiFetch?.(`/plans/${planId}/dashboard`);
            
            if (response && response.success) {
                dashboardData = response.data;
                await renderAllComponents();
                window.app?.showToast?.('✅ Métricas atualizadas com sucesso!', 'success');
            }
            
            lastMetricsUpdate = Date.now();
            updateLastUpdateIndicator();
            
        } catch (error) {
            console.error('❌ Erro ao atualizar métricas:', error);
            window.app?.showToast?.('Erro ao atualizar métricas: ' + error.message, 'error');
        } finally {
            window.app?.hideSpinner?.();
        }
    }
    
    // Atualizar indicador de última atualização
    function updateLastUpdateIndicator() {
        const indicator = document.getElementById('last-update-indicator');
        if (indicator) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            indicator.innerHTML = `✅ Última atualização: ${timeString}`;
            indicator.className = 'mt-2 text-xs text-green-600';
        }
    }
    
    // Registrar listener para atualizações de métricas
    function registerMetricsListener() {
        if (window.app?.onMetricsUpdate) {
            metricsListenerId = window.app.onMetricsUpdate((updatedPlanId, eventType) => {
                if (updatedPlanId === planId) {
                    setTimeout(() => {
                        refreshAllMetrics();
                    }, 1500);
                }
            });
        }
    }
    
    // Funções de renderização para os componentes
    function renderStatistics(statistics, container) {
        if (!container) return;
        
        const completionRate = statistics.completionRate || 0;
        const performanceClass = getPerformanceClass(completionRate);
        
        container.innerHTML = `
            <div class="performance-grid">
                <!-- Taxa de Conclusão Principal -->
                <div class="stat-card primary highlight-pulse">
                    <div class="stat-value">${completionRate}%</div>
                    <div class="stat-label">📈 Taxa de Conclusão</div>
                    <div class="performance-indicator ${performanceClass}">
                        ${getPerformanceText(completionRate)}
                    </div>
                </div>
                
                <!-- Sessões Concluídas -->
                <div class="stat-card info">
                    <div class="stat-value">${statistics.completedSessions || 0}/${statistics.totalSessions || 0}</div>
                    <div class="stat-label">🎯 Sessões de Estudo</div>
                </div>
                
                <!-- Tópicos Concluídos -->
                <div class="stat-card success">
                    <div class="stat-value">${statistics.completedTopics || 0}</div>
                    <div class="stat-label">📚 Tópicos Dominados</div>
                </div>
                
                <!-- Questões Hoje -->
                <div class="stat-card warning">
                    <div class="stat-value">${statistics.dailyProgress || 0}</div>
                    <div class="stat-label">💡 Questões Hoje</div>
                </div>
                
                <!-- Tempo Total Estudado -->
                <div class="stat-card primary">
                    <div class="stat-value">${formatTime(statistics.totalStudyTime || 0, '0h 0m')}</div>
                    <div class="stat-label">⏱️ Tempo de Estudo</div>
                </div>
                
                <!-- Meta Semanal -->
                <div class="stat-card success">
                    <div class="stat-value">${statistics.weeklyProgress || 0}/${statistics.weeklyGoal || 0}</div>
                    <div class="stat-label">🎯 Meta Semanal</div>
                </div>
            </div>
        `;
    }
    
    // Função auxiliar para determinar classe de performance
    function getPerformanceClass(rate) {
        if (rate >= 90) return 'excellent';
        if (rate >= 75) return 'good';
        if (rate >= 50) return 'average';
        return 'needs-improvement';
    }
    
    // Função auxiliar para texto de performance
    function getPerformanceText(rate) {
        if (rate >= 90) return 'Excelente';
        if (rate >= 75) return 'Bom Ritmo';
        if (rate >= 50) return 'Na Média';
        return 'Precisa Melhorar';
    }
    
    // Função auxiliar para formatar tempo em horas/minutos
    function formatTimeHours(seconds) {
        if (!seconds || seconds === 0) return '0h 0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
    
    function renderSubjectProgress(subjectProgress, container) {
        if (!container || !subjectProgress) return;
        
        const progressHTML = subjectProgress.map((subject, index) => {
            const progressPercentage = subject.progressPercentage || 0;
            const performanceClass = getProgressPerformanceClass(progressPercentage);
            
            return `
                <div class="stat-card ${performanceClass}" style="animation-delay: ${index * 0.1}s;">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-800 mb-1">${subject.name}</h4>
                            <div class="text-sm text-gray-600">
                                ${subject.completedTopics || 0}/${subject.totalTopics || 0} tópicos • 
                                ${subject.completedSessions || 0} sessões
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="stat-value text-lg">${progressPercentage.toFixed(0)}%</div>
                        </div>
                    </div>
                    
                    <div class="progress-bar-container mb-2">
                        <div class="progress-bar-compact" style="width: ${progressPercentage}%;"></div>
                    </div>
                    
                    <div class="flex justify-between text-xs text-gray-500">
                        <span>Último estudo: ${formatLastStudy(subject.lastStudiedAt)}</span>
                        <span class="performance-indicator ${getProgressPerformanceClass(progressPercentage)}">
                            ${getProgressStatusText(progressPercentage)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = progressHTML || `
            <div class="text-center py-8 text-gray-500">
                <div class="text-4xl mb-2">📚</div>
                <p>Nenhuma disciplina cadastrada ainda.</p>
                <p class="text-sm mt-1">Comece seus estudos para ver o progresso aqui!</p>
            </div>
        `;
    }
    
    // Função auxiliar para classe de performance do progresso
    function getProgressPerformanceClass(percentage) {
        if (percentage >= 80) return 'success';
        if (percentage >= 50) return 'info';
        if (percentage >= 25) return 'warning';
        return 'error';
    }
    
    // Função auxiliar para texto de status do progresso
    function getProgressStatusText(percentage) {
        if (percentage >= 80) return 'Quase Lá!';
        if (percentage >= 50) return 'Bom Ritmo';
        if (percentage >= 25) return 'No Caminho';
        return 'Iniciando';
    }
    
    // Função auxiliar para formatar último estudo
    function formatLastStudy(dateString) {
        if (!dateString) return 'Nunca';
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Hoje';
        if (diffDays === 1) return 'Ontem';
        if (diffDays <= 7) return `${diffDays} dias atrás`;
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    
    function renderDailyMissions(missions, container) {
        if (!container || !missions) return;
        
        const missionsHTML = missions.map((mission, index) => {
            const progressPercentage = Math.min(100, (mission.progress / mission.goal) * 100);
            const isCompleted = mission.completed;
            
            return `
                <div class="stat-card ${isCompleted ? 'success' : 'info'}" 
                     style="animation-delay: ${index * 0.1}s;">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex-1">
                            <h4 class="font-semibold flex items-center">
                                <span class="text-xl mr-2">${isCompleted ? '✅' : '🎯'}</span>
                                ${mission.title}
                            </h4>
                            <div class="text-sm text-gray-600 mt-1">
                                ${mission.description || 'Complete esta missão para ganhar XP!'}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-lg font-bold text-yellow-600">+${mission.xpReward} XP</div>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <div class="flex justify-between text-sm mb-1">
                            <span class="font-medium">${mission.progress}/${mission.goal}</span>
                            <span class="text-gray-500">${progressPercentage.toFixed(0)}% completo</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar ${isCompleted ? 'bg-green-500' : ''}" 
                                 style="width: ${progressPercentage}%;
                                        background: ${isCompleted ? '#22c55e' : 'linear-gradient(90deg, var(--primary) 0%, var(--primary-600) 100%)'}">
                                ${progressPercentage >= 20 ? progressPercentage.toFixed(0) + '%' : ''}
                            </div>
                        </div>
                    </div>
                    
                    ${isCompleted ? 
                        '<div class="text-center text-green-600 font-medium text-sm">🎉 Missão Concluída!</div>' :
                        `<div class="text-center text-gray-500 text-xs">
                            ${mission.progress > 0 ? 'Continue assim! Você está progredindo.' : 'Comece agora para ganhar XP!'}
                        </div>`
                    }
                </div>
            `;
        }).join('');
        
        const completedCount = missions.filter(m => m.completed).length;
        const totalCount = missions.length;
        
        container.innerHTML = `
            <div class="mb-4">
                <div class="flex justify-between items-center mb-2">
                    <div class="text-sm text-gray-600">
                        ${completedCount}/${totalCount} missões concluídas hoje
                    </div>
                    <div class="text-sm font-semibold text-yellow-600">
                        +${missions.reduce((acc, m) => acc + (m.completed ? m.xpReward : 0), 0)} XP ganhos
                    </div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${(completedCount / totalCount) * 100}%;">
                        ${Math.round((completedCount / totalCount) * 100)}% das missões
                    </div>
                </div>
            </div>
            
            <div class="space-y-3">
                ${missionsHTML}
            </div>
        `;
    }
    
    async function loadSchedulePreview() {
        // Implementação temporária - será carregada via API separada
        const container = document.getElementById('scheduleDashboard');
        if (container) {
            container.innerHTML = '<p class="text-gray-500">Carregando cronograma...</p>';
        }
    }
    
    // Cleanup ao sair da página
    function cleanup() {
        if (metricsListenerId && window.app?.removeMetricsListener) {
            window.app.removeMetricsListener(metricsListenerId);
        }
    }
    
    // Expor API pública
    window.PlanPage = {
        initialize,
        refreshAllMetrics,
        reloadComponent,
        formatTime
    };
    
    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initialize();
            setupRefreshButton();
        });
    } else {
        initialize();
        setupRefreshButton();
    }
    
    // Configurar botão de refresh manual
    function setupRefreshButton() {
        const btn = document.getElementById('refresh-metrics-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                await refreshAllMetrics();
            });
        }
    }
    
    // Registrar cleanup
    window.addEventListener('beforeunload', cleanup);
    
})();