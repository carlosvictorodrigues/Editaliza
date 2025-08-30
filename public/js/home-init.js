/**
 * @file js/home-init.js
 * @description Inicialização sequencial e determinística da home.html
 * @version 1.0 - Fix para cards sumindo e recarregamentos desnecessários
 */

class HomeInitializer {
    constructor() {
        this.initialized = false;
        this.metrics = {
            startTime: Date.now(),
            phases: {},
            errors: []
        };
    }
    
    // Inicialização principal
    async initialize() {
        if (this.initialized) {
            console.log('🏠 Home já inicializada');
            return;
        }
        
        console.log('🚀 Iniciando Home de forma determinística...');
        
        try {
            // Fase 1: Verificar dependências críticas
            await this._phase1_CheckDependencies();
            
            // Fase 2: Inicializar contexto de plano
            await this._phase2_InitializePlanContext();
            
            // Fase 3: Renderizar interface principal
            await this._phase3_RenderMainInterface();
            
            // Fase 4: Carregar dados e estatísticas
            await this._phase4_LoadDataAndStats();
            
            // Fase 5: Configurar interações e listeners
            await this._phase5_SetupInteractions();
            
            this.initialized = true;
            this._logPerformanceMetrics();
            console.log('✅ Home inicializada com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro na inicialização da Home:', error);
            this.metrics.errors.push(error.message);
            this._showErrorFallback(error);
        }
    }
    
    async _phase1_CheckDependencies() {
        const phaseStart = Date.now();
        console.log('📋 Fase 1: Verificando dependências...');
        
        // Aguardar módulos essenciais
        await this._waitForModules();
        
        // Verificar se usuário está autenticado
        if (!app.isAuthenticated()) {
            throw new Error('Usuário não autenticado');
        }
        
        this.metrics.phases.dependencies = Date.now() - phaseStart;
    }
    
    async _phase2_InitializePlanContext() {
        const phaseStart = Date.now();
        console.log('🎯 Fase 2: Inicializando contexto de plano...');
        
        // Carregar PlanContext se não estiver disponível
        if (!window.PlanContext) {
            await this._loadScript('js/state/plan-context.js');
        }
        
        // Inicializar contexto
        await window.PlanContext.initialize();
        
        // Configurar listener para mudanças
        window.PlanContext.addListener((state) => {
            this._onPlanContextChange(state);
        });
        
        this.metrics.phases.planContext = Date.now() - phaseStart;
    }
    
    async _phase3_RenderMainInterface() {
        const phaseStart = Date.now();
        console.log('🖼️ Fase 3: Renderizando interface principal...');
        
        // Renderizar navegação
        if (typeof components !== 'undefined' && components.renderMainNavigation) {
            await components.renderMainNavigation('home.html');
        }
        
        // Configurar seletor de planos
        await this._setupPlanSelector();
        
        // Atualizar data de hoje
        this._updateTodayDate();
        
        this.metrics.phases.interface = Date.now() - phaseStart;
    }
    
    async _phase4_LoadDataAndStats() {
        const phaseStart = Date.now();
        console.log('📊 Fase 4: Carregando dados e estatísticas...');
        
        const planId = window.PlanContext.planId;
        
        // Carregar em paralelo (não sequencial para performance)
        await Promise.all([
            this._loadUserProfile(),
            this._loadMetrics(planId),
            this._renderTodaySchedule(),
            this._loadStatistics(planId),
            this._checkOverdueTasks(planId),
            this._loadTransparencyData(planId)
        ]);
        
        this.metrics.phases.data = Date.now() - phaseStart;
    }
    
    async _phase5_SetupInteractions() {
        const phaseStart = Date.now();
        console.log('⚙️ Fase 5: Configurando interações...');
        
        // Event listeners para modais
        this._setupModalListeners();
        
        // Listeners para sessões completadas
        this._setupSessionListeners();
        
        // Configurar atualização automática (a cada 30 segundos)
        this._setupAutoRefresh();
        
        this.metrics.phases.interactions = Date.now() - phaseStart;
    }
    
