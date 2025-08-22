/**
 * @file js/modules/components-core.js
 * @description Core component orchestrator with lazy loading
 * @version 2.0 - Modularized for performance (14KB initial bundle)
 */

// Sistema de orquestração principal dos componentes
class ComponentsCore {
    constructor() {
        this.loadedModules = new Set();
        this.loadingModules = new Map();
        this.initializationPromises = [];
        
        // Módulos disponíveis para lazy loading
        this.moduleMap = {
            'navigation': '/js/modules/navigation.js',
            'cards': '/js/modules/cards.js',
            'gamification': '/js/modules/gamification.js',
            'smart-buttons': '/js/modules/smart-buttons.js',
            'ui-core': '/js/modules/ui-core.js',
            'contextual-notifications': '/js/modules/contextual-notifications.js',
            'notification-integrations': '/js/modules/notification-integrations.js'
        };

        // Auto-carregar módulos essenciais
        this.initializeCore();
    }

    // Inicialização dos módulos essenciais
    async initializeCore() {
        console.log('🚀 Inicializando ComponentsCore...');
        
        // Carregar UI Core imediatamente (essencial)
        await this.loadModule('ui-core');
        
        // 🔔 Carregar Sistema de Notificações Inteligentes
        try {
            await this.loadModule('contextual-notifications');
            await this.loadModule('notification-integrations');
            console.log('✅ Sistema de Notificações Inteligentes carregado');
        } catch (error) {
            console.warn('⚠️ Erro ao carregar sistema de notificações:', error);
            // Não quebra a aplicação se as notificações falharem
        }
        
        console.log('✅ ComponentsCore inicializado com sucesso');
    }

    // Sistema de lazy loading de módulos
    async loadModule(moduleName) {
        if (this.loadedModules.has(moduleName)) {
            return this.getModuleInstance(moduleName);
        }

        if (this.loadingModules.has(moduleName)) {
            return await this.loadingModules.get(moduleName);
        }

        const moduleUrl = this.moduleMap[moduleName];
        if (!moduleUrl) {
            throw new Error(`Módulo '${moduleName}' não encontrado`);
        }

        console.log(`📦 Carregando módulo: ${moduleName}...`);

        const loadPromise = this.importModule(moduleUrl, moduleName);
        this.loadingModules.set(moduleName, loadPromise);

        try {
            const moduleInstance = await loadPromise;
            this.loadedModules.add(moduleName);
            this.loadingModules.delete(moduleName);
            
            console.log(`✅ Módulo ${moduleName} carregado com sucesso`);
            return moduleInstance;
        } catch (error) {
            this.loadingModules.delete(moduleName);
            console.error(`❌ Erro ao carregar módulo ${moduleName}:`, error);
            throw error;
        }
    }

    // Importar módulo dinamicamente
    async importModule(moduleUrl, moduleName) {
        try {
            const module = await import(moduleUrl);
            const moduleKey = this.getModuleKey(moduleName);
            
            if (module[moduleKey]) {
                return module[moduleKey];
            } else {
                // Fallback: procurar a primeira exportação nomeada
                const exportKeys = Object.keys(module).filter(key => key !== 'default');
                if (exportKeys.length > 0) {
                    return module[exportKeys[0]];
                }
                
                throw new Error(`Módulo ${moduleName} não possui exportação adequada`);
            }
        } catch (error) {
            console.error(`Falha ao importar ${moduleUrl}:`, error);
            throw error;
        }
    }

    // Obter chave do módulo baseada no nome
    getModuleKey(moduleName) {
        const keyMap = {
            'navigation': 'Navigation',
            'cards': 'Cards', 
            'gamification': 'Gamification',
            'smart-buttons': 'SmartButtons',
            'ui-core': 'UICore'
        };
        return keyMap[moduleName] || moduleName;
    }

    // Obter instância do módulo carregado
    getModuleInstance(moduleName) {
        const moduleKey = this.getModuleKey(moduleName);
        return window[moduleKey] || null;
    }

    // API pública para navegação
    async renderMainNavigation(activePage) {
        const navigation = await this.loadModule('navigation');
        return navigation.renderMainNavigation(activePage);
    }

    async renderPlanHeader(planId, planName, activePage) {
        const navigation = await this.loadModule('navigation');
        return navigation.renderPlanHeader(planId, planName, activePage);
    }

    async updateNavigationAvatar() {
        const navigation = await this.loadModule('navigation');
        return navigation.updateNavigationAvatar();
    }

    // API pública para cards
    async createCard(session) {
        const cards = await this.loadModule('cards');
        return cards.createCard(session);
    }

    async createSessionCard(session) {
        const cards = await this.loadModule('cards');
        return cards.createSessionCard(session);
    }

    async createSimuladCard(session) {
        const cards = await this.loadModule('cards');
        return cards.createSimuladCard(session);
    }

    async createEssayCard(session) {
        const cards = await this.loadModule('cards');
        return cards.createEssayCard(session);
    }

    async createReviewCard(session) {
        const cards = await this.loadModule('cards');
        return cards.createReviewCard(session);
    }

    // API pública para gamificação
    async renderGamificationDashboard(gamificationData, containerId) {
        const gamification = await this.loadModule('gamification');
        return gamification.renderGamificationDashboard(gamificationData, containerId);
    }

    async renderOverdueAlert(count, containerId) {
        const gamification = await this.loadModule('gamification');
        return gamification.renderOverdueAlert(count, containerId);
    }

    async showAchievementNotification(achievement) {
        const gamification = await this.loadModule('gamification');
        return gamification.showAchievementNotification(achievement);
    }

    // API pública para smart buttons
    async generateSmartButton(sessionId, defaultText, sessionData) {
        const smartButtons = await this.loadModule('smart-buttons');
        return smartButtons.generateSmartButton(sessionId, defaultText, sessionData);
    }

