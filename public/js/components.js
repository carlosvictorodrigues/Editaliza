/* eslint-env browser */
/* global app, TimerSystem */

/**
 * @file js/components.js
 * @description Funções para renderizar componentes de UI reutilizáveis com a nova identidade visual.
 */

const components = {
    // CORREÇÃO: Gerar botão inteligente baseado no estado preciso do timer
    generateSmartButton(sessionId, defaultText = 'Iniciar Estudo', sessionData = null) {
        // CORREÇÃO: Verificar primeiro se sessão já foi concluída
        if (sessionData && sessionData.status === 'Concluído') {
            return {
                text: 'Concluído',
                classes: 'bg-green-600 hover:bg-green-700 cursor-not-allowed opacity-70',
                icon: '✅',
                action: 'completed',
                disabled: true
            };
        }
        
        // Verificar diferentes estados do timer
        if (!window.TimerSystem) {
            return {
                text: defaultText,
                classes: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
                icon: '🚀'
            };
        }
        
        const hasActiveTimer = TimerSystem.hasActiveTimer(sessionId);
        const timer = TimerSystem.timers[sessionId];
        
        // CORREÇÃO: Verificar se timer foi marcado como concluído
        if (timer && timer.isCompleted) {
            return {
                text: 'Concluído',
                classes: 'bg-green-600 hover:bg-green-700 cursor-not-allowed opacity-70',
                icon: '✅',
                action: 'completed',
                disabled: true
            };
        }
        
        if (hasActiveTimer) {
            // Timer ativo - rodando
            const elapsed = TimerSystem.getTimerElapsed(sessionId);
            const timeStr = TimerSystem.formatTime(elapsed);
            return {
                text: `Continuar (${timeStr})`,
                classes: 'animate-pulse bg-orange-500 hover:bg-orange-600 border-2 border-orange-300',
                icon: '⏱️',
                action: 'continue' // Indica que é uma continuação
            };
        } else if (timer && timer.elapsed > 1000) {
            // Timer pausado com tempo acumulado
            const timeStr = TimerSystem.formatTime(timer.elapsed);
            return {
                text: `Continuar (${timeStr})`,
                classes: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600',
                icon: '⏸️',
                action: 'continue' // Indica que é uma continuação
            };
        } else {
            // Sem timer ou timer zerado
            return {
                text: defaultText,
                classes: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
                icon: '🚀',
                action: 'start' // Indica que é um novo início
            };
        }
    },
    // Renderiza os componentes globais da UI (spinner, toast)
    renderGlobalUI() {
        const uiContainer = document.createElement('div');
        uiContainer.innerHTML = `
            <div id="toast-container" class="fixed top-5 right-5 z-50 space-y-3"></div>
            <div id="spinner-overlay" class="hidden fixed inset-0 bg-editaliza-black bg-opacity-60 z-50 flex items-center justify-center">
                <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-editaliza-blue"></div>
            </div>
        `;
        document.body.prepend(uiContainer);
    },

    // Cache do avatar do usuário para evitar múltiplas requisições
    userAvatarCache: null,
    userAvatarCacheTime: null,
    userAvatarCacheTimeout: 2 * 60 * 1000, // CORREÇÃO 5: Reduzir cache para 2 minutos para atualizações mais rápidas

    // Carregar dados do usuário (avatar) para a navegação
    async loadUserAvatar() {
        // Verificar se há cache válido
        const now = Date.now();
        if (this.userAvatarCache && this.userAvatarCacheTime && 
            (now - this.userAvatarCacheTime) < this.userAvatarCacheTimeout) {
            // Avatar cached
            return this.userAvatarCache;
        }

        try {
            // Loading avatar from server
            const userProfile = await app.apiFetch('/users/profile'); // CORREÇÃO 5: Usar endpoint correto
            
            // Check if user has Google avatar or local avatar
            let avatar = null;
            if (userProfile.google_avatar && userProfile.auth_provider === 'google') {
                avatar = userProfile.google_avatar;
                // Google avatar loaded
            } else if (userProfile.profile_picture) {
                avatar = userProfile.profile_picture;
                // Local avatar loaded
            } else {
                // No avatar found
            }
            
            this.userAvatarCache = avatar;
            this.userAvatarCacheTime = now;
            return this.userAvatarCache;
        } catch (error) {
            console.error('❌ Erro ao carregar avatar do usuário:', error);
            return null;
        }
    },

    // Limpar cache do avatar (chamado quando avatar é atualizado)
    clearUserAvatarCache() {
        this.userAvatarCache = null;
        this.userAvatarCacheTime = null;
    },

    // Renderiza a navegação principal
    async renderMainNavigation(activePage) {
        const navContainer = document.getElementById('main-nav-container');
        if (!navContainer) return;

        // CORREÇÃO: Obter planId do localStorage para incluir nos links do dropdown
        const currentPlanId = localStorage.getItem(app?.config?.planKey);
        
        const links = [
            { href: 'home.html', text: 'Painel Principal' },
            { 
                href: '#', 
                text: 'Gerenciar Planos',
                dropdown: [
                    { href: 'dashboard.html', text: 'Meus Planos' },
                    { href: 'notes.html', text: 'Anotações' },
                    { href: currentPlanId ? `plan.html?id=${currentPlanId}` : 'plan.html', text: 'Meu Desempenho' },
                    { href: currentPlanId ? `cronograma.html?id=${currentPlanId}` : 'cronograma.html', text: 'Cronograma de Estudos' },
                    { href: currentPlanId ? `plan_settings.html?id=${currentPlanId}` : 'plan_settings.html', text: 'Configurações' }
                ]
            },
            { href: 'metodologia.html', text: 'Metodologia' },
            { href: 'faq.html', text: 'FAQ' }
        ];

        const linksHtml = links.map(link => {
            if (link.dropdown) {
                // Check if any dropdown item is active
                const hasActiveItem = link.dropdown.some(item => {
                    const itemPage = item.href.split('?')[0];
                    return activePage === itemPage;
                });
                
                // Dropdown menu
                const dropdownItems = link.dropdown.map(item => {
                    // Check if this dropdown item is the active page
                    const itemPage = item.href.split('?')[0]; // Get page without query params
                    const isItemActive = activePage === itemPage;
                    const itemStyle = isItemActive 
                        ? 'background: linear-gradient(135deg, #0528f2 0%, #3b82f6 100%); color: white;' 
                        : '';
                    const itemClass = isItemActive 
                        ? 'block px-4 py-2 text-sm font-semibold transition-colors' 
                        : 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-editaliza-blue transition-colors';
                    return `<a href="${item.href}" class="${itemClass}" style="${itemStyle}">${item.text}</a>`;
                }).join('');
                
                // Apply active styling to dropdown trigger if any item is active
                const dropdownTriggerClass = hasActiveItem ? 'nav-link-active' : 'nav-link-default';
                const dropdownTriggerStyle = hasActiveItem ? 'background: linear-gradient(135deg, #0528f2 0%, #3b82f6 100%); color: white;' : '';
                
                return `
                    <div class="relative dropdown-container">
                        <button class="${dropdownTriggerClass} dropdown-trigger px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center" style="${dropdownTriggerStyle}">
                            ${link.text}
                            <svg class="inline w-4 h-4 ml-1 dropdown-arrow transition-transform" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div class="dropdown-menu absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible transition-all duration-200 z-50">
                            ${dropdownItems}
                        </div>
                    </div>
                `;
            } else {
                // Regular link
                const isActive = activePage === link.href;
                const linkClass = isActive ? 'nav-link-active' : 'nav-link-default';
                const linkStyle = isActive ? 'background: linear-gradient(135deg, #0528f2 0%, #3b82f6 100%); color: white;' : '';
                return `<a href="${link.href}" class="${linkClass} px-4 py-2 rounded-lg text-sm font-medium transition-colors" style="${linkStyle}">${link.text}</a>`;
            }
        }).join('');
        
        // Carregar avatar do usuário
        const userAvatar = await this.loadUserAvatar();
        
        // Criar HTML do perfil com ou sem avatar
        let profileHtml;
        if (userAvatar) {
            // Sanitizar o caminho do avatar
            const sanitizedAvatarPath = app.sanitizeHtml(userAvatar);
            
            // CORREÇÃO 5: Melhor tratamento de URLs de avatar (Google vs Local)
            let avatarUrl;
            if (sanitizedAvatarPath.startsWith('https://')) {
                // Avatar do Google - usar diretamente
                avatarUrl = sanitizedAvatarPath;
            } else if (sanitizedAvatarPath.startsWith('/')) {
                // Avatar local com caminho absoluto - adicionar cache buster
                avatarUrl = sanitizedAvatarPath + '?t=' + new Date().getTime();
            } else {
                // Avatar local relativo - adicionar prefixo ./ e cache buster
                avatarUrl = (sanitizedAvatarPath.startsWith('./') ? sanitizedAvatarPath : './' + sanitizedAvatarPath) + '?t=' + new Date().getTime();
            }
            
            profileHtml = `
                <a href="profile.html" class="hidden sm:flex items-center space-x-2 text-sm font-medium text-editaliza-gray hover:text-editaliza-black transition-all duration-200 group">
                    <div class="relative">
                        <img id="nav-user-avatar" src="${avatarUrl}" 
                             class="w-8 h-8 rounded-full object-cover border-2 border-transparent group-hover:border-editaliza-blue transition-all duration-200 shadow-sm" 
                             alt="Avatar do usuário"
                             onerror="console.error('Erro ao carregar avatar:', '${avatarUrl}'); this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="w-8 h-8 bg-gradient-to-br from-editaliza-blue to-indigo-600 rounded-full hidden items-center justify-center text-white text-xs font-bold border-2 border-transparent group-hover:border-editaliza-blue transition-all duration-200 shadow-sm">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                    </div>
                    <span class="hidden md:inline group-hover:text-editaliza-blue transition-colors duration-200">Perfil</span>
                </a>`;
        } else {
            // Fallback para ícone padrão
            profileHtml = `
                <a href="profile.html" class="hidden sm:flex items-center space-x-2 text-sm font-medium text-editaliza-gray hover:text-editaliza-black transition-all duration-200 group">
                    <div class="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white group-hover:from-editaliza-blue group-hover:to-indigo-600 transition-all duration-200 shadow-sm">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <span class="hidden md:inline group-hover:text-editaliza-blue transition-colors duration-200">Perfil</span>
                </a>`;
        }
        
        navContainer.innerHTML = `
            <style>
                .nav-link-active {
                    background: var(--nav-active-bg);
                    color: var(--nav-active-text);
                    border-radius: 0.5rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .nav-link-default {
                    color: var(--nav-text);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .nav-link-default:hover {
                    background-color: var(--nav-background-hover);
                    color: var(--nav-text-hover);
                    border-radius: 0.5rem;
                }
                .btn-secondary {
                    background: var(--surface-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-primary);
                    border-radius: 0.5rem;
                    padding: 0.5rem 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .btn-secondary:hover {
                    background: var(--surface-elevated);
                    border-color: var(--border-secondary);
                    transform: translateY(-1px);
                }
            </style>
            <header class="border-b shadow-sm" style="background: var(--nav-background); border-color: var(--nav-border);">
                <div class="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex justify-between items-center h-16">
                        <div class="flex items-center">
                            <a href="home.html" class="flex-shrink-0 flex items-center">
                                <svg id="logo-header" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510.24 101.5" class="h-8 w-auto">
                                  <defs>
                                    <style>
                                      .cls-1 {
                                        fill: #0528f2;
                                      }
                                      .cls-2 {
                                        fill: #0d0d0d !important; /* Force black text in logo */
                                      }
                                      .cls-3 {
                                        fill: #1ad937;
                                      }
                                    </style>
                                  </defs>
                                  <g id="Camada_1-2" data-name="Camada 1">
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
                                  </g>
                                </svg>

                            </a>
                        </div>
                        <nav class="hidden md:flex items-center space-x-1">
                            ${linksHtml}
                        </nav>
                        <div class="flex items-center space-x-3">
                            ${profileHtml}
                            <!-- Theme Toggle -->
                            <button data-theme-toggle class="button button--secondary" onclick="toggleTheme()" aria-label="Toggle theme" style="padding: 0.5rem; min-width: auto;">
                                <svg class="sun-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                                    <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path>
                                </svg>
                                
                                <svg class="moon-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; display: none;">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                                </svg>
                            </button>
                            <button id="logoutButton" class="btn-secondary flex items-center space-x-2 text-sm">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Sair</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
        `;
        
        document.getElementById('logoutButton').addEventListener('click', () => app.logout());
        
        // Add dropdown functionality with consistent behavior
        this.initializeDropdowns();
    },
    
    initializeDropdowns() {
        // Wait for DOM to be ready
        setTimeout(() => {
            const dropdowns = document.querySelectorAll('.dropdown-container');
            
            dropdowns.forEach(dropdown => {
                const trigger = dropdown.querySelector('.dropdown-trigger');
                const menu = dropdown.querySelector('.dropdown-menu');
                const arrow = dropdown.querySelector('.dropdown-arrow');
                let isOpen = false;
                let hoverTimeout;
                
                // Toggle on click
                trigger.addEventListener('click', (e) => {
                    e.preventDefault();
                    isOpen = !isOpen;
                    
                    if (isOpen) {
                        menu.classList.remove('opacity-0', 'invisible');
                        menu.classList.add('opacity-100', 'visible');
                        arrow.style.transform = 'rotate(180deg)';
                    } else {
                        menu.classList.add('opacity-0', 'invisible');
                        menu.classList.remove('opacity-100', 'visible');
                        arrow.style.transform = 'rotate(0deg)';
                    }
                });
                
                // Show on hover with delay
                dropdown.addEventListener('mouseenter', () => {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = setTimeout(() => {
                        if (!isOpen) {
                            menu.classList.remove('opacity-0', 'invisible');
                            menu.classList.add('opacity-100', 'visible');
                            arrow.style.transform = 'rotate(180deg)';
                        }
                    }, 200); // Small delay to prevent accidental opening
                });
                
                // Hide on mouse leave with delay
                dropdown.addEventListener('mouseleave', () => {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = setTimeout(() => {
                        if (!isOpen) {
                            menu.classList.add('opacity-0', 'invisible');
                            menu.classList.remove('opacity-100', 'visible');
                            arrow.style.transform = 'rotate(0deg)';
                        }
                    }, 300); // Delay to allow moving to submenu
                });
                
                // Close when clicking outside
                document.addEventListener('click', (e) => {
                    if (!dropdown.contains(e.target)) {
                        isOpen = false;
                        menu.classList.add('opacity-0', 'invisible');
                        menu.classList.remove('opacity-100', 'visible');
                        arrow.style.transform = 'rotate(0deg)';
                    }
                });
            });
        }, 200);
    },
    
    renderPlanHeader(planId, planName, activePage) {
        const headerContainer = document.getElementById('plan-header-container');
        if (!headerContainer) return;

        const safePlanName = app.sanitizeHtml(planName);

        const links = [
            { id: 'navPerformance', href: `plan.html?id=${planId}`, text: 'Meu Desempenho' },
            { id: 'navSchedule', href: `cronograma.html?id=${planId}`, text: 'Ver Cronograma' },
            { id: 'navSettings', href: `plan_settings.html?id=${planId}`, text: 'Configurar Plano' }
        ];

        const linksHtml = links.map(link => {
            const isActive = activePage === link.href.split('?')[0];
            const activeClass = 'cursor-default nav-link-active';
            const defaultClass = 'nav-link-default';
            return `<a id="${link.id}" href="${link.href}" class="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 shadow-sm transition-colors ${isActive ? activeClass : defaultClass}">${link.text}</a>`;
        }).join('');

        headerContainer.innerHTML = `
            <div class="content-card mb-8">
                <div class="flex flex-col sm:flex-row justify-between sm:items-center">
                    <div class="mb-4 sm:mb-0">
                        <h1 class="text-2xl font-bold text-editaliza-black">${safePlanName}</h1>
                        <p id="examDate" class="text-md text-editaliza-gray mt-1"></p>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${linksHtml}
                    </div>
                </div>
            </div>
        `;
    },

    renderOverdueAlert(overdueData, containerId = 'overdue-alert-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Handle both old format (just count) and new format ({count, tasks})
        const count = typeof overdueData === 'number' ? overdueData : (overdueData.count || 0);
        const tasks = (typeof overdueData === 'object' && overdueData.tasks) ? overdueData.tasks : [];

        if (count > 0) {
            container.innerHTML = `
                <div id="overdueAlert" class="overdue-alert-card p-8 rounded-3xl mb-8 shadow-xl animate-glow" role="alert" style="background: linear-gradient(135deg, #fef2f2 0%, #fef3c7 50%, #fef7cd 100%) !important; border: 2px solid #f87171 !important; background-image: radial-gradient(circle at top right, rgba(239, 68, 68, 0.1) 0%, transparent 50%), radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.1) 0%, transparent 50%) !important;">
                    <div class="flex items-start space-x-6">
                        <div class="flex-shrink-0">
                            <div class="w-20 h-20 bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse border-4 border-white">
                                <svg class="w-10 h-10 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-grow">
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center space-x-3">
                                    <h3 class="text-2xl font-bold text-red-800">⚠️ Atenção!</h3>
                                    <div class="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                                </div>
                                <span class="bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center space-x-2 shadow-lg">
                                    <span class="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                                    <span>${count} atrasada${count > 1 ? 's' : ''}</span>
                                    <span class="text-lg">🚨</span>
                                </span>
                            </div>
                            <p class="text-gray-800 font-bold text-lg mb-3">Você tem ${count} tarefa${count > 1 ? 's' : ''} atrasada${count > 1 ? 's' : ''}.</p>
                            <p class="text-gray-700 text-base mb-4 leading-relaxed">Não se preocupe! Podemos reorganizar seu cronograma automaticamente para você voltar aos trilhos. 💪</p>
                            
                            <!-- Detalhes das tarefas atrasadas -->
                            ${this.renderOverdueTasksDetails(tasks)}
                            
                            <!-- Action Section -->
                            <div class="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                                <button id="showReplanDetailsButton" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold px-6 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-3 border-2 border-blue-200">
                                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-lg">Ver Detalhes</span>
                                    <span class="text-xl">📋</span>
                                </button>
                                
                                <button id="replanButton" class="flex-1 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:via-orange-700 hover:to-amber-700 text-white font-bold px-6 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-3 border-2 border-red-200 animate-pulse">
                                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-lg">Replanejar Agora</span>
                                    <span class="text-2xl">🚀</span>
                                </button>
                                
                                <button onclick="document.getElementById('overdueAlert').style.display='none'" class="sm:w-auto px-6 py-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-2xl transition-colors duration-300 flex items-center justify-center border-2 border-gray-200 hover:border-gray-300">
                                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                    </svg>
                                    Depois
                                </button>
                            </div>
                            
                            <!-- Seção de detalhes do replanejamento (inicialmente oculta) -->
                            <div id="replanDetails" class="hidden mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 shadow-lg">
                                <div class="flex items-center mb-4">
                                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                                        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                    </div>
                                    <h4 class="font-bold text-lg text-blue-800">📋 Estratégia de Replanejamento</h4>
                                </div>
                                <div id="replanDetailsContent" class="text-base text-blue-700">
                                    <div class="animate-pulse flex items-center space-x-2">
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce"></div>
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
                                        <span class="ml-2">Carregando detalhes...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
        } else {
            container.innerHTML = '';
        }
    },

    renderOverdueTasksDetails(tasks) {
        if (!tasks || tasks.length === 0) return '';

        // Group tasks by subject
        const tasksBySubject = tasks.reduce((acc, task) => {
            const subjectName = task.subject_name || 'Sem disciplina';
            if (!acc[subjectName]) {
                acc[subjectName] = [];
            }
            acc[subjectName].push(task);
            return acc;
        }, {});

        const subjectsHtml = Object.keys(tasksBySubject)
            .sort()
            .map(subjectName => {
                const subjectTasks = tasksBySubject[subjectName];
                const style = app.getSubjectStyle(subjectName);
                
                const tasksHtml = subjectTasks.map(task => {
                    const sessionDate = new Date(task.session_date);
                    const today = new Date();
                    const daysDiff = Math.ceil((today - sessionDate) / (1000 * 60 * 60 * 24));
                    
                    const sessionTypeIcons = {
                        'Novo Tópico': '📚',
                        'Revisão': '🔄',
                        'Simulado': '📝',
                        'Simulado Direcionado': '🎯',
                        'Redação': '✍️'
                    };
                    
                    const icon = sessionTypeIcons[task.session_type] || '📖';
                    
                    return `
                        <div class="flex items-start space-x-3 p-3 bg-white/70 rounded-lg border border-gray-200 mb-2 last:mb-0">
                            <div class="flex-shrink-0 text-xl">${icon}</div>
                            <div class="flex-grow min-w-0">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-sm font-semibold text-gray-800">${app.sanitizeHtml(task.session_type)}</span>
                                    <span class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                                        ${daysDiff === 1 ? '1 dia' : `${daysDiff} dias`} atrás
                                    </span>
                                </div>
                                <p class="text-sm text-gray-700 leading-relaxed truncate" title="${app.sanitizeHtml(task.topic_description)}">
                                    ${app.sanitizeHtml(task.topic_description)}
                                </p>
                                <p class="text-xs text-gray-500 mt-1">
                                    Previsto para: ${sessionDate.toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="mb-4 last:mb-0">
                        <div class="flex items-center space-x-2 mb-3">
                            <div class="w-4 h-4 rounded-full" style="background: ${style.primary};"></div>
                            <h4 class="font-bold text-gray-800">${app.sanitizeHtml(subjectName)}</h4>
                            <span class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                ${subjectTasks.length} tarefa${subjectTasks.length > 1 ? 's' : ''}
                            </span>
                        </div>
                        <div class="space-y-2">
                            ${tasksHtml}
                        </div>
                    </div>
                `;
            }).join('');

        return `
            <div class="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 mb-6 border border-orange-200 shadow-inner">
                <div class="flex items-center space-x-2 mb-4">
                    <svg class="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                    </svg>
                    <h3 class="text-lg font-bold text-orange-800">Tarefas em Atraso</h3>
                </div>
                <div class="max-h-64 overflow-y-auto custom-scrollbar">
                    ${subjectsHtml}
                </div>
            </div>
        `;
    },

    // Renderiza alerta de modo Reta Final
    renderRetaFinalAlert(containerId = 'reta-final-alert-container') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-8 fade-in">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0">
                        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <span class="text-2xl">🚨</span>
                        </div>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-red-800 mb-2">
                                Cronograma em Modo Reta Final
                            </h3>
                        </div>
                        <div class="space-y-2">
                            <p class="text-red-700">
                                <strong>Este cronograma foi otimizado para o modo Reta Final.</strong>
                            </p>
                            <p class="text-red-600 text-sm">
                                • Apenas os tópicos mais importantes foram mantidos<br>
                                • Foco em conteúdos com maior probabilidade de cair na prova<br>
                                • Cronograma condensado para maximizar seus resultados
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Final stretch alert rendered
    },

    // Renderiza indicador compacto de Reta Final (para home)
    renderRetaFinalIndicator(isActive, containerId = 'retaFinalIndicator') {
        const indicator = document.getElementById(containerId);
        if (!indicator) return;
        
        if (isActive) {
            indicator.classList.remove('hidden');
            // Final stretch mode active
        } else {
            indicator.classList.add('hidden');
            // Final stretch mode inactive
        }
    },

    
    createSessionCard(session) {
        const style = app.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-white to-slate-50';
        const sessionTypeConfig = {
            'Novo Tópico': { bg: 'bg-gradient-to-r from-blue-100 to-blue-200', text: 'text-blue-800', icon: '', border: 'border-blue-300', showBadge: false },
            'Reforço Extra': { bg: 'bg-gradient-to-r from-orange-100 to-orange-200', text: 'text-orange-800', icon: '💪', border: 'border-orange-300', showBadge: false },
            'Revisão 7D': { bg: 'bg-gradient-to-r from-yellow-100 to-yellow-200', text: 'text-yellow-800', icon: '📚', border: 'border-yellow-300', showBadge: true, badgeText: '7D' },
            'Revisão 14D': { bg: 'bg-gradient-to-r from-purple-100 to-purple-200', text: 'text-purple-800', icon: '🔄', border: 'border-purple-300', showBadge: true, badgeText: '14D' },
            'Revisão 28D': { bg: 'bg-gradient-to-r from-pink-100 to-pink-200', text: 'text-pink-800', icon: '🎯', border: 'border-pink-300', showBadge: true, badgeText: '28D' },
            'Simulado Direcionado': { bg: 'bg-gradient-to-r from-purple-100 to-indigo-200', text: 'text-purple-800', icon: '🎯', border: 'border-purple-400', showBadge: false },
            'Simulado Completo': { bg: 'bg-gradient-to-r from-slate-100 to-gray-200', text: 'text-slate-800', icon: '🏆', border: 'border-slate-400', showBadge: false },
            'Redação': { bg: 'bg-gradient-to-r from-rose-100 to-rose-200', text: 'text-rose-800', icon: '✍️', border: 'border-rose-300', showBadge: false }
        };
        
        const typeConfig = sessionTypeConfig[session.session_type] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: '📖', showBadge: false };
        
        // CORREÇÃO: Badge de revisão agora usa posicionamento absoluto para constância.
        const badgeHtml = typeConfig.showBadge ?
            `<span class="absolute top-3 right-3 flex items-center bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                <span class="mr-1.5">${typeConfig.icon}</span>
                <span>${typeConfig.badgeText}</span>
            </span>` : '';

        // O ícone de tipo de sessão (secundário) agora só aparece se não for uma revisão.
        const secondaryText = !typeConfig.showBadge ? `<div class="flex items-center">
            <span class="${typeConfig.bg} ${typeConfig.text} ${typeConfig.border} border-2 px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center shadow-sm">
                <span class="text-xl">${typeConfig.icon}</span>
            </span>
        </div>` : '';
        
        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        const safeTopicDescription = app.sanitizeHtml(session.topic_description);
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));

        return `
            <div id="session-card-${session.id}" class="relative study-card flex flex-col h-full p-6 rounded-2xl shadow-lg border-l-4 ${style.color} ${cardBg} transform transition-all duration-300 hover:shadow-2xl group">
                ${badgeHtml}
                <div class="flex-grow">
                    <!-- Header com ícone e título -->
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 ${style.color.replace('border-', 'bg-').replace('-500', '-100')} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <span class="text-2xl">${style.icon}</span>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-bold text-lg ${isCompleted ? 'text-gray-600' : 'text-gray-800'} group-hover:text-gray-900 transition-colors">
                                        ${safeSubjectName}
                                    </h3>
                                </div>
                            </div>
                        </div>
                        ${secondaryText}
                    </div>
                    
                    <!-- Description -->
                    <p class="text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-600'} leading-relaxed mb-4">
                        ${safeTopicDescription}
                    </p>
                    
                    <!-- Visual separator -->
                    <div class="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4"></div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto">
                    ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center text-green-600 font-bold py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-all duration-300 transform hover:scale-[1.02] mb-3">
                            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <span class="text-lg">Tarefa Concluída!</span>
                            <span class="ml-3 text-2xl animate-bounce group-hover/btn:scale-110 transition-transform">🎉</span>
                        </button>
                        <!-- Botões secundários para sessão concluída -->
                        <div class="flex space-x-2">
                            <button onclick='reinforceSession(${session.id})' class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm">
                                <span class="text-lg">💪</span>
                                <span>Reforçar</span>
                            </button>
                            <button onclick='openPostponeModal(${session.id})' class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm">
                                <span class="text-lg">📅</span>
                                <span>Adiar</span>
                            </button>
                        </div>
                    ` : `
                        <button ${this.generateSmartButton(session.id, 'Iniciar Estudo', session).disabled ? 'disabled' : `onclick='window.openStudySession(${session.id})'`} data-session='${sessionJsonString}' class="timer-aware-button group/btn w-full ${this.generateSmartButton(session.id, 'Iniciar Estudo', session).classes} text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3 mb-3">
                            <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-lg button-text">${this.generateSmartButton(session.id, 'Iniciar Estudo', session).text}</span>
                            <span class="text-xl group-hover/btn:animate-bounce button-icon">${this.generateSmartButton(session.id, 'Iniciar Estudo', session).icon}</span>
                        </button>
                        <!-- Botões secundários -->
                        <div class="flex space-x-2">
                            <button onclick='reinforceSession(${session.id})' class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm">
                                <span class="text-lg">💪</span>
                                <span>Reforçar</span>
                            </button>
                            <button onclick='openPostponeModal(${session.id})' class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 text-sm">
                                <span class="text-lg">📅</span>
                                <span>Adiar</span>
                            </button>
                        </div>
                    `}
                </div>
            </div>`;
    },

    createSimuladCard(session) {
        const isCompleted = session.status === 'Concluído';
        const isDirected = session.session_type === 'Simulado Direcionado';

        // CORREÇÃO: Estilos mais diferenciados e atrativos para cada tipo de simulado
        const style = isDirected ? 
            { 
                color: 'border-purple-500', 
                bg: isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50', 
                icon: '🎯', 
                gradient: 'from-purple-600 via-indigo-600 to-blue-600',
                badge: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg',
                title: 'Simulado Direcionado - Teste Específico',
                subtitle: 'Questões focadas em tópicos já estudados'
            } : 
            { 
                color: 'border-slate-600', 
                bg: isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50', 
                icon: '🏆', 
                gradient: 'from-slate-600 via-gray-600 to-zinc-600',
                badge: 'bg-gradient-to-r from-slate-600 to-gray-600 text-white shadow-lg',
                title: 'Simulado Completo - Avaliação Geral',
                subtitle: 'Teste abrangente de todo o conhecimento'
            };
        
        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        
        let descriptionHtml = '';
        if (isDirected) {
            const description = app.sanitizeHtml(session.topic_description);
            const parts = description.split('\n\n');
            const mainTitle = parts[0];
            
            if (parts.length > 1) {
                // Formatar descrição estruturada com disciplinas agrupadas
                descriptionHtml += `<p class="mb-6 text-xl font-bold text-gray-800">${mainTitle}</p>`;
                
                // Extrair lista de tópicos organizados por disciplinas (melhor parser)
                const topicsList = parts[1];
                if (topicsList && topicsList.includes('•')) {
                    const lines = topicsList.split('\n').filter(line => line.trim());
                    const disciplineGroups = {};
                    let currentDiscipline = null;
                    
                    lines.forEach(line => {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                            // Esta é uma disciplina
                            currentDiscipline = trimmedLine.replace(/\*\*/g, '');
                            if (!disciplineGroups[currentDiscipline]) {
                                disciplineGroups[currentDiscipline] = [];
                            }
                        } else if (trimmedLine.startsWith('•') && currentDiscipline) {
                            // Este é um tópico da disciplina atual
                            disciplineGroups[currentDiscipline].push(trimmedLine.replace('•', '').trim());
                        } else if (trimmedLine.startsWith('•') && !currentDiscipline) {
                            // Fallback: se não há disciplina definida, usar "Tópicos Gerais"
                            if (!disciplineGroups['Tópicos Gerais']) {
                                disciplineGroups['Tópicos Gerais'] = [];
                            }
                            disciplineGroups['Tópicos Gerais'].push(trimmedLine.replace('•', '').trim());
                        } else if (!trimmedLine.startsWith('•') && !trimmedLine.startsWith('**') && trimmedLine.length > 0) {
                            // Linha sem formato especial pode ser nome de disciplina
                            currentDiscipline = trimmedLine;
                            if (!disciplineGroups[currentDiscipline]) {
                                disciplineGroups[currentDiscipline] = [];
                            }
                        }
                    });
                    
                    // Render disciplinas agrupadas com ícones (seguindo o padrão das review cards)
                    const disciplineIcons = {
                        'Direito Constitucional': '⚖️',
                        'Direito Administrativo': '🏛️',
                        'Direito Civil': '📋',
                        'Direito Penal': '⚡',
                        'Direito Processual Civil': '⚡',
                        'Direito Processual Penal': '⚖️',
                        'Matemática': '🧮',
                        'Português': '📚',
                        'Informática': '💻',
                        'Conhecimentos Gerais': '🌐',
                        'Raciocínio Lógico': '🧠',
                        'Estatística': '📊',
                        'Geografia': '🌍',
                        'História': '📜',
                        'Atualidades': '📰',
                        'default': '📖'
                    };
                    
                    // Verificar se temos disciplinas agrupadas
                    const hasValidGroups = Object.keys(disciplineGroups).length > 0 && 
                        Object.values(disciplineGroups).some(topics => topics.length > 0);
                    
                    if (hasValidGroups) {
                        descriptionHtml += `
                            <div class="space-y-4 mb-6">
                                ${Object.entries(disciplineGroups).map(([discipline, topics]) => {
                                    const icon = disciplineIcons[discipline] || disciplineIcons.default;
                                    const topicCount = topics.length;
                                    
                                    if (topicCount === 0) return '';
                                    
                                    return `
                                        <div class="bg-white/90 p-6 rounded-2xl border-2 ${isDirected ? 'border-purple-200 shadow-purple-100' : 'border-gray-200'} shadow-lg hover:shadow-xl transition-all duration-300 hover:border-${isDirected ? 'purple' : 'gray'}-300">
                                            <h4 class="font-bold text-gray-800 mb-4 flex items-center justify-between text-lg">
                                                <div class="flex items-center">
                                                    <span class="text-2xl mr-3">${icon}</span>
                                                    <span>${discipline}</span>
                                                </div>
                                                <span class="bg-${isDirected ? 'purple' : 'gray'}-100 text-${isDirected ? 'purple' : 'gray'}-700 px-3 py-1 rounded-full text-xs font-medium">
                                                    ${topicCount} ${topicCount === 1 ? 'tópico' : 'tópicos'}
                                                </span>
                                            </h4>
                                            <ul class="space-y-2">
                                                ${topics.map(topic => `
                                                    <li class="flex items-start space-x-3 py-2 px-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                                                        <span class="${isDirected ? 'text-purple-500' : 'text-gray-500'} font-bold mt-1">•</span>
                                                        <span class="text-gray-700 leading-relaxed">${topic}</span>
                                                    </li>
                                                `).join('')}
                                            </ul>
                                        </div>
                                    `;
                                }).filter(Boolean).join('')}
                            </div>
                        `;
                    } else {
                        // Fallback se não conseguir agrupar
                        const allTopics = topicsList.split('\n').filter(line => line.trim().startsWith('•'));
                        descriptionHtml += `
                            <div class="bg-white/90 p-6 rounded-2xl border-2 ${isDirected ? 'border-purple-200' : 'border-gray-200'} shadow-lg mb-6">
                                <h4 class="font-bold text-gray-800 mb-4 flex items-center text-lg">
                                    <span class="text-2xl mr-3">${disciplineIcons.default}</span>
                                    Tópicos do Simulado
                                </h4>
                                <ul class="space-y-2">
                                    ${allTopics.map(topic => `
                                        <li class="flex items-start space-x-3 py-2 px-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                                            <span class="${isDirected ? 'text-purple-500' : 'text-gray-500'} font-bold mt-1">•</span>
                                            <span class="text-gray-700 leading-relaxed">${topic.replace('•', '').trim()}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        `;
                    }
                }
                
                // Adicionar texto final se existir
                if (parts[2]) {
                    descriptionHtml += `<div class="bg-gradient-to-r from-${isDirected ? 'purple' : 'gray'}-100 to-${isDirected ? 'indigo' : 'slate'}-100 p-4 rounded-xl border border-${isDirected ? 'purple' : 'gray'}-200"><p class="text-sm text-gray-700 font-medium italic">${parts[2]}</p></div>`;
                }
            } else {
                descriptionHtml = `<p class="text-lg text-gray-700 leading-relaxed">${description}</p>`;
            }
        } else {
            descriptionHtml = `<p class="text-lg text-gray-700 leading-relaxed">${app.sanitizeHtml(session.topic_description)}</p>`;
        }
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/'/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));

        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col justify-between h-full p-8 rounded-3xl shadow-xl border-l-4 ${style.color} ${style.bg} group">
                <!-- Header Section -->
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-4">
                            <div class="w-20 h-20 bg-gradient-to-br ${style.gradient} rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                                <span class="text-4xl">${style.icon}</span>
                            </div>
                            <div class="flex-grow">
                                <div class="flex items-center space-x-3 mb-2">
                                    <h3 class="font-bold text-2xl text-gray-800 group-hover:text-gray-900 transition-colors">${safeSubjectName}</h3>
                                    <span class="${style.badge} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                        ${isDirected ? 'DIRECIONADO' : 'COMPLETO'}
                                    </span>
                                </div>
                                <p class="text-base font-semibold text-gray-600 mb-1">${style.title}</p>
                                <p class="text-sm text-gray-500">${style.subtitle}</p>
                            </div>
                        </div>
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Content Section -->
                    <div class="prose prose-sm max-w-none">${descriptionHtml}</div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto pt-6 border-t border-gray-200">
                     ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center text-green-600 font-bold py-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl hover:from-green-100 hover:to-emerald-100 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg mb-3">
                           <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                               <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                                   <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                               </svg>
                           </div>
                           <span class="text-xl">Simulado Concluído!</span>
                           <span class="ml-4 text-3xl animate-bounce group-hover/btn:scale-110 transition-transform">🎖️</span>
                        </button>
                        <!-- Botões secundários -->
                        <div class="flex space-x-3">
                            <button onclick='reinforceSession(${session.id})' class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">💪</span>
                                <span>Reforçar</span>
                            </button>
                            <button onclick='openPostponeModal(${session.id})' class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">📅</span>
                                <span>Adiar</span>
                            </button>
                        </div>
                    ` : `
                        <button ${this.generateSmartButton(session.id, 'Iniciar Simulado', session).disabled ? 'disabled' : `onclick='window.openStudySession(${session.id})'`} data-session='${sessionJsonString}' class="timer-aware-button group/btn w-full ${this.generateSmartButton(session.id, 'Iniciar Simulado', session).classes.includes('orange') ? this.generateSmartButton(session.id, 'Iniciar Simulado', session).classes : `bg-gradient-to-r ${style.gradient}`} hover:shadow-2xl text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-4 mb-3">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-xl button-text">${this.generateSmartButton(session.id, 'Iniciar Simulado', session).text}</span>
                            <span class="text-2xl group-hover/btn:animate-bounce button-icon">${this.generateSmartButton(session.id, 'Iniciar Simulado', session).classes.includes('orange') ? this.generateSmartButton(session.id, 'Iniciar Simulado', session).icon : style.icon}</span>
                        </button>
                        <!-- Botões secundários -->
                        <div class="flex space-x-3">
                            <button onclick='reinforceSession(${session.id})' class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">💪</span>
                                <span>Reforçar</span>
                            </button>
                            <button onclick='openPostponeModal(${session.id})' class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">📅</span>
                                <span>Adiar</span>
                            </button>
                        </div>
                    `}
                </div>
            </div>`;
    },

    createEssayCard(session) {
        const style = app.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-rose-50 to-pink-50';

        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        const safeTopicDescription = app.sanitizeHtml(session.topic_description);
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/'/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));
        
        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col justify-between h-full p-8 rounded-3xl shadow-xl border-l-4 ${style.color} ${cardBg} group">
                <!-- Header Section -->
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-4">
                            <div class="w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                <span class="text-3xl">✍️</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-2xl text-gray-800 group-hover:text-gray-900 transition-colors">${safeSubjectName}</h3>
                                <p class="text-sm font-medium text-gray-500 uppercase tracking-wider">Redação</p>
                            </div>
                        </div>
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Content Section -->
                    <div class="bg-white/60 p-6 rounded-2xl border border-rose-100">
                        <p class="text-lg text-gray-700 leading-relaxed">${safeTopicDescription}</p>
                        
                        <!-- Writing Tips -->
                        <div class="mt-4 flex items-center space-x-4 text-sm text-gray-600">
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">📝</span>
                                <span>Estrutura</span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">💡</span>
                                <span>Argumentação</span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">✨</span>
                                <span>Criatividade</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto pt-6 border-t ${isCompleted ? 'border-green-200' : 'border-rose-200'}">
                    ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center text-green-600 font-bold py-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl hover:from-green-100 hover:to-emerald-100 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg mb-3">
                            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                                <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <span class="text-xl">Redação Concluída!</span>
                            <span class="ml-4 text-3xl animate-bounce group-hover/btn:scale-110 transition-transform">🏆</span>
                        </button>
                        <!-- Botões secundários -->
                        <div class="flex space-x-3">
                            <button onclick='reinforceSession(${session.id})' class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">💪</span>
                                <span>Reforçar</span>
                            </button>
                            <button onclick='openPostponeModal(${session.id})' class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">📅</span>
                                <span>Adiar</span>
                            </button>
                        </div>
                    ` : `
                         <button ${this.generateSmartButton(session.id, 'Iniciar Redação', session).disabled ? 'disabled' : `onclick='window.openStudySession(${session.id})'`} data-session='${sessionJsonString}' class="timer-aware-button group/btn w-full ${this.generateSmartButton(session.id, 'Iniciar Redação', session).classes.includes('orange') ? this.generateSmartButton(session.id, 'Iniciar Redação', session).classes : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700'} hover:shadow-2xl text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-4 mb-3">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-xl button-text">${this.generateSmartButton(session.id, 'Iniciar Redação', session).text}</span>
                            <span class="text-2xl group-hover/btn:animate-bounce button-icon">${this.generateSmartButton(session.id, 'Iniciar Redação', session).classes.includes('orange') ? this.generateSmartButton(session.id, 'Iniciar Redação', session).icon : '✍️'}</span>
                         </button>
                         <!-- Botões secundários -->
                        <div class="flex space-x-3">
                            <button onclick='reinforceSession(${session.id})' class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">💪</span>
                                <span>Reforçar</span>
                            </button>
                            <button onclick='openPostponeModal(${session.id})' class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">📅</span>
                                <span>Adiar</span>
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    createReviewCard(session) {
        const style = app.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50';

        const description = app.sanitizeHtml(session.topic_description);
        const parts = description.split('\n\n');
        const mainTitle = parts.shift(); // "Revisão dos seguintes tópicos:"

        // Melhor organização com ícones por disciplina
        const disciplineIcons = {
            'Direito Constitucional': '⚖️',
            'Direito Administrativo': '🏛️',
            'Direito Civil': '📋',
            'Direito Penal': '⚡',
            'Matemática': '🧮',
            'Português': '📚',
            'Informática': '💻',
            'default': '📖'
        };

        const topicsHtml = parts.map(part => {
            const lines = part.split('\n');
            const subjectName = lines.shift().replace(/\*\*/g, '');
            const icon = disciplineIcons[subjectName] || disciplineIcons.default;
            const topicList = lines.map(line => `
                <li class="flex items-start space-x-3 py-2 px-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                    <span class="text-yellow-600 font-bold mt-1">•</span>
                    <span class="text-gray-700">${line.replace(/• /g, '').trim()}</span>
                </li>
            `).join('');
            return `
                <div class="bg-white/80 p-5 rounded-2xl border-2 border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300 mb-4">
                    <h4 class="font-bold text-gray-800 mb-4 flex items-center text-lg">
                        <span class="text-2xl mr-3">${icon}</span>
                        ${subjectName}
                        <span class="ml-2 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium">
                            ${lines.length} ${lines.length === 1 ? 'tópico' : 'tópicos'}
                        </span>
                    </h4>
                    <ul class="space-y-2">${topicList}</ul>
                </div>
            `;
        }).join('');

        return `
            <div id="session-card-${session.id}" class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col h-full p-8 rounded-3xl shadow-xl border-l-4 ${style.color} ${cardBg} transform transition-all duration-300 hover:shadow-2xl group border-2 border-yellow-300">
                <!-- Header aprimorado -->
                <div class="flex-grow">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex-1">
                            <div class="flex items-center space-x-4 mb-4">
                                <div class="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                                    <span class="text-3xl">📚</span>
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center space-x-3 mb-2">
                                        <h3 class="font-bold text-2xl ${isCompleted ? 'text-gray-600' : 'text-gray-800'} group-hover:text-gray-900 transition-colors">
                                            ${app.sanitizeHtml(session.subject_name)}
                                        </h3>
                                        <span class="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                            REVISÃO
                                        </span>
                                    </div>
                                    <p class="text-base font-semibold text-gray-600">Consolidação de Conhecimento</p>
                                    <p class="text-sm text-gray-500">Reforço dos tópicos estudados</p>
                                </div>
                            </div>
                        </div>
                        <!-- Indicador visual -->
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Conteúdo principal -->
                    <div class="bg-white/80 p-6 rounded-2xl border-2 border-yellow-200 mb-6">
                        <p class="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                            <span class="text-2xl mr-3">🎯</span>
                            ${mainTitle}
                        </p>
                        <div class="prose prose-sm max-w-none">${topicsHtml}</div>
                    </div>
                </div>
                
                <!-- Ação melhorada -->
                <div class="mt-auto pt-6 border-t-2 ${isCompleted ? 'border-green-200' : 'border-yellow-200'}">
                    ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center text-green-600 font-bold py-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl hover:from-green-100 hover:to-emerald-100 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg mb-3">
                            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                                <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                            </div>
                            <span class="text-xl">Revisão Concluída!</span>
                            <span class="ml-4 text-3xl animate-bounce group-hover/btn:scale-110 transition-transform">🎉</span>
                        </button>
                        <!-- Botões secundários -->
                        <div class="flex space-x-3">
                            <button onclick='reinforceSession(${session.id})' class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">💪</span>
                                <span>Reforçar</span>
                            </button>
                            <button onclick='openPostponeModal(${session.id})' class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">📅</span>
                                <span>Adiar</span>
                            </button>
                        </div>
                    ` : `
                        <button onclick='markReviewAsCompleted(${session.id})' class="group/btn w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-4 mb-3">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <span class="text-xl">Marcar como Concluída</span>
                            <span class="text-2xl group-hover/btn:animate-bounce">📚</span>
                        </button>
                        <!-- Botões secundários -->
                        <div class="flex space-x-3">
                            <button onclick='reinforceSession(${session.id})' class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">💪</span>
                                <span>Reforçar</span>
                            </button>
                            <button onclick='openPostponeModal(${session.id})' class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2">
                                <span class="text-xl">📅</span>
                                <span>Adiar</span>
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    // VERSÃO CORRIGIDA: Dashboard de gamificação com métricas precisas
    // Método para atualizar avatar na navegação após mudança no perfil
    async updateNavigationAvatar() {
        this.clearUserAvatarCache();
        const navAvatar = document.getElementById('nav-user-avatar');
        if (navAvatar) {
            const newAvatar = await this.loadUserAvatar();
            if (newAvatar) {
                const sanitizedAvatarPath = app.sanitizeHtml(newAvatar);
                
                // Handle Google avatars vs local avatars
                let avatarUrl;
                if (sanitizedAvatarPath.startsWith('https://')) {
                    // Google avatar - use directly
                    avatarUrl = sanitizedAvatarPath;
                } else if (sanitizedAvatarPath.startsWith('/')) {
                    // Local avatar with absolute path
                    avatarUrl = sanitizedAvatarPath + '?t=' + new Date().getTime();
                } else {
                    // Local avatar - add relative path and cache buster
                    avatarUrl = (sanitizedAvatarPath.startsWith('./') ? sanitizedAvatarPath : './' + sanitizedAvatarPath) + '?t=' + new Date().getTime();
                }
                
                navAvatar.src = avatarUrl;
                navAvatar.style.display = 'block';
                navAvatar.nextElementSibling.style.display = 'none';
            } else {
                navAvatar.style.display = 'none';
                navAvatar.nextElementSibling.style.display = 'flex';
            }
        }
    },

    renderGamificationDashboard(gamificationData, containerId) {
        // Delegar para o módulo gamification dedicado
        if (window.Gamification && window.Gamification.renderGamificationDashboard) {
            return window.Gamification.renderGamificationDashboard(gamificationData, containerId);
        } else {
            console.warn('Módulo Gamification não disponível');
        }
    },
    
    // Função para atualizar todos os botões de sessão quando timers mudam de estado
    updateAllTimerButtons() {
        const timerButtons = document.querySelectorAll('.timer-aware-button');
        timerButtons.forEach(button => {
            const sessionId = button.getAttribute('onclick').match(/\d+/)[0];
            if (sessionId) {
                this.updateTimerButton(sessionId);
            }
        });
    },
    
    // CORREÇÃO: Função para atualizar um botão específico com estado preciso
    updateTimerButton(sessionId) {
        const buttons = document.querySelectorAll(`button[onclick*="window.openStudySession(${sessionId})"], .timer-aware-button[onclick*="window.openStudySession(${sessionId})"]`);
        if (buttons.length === 0) return;
        
        buttons.forEach(button => {
            const buttonText = button.querySelector('.button-text');
            const buttonIcon = button.querySelector('.button-icon');
            
            // Gerar informações do botão baseado no estado atual
            const currentText = buttonText ? buttonText.textContent.replace(/Continuar \([^)]+\)/, '').replace('Continuar', 'Iniciar').trim() : 'Iniciar Estudo';
            const smartButton = this.generateSmartButton(sessionId, currentText || 'Iniciar Estudo');
            
            if (buttonText && buttonIcon) {
                // Atualizar elementos internos
                buttonText.textContent = smartButton.text;
                buttonIcon.textContent = smartButton.icon;
            } else {
                // Atualizar conteúdo direto do botão
                button.innerHTML = `${smartButton.icon} ${smartButton.text}`;
            }
            
            // Limpar classes antigas
            button.classList.remove(
                'bg-gradient-to-r', 'from-blue-600', 'to-purple-600', 'hover:from-blue-700', 'hover:to-purple-700',
                'from-yellow-500', 'to-orange-500', 'hover:from-yellow-600', 'hover:to-orange-600',
                'animate-pulse', 'bg-orange-500', 'hover:bg-orange-600', 'border-2', 'border-orange-300'
            );
            
            // Adicionar novas classes
            const classArray = smartButton.classes.split(' ').filter(c => c.trim());
            button.classList.add(...classArray);
            
            // Button updated for session
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    components.renderGlobalUI();
    
    // Atualizar botões a cada 5 segundos para refletir timers ativos
    setInterval(() => {
        if (typeof components !== 'undefined' && components.updateAllTimerButtons) {
            components.updateAllTimerButtons();
        }
    }, 5000);
});

// Expor componentes globalmente
window.components = components;
