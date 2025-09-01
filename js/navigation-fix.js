/**
 * @file js/navigation-fix.js
 * @description Correção para garantir que o módulo de navegação esteja disponível
 * @version 1.0
 */

(function() {
    'use strict';
    
    // Aguardar o módulo Navigation estar disponível e criar alias correto
    const checkNavigation = setInterval(() => {
        if (window.NavigationModule || window.EditalizeNavigation) {
            // Criar alias para compatibilidade, mas somente se não for a API nativa
            if (!window.navigation || typeof window.navigation !== 'object' || !window.navigation.renderMainNavigation) {
                window.navigation = window.NavigationModule || window.EditalizeNavigation;
                console.log('✅ Módulo de navegação configurado em window.navigation');
            }
            clearInterval(checkNavigation);
        }
    }, 50);
    
    // Timeout após 5 segundos
    setTimeout(() => clearInterval(checkNavigation), 5000);
})();