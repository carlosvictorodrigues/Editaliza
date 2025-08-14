/**
 * MÓDULO DE RODAPÉ EDITALIZA - VERSÃO DEFINITIVA
 * Sistema modular robusto e à prova de falhas para rodapé em todas as páginas
 * ✅ Funciona em file:// e http://
 * ✅ Sistema de fallback inteligente
 * ✅ Logs detalhados para debug
 * ✅ Auto-inicialização confiável
 */

class EditalizaFooter {
    constructor() {
        this.footerElement = null;
        this.isLoaded = false;
        this.loadAttempts = 0;
        this.maxAttempts = 3;
        this.isFileProtocol = window.location.protocol === 'file:';
        this.debugMode = true; // Ativar logs detalhados
        
        this.config = {
            footerPath: this.getFooterPath(),
            cssPath: this.getCSSPath(),
            autoInsert: true,
            position: 'body',
            fadeInDuration: 600,
            // CRÍTICO: SEMPRE usar fallback para garantir funcionamento em qualquer protocolo
            useFallback: true // Forçar fallback sempre
        };
        
        this.log('🚀 EditalizaFooter inicializado', { 
            protocol: window.location.protocol,
            useFallback: this.config.useFallback,
            debugMode: this.debugMode 
        });
    }
    
    /**
     * Determina o caminho correto para o arquivo footer.html
     */
    getFooterPath() {
        const possiblePaths = [
            'components/footer.html',
            './components/footer.html',
            '../components/footer.html'
        ];
        return possiblePaths[0]; // Usar primeiro caminho como padrão
    }
    
    /**
     * Determina o caminho correto para o CSS
     */
    getCSSPath() {
        const possiblePaths = [
            'css/footer.css',
            './css/footer.css',
            '../css/footer.css'
        ];
        return possiblePaths[0];
    }
    
    /**
     * Verifica se deve usar fallback baseado no ambiente
     */
    shouldUseFallback() {
        // Usar fallback se:
        // 1. Protocol é file://
        // 2. Não há servidor local detectado
        // 3. Ambiente parece ser estático
        return this.isFileProtocol || 
               !window.location.hostname || 
               window.location.hostname === '';
    }
    
    /**
     * Sistema de logging inteligente
     */
    log(message, data = null) {
        if (!this.debugMode) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `🦶 [FooterManager ${timestamp}]`;
        
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }
    
    /**
     * Logging de erro com detalhes
     */
    logError(message, error = null) {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `❌ [FooterManager ${timestamp}]`;
        
        if (error) {
            console.error(`${prefix} ${message}`, error);
        } else {
            console.error(`${prefix} ${message}`);
        }
    }

    /**
     * Inicialização principal - Sistema à prova de falhas
     */
    async init(customConfig = {}) {
        this.loadAttempts++;
        this.log(`🚀 Iniciando carregamento do rodapé (tentativa ${this.loadAttempts}/${this.maxAttempts})`);
        
        try {
            // Merge configurações personalizadas
            this.config = { ...this.config, ...customConfig };
            this.log('⚙️ Configurações aplicadas', this.config);
            
            // Verificar se já existe rodapé na página
            if (this.checkExistingFooter()) {
                this.log('✅ Rodapé já existe na página - abortando carregamento');
                return;
            }
            
            // DECISÃO CRÍTICA: Usar fallback em file:// ou quando especificado
            if (this.config.useFallback) {
                this.log('🔧 Usando sistema de fallback - garantia de funcionamento');
                this.loadDirectFooter();
                this.finalizeFooterLoad();
                return;
            }
            
            // Tentar carregamento via fetch (apenas em http/https)
            this.log('🌐 Tentando carregamento via fetch');
            await this.loadViaFetch();
            this.finalizeFooterLoad();
            
        } catch (error) {
            this.logError('Erro no carregamento principal, tentando fallback', error);
            this.handleLoadError(error);
        }
    }
    