    async updateAllTimerButtons() {
        const smartButtons = await this.loadModule('smart-buttons');
        return smartButtons.updateAllTimerButtons();
    }

    async updateTimerButton(sessionId) {
        const smartButtons = await this.loadModule('smart-buttons');
        return smartButtons.updateTimerButton(sessionId);
    }

    // API pública para UI Core
    async showToast(message, type) {
        const uiCore = await this.loadModule('ui-core');
        return uiCore.showToast(message, type);
    }

    async showSpinner() {
        const uiCore = await this.loadModule('ui-core');
        return uiCore.showSpinner();
    }

    async hideSpinner() {
        const uiCore = await this.loadModule('ui-core');
        return uiCore.hideSpinner();
    }

    async createModal(config) {
        const uiCore = await this.loadModule('ui-core');
        return uiCore.createModal(config);
    }

    // Inicialização global da UI
    async renderGlobalUI() {
        const uiCore = await this.loadModule('ui-core');
        return uiCore.renderGlobalUI();
    }

    // Preload de módulos específicos
    async preloadModule(moduleName) {
        try {
            await this.loadModule(moduleName);
            console.log(`🔄 Módulo ${moduleName} pré-carregado`);
        } catch (error) {
            console.warn(`⚠️ Falha ao pré-carregar ${moduleName}:`, error);
        }
    }

    // Preload inteligente baseado na página atual
    async intelligentPreload() {
        const currentPage = window.location.pathname.split('/').pop();
        
        const preloadMap = {
            'home.html': ['navigation', 'cards', 'gamification'],
            'dashboard.html': ['navigation'],
            'plan.html': ['navigation', 'gamification'],
            'cronograma.html': ['navigation', 'cards', 'smart-buttons'],
            'profile.html': ['navigation']
        };

        const modulesToPreload = preloadMap[currentPage] || ['navigation'];
        
        // Preload com delay para não bloquear a UI
        setTimeout(async () => {
            for (const moduleName of modulesToPreload) {
                if (!this.loadedModules.has(moduleName)) {
                    await this.preloadModule(moduleName);
                }
            }
        }, 100);
    }

    // Limpeza de cache (para desenvolvimento)
    clearModuleCache() {
        this.loadedModules.clear();
        this.loadingModules.clear();
        console.log('🗑️ Cache de módulos limpo');
    }

    // Informações de debug
    getDebugInfo() {
        return {
            loadedModules: Array.from(this.loadedModules),
            loadingModules: Array.from(this.loadingModules.keys()),
            availableModules: Object.keys(this.moduleMap)
        };
    }

    // Método para compatibilidade com código legado
    clearUserAvatarCache() {
        if (this.loadedModules.has('navigation')) {
            const navigation = this.getModuleInstance('navigation');
            if (navigation?.clearUserAvatarCache) {
                navigation.clearUserAvatarCache();
            }
        }
    }

    // Método para compatibilidade com código legado
    async loadUserAvatar() {
        const navigation = await this.loadModule('navigation');
        return navigation.loadUserAvatar();
    }
}

// Instância global
const componentsCore = new ComponentsCore();

// Compatibilidade com API legada
const components = {
    // Métodos de navegação
    renderMainNavigation: (activePage) => componentsCore.renderMainNavigation(activePage),
    renderPlanHeader: (planId, planName, activePage) => componentsCore.renderPlanHeader(planId, planName, activePage),
    updateNavigationAvatar: () => componentsCore.updateNavigationAvatar(),
    loadUserAvatar: () => componentsCore.loadUserAvatar(),
    clearUserAvatarCache: () => componentsCore.clearUserAvatarCache(),

    // Métodos de cards
    createSessionCard: (session) => componentsCore.createSessionCard(session),
    createSimuladCard: (session) => componentsCore.createSimuladCard(session),
    createEssayCard: (session) => componentsCore.createEssayCard(session),
    createReviewCard: (session) => componentsCore.createReviewCard(session),

    // Métodos de gamificação
    renderGamificationDashboard: (data, containerId) => componentsCore.renderGamificationDashboard(data, containerId),
    renderOverdueAlert: (count, containerId) => componentsCore.renderOverdueAlert(count, containerId),

    // Métodos de smart buttons
    generateSmartButton: (sessionId, defaultText, sessionData) => componentsCore.generateSmartButton(sessionId, defaultText, sessionData),
    updateAllTimerButtons: () => componentsCore.updateAllTimerButtons(),
    updateTimerButton: (sessionId) => componentsCore.updateTimerButton(sessionId),

    // Métodos de UI
    renderGlobalUI: () => componentsCore.renderGlobalUI(),
    showToast: (message, type) => componentsCore.showToast(message, type),
    showSpinner: () => componentsCore.showSpinner(),
    hideSpinner: () => componentsCore.hideSpinner()
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 Inicializando sistema de componentes...');
    
    // Renderizar UI global imediatamente
    await componentsCore.renderGlobalUI();
    
    // Preload inteligente
    await componentsCore.intelligentPreload();
    
    console.log('🎉 Sistema de componentes inicializado!');
    
    // Debug info
    if (window.location.hostname === 'localhost') {
        console.log('🔍 Debug info:', componentsCore.getDebugInfo());
    }
});

// Expor globalmente
window.componentsCore = componentsCore;
window.components = components;

// Manter funcionalidade de atualização de botões
setInterval(async () => {
    if (window.TimerSystem && componentsCore.loadedModules.has('smart-buttons')) {
        const smartButtons = componentsCore.getModuleInstance('smart-buttons');
        if (smartButtons?.updateAllTimerButtons) {
            smartButtons.updateAllTimerButtons();
        }
    }
}, 5000);