/* global app */
/**
 * @file js/state/plan-context.js
 * @description Pipeline determinístico para gestão de contexto de planos
 * @version 1.0 - Fix para cards sumindo e recarregamentos
 */

class PlanContextManager {
    constructor() {
        this.state = {
            planId: null,
            planData: null,
            sessions: {
                today: [],
                all: []
            },
            loading: false,
            initialized: false
        };
        
        this.listeners = new Set();
        this.loadPromise = null;
    }
    
    // Pipeline principal de inicialização
    async initialize() {
        if (this.state.initialized) {
            console.log('🎯 PlanContext já inicializado');
            return this.state;
        }
        
        if (this.loadPromise) {
            console.log('⏳ Aguardando inicialização em progresso...');
            return this.loadPromise;
        }
        
        this.loadPromise = this._performInitialization();
        return this.loadPromise;
    }
    
    async _performInitialization() {
        console.log('🚀 Iniciando pipeline determinístico de plano...');
        
        try {
            this.state.loading = true;
            
            // Etapa 1: Resolver planId de forma determinística
            const planId = await this._resolvePlanId();
            if (!planId) {
                // Redirecionar para criação de plano
                console.log('📝 Nenhum plano encontrado, redirecionando para criação...');
                window.location.href = '/criar-plano.html';
                return null;
            }
            
            this.state.planId = planId;
            
            // Etapa 2: Carregar dados do plano e sessões em paralelo
            const [planData, allScheduleData] = await Promise.all([
                this._loadPlanData(planId),
                app.apiFetch(`/sessions/by-date/${planId}`)
            ]);

            this.state.planData = planData;
            
            // Etapa 3: Processar sessões
            this.state.sessions.today = this._processTodaySessions(allScheduleData);
            this.state.sessions.all = this._processAllSessions(allScheduleData);
            
            this.state.initialized = true;
            this.state.loading = false;
            
            console.log('✅ Pipeline de plano concluído:', {
                planId: this.state.planId,
                todaySessions: this.state.sessions.today.length,
                allSessions: this.state.sessions.all.length
            });
            
            this._notifyListeners();
            return this.state;
            
        } catch (error) {
            console.error('❌ Erro no pipeline de plano:', error);
            this.state.loading = false;
            this.loadPromise = null;
            throw error;
        }
    }
    
    // Resolver planId de forma determinística
    async _resolvePlanId() {
        try {
            // 1. Tentar localStorage primeiro
            let planId = localStorage.getItem(app.config.planKey);
            
            // 2. Verificar se o plano existe
            const plans = await app.getPlans();
            if (!plans || plans.length === 0) {
                console.warn('⚠️ Nenhum plano encontrado');
                return null;
            }
            
            // 3. Validar se o planId do localStorage é válido
            const planExists = plans.some(p => p.id == planId);
            
            if (!planId || !planExists) {
                // Usar o primeiro plano disponível
                planId = plans[0].id;
                localStorage.setItem(app.config.planKey, planId);
                console.log('📌 Plano selecionado automaticamente:', planId);
            }
            
            return planId;
        } catch (error) {
            console.error('❌ Erro ao resolver planId:', error);
            return null;
        }
    }
    
    async _loadPlanData(planId) {
        const planData = await app.apiFetch(`/plans/${planId}`);
        console.log('📋 Dados do plano carregados');
        return planData;
    }
    
    _processTodaySessions(allScheduleData) {
        const today = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
        const todaysSessions = allScheduleData[today] || [];
        
        console.log('📅 Sessões de hoje:', {
            data: today,
            quantidade: todaysSessions.length
        });
        
        return todaysSessions;
    }
    
    _processAllSessions(allScheduleData) {
        const today = new Date();
        const pastDate = new Date(today);
        pastDate.setDate(today.getDate() - 30);
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + 30);
        
        const startDate = pastDate.toISOString().split('T')[0];
        const endDate = futureDate.toISOString().split('T')[0];
        
        let allSessions = [];
        for (const date in allScheduleData) {
            if (date >= startDate && date <= endDate) {
                allSessions = allSessions.concat(allScheduleData[date]);
            }
        }
        
        console.log('📊 Todas as sessões:', {
            periodo: `${startDate} a ${endDate}`,
            quantidade: allSessions.length
        });
        
        return allSessions;
    }
    
    // Atualizar apenas as sessões (para quando uma sessão é concluída)
    async refreshSessions() {
        if (!this.state.planId) {
            console.warn('⚠️ PlanId não definido para refresh');
            return;
        }
        
        try {
            console.log('🔄 Atualizando sessões...');
            const allScheduleData = await app.apiFetch(`/sessions/by-date/${this.state.planId}`);
            this.state.sessions.today = this._processTodaySessions(allScheduleData);
            this.state.sessions.all = this._processAllSessions(allScheduleData);
            this._notifyListeners();
        } catch (error) {
            console.error('❌ Erro ao atualizar sessões:', error);
        }
    }
    
    // Trocar plano (sem reload da página)
    async switchPlan(newPlanId) {
        if (newPlanId === this.state.planId) {
            console.log('📌 Mesmo plano, ignorando troca');
            return;
        }
        
        console.log('🔄 Trocando plano:', this.state.planId, '->', newPlanId);
        
        try {
            localStorage.setItem(app.config.planKey, newPlanId);
            
            // Reset state
            this.state.planId = newPlanId;
            this.state.planData = null;
            this.state.sessions = { today: [], all: [] };
            this.state.initialized = false;
            this.loadPromise = null;
            
            // Reinicializar
            await this.initialize();
            
        } catch (error) {
            console.error('❌ Erro ao trocar plano:', error);
            throw error;
        }
    }
    
    // Sistema de listeners para mudanças de estado
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    _notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('❌ Erro em listener:', error);
            }
        });
    }
    
    // Getters para fácil acesso
    get planId() { return this.state.planId; }
    get planData() { return this.state.planData; }
    get todaySessions() { return this.state.sessions.today; }
    get allSessions() { return this.state.sessions.all; }
    get isLoading() { return this.state.loading; }
    get isInitialized() { return this.state.initialized; }
}

// Instância global
window.PlanContext = new PlanContextManager();

console.log('🎯 PlanContextManager carregado e pronto!');