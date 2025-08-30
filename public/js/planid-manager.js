/**
 * PlanId Manager - Fonte única de verdade para o plano ativo
 */

window.PlanIdManager = {
    // Inicializar estado
    init() {
        window.AppState = window.AppState || {};
    },

    // Obter o planId atual de forma consistente
    getCurrentPlanId() {
        // Prioridade 1: AppState global
        if (window.AppState?.planId) {
            return Number(window.AppState.planId);
        }
        
        // Prioridade 2: app.state.activePlanId
        if (window.app?.state?.activePlanId) {
            window.AppState = { ...(window.AppState || {}), planId: window.app.state.activePlanId };
            return Number(window.app.state.activePlanId);
        }
        
        // Prioridade 3: localStorage
        const storedId = localStorage.getItem('selectedPlanId') || localStorage.getItem('activePlanId');
        if (storedId) {
            const id = Number(storedId);
            if (Number.isFinite(id) && id > 0) {
                window.AppState = { ...(window.AppState || {}), planId: id };
                return id;
            }
        }
        
        // Sem plano ativo
        return null;
    },

    // Definir o planId ativo
    setCurrentPlanId(planId) {
        const id = Number(planId);
        if (!Number.isFinite(id) || id <= 0) {
            console.error('❌ PlanId inválido:', planId);
            return false;
        }
        
        // Atualizar todas as fontes
        window.AppState = { ...(window.AppState || {}), planId: id };
        if (window.app?.state) {
            window.app.state.activePlanId = id;
        }
        localStorage.setItem('selectedPlanId', String(id));
        localStorage.setItem('activePlanId', String(id));
        
        console.log('✅ PlanId atualizado:', id);
        return true;
    },

    // Buscar o plano ativo do servidor
    async fetchActivePlanId() {
        try {
            const response = await fetch('/api/plans');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const plans = await response.json();
            if (plans && plans.length > 0) {
                // Pegar o primeiro plano ou o marcado como ativo
                const activePlan = plans.find(p => p.is_active) || plans[0];
                this.setCurrentPlanId(activePlan.id);
                return activePlan.id;
            }
        } catch (error) {
            console.error('❌ Erro ao buscar plano ativo:', error);
        }
        return null;
    }
};

// Inicializar automaticamente
PlanIdManager.init();

// Exportar função helper global
window.getCurrentPlanId = () => PlanIdManager.getCurrentPlanId();