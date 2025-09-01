/**
 * @file js/app.js
 * @description Script principal da aplica��o, gerenciando estado, chamadas de API e utilit�rios.
 * Vers�o com melhorias de seguran�a.
 */

const app = {
    state: {
        token: null,
        plans: [],
        activePlanId: null,
        activePlanData: {}, 
        overdueTasks: { count: 0, checked: false }
    },

    // Configura��es de seguran�a
    config: {
        apiUrl: window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin,
        tokenKey: 'editaliza_token',
        planKey: 'selectedPlanId',
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 horas em ms
        
        // x Configura��es do Sistema de Notifica��es Inteligentes
        notifications: {
            enabled: true,
            maxPerDay: 6,
            cooldown: 300000, // 5 minutos
            showWelcome: true,
            showMilestones: true,
            showTimingTips: true,
            showProcrastinationNudges: true,
            showSessionCompletion: true,
            showAchievements: true
        }
    },

    async init() {
        // Limpar token se expirado
        this.checkTokenExpiry();
        
        this.state.token = localStorage.getItem(this.config.tokenKey);
        
        // P�ginas que n�o requerem autentica��o
        const publicPages = ['/login.html', '/register.html', '/forgot-password.html', '/reset-password.html'];
        const currentPath = window.location.pathname;
        const isPublicPage = publicPages.some(page => currentPath.includes(page));
        
        if (!this.state.token && !isPublicPage) {
            window.location.href = 'login.html';
            return;
        }
        
        // Configurar interceptador para renovar token se necess�rio
        if (this.state.token) {
            this.setupTokenRefresh();
        }

        // x INICIALIZAR SISTEMA DE NOTIFICA!"ES INTELIGENTES
        await this.initializeNotificationSystem();
    },

    // x Sistema de Notifica��es Inteligentes
    async initializeNotificationSystem() {
        try {
            // Inicializando Sistema de Notifica��es Inteligentes...
            
            // Aguardar carregamento dos m�dulos
            const modulesLoaded = await this.waitForNotificationModules();
            
            if (modulesLoaded) {
                // Inicializar sistema de notifica��es contextuais
                if (window.ContextualNotifications) {
                    await window.ContextualNotifications.init();
                    // ContextualNotifications inicializado
                }
                
                // Inicializar integra��es de notifica��o
                if (window.NotificationIntegrations) {
                    await window.NotificationIntegrations.init();
                    // NotificationIntegrations inicializado
                }
                
                // Sistema de Notifica��es Inteligentes ativado com sucesso!
            } else {
                // Sistema de Notifica��es executando em modo simplificado
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao inicializar sistema de notificações:', error);
            // N�o quebra a aplica��o se as notifica��es falharem
        }
    },

    // Aguardar m�dulos de notifica��o estarem dispon�veis
    async waitForNotificationModules(maxWait = 10000) {
        const startTime = Date.now();
        let attempts = 0;
        const maxAttempts = 100; // M�ximo 100 tentativas
        
        while (Date.now() - startTime < maxWait && attempts < maxAttempts) {
            attempts++;
            
            try {
                if (window.ContextualNotifications && window.NotificationIntegrations) {
                    // M�dulos de notifica��o carregados
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`⚠️ Erro na tentativa ${attempts}:`, error);
                break; // Sair do loop em caso de erro
            }
        }
        
        console.warn(`⚠️ Módulos de notificação não carregaram após ${attempts} tentativas (${Date.now() - startTime}ms)`);
        return false;
    },

    // Verificar se o token expirou
    checkTokenExpiry() {
        const token = localStorage.getItem(this.config.tokenKey);
        if (!token) return;
        
        try {
            // Decodificar o payload do JWT (sem verificar assinatura no frontend)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiryTime = payload.exp * 1000; // converter para ms
            
            if (Date.now() > expiryTime) {
                this.logout();
            }
        } catch (error) {
            // Token inv�lido, fazer logout
            this.logout();
        }
    },

    // Configurar renova��o autom�tica de token
    setupTokenRefresh() {
        // Verificar token a cada 30 minutos
        setInterval(() => {
            this.checkTokenExpiry();
        }, 30 * 60 * 1000);
    },

    // Sanitizar dados antes de inserir no DOM
    sanitizeHtml(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    // Validar URL antes de redirecionar
    isValidUrl(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            // Permitir apenas URLs do mesmo dom�nio
            return urlObj.origin === window.location.origin;
        } catch {
            return false;
        }
    },

    async apiFetch(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.state.token}`
            }
        };
        const config = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...options.headers } };

        try {
            // Normalizar endpoint para evitar '/api/api' e suportar '/auth', '/plans', etc.
            let fullUrl;
            if (typeof url !== 'string') {
                throw new Error('endpoint deve ser string');
            }
            if (url.startsWith('http://') || url.startsWith('https://')) {
                fullUrl = url;
            } else if (url.startsWith('/api/')) {
                fullUrl = `${this.config.apiUrl}${url}`;
            } else if (url.startsWith('/')) {
                fullUrl = `${this.config.apiUrl}/api${url}`;
            } else {
                fullUrl = `${this.config.apiUrl}/api/${url}`;
            }

            console.log('Fazendo requisição para:', fullUrl);
            console.log('Método:', config.method || 'GET');
            console.log('Token presente?', !!this.state.token);
            console.log('Headers:', config.headers);
            console.log('Body:', config.body);
            
            const response = await fetch(fullUrl, config);
            
            console.log('Status da resposta:', response.status);

            // Tratamento espec�fico para respostas vazias
            let data = {};
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (jsonError) {
                    console.warn('Resposta JSON inv�lida:', jsonError);
                    data = {};
                }
            }

            if (response.status === 401 || response.status === 403) {
                this.logout();
                throw new Error('Sua sess�o expirou. Por favor, fa�a o login novamente.');
            }

            if (!response.ok) {
                throw new Error(data.error || `Erro na requisi��o: ${response.statusText}`);
            }
            
            return data;
        } catch (error) {
            // Se for erro de rede, tentar mostrar mensagem mais amig�vel
            if (error.message === 'Failed to fetch') {
                throw new Error('Erro de conex�o. Verifique sua internet e tente novamente.');
            }
            console.error('API Fetch Error:', error);
            throw error;
        }
    },

    // Check if user is authenticated
    isAuthenticated() {
        const token = localStorage.getItem(this.config.tokenKey);
        if (!token) return false;
        
        try {
            // Decode JWT payload to check expiry
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiryTime = payload.exp * 1000; // convert to ms
            
            if (Date.now() > expiryTime) {
                return false;
            }
            
            return true;
        } catch (error) {
            // Invalid token
            return false;
        }
    },

    logout() {
        // Limpar todos os dados sens�veis
        localStorage.removeItem(this.config.tokenKey);
        localStorage.removeItem(this.config.planKey);
        sessionStorage.clear();
        
        // Limpar estado
        this.state = { 
            token: null, 
            plans: [], 
            activePlanId: null, 
            activePlanData: {},
            overdueTasks: { count: 0, checked: false }
        };
        
        // Limpar cache do avatar
        if (typeof components !== 'undefined' && components.clearUserAvatarCache) {
            components.clearUserAvatarCache();
        }
        
        // Fazer logout no servidor (se poss�vel)
        if (this.state.token) {
            this.apiFetch('/api/logout', {
                method: 'POST'
            }).catch(() => {
                // Ignorar erros de logout
            });
        }
        
        window.location.href = 'login.html';
    },

    async getPlans(forceRefresh = false) {
        if (this.state.plans.length > 0 && !forceRefresh) {
            return this.state.plans;
        }
        const plans = await this.apiFetch('/plans');
        this.state.plans = plans;
        return plans;
    },

    // Logging inteligente - s� loga quando necess�rio
    _smartLog(key, message, data = null, level = 'log') {
        const logKey = `_lastLog_${key}`;
        const now = Date.now();
        
        // N�o logar a mesma mensagem mais de uma vez por minuto
        if (this[logKey] && (now - this[logKey]) < 60000) {
            return;
        }
        
        this[logKey] = now;
        if (data) {
            console[level](message, data);
        } else {
            console[level](message);
        }
    },

    // CORRE!�O: Melhorar fun��o de dados do plano com log detalhado
    async getActivePlanData(planId, dataType, forceRefresh = false) {
        // Validar inputs
        if (!planId || !dataType) {
            throw new Error('ID do plano e tipo de dados s�o obrigat�rios');
        }
        
        // Buscando dados
        
        // Se for for�ar refresh, invalidar cache primeiro
        if (forceRefresh) {
            this.invalidatePlanCache(planId, dataType);
        }
        
        // Verificar se j� temos dados em cache e n�o � for�ado
        if (this.state.activePlanData[planId] && this.state.activePlanData[planId][dataType] && !forceRefresh) {
            // Usando dados em cache
            return this.state.activePlanData[planId][dataType];
        }

        if (!this.state.activePlanData[planId]) {
            this.state.activePlanData[planId] = {};
        }
        
        // Buscando dados frescos da API
        const data = await this.apiFetch(`/plans/${planId}/${dataType}`);
        
        // Salvar no cache
        this.state.activePlanData[planId][dataType] = data;
        // Dados atualizados no cache
        
        return data;
    },
    
    async getGamificationData(planId) {
        if (!planId) throw new Error('ID do plano � necess�rio para buscar dados de gamifica��o.');
        return await this.apiFetch(`/plans/${planId}/gamification`);
    },

    // CORRE!�O: Melhorar sistema de invalida��o de cache com logs
    invalidatePlanCache(planId, dataType = null) {
        if (!planId) {
            console.warn('⚠️ Tentativa de invalidar cache sem planId');
            return;
        }
        
        if (this.state.activePlanData[planId]) {
            if (dataType) {
                void(`x? Invalidando cache de ${dataType} para plano ${planId}`);
                delete this.state.activePlanData[planId][dataType];
            } else {
                void(`x? Invalidando todo o cache do plano ${planId}`);
                delete this.state.activePlanData[planId];
            }
        } else {
            void(`x9 Cache j� vazio para plano ${planId}`);
        }
    },

    showToast(message, type = 'success', force = false) {
        // Se force=true, usar implementa��o direta sem passar por sistemas de notifica��o
        if (force) {
            return this.forceShowToast(message, type);
        }
        
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? '?' : '?';
        
        // Sanitizar mensagem
        const safeMessage = this.sanitizeHtml(message);
        
        toast.className = `p-4 rounded-lg text-white shadow-lg ${bgColor} transform transition-all duration-300 translate-x-full opacity-0 flex items-center space-x-2`;
        toast.innerHTML = `<span class="text-xl">${icon}</span><span>${safeMessage}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Animar entrada
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
        
        // Remover ap�s 3 segundos
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, { once: true });
        }, 3000);
    },
    
    // M�todo para for�ar exibi��o de toast cr�tico (bypassa cooldowns)
    forceShowToast(message, type = 'success') {
        // Criar container se n�o existir
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'fixed top-5 right-5 z-50 space-y-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-yellow-500';
        const icon = type === 'success' ? '?' : type === 'error' ? '?' : '??';
        
        // Sanitizar mensagem
        const safeMessage = this.sanitizeHtml(message);
        
        // Usar z-index alto para garantir visibilidade
        toast.className = `p-4 rounded-lg text-white shadow-lg ${bgColor} transform transition-all duration-300 translate-x-full opacity-0 flex items-center space-x-2`;
        toast.style.zIndex = '9999';
        toast.innerHTML = `<span class="text-xl">${icon}</span><span>${safeMessage}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Animar entrada
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
        
        // Remover ap�s 4 segundos (um pouco mais para toasts importantes)
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, { once: true });
        }, 4000);
        
        console.log('? Toast for�ado exibido:', message);
    },

    showSpinner() {
        const spinner = document.getElementById('spinner-overlay');
        if (spinner) {
            spinner.classList.remove('hidden');
            // Prevenir m�ltiplos spinners
            spinner.dataset.count = (parseInt(spinner.dataset.count || 0) + 1).toString();
        }
    },

    hideSpinner() {
        const spinner = document.getElementById('spinner-overlay');
        if (spinner) {
            const count = parseInt(spinner.dataset.count || 1) - 1;
            spinner.dataset.count = count.toString();
            
            if (count <= 0) {
                spinner.classList.add('hidden');
                spinner.dataset.count = '0';
            }
        }
    },
    
        getSubjectStyle(name) {
        if (!name) return { color: 'border-gray-400', icon: '\uD83D\uDCDA' }; // ??

        // Sistema expandido de cores por disciplina para melhor identidade visual
        const predefined = {
            // Disciplinas Jur�dicas - Mantendo cores existentes e expandindo
            'Constitucional': { color: 'border-green-500', icon: '\u2696\uFE0F' }, // ??
            'Administrativo': { color: 'border-red-500', icon: '\uD83C\uDFDB\uFE0F' }, // ???
            'Portugu�s': { color: 'border-orange-500', icon: '\uD83D\uDCD8' }, // ??
            'Civil': { color: 'border-blue-500', icon: '\uD83D\uDCD7' }, // ??
            'Racioc�nio L�gico': { color: 'border-cyan-500', icon: '\uD83E\uDDE0' }, // ??
            'Racioc�nio': { color: 'border-cyan-500', icon: '\uD83E\uDDE0' }, // ??
            'L�gico': { color: 'border-cyan-500', icon: '\uD83E\uDDE0' }, // ??
            'Matem�tica': { color: 'border-cyan-500', icon: '\uD83D\uDCCA' }, // ??
            'Processual Civil': { color: 'border-sky-500', icon: '\uD83D\uDCD8' }, // ??
            'Penal': { color: 'border-rose-500', icon: '\uD83D\uDE94' }, // ??
            'Processual Penal': { color: 'border-pink-500', icon: '\uD83D\uDC69\u200D\u2696\uFE0F' }, // ?????
            'Legisla��o': { color: 'border-purple-500', icon: '\uD83D\uDCDC' }, // ??
            'Tribut�rio': { color: 'border-yellow-600', icon: '\uD83D\uDCB0' }, // ??
            'Trabalhista': { color: 'border-amber-500', icon: '\uD83D\uDC54' }, // ??
            'Empresarial': { color: 'border-indigo-500', icon: '\uD83C\uDFE2' }, // ??
            
            // Tipos de Sess�o - Mantendo existentes
            'Revis�o Consolidada': { color: 'border-yellow-400', icon: '\uD83D\uDD01' }, // ??
            'Revis�o Semanal': { color: 'border-yellow-400', icon: '\uD83D\uDD01' }, // ??
            'Revis�o Mensal': { color: 'border-amber-500', icon: '\uD83D\uDCC5' }, // ??
            'Refor�o Extra': { color: 'border-indigo-500', icon: '\uD83D\uDCAA' }, // ??
            'Simulado Direcionado': { color: 'border-purple-500', icon: '\uD83C\uDFAF' }, // ??
            'Simulado Completo': { color: 'border-slate-700', icon: '\uD83E\uDDE9' }, // ??
            'Reda��o': { color: 'border-rose-500', icon: '\u270D\uFE0F' }, // ??
            
            // Disciplinas T�cnicas
            'Inform�tica': { color: 'border-purple-600', icon: '\uD83D\uDCBB' }, // ??
            'Tecnologia': { color: 'border-purple-600', icon: '\u26A1' }, // ?
            'Computa��o': { color: 'border-purple-600', icon: '\uD83D\uDDA5\uFE0F' }, // ???
            'Sistemas': { color: 'border-purple-600', icon: '\uD83D\uDD27' }, // ??
            'Redes': { color: 'border-purple-600', icon: '\uD83C\uDF10' }, // ??
            'Seguran�a': { color: 'border-purple-600', icon: '\uD83D\uDD12' }, // ??
            
            // Disciplinas de Gest�o
            'Administra��o': { color: 'border-orange-600', icon: '\uD83D\uDCCA' }, // ??
            'Gest�o': { color: 'border-orange-600', icon: '\uD83D\uDC68\u200D\uD83D\uDCBC' }, // ?????
            'Economia': { color: 'border-orange-600', icon: '\uD83D\uDCB9' }, // ??
            'Contabilidade': { color: 'border-orange-600', icon: '\uD83D\uDCC8' }, // ??
            'Financeira': { color: 'border-orange-600', icon: '\uD83D\uDCB0' }, // ??
            'Or�amento': { color: 'border-orange-600', icon: '\uD83D\uDCB5' }, // ??
            
            // Disciplinas de Sa�de
            'Sa�de': { color: 'border-teal-500', icon: '\uD83C\uDFE5' }, // ??
            'Medicina': { color: 'border-teal-500', icon: '\u2695\uFE0F' }, // ??
            'Enfermagem': { color: 'border-teal-500', icon: '\uD83D\uDC69\u200D\u2695\uFE0F' }, // ?????
            'Farm�cia': { color: 'border-teal-500', icon: '\uD83D\uDC8A' }, // ??
            'Psicologia': { color: 'border-teal-500', icon: '\uD83E\uDDE0' }, // ??
            
            // Disciplinas de Educa��o
            'Educa��o': { color: 'border-pink-600', icon: '\uD83C\uDF93' }, // ??
            'Pedagogia': { color: 'border-pink-600', icon: '\uD83D\uDCDA' }, // ??
            'Did�tica': { color: 'border-pink-600', icon: '\uD83D\uDC69\u200D\uD83C\uDFEB' }, // ?????
            
            // Disciplinas de Engenharia
            'Engenharia': { color: 'border-yellow-500', icon: '\u2699\uFE0F' }, // ??
            'Arquitetura': { color: 'border-yellow-500', icon: '\uD83C\uDFD7\uFE0F' }, // ???
            'Urbanismo': { color: 'border-yellow-500', icon: '\uD83C\uDF06' }, // ??
            
            // Conhecimentos Gerais
            'Hist�ria': { color: 'border-amber-600', icon: '\uD83C\uDFDB\uFE0F' }, // ???
            'Geografia': { color: 'border-emerald-500', icon: '\uD83C\uDF0D' }, // ??
            'Sociologia': { color: 'border-indigo-600', icon: '\uD83D\uDC65' }, // ??
            'Filosofia': { color: 'border-violet-500', icon: '\uD83E\uDD14' }, // ??
            'Atualidades': { color: 'border-cyan-600', icon: '\uD83D\uDCF0' }, // ??
            'Conhecimentos Gerais': { color: 'border-slate-500', icon: '\uD83C\uDF10' }, // ??
            'Realidade': { color: 'border-slate-500', icon: '\uD83C\uDFD9\uFE0F' } // ???
        };

        // Busca exata primeiro
        if (predefined[name]) {
            return predefined[name];
        }
        
        // Busca por palavras-chave (case insensitive)
        const normalizedName = name.toLowerCase();
        for (const keyword in predefined) {
            if (normalizedName.includes(keyword.toLowerCase())) {
                return predefined[keyword];
            }
        }

        // Cores de fallback mais vibrantes e diversificadas
        const fallbackColors = [
            { color: 'border-blue-500', icon: '\uD83D\uDCDA' }, // ??
            { color: 'border-green-500', icon: '\uD83D\uDCD7' }, // ??
            { color: 'border-red-500', icon: '\uD83D\uDCD5' }, // ??
            { color: 'border-purple-500', icon: '\uD83D\uDCD8' }, // ??
            { color: 'border-orange-500', icon: '\uD83D\uDCD9' }, // ??
            { color: 'border-teal-500', icon: '\uD83D\uDCC4' }, // ??
            { color: 'border-pink-500', icon: '\uD83D\uDCD6' }, // ??
            { color: 'border-cyan-500', icon: '\uD83D\uDCDC' }, // ??
            { color: 'border-yellow-500', icon: '\uD83D\uDCC3' }, // ??
            { color: 'border-indigo-500', icon: '\uD83D\uDCC1' }, // ??
        ];

        // Hash consistente baseado no nome
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            const char = name.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const index = Math.abs(hash % fallbackColors.length);
        return fallbackColors[index];
    },

    // Fun��o para validar dados de entrada
    validateInput(value, type, options = {}) {
        switch (type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(value);
                
            case 'password':
                return value.length >= options.minLength || 6;
                
            case 'date':
                const date = new Date(value);
                return !isNaN(date.getTime()) && date > new Date();
                
            case 'number':
                const num = Number(value);
                return !isNaN(num) && 
                       (options.min === undefined || num >= options.min) && 
                       (options.max === undefined || num <= options.max);
                       
            case 'text':
                return value.length >= (options.minLength || 0) && 
                       value.length <= (options.maxLength || Infinity);
                       
            default:
                return true;
        }
    },

    // Debounce para evitar m�ltiplas chamadas
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Salvar dados localmente de forma segura
    saveLocal(key, data) {
        try {
            const encrypted = btoa(JSON.stringify(data));
            localStorage.setItem(`editaliza_${key}`, encrypted);
        } catch (error) {
            console.error('Erro ao salvar dados localmente:', error);
        }
    },

    // Recuperar dados locais
    getLocal(key) {
        try {
            const encrypted = localStorage.getItem(`editaliza_${key}`);
            if (!encrypted) return null;
            return JSON.parse(atob(encrypted));
        } catch (error) {
            console.error('Erro ao recuperar dados locais:', error);
            return null;
        }
    },

    // Sistema de debounce para evitar m�ltiplas chamadas r�pidas
    _debounceGamificationCalls(planId, forceRefresh, callback) {
        const key = `${planId}_${forceRefresh}`;
        if (!this._gamificationDebounce) this._gamificationDebounce = {};
        
        // Cancelar chamada anterior se existir
        if (this._gamificationDebounce[key]) {
            clearTimeout(this._gamificationDebounce[key]);
        }
        
        // Agendar nova chamada com delay m�nimo
        this._gamificationDebounce[key] = setTimeout(callback, forceRefresh ? 0 : 100);
    },

    // CORRE!�O: Fun��o de gamifica��o sempre busca dados frescos quando solicitado
    async getGamificationData(planId, forceRefresh = false) {
        // Sistema de debounce para evitar chamadas excessivas
        return new Promise((resolve, reject) => {
            this._debounceGamificationCalls(planId, forceRefresh, async () => {
                try {
                    await this._getGamificationDataInternal(planId, forceRefresh).then(resolve).catch(reject);
                } catch (error) {
                    reject(error);
                }
            });
        });
    },

    async _getGamificationDataInternal(planId, forceRefresh = false) {
        try {
            // Log apenas se for for�ado ou primeira chamada
            if (forceRefresh || !this._gamificationDataCache?.[planId]) {
                void('x` Carregando dados de gamifica��o...', forceRefresh ? '(for�ado)' : '');
            }
            
            // CORRE!�O: Usar getActivePlanData para aproveitar o sistema de cache
            const response = await this.getActivePlanData(planId, 'gamification', forceRefresh);
            
            // Cache simples para controlar logs
            if (!this._gamificationDataCache) this._gamificationDataCache = {};
            const previousData = this._gamificationDataCache[planId];
            
            // S� logar se houve mudan�a significativa nos dados
            if (!previousData || 
                previousData.completedTopicsCount !== response.completedTopicsCount ||
                previousData.concurseiroLevel !== response.concurseiroLevel) {
                void('S& Dados atualizados:', {
                    nivel: response.concurseiroLevel,
                    topicos: response.completedTopicsCount,
                    streak: response.studyStreak
                });
                this._gamificationDataCache[planId] = response;
            }
            
            return response;
        } catch (error) {
            console.error('❌ Erro gamificação:', error.message || error);
            // Fallback com dados b�sicos
            return {
                studyStreak: 0,
                totalStudyDays: 0,
                experiencePoints: 0,
                concurseiroLevel: 'Aspirante a Servidor(a) xR',
                achievements: [],
                completedTopicsCount: 0,
                totalCompletedSessions: 0,
                currentStreak: 0,
                totalXP: 0,
                level: 1,
                levelName: 'Aspirante a Servidor(a) xR',
                achievementsCount: 0
            };
        }
    },

    // Fun��o para notificar atualiza��o do avatar do usu�rio
    async onUserAvatarUpdated() {
        if (typeof components !== 'undefined' && components.updateNavigationAvatar) {
            await components.updateNavigationAvatar();
        }
    },
    
    // CORRE!�O: Sistema de eventos para atualiza��o de m�tricas
    eventListeners: new Map(),
    
    // Registrar listener para eventos de atualiza��o de m�tricas
    onMetricsUpdate(callback) {
        const id = Date.now() + Math.random();
        this.eventListeners.set(id, callback);
        return id; // Retorna ID para poder remover depois
    },
    
    // Remover listener
    removeMetricsListener(id) {
        this.eventListeners.delete(id);
    },
    
    // Disparar evento de atualiza��o de m�tricas
    triggerMetricsUpdate(planId, eventType = 'session_completed') {
        void(`x Disparando evento de atualiza��o de m�tricas: ${eventType}`);
        this.eventListeners.forEach(callback => {
            try {
                callback(planId, eventType);
            } catch (error) {
                console.error('Erro em listener de m�tricas:', error);
            }
        });
    },

    // Marca sess�o como conclu�da e atualiza m�tricas/cards
    async markSessionAsCompleted(sessionId) {
        try {
            await app.apiFetch(`/sessions/${sessionId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'Concluido' })
            });

            if (window.todaySessionsData && Array.isArray(window.todaySessionsData)) {
                const idx = window.todaySessionsData.findIndex(s => String(s.id) === String(sessionId));
                if (idx !== -1) {
                    window.todaySessionsData[idx].status = 'Concluído'; // Reverted to 'Concluído'
                    window.todaySessionsData[idx].completed_at = new Date().toISOString();
                }
            }

            app.showToast('Sess�o marcada como conclu�da!', 'success');
            if (app.state?.activePlanId) {
                app.triggerMetricsUpdate(app.state.activePlanId, 'session_completed');
            }
            document.dispatchEvent(new CustomEvent('sessionCompleted', { detail: { sessionId } }));

            if (typeof updateTodayProgress === 'function') updateTodayProgress();
            if (typeof updateStudyStatistics === 'function' && app.state?.activePlanId) {
                updateStudyStatistics(app.state.activePlanId);
            }
        } catch (error) {
            console.error('Erro ao concluir sess�o:', error);
            app.showToast('Erro ao concluir sess�o. Tente novamente.', 'error');
        }
    }
};

// CORREÇÃO MISSÃO 2: Função global inteligente para abrir sessões de estudo
// Resolve problema do checklist reabrindo ao pausar cronômetro
async function openStudySession(sessionId) {
    try {
        console.log(`🎯 Iniciando sessão ${sessionId}...`);
        
        // CORREÇÃO 1: Verificar se há um timer ativo/pausado para essa sessão
        const hasActiveTimer = window.TimerSystem && TimerSystem.hasActiveTimer(sessionId);
        const hasElapsedTime = window.TimerSystem && TimerSystem.getTimerElapsed(sessionId) > 1000; // Mais de 1 segundo
        
        if (hasActiveTimer) {
            void(`? Timer ativo encontrado para sess�o ${sessionId} - continuando sem abrir checklist`);
            TimerSystem.continueTimer(sessionId);
            app.showToast('?? Timer retomado! Continue estudando.', 'success');
            return;
        }
        
        if (hasElapsedTime) {
            void(`?? Timer pausado com tempo encontrado para sess�o ${sessionId} - perguntando ao usu�rio`);
            
            // Mostrar modal de confirmação se há tempo estudado mas timer pausado
            const shouldContinue = await showContinueStudyModal(sessionId);
            
            if (shouldContinue) {
                // Continuar timer e reabrir modal do cron�metro
                const session = await fetchSessionData(sessionId);
                if (session) {
                    TimerSystem.continueTimer(sessionId);
                    // Definir sessão ANTES de montar a UI do timer
                    StudyChecklist.session = session;
                    StudyChecklist.startStudySession(false);
                    app.showToast('Continuando estudos! Timer retomado.', 'success');
                } else {
                    console.error('R N�o foi poss�vel carregar dados da sess�o');
                    app.showToast('Erro ao carregar sess�o. Tente novamente.', 'error');
                }
                return;
            }
        }
        
        // CORREÇÃO 2: Buscar dados da sessão do servidor (não do localStorage)
        const session = await fetchSessionData(sessionId);

        if (!session) {
            console.error('❌ Sessão não encontrada:', sessionId);
            app.showToast('Erro: Sessão não encontrada. Recarregue a página.', 'error');
            return;
        }

        let sessionRescheduled = false;
        // Usar hor�rio de Bras�lia corretamente
        const todayStr = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
        
        // Debug de datas
        void('x& Compara��o de datas:', {
            session_date: session.session_date,
            session_date_type: typeof session.session_date,
            todayStr: todayStr,
            comparison: session.session_date !== todayStr
        });
        
        // Converter session_date para string no formato correto se necess�rio
        let sessionDateStr = session.session_date;
        if (session.session_date instanceof Date) {
            sessionDateStr = session.session_date.toISOString().split('T')[0];
        } else if (typeof session.session_date === 'object' && session.session_date !== null) {
            sessionDateStr = new Date(session.session_date).toISOString().split('T')[0];
        } else if (typeof session.session_date === 'string' && session.session_date.includes('T')) {
            sessionDateStr = session.session_date.split('T')[0];
        }
        
        if (sessionDateStr && sessionDateStr !== todayStr) {
            const confirmReschedule = confirm('Esta sess�o estava marcada para outro dia. Deseja reagend�-la para hoje?');
            if (!confirmReschedule) {
                return;
            }

            const oldDate = session.session_date;
            try {
                await app.apiFetch(`/sessions/${sessionId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ session_date: todayStr })
                });

                session.session_date = todayStr;

                if (window.sessionsData) {
                    const idx = window.sessionsData.findIndex(s => s.id == sessionId);
                    if (idx !== -1) {
                        window.sessionsData[idx].session_date = todayStr;
                    }
                }

                if (window.fullSchedule) {
                    const oldSessions = window.fullSchedule[oldDate];
                    if (oldSessions) {
                        const index = oldSessions.findIndex(s => s.id == sessionId);
                        if (index !== -1) {
                            oldSessions.splice(index, 1);
                        }
                        if (oldSessions.length === 0) {
                            delete window.fullSchedule[oldDate];
                        }
                    }

                    if (!window.fullSchedule[todayStr]) {
                        window.fullSchedule[todayStr] = [];
                    }
                    window.fullSchedule[todayStr].push(session);

                    if (typeof window.renderScheduleDOM === 'function') {
                        try {
                            window.renderScheduleDOM(window.activeFilter || 'week');
                        } catch (err) {
                            console.warn('Erro ao revalidar cronograma:', err);
                        }
                    }
                }

                if (window.todaySessionsData) {
                    const idx = window.todaySessionsData.findIndex(s => s.id == sessionId);
                    if (idx === -1) {
                        window.todaySessionsData.push(session);
                    } else {
                        window.todaySessionsData[idx] = session;
                    }
                }

                if (window.allSessionsData) {
                    const idx = window.allSessionsData.findIndex(s => s.id == sessionId);
                    if (idx !== -1) {
                        window.allSessionsData[idx].session_date = todayStr;
                    } else {
                        window.allSessionsData.push(session);
                    }
                }

                sessionRescheduled = true;
            } catch (err) {
                console.error('R Erro ao atualizar data da sess�o:', err);
                app.showToast('Erro ao reagendar sess�o.', 'error');
                return;
            }
        }

        void('S& Sess�o carregada:', session.subject_name);

        // CORRE!�O: Verificar se sess�o j� foi conclu�da
        if (session.status === 'Conclu�do') {
            void('a? Sess�o j� foi conclu�da');
            app.showToast('S& Esta sess�o j� foi conclu�da!', 'info');
            
            // Atualizar visual do card para mostrar como conclu�da
            if (window.TimerSystem) {
                // For�ar estado de conclu�do no timer
                if (!TimerSystem.timers[sessionId]) {
                    TimerSystem.timers[sessionId] = { elapsed: 0 };
                }
                TimerSystem.timers[sessionId].isCompleted = true;
                TimerSystem.updateCardVisuals(sessionId);
            }
            
            return;
        }

        // CORRE!�O 3: Sempre mostrar checklist para novas sess�es ou quando usu�rio escolheu reiniciar
        if (window.StudyChecklist && window.StudyChecklist.show) {
            window.StudyChecklist.show(session);
        } else {
            console.error('StudyChecklist n�o est� dispon�vel');
            app.showToast('Erro ao carregar m�dulo de checklist. Recarregue a p�gina.', 'error');
            return;
        }

        if (sessionRescheduled) {
            app.showToast('Sess�o reagendada para hoje!', 'success');
        }
        
    } catch (error) {
        console.error('R Erro ao abrir sess�o de estudo:', error);
        app.showToast('Erro inesperado ao abrir sess�o. Tente novamente.', 'error');
    }
}