    // Esperar módulos críticos estarem disponíveis
    async _waitForModules(maxWait = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (window.app && window.components) {
                console.log('✅ Módulos críticos carregados');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.warn('⚠️ Timeout aguardando módulos, continuando...');
        return false;
    }
    
    // Carregar script dinamicamente
    async _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // Configurar seletor de planos sem reload
    async _setupPlanSelector() {
        const planSelector = document.getElementById('planSelector');
        if (!planSelector) {
            console.warn('⚠️ Plan selector não encontrado');
            return;
        }
        
        try {
            const plans = await app.getPlans();
            const currentPlanId = window.PlanContext.planId;
            
            planSelector.innerHTML = plans.map(p => 
                `<option value="${p.id}" ${p.id == currentPlanId ? 'selected' : ''}>${app.sanitizeHtml(p.plan_name)}</option>`
            ).join('');
            planSelector.disabled = false;
            
            // Event listener SEM location.reload()
            planSelector.addEventListener('change', async (e) => {
                const newPlanId = e.target.value;
                if (!newPlanId || newPlanId === currentPlanId) return;
                
                try {
                    e.target.disabled = true;
                    await window.PlanContext.switchPlan(newPlanId);
                    // Interface será atualizada automaticamente via listener
                } catch (error) {
                    console.error('Erro ao trocar plano:', error);
                    app.showToast('❌ Erro ao trocar plano: ' + error.message, 'error');
                } finally {
                    e.target.disabled = false;
                }
            });
            
        } catch (error) {
            console.error('Erro ao configurar seletor de planos:', error);
        }
    }
    
    // Atualizar data de hoje
    _updateTodayDate() {
        const todayElement = document.getElementById('todayDateHero');
        if (todayElement) {
            const today = new Date();
            todayElement.textContent = today.toLocaleDateString('pt-BR', { 
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
            });
        }
    }
    
    // Renderizar cronograma de hoje (sem sumimir os cards)
    async _renderTodaySchedule() {
        const container = document.getElementById('todaySchedule');
        if (!container) return;
        
        const todaySessions = window.PlanContext.todaySessions;
        
        if (todaySessions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Nenhuma atividade para hoje</h3>
                    <p class="text-gray-600">Aproveite para descansar ou revisar conteúdos anteriores!</p>
                </div>
            `;
            return;
        }
        
        try {
            // Renderizar cards de forma síncrona para evitar flicker
            const sessionCards = await Promise.all(
                todaySessions.map(session => this._renderIndividualCard(session))
            );
            
            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    ${sessionCards.join('')}
                </div>
            `;
            
            console.log(`🎯 ${todaySessions.length} cards renderizados com sucesso`);
            
        } catch (error) {
            console.error('Erro ao renderizar cronograma:', error);
            container.innerHTML = `
                <div class="text-center py-12 text-red-600">
                    <p>Erro ao carregar atividades. Tente recarregar a página.</p>
                </div>
            `;
        }
    }
    
    async _renderIndividualCard(session) {
        if (!components) {
            console.warn('⚠️ Components não disponível para renderizar card');
            return '<div class="p-4 bg-gray-100 rounded-lg">Card indisponível</div>';
        }
        
        switch (session.session_type) {
            case 'Novo Tópico':
            case 'Reforço Extra':
                return await components.createSessionCard(session);
            case 'Revisão Consolidada':
                return await components.createReviewCard(session);
            case 'Simulado Direcionado':
            case 'Simulado Completo':
                return await components.createSimuladCard(session);
            case 'Redação':
                return await components.createEssayCard(session);
            default:
                return await components.createSessionCard(session);
        }
    }
    
    async _loadUserProfile() {
        try {
            const profile = await app.apiFetch("/users/profile");
            const welcomeElement = document.getElementById("welcomeMessage");
            
            if (profile && profile.name) {
                welcomeElement.textContent = "Olá, " + app.sanitizeHtml(profile.name) + "!";
            } else {
                welcomeElement.textContent = "Olá! Bem-vindo ao seu painel";
            }
        } catch (error) {
            console.warn('Erro ao carregar perfil:', error);
        }
    }
    
    async _loadMetrics(planId) {
        try {
            const [plan, progress] = await Promise.all([
                app.apiFetch(`/plans/${planId}`),
                app.apiFetch(`/plans/${planId}/progress`)
            ]);
            
            // Indicador Reta Final
            const isRetaFinalMode = plan.reta_final_mode === 1 || plan.reta_final_mode === true;
            if (components && components.renderRetaFinalIndicator) {
                components.renderRetaFinalIndicator(isRetaFinalMode);
            }
            
            // Dias para prova
            if (plan.exam_date) {
                const examDate = new Date(plan.exam_date);
                const today = new Date();
                const diffTime = examDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                const daysElement = document.getElementById('daysToExamHero');
                if (daysElement) {
                    daysElement.textContent = diffDays > 0 ? `${diffDays}` : 'Hoje!';
                }
            }
            
            // Progresso geral
            const progressElement = document.getElementById('generalProgressHero');
            if (progressElement) {
                progressElement.textContent = `${progress.percentage || 0}%`;
            }
            
        } catch (error) {
            console.error('Erro ao carregar métricas:', error);
        }
    }
    
    async _loadStatistics(planId) {
        try {
            const stats = await app.apiFetch(`/plans/${planId}/statistics`);
            
            // Atualizar elementos de estatística
            this._updateStatsElement('totalStudyDaysText', stats.totalStudyDays?.toString() || '0');
            this._updateStatsElement('currentStreakText', stats.currentStreak?.toString() || '0');
            
            // Total de horas formatado
            if (stats.totalHours !== undefined) {
                const hours = Math.floor(stats.totalHours);
                const minutes = Math.round((stats.totalHours - hours) * 60);
                const formatted = hours > 0 
                    ? (minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`)
                    : `${minutes}min`;
                this._updateStatsElement('totalHoursText', formatted);
            }
            
            // Média diária formatada
            if (stats.averageHoursPerDay !== undefined) {
                const avgHours = Math.floor(stats.averageHoursPerDay);
                const avgMinutes = Math.round((stats.averageHoursPerDay - avgHours) * 60);
                const avgFormatted = avgHours > 0 
                    ? (avgMinutes > 0 ? `${avgHours}h ${avgMinutes}min` : `${avgHours}h`)
                    : `${avgMinutes}min`;
                this._updateStatsElement('avgHoursText', avgFormatted);
            }
            
            // Progresso de hoje
            this._updateTodayProgress();
            
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    }
    
    _updateStatsElement(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }
    
    _updateTodayProgress() {
        const todaySessions = window.PlanContext.todaySessions;
        const total = todaySessions.length;
        const completed = todaySessions.filter(session => 
            session.completed_at || 
            session.status === 'completed' || 
            (session.study_time && session.study_time > 0)
        ).length;
        
        const progressElement = document.getElementById('todayProgressText');
        if (progressElement) {
            progressElement.textContent = `${completed}/${total}`;
        }
    }
    
    async _checkOverdueTasks(planId) {
        try {
            const overdueData = await app.apiFetch(`/sessions/overdue-check/${planId}`);
            if (overdueData.count > 0 && components && components.renderOverdueAlert) {
                components.renderOverdueAlert(overdueData);
            }
        } catch (error) {
            console.warn('Erro ao verificar tarefas atrasadas:', error);
        }
    }
    
    async _loadTransparencyData(planId) {
        try {
            const plan = await app.apiFetch(`/plans/${planId}`);
            if (plan.reta_final_mode) {
                // Lógica para mostrar dados de transparência
                console.log('📊 Modo Reta Final ativo');
            }
        } catch (error) {
            console.warn('Erro ao carregar dados de transparência:', error);
        }
    }
    
    // Listeners para mudanças no contexto do plano
    _onPlanContextChange(state) {
        console.log('🔄 Contexto do plano alterado, atualizando interface...');
        
        // Re-renderizar cronograma
        this._renderTodaySchedule();
        
        // Atualizar métricas
        if (state.planId) {
            this._loadMetrics(state.planId);
            this._loadStatistics(state.planId);
        }
    }
    
    // Configurar listeners de modais
    _setupModalListeners() {
        // Modal de adiamento
        const postponeModal = document.getElementById('postponeModal');
        const cancelButton = document.getElementById('cancelPostponeButton');
        const postponeButtons = document.querySelectorAll('.postpone-option-btn');
        
        if (cancelButton) {
            cancelButton.addEventListener('click', () => this._closePostponeModal());
        }
        
        postponeButtons.forEach(btn => {
            btn.addEventListener('click', (event) => {
                const days = event.currentTarget.dataset.days;
                this._handlePostpone(days);
            });
        });
        
        if (postponeModal) {
            postponeModal.addEventListener('click', (event) => {
                if (event.target === postponeModal) {
                    this._closePostponeModal();
                }
            });
        }
    }
    
    // Configurar listeners de sessão
    _setupSessionListeners() {
        document.addEventListener('sessionCompleted', () => {
            console.log('🎉 Sessão completada, atualizando dados...');
            setTimeout(() => {
                window.PlanContext.refreshSessions();
            }, 1000);
        });
    }
    
    // Configurar atualização automática
    _setupAutoRefresh() {
        // Atualizar a cada 30 segundos (apenas estatísticas, não toda a página)
        setInterval(() => {
            if (window.PlanContext.planId) {
                this._updateTodayProgress();
            }
        }, 30000);
    }
    
    // Fallback para erros
    _showErrorFallback(error) {
        const mainContainer = document.querySelector('main');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="h-screen flex flex-col items-center justify-center">
                    <h1 class="text-2xl font-bold mb-4">Erro ao carregar painel</h1>
                    <p class="text-gray-600 mb-8">${error.message}</p>
                    <button onclick="location.reload()" class="btn-primary">Tentar Novamente</button>
                </div>
            `;
        }
    }
    
    // Log de métricas de performance
    _logPerformanceMetrics() {
        const totalTime = Date.now() - this.metrics.startTime;
        console.log('📊 Métricas de performance da Home:', {
            tempoTotal: `${totalTime}ms`,
            fases: this.metrics.phases,
            erros: this.metrics.errors
        });
    }
    
    // Funções auxiliares para modais (expostas globalmente)
    _closePostponeModal() {
        const modal = document.getElementById('postponeModal');
        if (modal) {
            modal.classList.add('opacity-0');
            modal.querySelector('.modal-container').classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    }
    
    async _handlePostpone(days) {
        // Implementação do adiamento
        console.log('📅 Adiando sessão por', days, 'dias');
        this._closePostponeModal();
    }
}

// Instância global
window.HomeInitializer = new HomeInitializer();

console.log('🏠 HomeInitializer carregado e pronto!');

// Expor funções globais para compatibilidade
window.reinforceSession = async (sessionId) => {
    try {
        const result = await app.apiFetch(`/sessions/${sessionId}/reinforce`, { method: 'POST' });
        if (result.message) {
            app.showToast('✅ ' + result.message, 'success');
            window.PlanContext.refreshSessions();
        }
    } catch (error) {
        console.error('Erro ao reforçar sessão:', error);
        app.showToast('❌ Erro ao agendar reforço: ' + error.message, 'error');
    }
};

window.openPostponeModal = (sessionId) => {
    window.sessionIdToPostpone = sessionId;
    const modal = document.getElementById('postponeModal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('.modal-container').classList.remove('scale-95');
        }, 10);
    }
};

window.closePostponeModal = () => {
    window.HomeInitializer._closePostponeModal();
};