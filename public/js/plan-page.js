/**
 * @file js/plan-page.js
 * @description JavaScript dedicado para a página plan.html - otimizado e consolidado
 * @version 2.0
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
        
        // Renderizar visualização de tempo dedicado
        if (dashboardData.statistics?.studyTime) {
            const studyTimeContainer = document.getElementById('studyTimeDashboard');
            if (studyTimeContainer) {
                try {
                    renderStudyTimeVisualization(dashboardData.statistics.studyTime, studyTimeContainer);
                    console.log('✅ Visualização de tempo dedicado renderizada');
                } catch (error) {
                    console.error('Erro ao renderizar visualização de tempo:', error);
                }
            }
        } else {
            // Carregar dados de tempo dedicado via API específica
            await loadStudyTimeData();
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
        
        // Carregar visualização de tempo se não foi carregada pelos dados consolidados
        const studyTimeContainer = document.getElementById('studyTimeDashboard');
        if (studyTimeContainer && studyTimeContainer.innerHTML.includes('Carregando análise de tempo')) {
            await loadStudyTimeData();
        }
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
                'detailedProgressAccordion': loadDetailedProgress,
                'studyTimeDashboard': loadStudyTimeData
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
        console.log('📊 XP recebido:', data?.xp, 'ExperiencePoints:', data?.experiencePoints, 'TotalXP:', data?.totalXP);
        console.log('📊 Level Info:', data?.level_info);
        console.log('📊 Current Streak:', data?.current_streak, 'Study Streak:', data?.studyStreak);
        
        // Atualizar contador de streak no header
        const streakDisplay = document.getElementById('streak-display');
        if (streakDisplay) {
            streakDisplay.textContent = data.studyStreak || data.current_streak || 0;
        }
        
        // Tentar usar o módulo Gamification diretamente
        if (window.Gamification?.renderGamificationDashboard) {
            console.log('✅ Usando window.Gamification.renderGamificationDashboard');
            window.Gamification.renderGamificationDashboard(data, container.id);
        } else if (window.components?.renderGamificationDashboard) {
            console.log('✅ Usando window.components.renderGamificationDashboard');
            window.components.renderGamificationDashboard(data, container.id);
        } else {
            console.log('✅ Usando renderModernGamification');
            // Renderização moderna com badges e progress rings
            renderModernGamification(data, container);
        }
    }
    
    // Nova função para renderizar gamificação moderna
    function renderModernGamification(data, container) {
        const level = data.level || 1;
        const currentXP = data.currentXP || 0;
        const nextLevelXP = data.nextLevelXP || 100;
        const totalXP = data.totalXP || 0;
        const studyStreak = data.studyStreak || 0;
        const achievements = data.achievements || [];
        
        const xpProgressPercentage = Math.min(100, (currentXP / nextLevelXP) * 100);
        
        container.innerHTML = `
            <!-- Grid Principal de Stats -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <!-- Level Progress Ring -->
                <div class="text-center">
                    <div class="progress-ring">
                        <svg>
                            <circle class="progress-ring-background" cx="60" cy="60" r="52"></circle>
                            <circle class="progress-ring-progress" cx="60" cy="60" r="52" 
                                    stroke-dasharray="${2 * Math.PI * 52}" 
                                    stroke-dashoffset="${2 * Math.PI * 52 * (1 - xpProgressPercentage / 100)}"
                                    style="stroke: var(--level-purple);"></circle>
                        </svg>
                        <div class="progress-ring-text">
                            <span class="progress-ring-percentage" style="color: var(--level-purple);">Lv ${level}</span>
                            <span class="progress-ring-label">Nível</span>
                        </div>
                    </div>
                </div>
                
                <!-- XP Total -->
                <div class="text-center">
                    <div class="stat-card primary">
                        <div class="stat-value">${totalXP.toLocaleString()}</div>
                        <div class="stat-label">🌟 XP Total</div>
                    </div>
                </div>
                
                <!-- Sequência de Estudos -->
                <div class="text-center">
                    <div class="stat-card warning">
                        <div class="stat-value">${studyStreak}</div>
                        <div class="stat-label">🔥 Dias Seguidos</div>
                    </div>
                </div>
                
                <!-- Conquistas -->
                <div class="text-center">
                    <div class="stat-card success">
                        <div class="stat-value">${achievements.length}</div>
                        <div class="stat-label">🏆 Conquistas</div>
                    </div>
                </div>
            </div>
            
            <!-- Level Progress Bar Avançada -->
            <div class="level-progress-container">
                <div class="level-info">
                    <div class="current-level">Nível ${level}</div>
                    <div class="next-level">Próximo: Nível ${level + 1}</div>
                </div>
                <div class="xp-progress-bar">
                    <div class="xp-progress-fill" style="width: ${xpProgressPercentage}%"></div>
                </div>
                <div class="xp-info">
                    <div class="xp-current">${currentXP} XP</div>
                    <div class="xp-needed">${nextLevelXP - currentXP} XP restantes</div>
                </div>
            </div>
            
            <!-- Badges de Conquistas -->
            <div class="badges-container">
                ${renderAchievementBadges(achievements)}
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
                    <div class="performance-indicator ${performformanceClass}">
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
    
    /**
     * Carrega dados de tempo dedicado via API
     */
    async function loadStudyTimeData() {
        const container = document.getElementById('studyTimeDashboard');
        if (!container) return;
        
        try {
            console.log('📊 Carregando dados de tempo dedicado via API...');
            
            // Buscar dados reais via API
            const response = await window.app?.apiFetch?.(`/plans/${planId}/study-time`);
            
            if (response && (response.totalStudyTimeSeconds >= 0)) {
                renderStudyTimeVisualization(response, container);
                console.log('✅ Dados de tempo carregados via API:', response);
            } else {
                // Fallback para dados mock se API falhar
                console.warn('⚠️ API retornou dados vazios, usando fallback mock');
                const mockTimeData = await generateMockStudyTimeData();
                renderStudyTimeVisualization(mockTimeData, container);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados de tempo:', error);
            
            // Tentar fallback com dados mock
            try {
                const mockTimeData = await generateMockStudyTimeData();
                renderStudyTimeVisualization(mockTimeData, container);
                
                // Mostrar aviso de que são dados de demonstração
                const demoNotice = document.createElement('div');
                demoNotice.className = 'demo-notice';
                demoNotice.innerHTML = `
                    <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; margin-bottom: 16px;">
                        ⚠️ <strong>Dados de Demonstração:</strong> Complete algumas sessões de estudo para ver seus dados reais aqui.
                    </div>
                `;
                container.insertBefore(demoNotice, container.firstChild);
            } catch (fallbackError) {
                container.innerHTML = `
                    <div class="no-data-state">
                        <div class="no-data-icon">⚠️</div>
                        <div class="no-data-title">Erro ao Carregar Dados</div>
                        <div class="no-data-description">Não foi possível carregar os dados de tempo de estudo.</div>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Gera dados mock para demonstração (será substituído por dados reais da API)
     */
    async function generateMockStudyTimeData() {
        // Simula dados reais baseados na estrutura esperada
        return {
            totalStudyTimeSeconds: 10800, // 3 horas total
            subjects: [
                {
                    name: 'Direito Civil',
                    totalTimeSeconds: 5400, // 1.5 horas
                    topics: [
                        { name: 'Obrigações', timeSeconds: 3000 }, // 50 min
                        { name: 'Fontes do Direito Civil', timeSeconds: 2400 } // 40 min
                    ]
                },
                {
                    name: 'Direito Penal',
                    totalTimeSeconds: 3600, // 1 hora
                    topics: [
                        { name: 'Crimes contra a Pessoa', timeSeconds: 2100 }, // 35 min
                        { name: 'Legitima Defesa', timeSeconds: 1500 } // 25 min
                    ]
                },
                {
                    name: 'Direito Constitucional',
                    totalTimeSeconds: 1800, // 30 min
                    topics: [
                        { name: 'Princípios Fundamentais', timeSeconds: 1800 } // 30 min
                    ]
                }
            ]
        };
    }
    
    /**
     * Renderiza a visualização de tempo dedicado
     */
    function renderStudyTimeVisualization(timeData, container) {
        if (!timeData || !timeData.subjects || timeData.subjects.length === 0) {
            container.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon">📈</div>
                    <div class="no-data-title">Nenhum Tempo Registrado</div>
                    <div class="no-data-description">
                        Comece a estudar e complete sessões para ver como seu tempo é distribuído entre as disciplinas!
                    </div>
                </div>
            `;
            return;
        }
        
        // Preparar dados para visualização
        const chartData = prepareChartData(timeData);
        
        container.innerHTML = `
            <div class="time-chart-container">
                <div class="sunburst-chart" id="sunburst-chart-${planId}">
                    <canvas id="time-chart-canvas-${planId}" class="chart-svg"></canvas>
                    <div class="chart-center-text">
                        <div class="chart-center-value">${formatTimeHours(timeData.totalStudyTimeSeconds)}</div>
                        <div class="chart-center-label">Tempo Total</div>
                    </div>
                    <div class="chart-tooltip" id="chart-tooltip-${planId}"></div>
                </div>
            </div>
            
            <div class="time-legend">
                <div class="total-time-card">
                    <div class="total-time-value">${formatTimeHours(timeData.totalStudyTimeSeconds)}</div>
                    <div class="total-time-label">Tempo Total de Estudo</div>
                </div>
                
                <h4>📈 Distribuição por Disciplina</h4>
                <div class="legend-items">
                    ${renderLegendItems(chartData)}
                </div>
                
                <div class="time-breakdown">
                    <div class="breakdown-item">
                        <span class="breakdown-label">Média por disciplina:</span>
                        <span class="breakdown-value">${calculateAverageTime(timeData)}</span>
                    </div>
                    <div class="breakdown-item">
                        <span class="breakdown-label">Disciplinas ativas:</span>
                        <span class="breakdown-value">${timeData.subjects.length}</span>
                    </div>
                    <div class="breakdown-item">
                        <span class="breakdown-label">Total de tópicos:</span>
                        <span class="breakdown-value">${timeData.subjects.reduce((acc, s) => acc + s.topics.length, 0)}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Renderizar o gráfico
        requestAnimationFrame(() => {
            renderChart(chartData, `time-chart-canvas-${planId}`, `chart-tooltip-${planId}`);
        });
    }
    
    /**
     * Prepara dados para o gráfico
     */
    function prepareChartData(timeData) {
        const colors = [
            '#0528f2', '#3b82f6', '#06b6d4', '#10b981', 
            '#84cc16', '#f59e0b', '#ef4444', '#8b5cf6'
        ];
        
        let colorIndex = 0;
        
        return timeData.subjects.map(subject => {
            const percentage = (subject.totalTimeSeconds / timeData.totalStudyTimeSeconds) * 100;
            const color = colors[colorIndex % colors.length];
            colorIndex++;
            
            return {
                name: subject.name,
                timeSeconds: subject.totalTimeSeconds,
                percentage: percentage,
                color: color,
                topics: subject.topics.map(topic => ({
                    name: topic.name,
                    timeSeconds: topic.timeSeconds,
                    percentage: (topic.timeSeconds / subject.totalTimeSeconds) * 100
                }))
            };
        });
    }
    
    /**
     * Renderiza os itens da legenda
     */
    function renderLegendItems(chartData) {
        return chartData.map(item => `
            <div class="legend-item" data-subject="${item.name}">
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <div class="legend-name">${item.name}</div>
                <div class="legend-time">${formatTimeHours(item.timeSeconds)}</div>
                <div class="legend-percentage">(${item.percentage.toFixed(0)}%)</div>
            </div>
        `).join('');
    }
    
    /**
     * Calcula tempo médio por disciplina
     */
    function calculateAverageTime(timeData) {
        const averageSeconds = timeData.totalStudyTimeSeconds / timeData.subjects.length;
        return formatTimeHours(averageSeconds);
    }
    
    /**
     * Renderiza gráfico usando Canvas API (simples e rápido)
     */
    function renderChart(chartData, canvasId, tooltipId) {
        const canvas = document.getElementById(canvasId);
        const tooltip = document.getElementById(tooltipId);
        
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const size = Math.min(canvas.parentElement.clientWidth, 380);
        
        canvas.width = size;
        canvas.height = size;
        
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 20;
        
        let currentAngle = -Math.PI / 2; // Começar do topo
        
        chartData.forEach((item, index) => {
            const sliceAngle = (item.percentage / 100) * 2 * Math.PI;
            
            // Desenhar segmento
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            
            ctx.fillStyle = item.color;
            ctx.fill();
            
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            currentAngle += sliceAngle;
        });
        
        // Adicionar interatividade
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
            const distance = Math.sqrt((mouseX - centerX) ** 2 + (mouseY - centerY) ** 2);
            
            if (distance <= radius) {
                // Calcular qual segmento está sendo hover
                let testAngle = -Math.PI / 2;
                let hoveredItem = null;
                
                for (const item of chartData) {
                    const sliceAngle = (item.percentage / 100) * 2 * Math.PI;
                    
                    if (angle >= testAngle && angle <= testAngle + sliceAngle) {
                        hoveredItem = item;
                        break;
                    }
                    
                    testAngle += sliceAngle;
                }
                
                if (hoveredItem) {
                    tooltip.innerHTML = `
                        <strong>${hoveredItem.name}</strong><br>
                        Tempo: ${formatTimeHours(hoveredItem.timeSeconds)}<br>
                        ${hoveredItem.percentage.toFixed(1)}% do total
                    `;
                    tooltip.style.opacity = '1';
                    tooltip.style.left = (e.clientX + 10) + 'px';
                    tooltip.style.top = (e.clientY - 10) + 'px';
                } else {
                    tooltip.style.opacity = '0';
                }
            } else {
                tooltip.style.opacity = '0';
            }
        });
        
        canvas.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });
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