// Fun��o auxiliar para buscar dados da sess�o
async function fetchSessionData(sessionId) {
    try {
        // Primeiro tentar buscar de dados já carregados na página atual
        if (window.todaySessionsData) {
            const localSession = window.todaySessionsData.find(s => s.id == sessionId);
            if (localSession) {
                console.log('✅ Sessão encontrada em dados locais');
                return localSession;
            }
        }
        
        if (window.sessionsData) {
            const localSession = window.sessionsData.find(s => s.id == sessionId);
            if (localSession) {
                console.log('✅ Sessão encontrada em dados do cronograma');
                return localSession;
            }
        }

        // Procurar no cronograma completo se disponível
        if (window.fullSchedule) {
            for (const dateStr in window.fullSchedule) {
                const sessions = window.fullSchedule[dateStr];
                const fullSession = sessions.find(s => s.id == sessionId);
                if (fullSession) {
                    console.log('✅ Sessão encontrada no fullSchedule');
                    return fullSession;
                }
            }
        }

        // Se não encontrou localmente, buscar no servidor
        console.log('🔍 Buscando sessão no servidor...');
        const response = await app.apiFetch(`/sessions/${sessionId}`);
        return response;
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados da sessão:', error);
        return null;
    }
}

// Fun��o auxiliar para mostrar modal de continua��o de estudo
function showContinueStudyModal(sessionId) {
    return new Promise((resolve) => {
        const timerData = TimerSystem.timers[sessionId];
        const timeStr = TimerSystem.formatTime(timerData.elapsed);
        
        // Criar modal din�mico
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Continuar Estudos? ⏱️</h2>
                <p class="text-gray-600 mb-2">Você já estudou por:</p>
                <p class="text-3xl font-mono font-bold text-blue-600 mb-6">${timeStr}</p>
                <p class="text-gray-600 mb-8">Deseja continuar de onde parou ou começar uma nova sessão?</p>
                <div class="space-y-3">
                    <button id="continue-btn" class="w-full btn-primary py-3 text-lg font-bold">
                        ⏯️ Continuar Estudos
                    </button>
                    <button id="restart-btn" class="w-full btn-secondary py-3 text-lg font-semibold">
                        🔄 Nova Sessão (Resetar Timer)
                    </button>
                    <button id="cancel-btn" class="w-full text-sm text-gray-500 hover:text-gray-700 font-medium mt-4">
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const continueBtn = modal.querySelector('#continue-btn');
        const restartBtn = modal.querySelector('#restart-btn');
        const cancelBtn = modal.querySelector('#cancel-btn');
        
        continueBtn.onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
        
        restartBtn.onclick = () => {
            // Limpar timer existente
            TimerSystem.clearStoredTimer(sessionId);
            delete TimerSystem.timers[sessionId];
            document.body.removeChild(modal);
            resolve(false);
        };
        
        cancelBtn.onclick = () => {
            document.body.removeChild(modal);
            resolve(null);
        };
        
        // Fechar ao clicar fora
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(null);
            }
        };
    });
}