    /**
     * Verifica se já existe rodapé na página
     */
    checkExistingFooter() {
        const existingFooter = document.querySelector('.editaliza-footer, footer');
        if (existingFooter) {
            this.log('👀 Rodapé existente encontrado', existingFooter);
            this.footerElement = existingFooter;
            this.isLoaded = true;
            return true;
        }
        return false;
    }
    
    /**
     * Finaliza o carregamento e configuração do rodapé
     */
    finalizeFooterLoad() {
        this.setupFooter();
        this.isLoaded = true;
        this.log('✅ Rodapé Editaliza carregado com sucesso');
        this.dispatchFooterLoadedEvent();
    }
    
    /**
     * Carregamento via fetch (para http/https)
     */
    async loadViaFetch() {
        // Carregar CSS primeiro
        await this.loadCSS();
        this.log('📄 CSS carregado com sucesso');
        
        // Carregar HTML do componente
        await this.loadFooterHTML();
        this.log('🏗️ HTML carregado com sucesso');
    }

    /**
     * Carrega o arquivo CSS do rodapé
     */
    async loadCSS() {
        return new Promise((resolve, reject) => {
            // Verifica se o CSS já foi carregado
            if (document.querySelector(`link[href*="footer.css"]`)) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = this.config.cssPath;
            
            link.onload = () => {
                console.log('📄 CSS do rodapé carregado');
                resolve();
            };
            
            link.onerror = () => {
                console.warn('⚠️ Erro ao carregar CSS do rodapé, usando estilos inline');
                this.loadFallbackCSS();
                resolve(); // Continua mesmo sem CSS
            };
            
            document.head.appendChild(link);
        });
    }

