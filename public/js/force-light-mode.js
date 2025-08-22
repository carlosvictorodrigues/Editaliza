/* eslint-env browser */
/**
 * FORÇA BRUTA - LIGHT MODE APENAS
 * Bloqueia qualquer tentativa de ativar dark mode
 */

(function() {
    'use strict';
    
    console.info('🌞 Force Light Mode script loaded');
    
    // Função principal para forçar light mode
    const forceLight = () => {
        // Remover atributos data-theme
        if (document.documentElement.hasAttribute('data-theme')) {
            document.documentElement.removeAttribute('data-theme');
        }
        if (document.body.hasAttribute('data-theme')) {
            document.body.removeAttribute('data-theme');
        }
        
        // Limpar localStorage
        if (localStorage.getItem('editaliza-theme')) {
            localStorage.removeItem('editaliza-theme');
        }
        if (localStorage.getItem('theme')) {
            localStorage.removeItem('theme');
        }
        
        // Esconder todos os toggles de tema
        const toggleSelectors = [
            '.theme-toggle',
            '.theme-toggle-nav',
            '.theme-switch',
            '.fab-theme',
            '.floating-theme',
            '[data-theme-toggle]',
            '.btn-theme',
            '.theme-btn',
            '.sun-icon',
            '.moon-icon',
            '.theme-icon'
        ];
        
        toggleSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                element.style.visibility = 'hidden';
                element.style.opacity = '0';
                element.style.pointerEvents = 'none';
            });
        });
        
        // Corrigir cores específicas
        correctColors();
    };
    
    // Função para corrigir cores específicas
    const correctColors = () => {
        // Títulos das sessões de estudo - PRETOS
        const sessionTitles = document.querySelectorAll('.study-session-title, .session-title, .study-card h3, .study-card .text-xl, .session-card h3, .session-card .text-xl');
        sessionTitles.forEach(title => {
            title.style.color = '#000000';
            title.style.fontWeight = '700';
        });
        
        // Botões de sessão - TEXTO BRANCO
        const sessionButtons = document.querySelectorAll('.btn-study-start, .btn-study-reinforce, .btn-study-postpone, .btn-replanejar, .btn-ver-detalhes, .btn-primary');
        sessionButtons.forEach(button => {
            button.style.color = '#FFFFFF';
            button.style.backgroundColor = '#0528f2';
            button.style.fontWeight = '600';
        });
        
        // Botões de sessão atrasada - TEXTO BRANCO
        const lateButtons = document.querySelectorAll('.btn-replanejar-agora, .btn-ver-detalhes-atraso, .btn-danger');
        lateButtons.forEach(button => {
            button.style.color = '#FFFFFF';
            button.style.backgroundColor = '#EF4444';
            button.style.fontWeight = '600';
        });
        
        // Botões secundários - TEXTO BRANCO
        const secondaryButtons = document.querySelectorAll('.btn-secondary');
        secondaryButtons.forEach(button => {
            button.style.color = '#FFFFFF';
            button.style.backgroundColor = '#334155';
            button.style.fontWeight = '600';
        });
        
        // Rodapé - fundo branco do card do logo
        const footerLogos = document.querySelectorAll('.footer-logo, .editaliza-footer-refatorado .footer-logo');
        footerLogos.forEach(logo => {
            logo.style.background = '#FFFFFF';
            logo.style.backdropFilter = 'none';
            logo.style.border = '1px solid #E5E7EB';
            logo.style.borderRadius = '8px';
            logo.style.padding = '8px 12px';
            logo.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        });
        
        // Rodapé - títulos brancos
        const footerTitles = document.querySelectorAll('.footer-nav-title, .editaliza-footer-refatorado .footer-nav-title');
        footerTitles.forEach(title => {
            title.style.color = '#FFFFFF';
            title.style.fontWeight = '600';
            title.style.textTransform = 'uppercase';
        });
    };
    
    // Observer para monitorar mudanças no DOM
    /* global MutationObserver */
    const observer = new MutationObserver((mutations) => {
        let needsUpdate = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                needsUpdate = true;
            }
            if (mutation.type === 'childList') {
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            setTimeout(forceLight, 10);
        }
    });
    
    // Inicializar quando DOM estiver pronto
    const init = () => {
        forceLight();
        
        // Configurar observer
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
            childList: true,
            subtree: true
        });
        
        // Verificação periódica
        setInterval(forceLight, 2000);
    };
    
    // Sobrescrever funções globais de tema
    window.toggleTheme = () => {
        console.info('🚫 Theme toggle blocked - light mode only');
    };
    
    window.setTheme = () => {
        console.info('🚫 Theme setting blocked - light mode only');
    };
    
    // Interceptar tentativas de modificar localStorage
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, _value) {
        if (key === 'editaliza-theme' || key === 'theme') {
            console.info('🚫 Theme localStorage blocked - light mode only');
            return;
        }
        return originalSetItem.apply(this, arguments);
    };
    
    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    console.info('🌞 Force Light Mode initialized');
})();