/**
 * Adiar uma sess�o de estudo para o pr�ximo dia dispon�vel
 * @param {number} sessionId - ID da sess�o
 * @param {string} reason - Motivo do adiamento (opcional)
 */
async function postponeSession(sessionId, reason = 'user_request') {
    try {
        // Buscar dados da sess�o para valida��o
        const session = await fetchSessionData(sessionId);
        if (!session) {
            app.showToast('Sessão não encontrada!', 'error');
            return;
        }

        if (session.status === 'Conclu�do') {
            app.showToast('N�o � poss�vel adiar uma sess�o j� conclu�da!', 'info');
            return;
        }

        // Mostrar loading no bot�o
        const postponeBtn = document.querySelector(`[data-session-id="${sessionId}"] .postpone-btn`);
        if (postponeBtn) {
            postponeBtn.innerHTML = '<span class="animate-spin">?</span> Adiando...';
            postponeBtn.disabled = true;
        }

        // Fazer requisi��o para adiar
        const response = await app.apiFetch(`/sessions/${sessionId}/postpone`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                days: 'next',
                reason: reason
            })
        });

        if (response.success) {
            app.showToast('?? Sess�o adiada com sucesso!', 'success');
            
            // Atualizar dados locais
            if (window.todaySessionsData) {
                const idx = window.todaySessionsData.findIndex(s => s.id == sessionId);
                if (idx !== -1) {
                    window.todaySessionsData.splice(idx, 1);
                }
            }

            // Recarregar interface
            if (typeof window.renderScheduleDOM === 'function') {
                window.renderScheduleDOM(window.activeFilter || 'week');
            }
            
            // Remover ou atualizar o card
            const sessionCard = document.getElementById(`session-card-${sessionId}`);
            if (sessionCard) {
                sessionCard.style.opacity = '0.5';
                setTimeout(() => {
                    sessionCard.remove();
                }, 300);
            }
        }

    } catch (error) {
        console.error('Erro ao adiar sess�o:', error);
        app.showToast('? Erro ao adiar sess�o. Tente novamente.', 'error');
        
        // Restaurar bot�o
        const postponeBtn = document.querySelector(`[data-session-id="${sessionId}"] .postpone-btn`);
        if (postponeBtn) {
            postponeBtn.innerHTML = '?? Adiar';
            postponeBtn.disabled = false;
        }
    }
}

