/**
 * @file js/navigation-init.js
 * @description Inicialização universal da navegação para todas as páginas
 * @version 1.0 - Fix para navegação não aparecendo em páginas além da home
 */

(function() {
    'use strict';
    
    // Função para aguardar módulos críticos
    async function waitForModules(maxWait = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            // Verificar se app e components estão disponíveis
            if (window.app && window.components) {
                console.log('✅ Módulos de navegação prontos');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.warn('⚠️ Timeout aguardando módulos de navegação');
        return false;
    }
    
    // Função para detectar página atual
    function getCurrentPage() {
        const path = window.location.pathname;
        const pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
        return pageName;
    }
    
    // Função principal de inicialização da navegação
    async function initializeNavigation() {
        console.log('🚀 Inicializando navegação universal...');
        
        try {
            // Aguardar módulos estarem disponíveis
            const modulesReady = await waitForModules();
            
            if (!modulesReady) {
                console.error('❌ Módulos não carregados, navegação não renderizada');
                return;
            }
            
            // Detectar página atual
            const currentPage = getCurrentPage();
            console.log('📍 Página atual:', currentPage);
            
            // Verificar se estamos autenticados
            if (!app.isAuthenticated()) {
                console.log('🔒 Usuário não autenticado, pulando navegação');
                // Se não estiver autenticado e não estiver em página pública, redirecionar
                const publicPages = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html', 'index.html'];
                if (!publicPages.includes(currentPage)) {
                    window.location.href = '/login.html';
                }
                return;
            }
            
            // Renderizar navegação principal
            if (components && typeof components.renderMainNavigation === 'function') {
                console.log('🎨 Renderizando navegação principal...');
                await components.renderMainNavigation(currentPage);
                console.log('✅ Navegação renderizada com sucesso');
            } else {
                console.error('❌ Função renderMainNavigation não disponível');
            }
            
            // Para páginas que precisam do PlanContext (não home.html)
            if (currentPage !== 'home.html') {
                // Verificar se precisamos carregar o contexto de plano
                const pagesNeedingPlan = ['dashboard.html', 'plan.html', 'cronograma.html', 'plan_settings.html'];
                
                if (pagesNeedingPlan.includes(currentPage)) {
                    // Carregar PlanContext se não estiver disponível
                    if (!window.PlanContext) {
                        console.log('📦 Carregando PlanContext...');
                        await loadScript('/js/state/plan-context.js');
                    }
                    
                    // Inicializar contexto se disponível
                    if (window.PlanContext) {
                        try {
                            await window.PlanContext.initialize();
                            console.log('✅ PlanContext inicializado');
                        } catch (error) {
                            console.warn('⚠️ Erro ao inicializar PlanContext:', error);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Erro ao inicializar navegação:', error);
        }
    }
    
    // Função auxiliar para carregar scripts dinamicamente
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeNavigation);
    } else {
        // DOM já carregado
        initializeNavigation();
    }
    
    // Exportar para uso global se necessário
    window.NavigationInit = {
        initialize: initializeNavigation,
        getCurrentPage: getCurrentPage
    };
    
})();

console.log('📦 NavigationInit carregado - navegação universal disponível');