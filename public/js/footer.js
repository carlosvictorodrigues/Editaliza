/**
 * RODAPÉ EDITALIZA - REFATORAÇÃO COMPLETA
 * Sistema modular com design moderno e integração perfeita do logotipo
 */

// LOG DE EMERGÊNCIA - CONFIRMAR QUE O ARQUIVO FOI CARREGADO
console.log('🚨🚨🚨 FOOTER.JS CARREGADO! 🚨🚨🚨');
console.log('🚨🚨🚨 Arquivo:', window.location.href);
console.log('🚨🚨🚨 Timestamp:', new Date().toISOString());

class EditalizaFooterRefatorado {
    constructor() {
        this.footerElement = null;
        this.isLoaded = false;
        this.debugMode = true;
        
        // Tokens de design centralizados
        this.designTokens = {
            colors: {
                gradientPrimary: 'linear-gradient(135deg, #0528f2 0%, #0d0d0d 100%)',
                gradientSecondary: 'linear-gradient(90deg, #0528f2 0%, #041d8a 100%)',
                textPrimary: '#ffffff',
                textSecondary: 'rgba(255, 255, 255, 0.85)',
                textMuted: 'rgba(255, 255, 255, 0.65)',
                accent: '#1AD937',
                logoShadow: 'drop-shadow(0 1px 3px rgba(255, 255, 255, 0.4)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15))'
            },
            spacing: {
                paddingVertical: '32px',
                paddingHorizontal: '24px',
                paddingBottom: '16px',
                gapGrid: '32px',
                gapSmall: '8px',
                gapMedium: '16px'
            },
            typography: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                sizeBase: '0.875rem',
                sizeSmall: '0.75rem',
                sizeHeading: '1rem',
                weightNormal: '400',
                weightMedium: '500',
                weightSemibold: '600',
                lineHeight: '1.5'
            },
            effects: {
                borderRadius: '8px',
                logoBackground: 'rgba(255, 255, 255, 0.12)',
                logoBackdrop: 'blur(16px)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }
        };
        
        this.log('🚀 Footer Refatorado inicializado');
    }
    