    /**
     * Carrega CSS de fallback inline caso o arquivo não esteja disponível
     */
    loadFallbackCSS() {
        const style = document.createElement('style');
        style.textContent = `
            .editaliza-footer {
                background: linear-gradient(135deg, #0528f2 0%, #1e40af 50%, #0d0d0d 100%);
                color: white;
                padding: 0.75rem 1rem 0.5rem;
                margin-top: auto;
                text-align: center;
                max-height: 150px;
            }
            .footer-container { max-width: 1200px; margin: 0 auto; }
            .footer-brand { margin-bottom: 0.5rem; }
            .footer-logo-text { font-size: 1rem; font-weight: bold; }
            .footer-copyright { margin-top: 0.5rem; opacity: 0.8; font-size: 0.75rem; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Carrega o HTML do rodapé
     */
    async loadFooterHTML() {
        try {
            const response = await fetch(this.config.footerPath);
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            const footerHTML = await response.text();
            
            if (this.config.autoInsert) {
                this.insertFooter(footerHTML);
            }
            
            return footerHTML;
            
        } catch (error) {
            console.warn('⚠️ Erro ao carregar HTML do rodapé, usando versão simplificada');
            this.loadFallbackFooter();
        }
    }

    /**
     * Insere o rodapé na página
     */
    insertFooter(footerHTML) {
        // Remove rodapé existente se houver
        const existingFooter = document.querySelector('.editaliza-footer');
        if (existingFooter) {
            existingFooter.remove();
        }

        // Cria elemento temporário para parser do HTML
        const temp = document.createElement('div');
        temp.innerHTML = footerHTML.trim();
        this.footerElement = temp.firstChild;

        // Adiciona classe de loading inicialmente
        this.footerElement.classList.add('footer-loading');

        // Insere no local apropriado
        const targetElement = this.config.position === 'body' 
            ? document.body 
            : document.querySelector(this.config.position);

        if (targetElement) {
            targetElement.appendChild(this.footerElement);
        } else {
            console.warn('⚠️ Elemento alvo não encontrado, inserindo no body');
            document.body.appendChild(this.footerElement);
        }
    }

    /**
     * Sistema de carregamento direto - VERSÃO COMPLETA E ROBUSTA
     * Inclui todo o HTML do rodapé diretamente no JavaScript
     */
    loadDirectFooter() {
        this.log('🏗️ Carregando rodapé direto (sistema à prova de falhas)');
        
        // CSS inline para garantir funcionamento mesmo sem arquivo CSS
        this.injectInlineCSS();
        
        // HTML completo do rodapé
        const footerHTML = `
            <footer class="editaliza-footer">
                <div class="footer-container">
                    <!-- Grid principal -->
                    <div class="footer-grid">
                        <!-- Seção da marca -->
                        <div class="footer-brand">
                            <div class="footer-logo">
                                <svg class="footer-logo-icon" width="120" height="24" viewBox="0 0 510.24 101.5" xmlns="http://www.w3.org/2000/svg">
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
                                Plataforma inteligente de estudos para concursos públicos com metodologia personalizada.
                            </p>
                            
                            <!-- Redes sociais -->
                            <div class="footer-social">
                                <div class="social-links">
                                    <a href="#" class="social-link" title="Instagram" aria-label="Siga-nos no Instagram">
                                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                        </svg>
                                    </a>
                                    <a href="#" class="social-link" title="YouTube" aria-label="Acesse nosso canal no YouTube">
                                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                        </svg>
                                    </a>
                                    <a href="#" class="social-link" title="LinkedIn" aria-label="Conecte-se conosco no LinkedIn">
                                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                        </svg>
                                    </a>
                                    <a href="#" class="social-link" title="WhatsApp" aria-label="Entre em contato via WhatsApp">
                                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <!-- Links da plataforma -->
                        <div class="footer-section">
                            <h3>Plataforma</h3>
                            <ul class="footer-links">
                                <li><a href="dashboard.html">Dashboard</a></li>
                                <li><a href="home.html">Meus Estudos</a></li>
                                <li><a href="cronograma.html">Cronograma</a></li>
                                <li><a href="plan_settings.html">Configurações do Plano</a></li>
                                <li><a href="profile.html">Meu Perfil</a></li>
                            </ul>
                        </div>

                        <!-- Recursos -->
                        <div class="footer-section">
                            <h3>Recursos</h3>
                            <ul class="footer-links">
                                <li><a href="#simulados">Simulados</a></li>
                                <li><a href="#revisoes">Revisões</a></li>
                                <li><a href="#redacoes">Redações</a></li>
                                <li><a href="#cronograma-inteligente">Cronograma Inteligente</a></li>
                                <li><a href="#gamificacao">Gamificação</a></li>
                            </ul>
                        </div>

                        <!-- Suporte e contato -->
                        <div class="footer-section">
                            <h3>Suporte</h3>
                            <div class="footer-contact-info">
                                <div class="contact-item">
                                    <svg class="contact-icon" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                    </svg>
                                    <span>suporte@editaliza.com</span>
                                </div>
                                <div class="contact-item">
                                    <svg class="contact-icon" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                    </svg>
                                    <span>(11) 99999-9999</span>
                                </div>
                                <div class="contact-item">
                                    <svg class="contact-icon" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                    <span>São Paulo, SP - Brasil</span>
                                </div>
                            </div>
                            
                            <ul class="footer-links" style="margin-top: 1.5rem;">
                                <li><a href="#central-ajuda">Central de Ajuda</a></li>
                                <li><a href="#contato">Fale Conosco</a></li>
                                <li><a href="#status">Status da Plataforma</a></li>
                            </ul>
                        </div>
                    </div>

                    <!-- Linha divisória -->
                    <div class="footer-divider"></div>

                    <!-- Rodapé inferior -->
                    <div class="footer-bottom">
                        <div class="footer-copyright">
                            <span>©</span>
                            <span id="footer-current-year">${new Date().getFullYear()}</span>
                            <span>Editaliza. Todos os direitos reservados.</span>
                        </div>
                        
                        <div class="footer-meta-links">
                            <a href="#termos">Termos de Uso</a>
                            <a href="#privacidade">Política de Privacidade</a>
                            <a href="#cookies">Política de Cookies</a>
                            <a href="#acessibilidade">Acessibilidade</a>
                        </div>
                    </div>
                </div>
            </footer>
        `;
        
        this.insertFooter(footerHTML);
        this.log('✅ Rodapé direto inserido com sucesso');
    }
    
    /**
     * Injeta CSS inline para garantir funcionamento sem arquivo CSS
     */
    injectInlineCSS() {
        // Verifica se CSS já foi injetado
        if (document.querySelector('#editaliza-footer-inline-css')) {
            this.log('📄 CSS inline já existe');
            return;
        }
        
        this.log('💉 Injetando CSS inline');
        const style = document.createElement('style');
        style.id = 'editaliza-footer-inline-css';
        style.textContent = this.getInlineCSS();
        document.head.appendChild(style);
        this.log('✅ CSS inline injetado');
    }
    
    /**
     * CSS inline completo para garantir funcionamento
     */
    getInlineCSS() {
        return `
            .editaliza-footer {
                background: linear-gradient(135deg, #0528f2 0%, #1e40af 50%, #0d0d0d 100%);
                color: white;
                margin-top: auto;
                position: relative;
                overflow: hidden;
            }
            
            .editaliza-footer::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: 
                    radial-gradient(circle at 20% 80%, rgba(26, 217, 55, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
                pointer-events: none;
            }
            
            .footer-container {
                position: relative;
                z-index: 1;
                max-width: 1200px;
                margin: 0 auto;
                padding: 0.75rem 1rem 0.5rem;
            }
            
            .footer-grid {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr;
                gap: 1rem;
                margin-bottom: 0.75rem;
            }
            
            .footer-brand {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .footer-logo {
                display: flex;
                align-items: center;
                margin-bottom: 0.5rem;
                padding: 0.5rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 0.5rem;
                backdrop-filter: blur(10px);
                width: fit-content;
            }
            
            .footer-logo-icon {
                width: auto;
                height: 1.5rem;
                filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
            }
            
            .footer-description {
                color: rgba(255, 255, 255, 0.8);
                line-height: 1.4;
                font-size: 0.85rem;
                margin-bottom: 0.5rem;
            }
            
            .footer-section h3 {
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 0.75rem;
                color: white;
                position: relative;
            }
            
            .footer-section h3::after {
                content: '';
                position: absolute;
                bottom: -0.375rem;
                left: 0;
                width: 1.5rem;
                height: 2px;
                background: linear-gradient(90deg, #1ad937, #16a34a);
                border-radius: 1px;
            }
            
            .footer-links {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .footer-links li a {
                color: rgba(255, 255, 255, 0.8);
                text-decoration: none;
                font-size: 0.8rem;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .footer-links li a:hover {
                color: #1ad937;
                transform: translateX(0.25rem);
            }
            
            .footer-contact-info {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .contact-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.8rem;
            }
            
            .contact-icon {
                width: 1rem;
                height: 1rem;
                color: #1ad937;
                flex-shrink: 0;
            }
            
            .footer-social {
                margin-top: 0.75rem;
            }
            
            .social-links {
                display: flex;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            
            .social-link {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2rem;
                height: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 0.375rem;
                color: white;
                text-decoration: none;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            }
            
            .social-link:hover {
                background: #1ad937;
                transform: translateY(-0.125rem);
                box-shadow: 0 4px 12px rgba(26, 217, 55, 0.4);
            }
            
            .social-link svg {
                width: 1rem;
                height: 1rem;
            }
            
            .footer-divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                margin: 1rem 0 0.75rem;
            }
            
            .footer-bottom {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                align-items: center;
                text-align: center;
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.75rem;
            }
            
            .footer-copyright {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .footer-meta-links {
                display: flex;
                gap: 1rem;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .footer-meta-links a {
                color: rgba(255, 255, 255, 0.7);
                text-decoration: none;
                transition: color 0.3s ease;
            }
            
            .footer-meta-links a:hover {
                color: #1ad937;
            }
            
            @media (max-width: 768px) {
                .footer-container {
                    padding: 0.75rem 1rem 0.5rem;
                }
                
                .footer-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
                
                .footer-bottom {
                    gap: 0.5rem;
                }
                
                .footer-meta-links {
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .social-links {
                    justify-content: center;
                }
                
                .footer-description {
                    font-size: 0.75rem;
                }
                
                .footer-section h3 {
                    font-size: 0.9rem;
                }
                
                .footer-logo {
                    align-self: center;
                }
            }
        `;
    }

    /**
     * Configura funcionalidades do rodapé após carregamento
     */
    setupFooter() {
        if (!this.footerElement) return;

        // Atualiza ano atual
        this.updateCurrentYear();
        
        // Remove estado de loading com animação
        setTimeout(() => {
            this.footerElement.classList.remove('footer-loading');
        }, 100);

        // Configura links externos
        this.setupExternalLinks();
        
        // Configura links de navegação interna
        this.setupInternalLinks();
        
        // Configura tracking de analytics (se disponível)
        this.setupAnalytics();
    }

    /**
     * Atualiza o ano atual no copyright
     */
    updateCurrentYear() {
        const yearElement = this.footerElement?.querySelector('#footer-current-year');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear().toString();
        }
    }

    /**
     * Configura comportamento de links externos
     */
    setupExternalLinks() {
        const externalLinks = this.footerElement?.querySelectorAll('a[href^="http"], a[href^="mailto:"], a[href^="tel:"]');
        
        externalLinks?.forEach(link => {
            // Adiciona target="_blank" para links externos
            if (link.href.startsWith('http') && !link.href.includes(window.location.hostname)) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
            
            // Adiciona tracking de cliques
            link.addEventListener('click', (e) => {
                this.trackFooterClick(link.href, link.textContent.trim());
            });
        });
    }

    /**
     * Configura links de navegação interna
     */
    setupInternalLinks() {
        const internalLinks = this.footerElement?.querySelectorAll('a[href$=".html"], a[href^="#"]');
        
        internalLinks?.forEach(link => {
            link.addEventListener('click', (e) => {
                // Verifica se a página existe antes de navegar
                if (link.href.includes('.html')) {
                    this.validateInternalLink(link);
                }
                
                this.trackFooterClick(link.href, link.textContent.trim());
            });
        });
    }

    /**
     * Valida se link interno existe
     */
    async validateInternalLink(link) {
        try {
            const response = await fetch(link.href, { method: 'HEAD' });
            if (!response.ok) {
                console.warn(`⚠️ Link pode estar quebrado: ${link.href}`);
            }
        } catch (error) {
            console.warn(`⚠️ Erro ao validar link: ${link.href}`);
        }
    }

    /**
     * Configura analytics se disponível
     */
    setupAnalytics() {
        // Integração com Google Analytics, Mixpanel, etc.
        if (typeof gtag !== 'undefined') {
            console.log('📊 Analytics configurado para rodapé');
        }
    }

    /**
     * Rastreia cliques nos links do rodapé
     */
    trackFooterClick(href, text) {
        // Analytics event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'footer_click', {
                'link_url': href,
                'link_text': text,
                'page_location': window.location.href
            });
        }
        
        console.log(`🔗 Click no rodapé: ${text} (${href})`);
    }

    /**
     * Dispara evento personalizado quando rodapé é carregado
     */
    dispatchFooterLoadedEvent() {
        const event = new CustomEvent('footerLoaded', {
            detail: {
                footerElement: this.footerElement,
                timestamp: new Date().toISOString()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Sistema robusto de tratamento de erros
     */
    handleLoadError(error) {
        this.logError(`Erro no carregamento (tentativa ${this.loadAttempts}/${this.maxAttempts})`, error);
        
        // Se ainda temos tentativas, tenta novamente em modo fallback
        if (this.loadAttempts < this.maxAttempts && !this.config.useFallback) {
            this.log('🔄 Tentando novamente com fallback');
            this.config.useFallback = true;
            setTimeout(() => {
                this.init();
            }, 1000);
            return;
        }
        
        // Última tentativa - carregamento direto forçado
        this.log('🆘 Última tentativa - carregamento direto forçado');
        try {
            this.loadDirectFooter();
            this.finalizeFooterLoad();
        } catch (finalError) {
            this.logError('Falha crítica no carregamento do rodapé', finalError);
            this.loadEmergencyFooter();
        }
    }
    
    /**
     * Rodapé de emergência ultra-simplificado
     */
    loadEmergencyFooter() {
        this.log('🚨 Carregando rodapé de emergência');
        const emergencyHTML = `
            <div style="
                background: linear-gradient(135deg, #0528f2, #1e40af);
                color: white;
                text-align: center;
                padding: 0.75rem 1rem 0.5rem;
                margin-top: 1rem;
                height: auto;
                max-height: 120px;
            ">
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem;">Editaliza</h3>
                <p style="opacity: 0.8; margin-bottom: 0.5rem; font-size: 0.75rem;">Plataforma inteligente de estudos para concursos públicos</p>
                <p style="opacity: 0.6; font-size: 0.7rem;">© ${new Date().getFullYear()} Editaliza. Todos os direitos reservados.</p>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = emergencyHTML;
        const footerElement = tempDiv.firstElementChild;
        footerElement.classList.add('editaliza-footer', 'emergency-footer');
        
        document.body.appendChild(footerElement);
        this.footerElement = footerElement;
        this.isLoaded = true;
        this.log('✅ Rodapé de emergência carregado');
    }

    /**
     * Atualiza conteúdo do rodapé dinamicamente
     */
    updateFooterContent(updates = {}) {
        if (!this.footerElement) return;

        // Atualizar ano
        if (updates.year) {
            const yearElement = this.footerElement.querySelector('#footer-current-year');
            if (yearElement) yearElement.textContent = updates.year;
        }

        // Atualizar links de redes sociais
        if (updates.socialLinks) {
            this.updateSocialLinks(updates.socialLinks);
        }

        // Atualizar informações de contato
        if (updates.contact) {
            this.updateContactInfo(updates.contact);
        }
    }

    /**
     * Atualiza links de redes sociais
     */
    updateSocialLinks(socialLinks) {
        const socialContainer = this.footerElement?.querySelector('.social-links');
        if (!socialContainer) return;

        Object.entries(socialLinks).forEach(([platform, url]) => {
            const link = socialContainer.querySelector(`a[title*="${platform}"]`);
            if (link && url) {
                link.href = url;
                link.style.display = 'flex';
            } else if (link && !url) {
                link.style.display = 'none';
            }
        });
    }

    /**
     * Atualiza informações de contato
     */
    updateContactInfo(contactInfo) {
        if (contactInfo.email) {
            const emailElement = this.footerElement?.querySelector('.contact-item span');
            if (emailElement && emailElement.textContent.includes('@')) {
                emailElement.textContent = contactInfo.email;
            }
        }

        if (contactInfo.phone) {
            const phoneElements = this.footerElement?.querySelectorAll('.contact-item span');
            phoneElements?.forEach(el => {
                if (el.textContent.includes('(') || el.textContent.includes('-')) {
                    el.textContent = contactInfo.phone;
                }
            });
        }
    }

    /**
     * Remove o rodapé da página
     */
    destroy() {
        if (this.footerElement) {
            this.footerElement.remove();
            this.footerElement = null;
        }
        
        this.isLoaded = false;
        console.log('🗑️ Módulo de rodapé removido');
    }

    /**
     * Recarrega o rodapé
     */
    async reload() {
        this.destroy();
        await this.init();
    }

    /**
     * Verifica se rodapé está carregado
     */
    isFooterLoaded() {
        return this.isLoaded && this.footerElement && document.body.contains(this.footerElement);
    }
}

// Instância global do módulo de rodapé
window.EditalizaFooter = EditalizaFooter;

// ==========================================
// SISTEMA DE AUTO-INICIALIZAÇÃO ROBUSTO
// ==========================================

/**
 * Função de inicialização inteligente que garante carregamento em qualquer situação
 */
function initEditalizaFooter() {
    console.log('🚀 [FOOTER] Iniciando sistema de auto-inicialização...');
    
    // Verificar se já existe rodapé na página
    if (document.querySelector('.editaliza-footer')) {
        console.log('✅ [FOOTER] Rodapé já existe na página');
        return;
    }
    
    // Verificar se já existe instância do footer manager
    if (window.footerManager && window.footerManager.isLoaded) {
        console.log('✅ [FOOTER] FooterManager já carregado');
        return;
    }
    
    console.log('🦶 [FOOTER] Criando nova instância do FooterManager...');
    
    try {
        window.footerManager = new EditalizaFooter();
        
        // Inicializar de forma assíncrona para não bloquear o carregamento da página
        window.footerManager.init().then(() => {
            console.log('✅ [FOOTER] Auto-inicialização concluída com sucesso');
        }).catch((error) => {
            console.warn('⚠️ [FOOTER] Erro na inicialização:', error);
            // Tentar fallback após pequeno delay
            setTimeout(() => {
                console.log('🔄 [FOOTER] Tentando fallback...');
                try {
                    window.footerManager = new EditalizaFooter();
                    window.footerManager.init({ useFallback: true });
                } catch (fallbackError) {
                    console.error('❌ [FOOTER] Fallback também falhou:', fallbackError);
                }
            }, 1500);
        });
        
    } catch (error) {
        console.error('❌ [FOOTER] Erro crítico na criação da instância:', error);
        // Última tentativa com sistema de emergência
        setTimeout(() => {
            console.log('🆘 [FOOTER] Ativando sistema de emergência...');
            const emergencyFooter = new EditalizaFooter();
            emergencyFooter.loadEmergencyFooter();
        }, 2000);
    }
}

// Múltiplas estratégias de inicialização para máxima compatibilidade

// 1. DOMContentLoaded (padrão moderno)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditalizaFooter);
} else {
    // DOM já está pronto
    initEditalizaFooter();
}

// 2. window.onload (fallback para compatibilidade)
if (window.addEventListener) {
    window.addEventListener('load', () => {
        // Verificar se o rodapé ainda não foi carregado
        if (!document.querySelector('.editaliza-footer')) {
            console.log('🔄 [FOOTER] Tentativa adicional via window.onload');
            initEditalizaFooter();
        }
    });
}

// 3. Inicialização imediata se script for carregado após DOM pronto
setTimeout(() => {
    if (!document.querySelector('.editaliza-footer') && document.readyState === 'complete') {
        console.log('⏰ [FOOTER] Inicialização via timeout');
        initEditalizaFooter();
    }
}, 100);

// Exporta para uso em módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditalizaFooter;
}

// Event listener para debug/monitoring
document.addEventListener('footerLoaded', (event) => {
    console.log('🎉 Rodapé Editaliza carregado:', event.detail);
});

/**
 * UTILITY FUNCTIONS - Funções auxiliares globais
 */

/**
 * Função para carregar rodapé manualmente em páginas específicas
 */
window.loadEditalizaFooter = async (customConfig = {}) => {
    if (!window.footerManager) {
        window.footerManager = new EditalizaFooter();
    }
    
    await window.footerManager.init(customConfig);
    return window.footerManager;
};

/**
 * Função para atualizar rodapé dinamicamente
 */
window.updateEditalizaFooter = (updates) => {
    if (window.footerManager && window.footerManager.isFooterLoaded()) {
        window.footerManager.updateFooterContent(updates);
    }
};

/**
 * Função para verificar status do rodapé
 */
window.getFooterStatus = () => {
    return {
        loaded: window.footerManager?.isFooterLoaded() || false,
        element: window.footerManager?.footerElement || null,
        timestamp: new Date().toISOString()
    };
};