/**
 * Criar sess�o de refor�o para revis�o espa�ada
 * @param {number} sessionId - ID da sess�o
 */
async function reinforceSession(sessionId) {
    try {
        // Buscar dados da sess�o para valida��o
        const session = await fetchSessionData(sessionId);
        if (!session) {
            app.showToast('Sessão não encontrada!', 'error');
            return;
        }

        // Mostrar loading no bot�o
        const reinforceBtn = document.querySelector(`[data-session-id="${sessionId}"] .reinforce-btn`);
        if (reinforceBtn) {
            reinforceBtn.innerHTML = '<span class="animate-spin">?</span> Criando...';
            reinforceBtn.disabled = true;
        }

        // Fazer requisi��o para criar refor�o
        const response = await app.apiFetch(`/sessions/${sessionId}/reinforce`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.success) {
            app.showToast('?? Sess�o de refor�o criada! Aparecer� em 3 dias.', 'success');
            
            // Recarregar cronograma para mostrar nova sess�o
            if (typeof window.renderScheduleDOM === 'function') {
                setTimeout(() => {
                    window.renderScheduleDOM(window.activeFilter || 'week');
                }, 500);
            }
        }

    } catch (error) {
        console.error('Erro ao criar sess�o de refor�o:', error);
        app.showToast('? Erro ao criar refor�o. Tente novamente.', 'error');
        
        // Restaurar bot�o
        const reinforceBtn = document.querySelector(`[data-session-id="${sessionId}"] .reinforce-btn`);
        if (reinforceBtn) {
            reinforceBtn.innerHTML = '?? Refor�ar';
            reinforceBtn.disabled = false;
        }
    }
}

// CORRE!�O: Expor fun��es globalmente
window.app = app;
window.openStudySession = openStudySession;
window.fetchSessionData = fetchSessionData;
window.showContinueStudyModal = showContinueStudyModal;
window.postponeSession = postponeSession;
window.reinforceSession = reinforceSession;

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Safe override: reabrir modal do timer quando j� houver timer ativo
if (typeof window.openStudySession === 'function') {
    const __originalOpenStudySession = window.openStudySession;
    window.openStudySession = async function(sessionId) {
        try {
            const hasActiveTimer = window.TimerSystem && TimerSystem.hasActiveTimer(sessionId);
            if (hasActiveTimer && window.StudyChecklist) {
                const session = await (typeof fetchSessionData === 'function' ? fetchSessionData(sessionId) : null);
                if (session) {
                    TimerSystem.continueTimer(sessionId);
                    StudyChecklist.session = session;
                    StudyChecklist.startStudySession(false);
                    app.showToast('Timer retomado! Continue estudando.', 'success');
                    return;
                }
            }
        } catch (_) { /* fallback below */ }
        return __originalOpenStudySession(sessionId);
    };
}