    log(message, data = null) {
        if (!this.debugMode) return;
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🦶 [FooterRefatorado ${timestamp}] ${message}`, data || '');
    }
    
    /**
     * Verifica se deve mostrar footer na página atual
     */
    shouldShowFooter() {
        const pathname = window.location.pathname;
        const filename = pathname.split('/').pop() || '';
        
        // Páginas onde o footer NÃO deve aparecer
        const excludedPages = [
            'login.html',
            'register.html',
            'reset-password.html',
            'forgot-password.html'
        ];
        
        return !excludedPages.includes(filename);
    }
    
    /**
     * Inicialização principal
     */
    async init() {
        try {
            console.log('🚨🚨🚨 FOOTER REFATORADO INICIANDO! 🚨🚨🚨');
            console.log('🚨🚨🚨 URL:', window.location.href);
            console.log('🚨🚨🚨 Protocolo:', window.location.protocol);
            this.log('🚀 Iniciando carregamento do rodapé refatorado...');
            this.log('📍 URL atual:', window.location.href);
            this.log('📍 Protocolo:', window.location.protocol);
            
            // Verificar se deve mostrar footer nesta página
            if (!this.shouldShowFooter()) {
                this.log('⏭️ Footer não deve aparecer nesta página');
                return;
            }
            
            // Verificar se já existe
            if (this.checkExistingFooter()) {
                this.log('✅ Rodapé já existe na página');
                return;
            }
            
            this.log('🔧 Iniciando processo de carregamento...');
            
            // Injetar CSS
            this.injectCSS();
            
            // Carregar HTML
            this.loadFooterHTML();
            
            this.finalizeFooterLoad();
            
        } catch (error) {
            this.log('❌ Erro no carregamento:', error);
            console.error('❌ Erro detalhado:', error);
        }
    }
    
    checkExistingFooter() {
        // Sempre retorna false para forçar recarregamento
        // Isso garante que o footer seja sempre renderizado corretamente
        this.log('🔍 Verificando footer existente...');
        
        const existingFooter = document.querySelector('.editaliza-footer, .editaliza-footer-refatorado');
        if (existingFooter) {
            this.log('🗑️ Footer existente encontrado, será removido e recriado');
            existingFooter.remove();
            return false;
        }
        
        this.log('✅ Nenhum footer existente encontrado');
        return false;
    }
    
    /**
     * Injeta CSS otimizado
     */
    injectCSS() {
        if (document.querySelector('#editaliza-footer-refatorado-css')) {
            this.log('📄 CSS já existe');
            return;
        }
        
        this.log('💉 Injetando CSS refatorado');
        const style = document.createElement('style');
        style.id = 'editaliza-footer-refatorado-css';
        style.textContent = this.getOptimizedCSS();
        document.head.appendChild(style);
        this.log('✅ CSS injetado');
    }
    
    /**
     * CSS otimizado com tokens e estrutura em duas faixas
     */
    getOptimizedCSS() {
        const { colors, spacing, typography, effects } = this.designTokens;
        
        return `
            /* Footer Refatorado - Design System Full-bleed */
            .editaliza-footer-refatorado {
                margin-top: auto !important;
                font-family: ${typography.fontFamily} !important;
                line-height: ${typography.lineHeight} !important;
                color: ${colors.textPrimary} !important;
                width: 100% !important;
                position: relative !important;
                z-index: 9999 !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                background: linear-gradient(135deg, #0528f2 0%, #0d0d0d 100%) !important;
                min-height: 200px !important;
            }
            
            /* FAIXA PRINCIPAL - Gradiente full-bleed */
            .footer-main-section {
                background: linear-gradient(135deg, #0528f2 0%, #041d8a 100%) !important;
                width: 100% !important;
                position: relative !important;
                overflow: hidden !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                min-height: 150px !important;
            }
            
            /* FAIXA INFERIOR - Direitos autorais full-bleed */
            .footer-copyright-section {
                background: ${colors.gradientSecondary};
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                width: 100%;
            }
            
            /* Container interno apenas para padding e grid */
            .footer-container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 ${spacing.paddingHorizontal};
                position: relative;
                z-index: 1;
            }
            
            /* Container da faixa principal */
            .footer-main-container {
                padding: ${spacing.paddingVertical} 0;
            }
            
            /* Container da faixa inferior */
            .footer-copyright-container {
                padding: ${spacing.paddingBottom} 0;
            }
            
            /* Grid responsivo da faixa principal */
            .footer-main-grid {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr;
                gap: ${spacing.gapGrid};
                align-items: start;
            }
            
            /* SEÇÃO DA MARCA */
            .footer-brand {
                display: flex;
                flex-direction: column;
                gap: ${spacing.gapMedium};
            }
            
            /* Logo com espaçamento seguro */
            .footer-logo {
                display: inline-flex;
                align-items: center;
                padding: 16px 20px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                width: fit-content;
                margin-bottom: ${spacing.gapSmall};
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            }
            
            .footer-logo-icon {
                height: 32px;
                width: auto;
                filter: ${colors.logoShadow};
            }
            
            /* Descrição compacta */
            .footer-description {
                color: ${colors.textSecondary};
                font-size: ${typography.sizeBase};
                line-height: 1.4;
                margin: 0;
                max-width: 280px;
            }
            
            /* Redes sociais */
            .footer-social {
                margin-top: ${spacing.gapMedium};
            }
            
            .social-links {
                display: flex;
                gap: ${spacing.gapSmall};
                align-items: center;
            }
            
            .social-link {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: ${colors.textPrimary};
                text-decoration: none;
                transition: ${effects.transition};
                backdrop-filter: blur(8px);
            }
            
            .social-link:hover {
                background: ${colors.accent};
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(26, 217, 55, 0.3);
            }
            
            .social-link svg {
                width: 18px;
                height: 18px;
            }
            
            /* SEÇÕES DE NAVEGAÇÃO */
            .footer-nav-section {
                display: flex;
                flex-direction: column;
            }
            
            .footer-nav-title {
                font-size: ${typography.sizeHeading};
                font-weight: ${typography.weightSemibold};
                color: ${colors.textPrimary};
                margin: 0 0 ${spacing.gapMedium} 0;
                text-transform: uppercase;
                letter-spacing: 0.025em;
                position: relative;
            }
            
            .footer-nav-title::after {
                content: '';
                position: absolute;
                bottom: -6px;
                left: 0;
                width: 24px;
                height: 2px;
                background: ${colors.accent};
                border-radius: 1px;
            }
            
            .footer-nav-list {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: ${spacing.gapSmall};
            }
            
            .footer-nav-link {
                color: ${colors.textSecondary};
                text-decoration: none;
                font-size: ${typography.sizeBase};
                font-weight: ${typography.weightNormal};
                transition: ${effects.transition};
                display: inline-block;
            }
            
            .footer-nav-link:hover,
            .footer-nav-link:focus {
                color: ${colors.accent};
                transform: translateX(4px);
            }
            
            /* FAIXA INFERIOR - Copyright */
            .footer-copyright-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: ${spacing.gapMedium};
                min-height: 44px;
            }
            
            .footer-copyright-text {
                color: ${colors.textMuted};
                font-size: ${typography.sizeSmall};
                font-weight: ${typography.weightNormal};
                margin: 0;
            }
            
            .footer-legal-links {
                display: flex;
                gap: ${spacing.gapMedium};
                align-items: center;
                flex-wrap: wrap;
                height: 100%;
            }
            
            .footer-legal-link {
                color: ${colors.textMuted};
                text-decoration: none;
                font-size: ${typography.sizeSmall};
                transition: ${effects.transition};
            }
            
            .footer-legal-link:hover,
            .footer-legal-link:focus {
                color: ${colors.accent};
            }
            
            /* RESPONSIVIDADE */
            @media (max-width: 1024px) {
                .footer-main-grid {
                    grid-template-columns: 1fr 1fr;
                    gap: 28px;
                }
                
                .footer-brand {
                    grid-column: 1 / -1;
                    margin-bottom: ${spacing.gapMedium};
                }
            }
            
            @media (max-width: 768px) {
                .footer-main-section {
                    padding: 24px 20px;
                }
                
                .footer-copyright-section {
                    padding: 12px 20px;
                }
                
                .footer-main-grid {
                    grid-template-columns: 1fr;
                    gap: 20px;
                }
                
                .footer-brand {
                    grid-column: 1;
                    margin-bottom: 16px;
                }
                
                .footer-logo {
                    padding: 10px 14px;
                }
                
                .footer-logo-icon {
                    height: 28px;
                }
                
                .footer-description {
                    font-size: 0.8rem;
                    max-width: none;
                }
                
                .footer-copyright-content {
                    flex-direction: column;
                    text-align: center;
                    gap: 12px;
                }
                
                .footer-legal-links {
                    justify-content: center;
                }
            }
            
            @media (max-width: 480px) {
                .footer-main-section {
                    padding: 20px 16px;
                }
                
                .footer-copyright-section {
                    padding: 10px 16px;
                }
                
                .footer-legal-links {
                    flex-direction: column;
                    gap: 8px;
                }
            }
        `;
    }
    
    /**
     * Carrega HTML refatorado
     */
    loadFooterHTML() {
        this.log('🏗️ Carregando HTML refatorado');
        
        const footerHTML = `
            <footer class="editaliza-footer-refatorado" role="contentinfo" aria-label="Rodapé do site">
                <!-- FAIXA PRINCIPAL -->
                <div class="footer-main-section" style="background: linear-gradient(135deg, #0528f2 0%, #041d8a 100%) !important;">
                    <div class="footer-container">
                        <div class="footer-main-container">
                            <div class="footer-main-grid">
                            <!-- SEÇÃO DA MARCA -->
                            <div class="footer-brand">
                                <div class="footer-logo" style="background: #FFFFFF !important; padding: 16px 20px !important; border-radius: 12px !important; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;">
                                    <svg class="footer-logo-icon" viewBox="0 0 510.24 101.5" xmlns="http://www.w3.org/2000/svg">
                                        <defs>
                                            <style>
                                                .cls-1 { fill: #0528f2; }
                                                .cls-2 { fill: #ffffff; }
                                                .cls-3 { fill: #1ad937; }
                                            </style>
                                        </defs>
                                        <g>
                                            <g>
                                                <path class="cls-2" d="M148.68,17.22l49.51-.04v9.32l-39.51.03v17.97l37.97-.03v9.22l-37.97.03v20.83l39.51-.03v9.22l-49.51.04V17.22Z"/>
                                                <path class="cls-2" d="M210.98,77.75c-4.49-4.5-6.73-10.65-6.73-18.44s2.13-13.7,6.39-18.26c4.26-4.57,10.17-6.85,17.74-6.86,7.5,0,13.55,2.59,18.17,7.78v-24.82h9.23s0,66.56,0,66.56h-9.23s0-5.79,0-5.79c-2.24,2.22-4.82,3.87-7.74,4.95-2.92,1.08-6.04,1.62-9.37,1.62-7.82,0-13.97-2.24-18.46-6.74ZM242.51,72.54c2.76-2.57,4.13-6.39,4.13-11.46v-3.61c0-4.56-1.52-8.19-4.57-10.89-3.04-2.69-7.16-4.04-12.35-4.03-4.74,0-8.57,1.4-11.49,4.19-2.92,2.79-4.37,7.01-4.37,12.65s1.44,9.89,4.33,12.74c2.88,2.85,6.95,4.27,12.21,4.27,5.32,0,9.36-1.29,12.11-3.86Z"/>
                                                <path class="cls-2" d="M264.04,17.13h9.42s0,11.21,0,11.21h-9.42s0-11.21,0-11.21ZM264.14,35.96h9.23s0,47.73,0,47.73h-9.23s0-47.73,0-47.73Z"/>
                                                <path class="cls-2" d="M293.7,80.3c-2.34-2.76-3.61-6.8-3.8-12.12v-23.77h-8.27s0-8.27,0-8.27h8.27v-17.69h9.32s0,17.68,0,17.68h15.86s0,8.26,0,8.26h-15.86v24.55c0,4.69,2.66,7.03,7.98,7.03,2.18,0,4.65-.32,7.4-.96l2.21,7.32c-2.31.76-4.31,1.3-6.01,1.62-1.7.32-3.48.48-5.34.48-5.51,0-9.44-1.37-11.78-4.13Z"/>
                                                <path class="cls-2" d="M326.96,80.36c-3.43-2.57-5.14-6.32-5.14-11.26,0-6.09,2.55-10.19,7.64-12.32,5.1-2.13,12.03-3.26,20.81-3.39l9.04-.2v-1.24c0-3.55-.95-6.05-2.84-7.51-1.89-1.46-5.14-2.18-9.76-2.18-4.1,0-7.21.67-9.32,2-2.12,1.33-3.24,3.58-3.36,6.75h-9.42c.13-5.89,2.05-10.17,5.77-12.84,3.72-2.67,9.16-4.03,16.34-4.1,7.69.06,13.25,1.57,16.68,4.55,3.43,2.98,5.14,7.51,5.14,13.6v31.38h-9.13s0-7.03,0-7.03c-4.55,5.08-10.64,7.62-18.27,7.62-6.02,0-10.75-1.28-14.18-3.84ZM354.7,73.64c3.08-1.97,4.61-4.6,4.61-7.9v-5.8l-8.84.29c-7.05.26-12.03,1.07-14.95,2.44-2.92,1.37-4.37,3.51-4.37,6.42,0,2.41.96,4.26,2.88,5.56,1.92,1.3,4.84,1.95,8.75,1.94,4.87,0,8.84-.99,11.92-2.96Z"/>
                                                <path class="cls-2" d="M377.19,17.04h9.23s0,66.56,0,66.56h-9.23s0-66.56,0-66.56Z"/>
                                                <path class="cls-2" d="M394.68,17.02h9.42s0,11.21,0,11.21h-9.42s0-11.21,0-11.21ZM394.78,35.85h9.23s0,47.73,0,47.73h-9.23s0-47.73,0-47.73Z"/>
                                                <path class="cls-2" d="M412.28,76.83l30.57-33.12-29.9.02v-7.7l42.4-.03v6.56l-30.38,32.93,30.09-.02v8.08l-42.78.03v-6.75Z"/>
                                                <path class="cls-2" d="M468.66,80.25c-3.43-2.57-5.14-6.32-5.14-11.26,0-6.09,2.55-10.19,7.64-12.32,5.1-2.13,12.03-3.26,20.81-3.39l9.04-.2v-1.24c0-3.55-.95-6.05-2.84-7.51-1.89-1.46-5.14-2.18-9.76-2.18-4.1,0-7.21.67-9.32,2-2.12,1.33-3.24,3.58-3.36,6.75h-9.42c.13-5.89,2.05-10.17,5.77-12.84,3.72-2.67,9.16-4.03,16.34-4.1,7.69.06,13.25,1.57,16.68,4.55,3.43,2.98,5.14,7.51,5.14,13.6v31.38h-9.13s0-7.03,0-7.03c-4.55,5.08-10.64,7.62-18.27,7.62-6.02,0-10.75-1.28-14.18-3.84ZM496.39,73.53c3.08-1.97,4.61-4.6,4.61-7.9v-5.8l-8.84.29c-7.05.26-12.03,1.07-14.95,2.44-2.92,1.37-4.37,3.51-4.37,6.42,0,2.41.96,4.26,2.88,5.56,1.92,1.3,4.84,1.95,8.75,1.94,4.87,0,8.84-.99,11.92-2.96Z"/>
                                            </g>
                                            <g>
                                                <path class="cls-1" d="M58.62,101.5s-12.21-26.73-43.18-21.61v-24.04s29.74,1.62,40.51,31.49c1.21,4.27,2.12,8.98,2.67,14.17Z"/>
                                                <path class="cls-3" d="M58.62,101.5c-6.75-32.15-28.77-42.36-43.18-45.57-3.53-.79-6.61-1.16-8.89-1.33-2.37-.18-4.2-2.14-4.2-4.52,0-2.73,2.38-4.84,5.09-4.5,11.47,1.44,39.07,8.39,48.52,41.75,1.21,4.27,2.12,8.98,2.67,14.17Z"/>
                                                <path class="cls-1" d="M69.48,101.5s12.21-27.94,43.18-22.83v-22.83s-29.74,1.62-40.51,31.49c-1.21,4.27-2.12,8.98-2.67,14.17Z"/>
                                                <path class="cls-3" d="M69.48,101.5c6.75-32.15,28.77-42.36,43.18-45.57,3.53-.79,6.61-1.16,8.89-1.33,2.37-.18,4.2-2.14,4.2-4.52,0-2.73-2.38-4.84-5.09-4.5-11.47,1.44-39.07,8.39-48.52,41.75-1.21,4.27-2.12,8.98-2.67,14.17Z"/>
                                                <path class="cls-1" d="M92.24,7.72C83.54,2.57,73.8,0,64.05,0c-9.75,0-19.49,2.57-28.19,7.72L1.79,27.87c-2.97,1.76-2.07,6.28,1.35,6.75,12,1.65,31.51,6.67,49.09,21.75,1.7,1.46,3.6,2.57,5.6,3.33,3.99,1.52,8.42,1.52,12.41,0,2-.76,3.9-1.87,5.6-3.33,17.59-15.08,37.1-20.1,49.09-21.75,3.42-.47,4.33-4.99,1.35-6.75L92.24,7.72ZM64.05,48.49c-6.16,0-11.16-5-11.16-11.16s5-11.16,11.16-11.16,11.16,5,11.16,11.16-5,11.16-11.16,11.16Z"/>
                                            </g>
                                        </g>
                                    </svg>
                                </div>
                                
                                <p class="footer-description">
                                    Plataforma inteligente de estudos para concursos públicos com metodologia personalizada e gamificação.
                                </p>
                                
                                <div class="footer-social">
                                    <div class="social-links">
                                        <a href="#" class="social-link" title="Instagram" aria-label="Siga-nos no Instagram">
                                            <svg fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                            </svg>
                                        </a>
                                        <a href="#" class="social-link" title="LinkedIn" aria-label="Conecte-se no LinkedIn">
                                            <svg fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                            </svg>
                                        </a>
                                        <a href="#" class="social-link" title="WhatsApp" aria-label="Contato via WhatsApp">
                                            <svg fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- NAVEGAÇÃO PLATAFORMA -->
                            <nav class="footer-nav-section" aria-label="Navegação da plataforma">
                                <h3 class="footer-nav-title">Plataforma</h3>
                                <ul class="footer-nav-list">
                                    <li><a href="home.html" class="footer-nav-link">Painel Principal</a></li>
                                    <li><a href="cronograma.html" class="footer-nav-link">Cronograma</a></li>
                                    <li><a href="plan.html" class="footer-nav-link">Gerenciar Planos</a></li>
                                    <li><a href="notes.html" class="footer-nav-link">Minhas Anotações</a></li>
                                    <li><a href="profile.html" class="footer-nav-link">Meu Perfil</a></li>
                                </ul>
                            </nav>
                            
                            <!-- NAVEGAÇÃO RECURSOS -->
                            <nav class="footer-nav-section" aria-label="Recursos da plataforma">
                                <h3 class="footer-nav-title">Recursos</h3>
                                <ul class="footer-nav-list">
                                    <li><a href="metodologia.html" class="footer-nav-link">Nossa Metodologia</a></li>
                                    <li><a href="faq.html" class="footer-nav-link">Central de Ajuda</a></li>
                                    <li><a href="plan_settings.html" class="footer-nav-link">Configurações</a></li>
                                </ul>
                            </nav>
                            
                            <!-- NAVEGAÇÃO SUPORTE -->
                            <nav class="footer-nav-section" aria-label="Suporte e ajuda">
                                <h3 class="footer-nav-title">Suporte</h3>
                                <ul class="footer-nav-list">
                                    <li><a href="mailto:suporte@editaliza.com.br" class="footer-nav-link">Contato</a></li>
                                    <li><a href="faq.html" class="footer-nav-link">FAQ</a></li>
                                    <li><a href="politica-privacidade.html" class="footer-nav-link">Privacidade</a></li>
                                </ul>
                            </nav>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- FAIXA INFERIOR - DIREITOS AUTORAIS -->
                <div class="footer-copyright-section" style="background: linear-gradient(90deg, #0528f2 0%, #041d8a 100%) !important; border-top: 1px solid rgba(255, 255, 255, 0.1) !important;">
                    <div class="footer-container">
                        <div class="footer-copyright-container">
                            <div class="footer-copyright-content">
                            <p class="footer-copyright-text">
                                © ${new Date().getFullYear()} Editaliza - CNPJ: 62.189.551/0001-00. Todos os direitos reservados.
                            </p>
                            
                            <div class="footer-legal-links">
                                <a href="politica-privacidade.html" class="footer-legal-link">Política de Privacidade</a>
                                <a href="metodologia.html" class="footer-legal-link">Metodologia</a>
                                <a href="faq.html" class="footer-legal-link">FAQ</a>
                                <a href="mailto:suporte@editaliza.com.br" class="footer-legal-link">Suporte</a>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        `;
        
        this.insertFooter(footerHTML);
        this.log('✅ HTML refatorado inserido');
    }
    
    /**
     * Insere o rodapé na página
     */
    insertFooter(footerHTML) {
        this.log('🔧 Iniciando inserção do footer...');
        
        // Remove rodapé existente
        const existingFooter = document.querySelector('.editaliza-footer, .editaliza-footer-refatorado');
        if (existingFooter) {
            this.log('🗑️ Removendo footer existente');
            existingFooter.remove();
        }
        
        // Cria elemento
        this.log('🏗️ Criando elemento do footer...');
        const temp = document.createElement('div');
        temp.innerHTML = footerHTML.trim();
        this.footerElement = temp.firstChild;
        
        this.log('📍 Footer criado, tipo:', this.footerElement.tagName);
        this.log('📍 Classes do footer:', this.footerElement.className);
        
        // Insere no body
        this.log('📌 Inserindo footer no body...');
        document.body.appendChild(this.footerElement);
        
        // Log para debug
        this.log('📍 Footer inserido no body, altura:', this.footerElement.offsetHeight);
        this.log('📍 Posição do footer:', this.footerElement.getBoundingClientRect());
        this.log('📍 Footer visível:', this.footerElement.offsetHeight > 0 && this.footerElement.offsetWidth > 0);
        
        // Verificar se foi inserido corretamente
        const insertedFooter = document.querySelector('.editaliza-footer-refatorado');
        if (insertedFooter) {
            this.log('✅ Footer encontrado no DOM após inserção');
        } else {
            this.log('❌ Footer NÃO encontrado no DOM após inserção');
        }
    }
    
    finalizeFooterLoad() {
        this.isLoaded = true;
        this.log('✅ Rodapé refatorado carregado com sucesso');
        
        // Dispara evento
        const event = new CustomEvent('footerRefatoradoLoaded', {
            detail: {
                footerElement: this.footerElement,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
    }
}

// Instância global
window.EditalizaFooterRefatorado = EditalizaFooterRefatorado;

// Função de inicialização
function initFooterRefatorado() {
    console.log('🚨🚨🚨 INIT FOOTER REFATORADO CHAMADO! 🚨🚨🚨');
    console.log('🚨🚨🚨 Timestamp:', new Date().toISOString());
    console.log('🚀 [FOOTER REFATORADO] Iniciando...');
    
    // Verificar se já existe
    if (document.querySelector('.editaliza-footer-refatorado')) {
        console.log('✅ [FOOTER REFATORADO] Já existe');
        return;
    }
    
    try {
        console.log('🚨🚨🚨 CRIANDO INSTÂNCIA DO FOOTER! 🚨🚨🚨');
        window.footerManagerRefatorado = new EditalizaFooterRefatorado();
        console.log('🚨🚨🚨 INSTÂNCIA CRIADA, CHAMANDO INIT! 🚨🚨🚨');
        window.footerManagerRefatorado.init();
    } catch (error) {
        console.error('❌ [FOOTER REFATORADO] Erro:', error);
    }
}

// Auto-inicialização
console.log('🚨🚨🚨 AUTO-INICIALIZAÇÃO DO FOOTER! 🚨🚨🚨');
console.log('🚨🚨🚨 Document readyState:', document.readyState);

if (document.readyState === 'loading') {
    console.log('🚨🚨🚨 DOM ainda carregando, aguardando DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initFooterRefatorado);
} else {
    console.log('🚨🚨🚨 DOM já carregado, iniciando imediatamente...');
    initFooterRefatorado();
}

// Exportar para uso global
window.loadFooterRefatorado = () => {
    if (!window.footerManagerRefatorado) {
        window.footerManagerRefatorado = new EditalizaFooterRefatorado();
    }
    return window.footerManagerRefatorado.init();
};