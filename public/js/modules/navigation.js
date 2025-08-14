/**
 * @file js/modules/navigation.js  
 * @description Navigation system with user avatar management
 * @version 2.0 - Modularized for performance
 */

export const Navigation = {
    // Cache do avatar do usuário para evitar múltiplas requisições
    userAvatarCache: null,
    userAvatarCacheTime: null,
    userAvatarCacheTimeout: 2 * 60 * 1000, // 2 minutos para atualizações mais rápidas

    // Carregar dados do usuário (avatar) para a navegação
    async loadUserAvatar() {
        // Verificar se há cache válido
        const now = Date.now();
        if (this.userAvatarCache && this.userAvatarCacheTime && 
            (now - this.userAvatarCacheTime) < this.userAvatarCacheTimeout) {
            console.log('🎯 Usando avatar do cache:', this.userAvatarCache);
            return this.userAvatarCache;
        }

        try {
            console.log('🔄 Carregando avatar do servidor...');
            const userProfile = await window.app.apiFetch('/users/profile');
            
            // Check if user has Google avatar or local avatar
            let avatar = null;
            if (userProfile.google_avatar && userProfile.auth_provider === 'google') {
                avatar = userProfile.google_avatar;
                console.log('✅ Avatar do Google carregado:', avatar);
            } else if (userProfile.profile_picture) {
                avatar = userProfile.profile_picture;
                console.log('✅ Avatar local carregado:', avatar);
            } else {
                console.log('⚠️ Nenhum avatar encontrado no perfil');
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

        // Obter planId do localStorage para incluir nos links do dropdown
        const currentPlanId = localStorage.getItem(window.app?.config?.planKey || 'selectedPlanId');
        
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

        let linksHtml = links.map(link => {
            if (link.dropdown) {
                // Dropdown menu
                const dropdownItems = link.dropdown.map(item => 
                    `<a href="${item.href}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-editaliza-blue transition-colors">${item.text}</a>`
                ).join('');
                
                return `
                    <div class="relative group">
                        <button class="nav-link-default px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50 flex items-center">
                            ${link.text}
                            <svg class="inline w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div class="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            ${dropdownItems}
                        </div>
                    </div>
                `;
            } else {
                // Regular link
                const isActive = activePage === link.href;
                const linkClass = isActive ? 'nav-link-active' : 'nav-link-default';
                return `<a href="${link.href}" class="${linkClass} px-4 py-2 rounded-lg text-sm font-medium transition-colors">${link.text}</a>`;
            }
        }).join('');
        
        // Carregar avatar do usuário
        const userAvatar = await this.loadUserAvatar();
        
        // Criar HTML do perfil com ou sem avatar
        const profileHtml = this.generateProfileHtml(userAvatar);
        
        navContainer.innerHTML = `
            ${this.getNavigationStyles()}
            <header class="bg-white border-b border-gray-200 shadow-sm">
                <div class="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex justify-between items-center h-16">
                        <div class="flex items-center">
                            <a href="home.html" class="flex-shrink-0 flex items-center">
                                ${this.getLogoSvg()}
                            </a>
                        </div>
                        <nav class="hidden md:flex items-center space-x-1">
                            ${linksHtml}
                        </nav>
                        <div class="flex items-center space-x-3">
                            ${profileHtml}
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
        
        // Adicionar event listener para logout
        document.getElementById('logoutButton').addEventListener('click', () => {
            if (window.app?.logout) {
                window.app.logout();
            }
        });
    },

    // Gerar HTML do perfil do usuário
    generateProfileHtml(userAvatar) {
        if (userAvatar) {
            // Sanitizar o caminho do avatar
            const sanitizedAvatarPath = window.app?.sanitizeHtml ? window.app.sanitizeHtml(userAvatar) : userAvatar;
            
            // Melhor tratamento de URLs de avatar (Google vs Local)
            let avatarUrl;
            if (sanitizedAvatarPath.startsWith('https://')) {
                // Avatar do Google - usar diretamente
                avatarUrl = sanitizedAvatarPath;
            } else if (sanitizedAvatarPath.startsWith('/')) {
                // Avatar local com caminho absoluto
                avatarUrl = sanitizedAvatarPath + '?t=' + new Date().getTime();
            } else {
                // Avatar local relativo - adicionar cache buster e prefixo
                avatarUrl = (sanitizedAvatarPath.startsWith('./') ? sanitizedAvatarPath : './' + sanitizedAvatarPath) + '?t=' + new Date().getTime();
            }
            
            return `
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
            return `
                <a href="profile.html" class="hidden sm:flex items-center space-x-2 text-sm font-medium text-editaliza-gray hover:text-editaliza-black transition-all duration-200 group">
                    <div class="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white group-hover:from-editaliza-blue group-hover:to-indigo-600 transition-all duration-200 shadow-sm">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <span class="hidden md:inline group-hover:text-editaliza-blue transition-colors duration-200">Perfil</span>
                </a>`;
        }
    },

    // Estilos CSS da navegação
    getNavigationStyles() {
        return `
            <style>
                .nav-link-active {
                    background: linear-gradient(135deg, #0528f2, #3b82f6);
                    color: white;
                    border-radius: 0.5rem;
                }
                .nav-link-default {
                    color: #374151;
                }
                .nav-link-default:hover {
                    background-color: #f3f4f6;
                    color: #111827;
                }
                .btn-secondary {
                    background: white;
                    color: #374151;
                    border: 1px solid #d1d5db;
                    border-radius: 0.5rem;
                    padding: 0.5rem 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .btn-secondary:hover {
                    background: #f9fafb;
                    border-color: #9ca3af;
                }
            </style>
        `;
    },

    // Logo SVG da Editaliza
    getLogoSvg() {
        return `
            <svg id="logo-header" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510.24 101.5" class="h-8 w-auto">
                <defs>
                    <style>
                      .cls-1 { fill: #0528f2; }
                      .cls-2 { fill: #0d0d0d; }
                      .cls-3 { fill: #1ad937; }
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
        `;
    },

    // Renderizar header de plano específico
    renderPlanHeader(planId, planName, activePage) {
        const headerContainer = document.getElementById('plan-header-container');
        if (!headerContainer) return;

        const safePlanName = window.app?.sanitizeHtml ? window.app.sanitizeHtml(planName) : planName;

        const links = [
            { id: 'navPerformance', href: `plan.html?id=${planId}`, text: 'Meu Desempenho' },
            { id: 'navSchedule', href: `cronograma.html?id=${planId}`, text: 'Ver Cronograma' },
            { id: 'navSettings', href: `plan_settings.html?id=${planId}`, text: 'Configurar Plano' }
        ];

        let linksHtml = links.map(link => {
            const isActive = activePage === link.href.split('?')[0];
            const activeClass = 'bg-editaliza-blue text-white cursor-default';
            const defaultClass = 'bg-white hover:bg-gray-100 text-gray-700';
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

    // Método para atualizar avatar na navegação após mudança no perfil
    async updateNavigationAvatar() {
        this.clearUserAvatarCache();
        const navAvatar = document.getElementById('nav-user-avatar');
        if (navAvatar) {
            const newAvatar = await this.loadUserAvatar();
            if (newAvatar) {
                const sanitizedAvatarPath = window.app?.sanitizeHtml ? window.app.sanitizeHtml(newAvatar) : newAvatar;
                
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
    }
};

// Disponibilizar globalmente para compatibilidade
window.Navigation = Navigation;