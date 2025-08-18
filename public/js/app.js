/**
 * @file js/app.js
 * @description Script principal da aplicação, gerenciando estado, chamadas de API e utilitários.
 * Versão com melhorias de segurança.
 */

const app = {
    state: {
        token: null,
        plans: [],
        activePlanId: null,
        activePlanData: {}, 
        overdueTasks: { count: 0, checked: false }
    },

    // Configurações de segurança
    config: {
        apiUrl: window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin,
        tokenKey: 'editaliza_token',
        planKey: 'selectedPlanId',
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 horas em ms
        
        // 🔔 Configurações do Sistema de Notificações Inteligentes
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
        
        // Páginas que não requerem autenticação
        const publicPages = ['/login.html', '/register.html', '/forgot-password.html', '/reset-password.html'];
        const currentPath = window.location.pathname;
        const isPublicPage = publicPages.some(page => currentPath.includes(page));
        
        if (!this.state.token && !isPublicPage) {
            window.location.href = 'login.html';
            return;
        }
        
        // Configurar interceptador para renovar token se necessário
        if (this.state.token) {
            this.setupTokenRefresh();
        }

        // 🔔 INICIALIZAR SISTEMA DE NOTIFICAÇÕES INTELIGENTES
        await this.initializeNotificationSystem();
    },

    // 🔔 Sistema de Notificações Inteligentes
    async initializeNotificationSystem() {
        try {
            console.log('🔔 Inicializando Sistema de Notificações Inteligentes...');
            
            // Aguardar carregamento dos módulos
            const modulesLoaded = await this.waitForNotificationModules();
            
            if (modulesLoaded) {
                // Inicializar sistema de notificações contextuais
                if (window.ContextualNotifications) {
                    await window.ContextualNotifications.init();
                    console.log('✅ ContextualNotifications inicializado');
                }
                
                // Inicializar integrações de notificação
                if (window.NotificationIntegrations) {
                    await window.NotificationIntegrations.init();
                    console.log('✅ NotificationIntegrations inicializado');
                }
                
                console.log('🎯 Sistema de Notificações Inteligentes ativado com sucesso!');
            } else {
                console.log('💤 Sistema de Notificações executando em modo simplificado');
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao inicializar sistema de notificações:', error);
            // Não quebra a aplicação se as notificações falharem
        }
    },

    // Aguardar módulos de notificação estarem disponíveis
    async waitForNotificationModules(maxWait = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (window.ContextualNotifications && window.NotificationIntegrations) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.warn('⚠️ Módulos de notificação não carregaram, usando fallback');
        return false; // Retorna false em vez de erro
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
            // Token inválido, fazer logout
            this.logout();
        }
    },

    // Configurar renovação automática de token
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
            // Permitir apenas URLs do mesmo domínio
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
            const response = await fetch(`${this.config.apiUrl}${url}`, config);

            // Tratamento específico para respostas vazias
            let data = {};
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (jsonError) {
                    console.warn('Resposta JSON inválida:', jsonError);
                    data = {};
                }
            }

            if (response.status === 401 || response.status === 403) {
                this.logout();
                throw new Error('Sua sessão expirou. Por favor, faça o login novamente.');
            }

            if (!response.ok) {
                throw new Error(data.error || `Erro na requisição: ${response.statusText}`);
            }
            
            return data;
        } catch (error) {
            // Se for erro de rede, tentar mostrar mensagem mais amigável
            if (error.message === 'Failed to fetch') {
                throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
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
        // Limpar todos os dados sensíveis
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
        
        // Fazer logout no servidor (se possível)
        if (this.state.token) {
            fetch(`${this.config.apiUrl}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.state.token}`
                }
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

    // Logging inteligente - só loga quando necessário
    _smartLog(key, message, data = null, level = 'log') {
        const logKey = `_lastLog_${key}`;
        const now = Date.now();
        
        // Não logar a mesma mensagem mais de uma vez por minuto
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

    // CORREÇÃO: Melhorar função de dados do plano com log detalhado
    async getActivePlanData(planId, dataType, forceRefresh = false) {
        // Validar inputs
        if (!planId || !dataType) {
            throw new Error('ID do plano e tipo de dados são obrigatórios');
        }
        
        console.log(`📊 Buscando dados: ${dataType} (forceRefresh: ${forceRefresh})`);
        
        // Se for forçar refresh, invalidar cache primeiro
        if (forceRefresh) {
            this.invalidatePlanCache(planId, dataType);
        }
        
        // Verificar se já temos dados em cache e não é forçado
        if (this.state.activePlanData[planId] && this.state.activePlanData[planId][dataType] && !forceRefresh) {
            console.log(`📋 Usando dados em cache para ${dataType}`);
            return this.state.activePlanData[planId][dataType];
        }

        if (!this.state.activePlanData[planId]) {
            this.state.activePlanData[planId] = {};
        }
        
        console.log(`🌍 Buscando dados frescos da API: ${dataType}`);
        const data = await this.apiFetch(`/plans/${planId}/${dataType}`);
        
        // Salvar no cache
        this.state.activePlanData[planId][dataType] = data;
        console.log(`✅ Dados de ${dataType} atualizados no cache`);
        
        return data;
    },
    
    async getGamificationData(planId) {
        if (!planId) throw new Error("ID do plano é necessário para buscar dados de gamificação.");
        return await this.apiFetch(`/plans/${planId}/gamification`);
    },

    // CORREÇÃO: Melhorar sistema de invalidação de cache com logs
    invalidatePlanCache(planId, dataType = null) {
        if (!planId) {
            console.warn('⚠️ Tentativa de invalidar cache sem planId');
            return;
        }
        
        if (this.state.activePlanData[planId]) {
            if (dataType) {
                console.log(`🗑️ Invalidando cache de ${dataType} para plano ${planId}`);
                delete this.state.activePlanData[planId][dataType];
            } else {
                console.log(`🗑️ Invalidando todo o cache do plano ${planId}`);
                delete this.state.activePlanData[planId];
            }
        } else {
            console.log(`📋 Cache já vazio para plano ${planId}`);
        }
    },

    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? '✓' : '✕';
        
        // Sanitizar mensagem
        const safeMessage = this.sanitizeHtml(message);
        
        toast.className = `p-4 rounded-lg text-white shadow-lg ${bgColor} transform transition-all duration-300 translate-x-full opacity-0 flex items-center space-x-2`;
        toast.innerHTML = `<span class="text-xl">${icon}</span><span>${safeMessage}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Animar entrada
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
        
        // Remover após 3 segundos
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, { once: true });
        }, 3000);
    },

    showSpinner() {
        const spinner = document.getElementById('spinner-overlay');
        if (spinner) {
            spinner.classList.remove('hidden');
            // Prevenir múltiplos spinners
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
        if (!name) return { color: 'border-gray-400', icon: '📚' };

        const predefined = {
            'Constitucional': { color: 'border-green-500', icon: '⚖️' }, 
            'Administrativo': { color: 'border-red-500', icon: '🏛️' },
            'Português': { color: 'border-orange-500', icon: '✍️' }, 
            'Civil': { color: 'border-blue-500', icon: '👨‍⚖️' },
            'Raciocínio Lógico': { color: 'border-cyan-500', icon: '🧠' }, 
            'Processual Civil': { color: 'border-sky-500', icon: '📂' },
            'Penal': { color: 'border-rose-500', icon: '🔪' }, 
            'Processual Penal': { color: 'border-pink-500', icon: '⛓️' },
            'Legislação': { color: 'border-purple-500', icon: '📜' }, 
            'Revisão Consolidada': { color: 'border-yellow-400', icon: '⭐' },
            'Revisão Semanal': { color: 'border-yellow-400', icon: '⭐' },
            'Revisão Mensal': { color: 'border-amber-500', icon: '🗓️' }, 
            'Reforço Extra': { color: 'border-indigo-500', icon: '🎯' },
            'Simulado Direcionado': { color: 'border-purple-500', icon: '🎯' },
            'Simulado Completo': { color: 'border-slate-700', icon: '🏆' },
            'Redação': { color: 'border-rose-500', icon: '📝' }
        };

        for (const keyword in predefined) {
            if (name.includes(keyword)) return predefined[keyword];
        }

        const colors = [
            'border-teal-500', 'border-lime-500', 'border-fuchsia-500', 
            'border-violet-500', 'border-emerald-500', 'border-cyan-600',
            'border-sky-600', 'border-indigo-600', 'border-pink-600',
            'border-amber-600', 'border-yellow-500', 'border-green-600'
        ];
        
        // Hash mais robusto
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            const char = name.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converter para 32-bit integer
        }
        const index = Math.abs(hash % colors.length);
        
        return { color: colors[index], icon: '📚' };
    },

    // Função para validar dados de entrada
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

    // Debounce para evitar múltiplas chamadas
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

    // Sistema de debounce para evitar múltiplas chamadas rápidas
    _debounceGamificationCalls(planId, forceRefresh, callback) {
        const key = `${planId}_${forceRefresh}`;
        if (!this._gamificationDebounce) this._gamificationDebounce = {};
        
        // Cancelar chamada anterior se existir
        if (this._gamificationDebounce[key]) {
            clearTimeout(this._gamificationDebounce[key]);
        }
        
        // Agendar nova chamada com delay mínimo
        this._gamificationDebounce[key] = setTimeout(callback, forceRefresh ? 0 : 100);
    },

    // CORREÇÃO: Função de gamificação sempre busca dados frescos quando solicitado
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
            // Log apenas se for forçado ou primeira chamada
            if (forceRefresh || !this._gamificationDataCache?.[planId]) {
                console.log('📊 Carregando dados de gamificação...', forceRefresh ? '(forçado)' : '');
            }
            
            // CORREÇÃO: Usar getActivePlanData para aproveitar o sistema de cache
            const response = await this.getActivePlanData(planId, 'gamification', forceRefresh);
            
            // Cache simples para controlar logs
            if (!this._gamificationDataCache) this._gamificationDataCache = {};
            const previousData = this._gamificationDataCache[planId];
            
            // Só logar se houve mudança significativa nos dados
            if (!previousData || 
                previousData.completedTopicsCount !== response.completedTopicsCount ||
                previousData.concurseiroLevel !== response.concurseiroLevel) {
                console.log('✅ Dados atualizados:', {
                    nivel: response.concurseiroLevel,
                    topicos: response.completedTopicsCount,
                    streak: response.studyStreak
                });
                this._gamificationDataCache[planId] = response;
            }
            
            return response;
        } catch (error) {
            console.error('❌ Erro gamificação:', error.message || error);
            // Fallback com dados básicos
            return {
                studyStreak: 0,
                totalStudyDays: 0,
                experiencePoints: 0,
                concurseiroLevel: 'Aspirante a Servidor(a) 🌱',
                achievements: [],
                completedTopicsCount: 0,
                totalCompletedSessions: 0,
                currentStreak: 0,
                totalXP: 0,
                level: 1,
                levelName: 'Aspirante a Servidor(a) 🌱',
                achievementsCount: 0
            };
        }
    },

    // Função para notificar atualização do avatar do usuário
    async onUserAvatarUpdated() {
        if (typeof components !== 'undefined' && components.updateNavigationAvatar) {
            await components.updateNavigationAvatar();
        }
    },
    
    // CORREÇÃO: Sistema de eventos para atualização de métricas
    eventListeners: new Map(),
    
    // Registrar listener para eventos de atualização de métricas
    onMetricsUpdate(callback) {
        const id = Date.now() + Math.random();
        this.eventListeners.set(id, callback);
        return id; // Retorna ID para poder remover depois
    },
    
    // Remover listener
    removeMetricsListener(id) {
        this.eventListeners.delete(id);
    },
    
    // Disparar evento de atualização de métricas
    triggerMetricsUpdate(planId, eventType = 'session_completed') {
        console.log(`📡 Disparando evento de atualização de métricas: ${eventType}`);
        this.eventListeners.forEach(callback => {
            try {
                callback(planId, eventType);
            } catch (error) {
                console.error('Erro em listener de métricas:', error);
            }
        });
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
            console.log(`⏰ Timer ativo encontrado para sessão ${sessionId} - continuando sem abrir checklist`);
            TimerSystem.continueTimer(sessionId);
            app.showToast('⏱️ Timer retomado! Continue estudando.', 'success');
            return;
        }
        
        if (hasElapsedTime) {
            console.log(`⏸️ Timer pausado com tempo encontrado para sessão ${sessionId} - perguntando ao usuário`);
            
            // Mostrar modal de confirmação se há tempo estudado mas timer pausado
            const shouldContinue = await showContinueStudyModal(sessionId);
            
            if (shouldContinue) {
                // Continuar timer sem abrir checklist
                const session = await fetchSessionData(sessionId);
                if (session) {
                    TimerSystem.continueTimer(sessionId);
                    StudyChecklist.startStudySession(false); // CORREÇÃO: Não iniciar novo timer
                    StudyChecklist.session = session; // Definir sessão para modal
                    app.showToast('⏱️ Continuando estudos! Timer retomado.', 'success');
                } else {
                    console.error('❌ Não foi possível carregar dados da sessão');
                    app.showToast('Erro ao carregar sessão. Tente novamente.', 'error');
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
        // Usar horário de Brasília corretamente
        const todayStr = new Date().toLocaleDateString("en-CA", {timeZone: "America/Sao_Paulo"});
        if (session.session_date && session.session_date !== todayStr) {
            const confirmReschedule = confirm('Esta sessão estava marcada para outro dia. Deseja reagendá-la para hoje?');
            if (!confirmReschedule) {
                return;
            }

            const oldDate = session.session_date;
            try {
                await app.apiFetch(`/schedules/sessions/${sessionId}`, {
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
                console.error('❌ Erro ao atualizar data da sessão:', err);
                app.showToast('Erro ao reagendar sessão.', 'error');
                return;
            }
        }

        console.log('✅ Sessão carregada:', session.subject_name);

        // CORREÇÃO: Verificar se sessão já foi concluída
        if (session.status === 'Concluído') {
            console.log('⚠️ Sessão já foi concluída');
            app.showToast('✅ Esta sessão já foi concluída!', 'info');
            
            // Atualizar visual do card para mostrar como concluída
            if (window.TimerSystem) {
                // Forçar estado de concluído no timer
                if (!TimerSystem.timers[sessionId]) {
                    TimerSystem.timers[sessionId] = { elapsed: 0 };
                }
                TimerSystem.timers[sessionId].isCompleted = true;
                TimerSystem.updateCardVisuals(sessionId);
            }
            
            return;
        }

        // CORREÇÃO 3: Sempre mostrar checklist para novas sessões ou quando usuário escolheu reiniciar
        StudyChecklist.show(session);

        if (sessionRescheduled) {
            app.showToast('Sessão reagendada para hoje!', 'success');
        }
        
    } catch (error) {
        console.error('❌ Erro ao abrir sessão de estudo:', error);
        app.showToast('Erro inesperado ao abrir sessão. Tente novamente.', 'error');
    }
}

// Função auxiliar para buscar dados da sessão
async function fetchSessionData(sessionId) {
    try {
        // Primeiro tentar buscar de dados já carregados na página atual
        if (window.todaySessionsData) {
            const localSession = window.todaySessionsData.find(s => s.id == sessionId);
            if (localSession) {
                console.log('📦 Sessão encontrada em dados locais');
                return localSession;
            }
        }
        
        if (window.sessionsData) {
            const localSession = window.sessionsData.find(s => s.id == sessionId);
            if (localSession) {
                console.log('📦 Sessão encontrada em dados do cronograma');
                return localSession;
            }
        }

        // Procurar no cronograma completo se disponível
        if (window.fullSchedule) {
            for (const dateStr in window.fullSchedule) {
                const sessions = window.fullSchedule[dateStr];
                const fullSession = sessions.find(s => s.id == sessionId);
                if (fullSession) {
                    console.log('📚 Sessão encontrada no fullSchedule');
                    return fullSession;
                }
            }
        }

        // Se não encontrou localmente, buscar no servidor
        console.log('🌐 Buscando sessão no servidor...');
        const response = await app.apiFetch(`/schedules/sessions/${sessionId}`);
        return response;
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados da sessão:', error);
        return null;
    }
}

// Função auxiliar para mostrar modal de continuação de estudo
function showContinueStudyModal(sessionId) {
    return new Promise((resolve) => {
        const timerData = TimerSystem.timers[sessionId];
        const timeStr = TimerSystem.formatTime(timerData.elapsed);
        
        // Criar modal dinâmico
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

// CORREÇÃO: Expor funções globalmente
window.app = app;
window.openStudySession = openStudySession;
window.fetchSessionData = fetchSessionData;
window.showContinueStudyModal = showContinueStudyModal;

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}