/**
 * Notification Integrations - Sistema de Integração Segura
 * 
 * Este módulo conecta o sistema de notificaçÃµes contextuais com os eventos
 * existentes da plataforma de forma não invasiva e segura.
 */

const NotificationIntegrations = {
    initialized: false,
    observers: [],
    listeners: [],
    intervals: [],

    // Inicialização segura
    async init() {
        if (this.initialized) return;

        try {
            console.log('🎯”— Inicializando IntegraçÃµes de Notificação...');

            // Aguardar carregamento das dependÃªncias
            await this.waitForDependencies();

            // Configurar integraçÃµes com eventos existentes
            this.setupSessionIntegrations();
            this.setupGamificationIntegrations();
            this.setupTimerIntegrations();
            this.setupUIIntegrations();

            this.initialized = true;
            console.log('âœ… IntegraçÃµes de notificação inicializadas');

        } catch (error) {
            console.error('âŒ Erro na inicialização das integraçÃµes:', error);
        }
    },

    // Aguardar dependÃªncias estarem disponíveis
    async waitForDependencies() {
        const maxWait = 10000; // 10 segundos
        const checkInterval = 100; // 100ms
        let waited = 0;

        while (waited < maxWait) {
            if (window.ContextualNotifications && 
                window.app && 
                document.readyState === 'complete') {
                return true;
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }

        throw new Error('DependÃªncias não carregaram a tempo');
    },

    // Integração com eventos de sessão
    setupSessionIntegrations() {
        // Observer para botÃµes de conclusão de sessão
        this.observeSessionCompletions();

        // Observer para início de sessÃµes
        this.observeSessionStarts();

        // Monitor de tempo de estudo
        this.monitorStudySessions();
    },

    observeSessionCompletions() {
        // Observer para detectar quando sessÃµes são marcadas como concluídas
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Verificar se algum elemento foi alterado indicando conclusão
                    const addedNodes = Array.from(mutation.addedNodes);
                    addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.checkForSessionCompletion(node);
                        }
                    });
                }

                if (mutation.type === 'attributes') {
                    // Verificar mudanças de classe/status que indicam conclusão
                    this.checkSessionStatusChange(mutation.target);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-status']
        });

        this.observers.push(observer);
    },

    checkForSessionCompletion(element) {
        // Verificar se é uma notificação de sessão concluída
        if (element.classList?.contains('toast-success') || 
            element.textContent?.includes('Sessão concluída') ||
            element.textContent?.includes('Parabéns')) {
            
            // Extrair dados da sessão se possível
            const sessionData = this.extractSessionData(element);
            this.triggerSessionCompleted(sessionData);
        }
    },

    checkSessionStatusChange(element) {
        // Verificar mudanças que indicam conclusão de sessão
        if (element.classList?.contains('completed') ||
            element.dataset?.status === 'completed') {
            
            const sessionData = this.extractSessionDataFromElement(element);
            this.triggerSessionCompleted(sessionData);
        }
    },

    observeSessionStarts() {
        // Monitor para início de cronÃ´metros/sessÃµes
        const timerObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    const target = mutation.target;
                    
                    // Verificar se um cronÃ´metro foi iniciado
                    if (target.classList?.contains('timer-running') ||
                        target.textContent?.includes('Pausar') ||
                        target.querySelector?.('.timer-running')) {
                        
                        this.handleSessionStart();
                    }
                }
            });
        });

        // Observar área onde cronÃ´metros aparecem
        const timerContainers = document.querySelectorAll('.timer-container, .session-timer, .pomodoro-timer');
        timerContainers.forEach(container => {
            timerObserver.observe(container, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        });

        this.observers.push(timerObserver);
    },

    // Integração com sistema de gamificação
    setupGamificationIntegrations() {
        // Interceptar atualizaçÃµes de XP e conquistas
        this.interceptGamificationUpdates();

        // Monitor de streaks
        this.monitorStreakChanges();
    },

    interceptGamificationUpdates() {
        // Observer para mudanças na seção de gamificação
        const gamificationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const target = mutation.target;
                    
                    // Verificar mudanças em XP
                    if (target.classList?.contains('xp-counter') ||
                        target.textContent?.includes('XP') ||
                        target.textContent?.includes('pontos')) {
                        
                        this.detectXPChange(target);
                    }

                    // Verificar novas conquistas
                    if (target.classList?.contains('achievement-card') ||
                        target.textContent?.includes('Nova conquista') ||
                        target.textContent?.includes('desbloqueou')) {
                        
                        this.detectAchievement(target);
                    }
                }
            });
        });

        // Observar áreas de gamificação
        const gamificationAreas = document.querySelectorAll('#gamification-dashboard, .achievement-card, .xp-counter');
        gamificationAreas.forEach(area => {
            gamificationObserver.observe(area, {
                childList: true,
                subtree: true,
                characterData: true
            });
        });

        this.observers.push(gamificationObserver);
    },

    monitorStreakChanges() {
        let lastStreak = 0;
        
        const checkStreak = () => {
            try {
                // Verificar se há elementos de streak na página
                const streakElements = document.querySelectorAll('.streak-counter, [class*="streak"], [class*="sequencia"]');
                
                streakElements.forEach(element => {
                    const streakText = element.textContent;
                    const streakMatch = streakText.match(/(\d+)/);
                    
                    if (streakMatch) {
                        const currentStreak = parseInt(streakMatch[1]);
                        if (currentStreak > lastStreak && lastStreak > 0) {
                            // Streak aumentou
                            this.triggerStreakMilestone(currentStreak);
                        }
                        lastStreak = currentStreak;
                    }
                });
            } catch (error) {
                // Ignorar erros silenciosamente
            }
        };

        const streakInterval = setInterval(checkStreak, 30000); // Cada 30 segundos
        this.intervals.push(streakInterval);
    },

    // Integração com cronÃ´metros
    setupTimerIntegrations() {
        this.monitorPomodoroCompletions();
        this.monitorStudySessions();
    },

    monitorPomodoroCompletions() {
        // Observer para detectar conclusão de pomodoros
        const pomodoroObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const target = mutation.target;
                
                // Verificar se pomodoro foi concluído
                if (target.textContent?.includes('Pomodoro concluído') ||
                    target.textContent?.includes('Tempo esgotado') ||
                    target.classList?.contains('timer-finished')) {
                    
                    this.triggerPomodoroComplete();
                }
            });
        });

        // Observar elementos de timer
        const timerElements = document.querySelectorAll('.timer, .pomodoro, .countdown');
        timerElements.forEach(element => {
            pomodoroObserver.observe(element, {
                childList: true,
                subtree: true,
                characterData: true
            });
        });

        this.observers.push(pomodoroObserver);
    },

    monitorStudySessions() {
        let sessionStartTime = null;
        
        // Monitor de atividade de estudo
        const monitorActivity = () => {
            const isStudying = this.detectStudyActivity();
            
            if (isStudying && !sessionStartTime) {
                sessionStartTime = Date.now();
                this.handleSessionStart();
            } else if (!isStudying && sessionStartTime) {
                const duration = Math.round((Date.now() - sessionStartTime) / 60000); // minutos
                if (duration >= 5) { // SessÃµes de pelo menos 5 minutos
                    this.handleSessionEnd(duration);
                }
                sessionStartTime = null;
            }
        };

        const activityInterval = setInterval(monitorActivity, 60000); // Cada minuto
        this.intervals.push(activityInterval);
    },

    detectStudyActivity() {
        // Verificar se há indicadores de estudo ativo
        return document.querySelector('.timer-running') ||
               document.querySelector('.session-active') ||
               document.querySelector('.studying') ||
               document.title.includes('Estudando');
    },

    // Integração com UI
    setupUIIntegrations() {
        // Interceptar toasts existentes para adicionar contexto
        this.interceptToasts();

        // Monitor de navegação entre páginas
        this.monitorPageNavigation();
    },

    interceptToasts() {
        // Observar container de toasts
        const toastObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && 
                            (node.classList?.contains('toast') || 
                             node.classList?.contains('alert'))) {
                            
                            this.enhanceToast(node);
                        }
                    });
                }
            });
        });

        // Observar áreas onde toasts aparecem
        const toastContainers = document.querySelectorAll('.toast-container, .alerts, .notifications');
        toastContainers.forEach(container => {
            toastObserver.observe(container, {
                childList: true,
                subtree: true
            });
        });

        this.observers.push(toastObserver);
    },

    monitorPageNavigation() {
        // Detectar mudanças de página
        let lastPath = window.location.pathname;
        
        const checkNavigation = () => {
            const currentPath = window.location.pathname;
            if (currentPath !== lastPath) {
                this.handlePageChange(lastPath, currentPath);
                lastPath = currentPath;
            }
        };

        const navInterval = setInterval(checkNavigation, 1000);
        this.intervals.push(navInterval);
    },

    // === TRIGGERS DE EVENTOS ===

    triggerSessionCompleted(sessionData) {
        if (!window.ContextualNotifications) return;

        const event = new CustomEvent('sessionCompleted', {
            detail: {
                sessionType: sessionData.type || 'Estudo',
                duration: sessionData.duration || 25,
                subject: sessionData.subject || 'Matéria',
                difficulty: sessionData.difficulty || 3,
                timestamp: Date.now()
            }
        });

        document.dispatchEvent(event);
    },

    triggerPomodoroComplete() {
        const event = new CustomEvent('pomodoroComplete', {
            detail: {
                duration: 25,
                timestamp: Date.now()
            }
        });

        document.dispatchEvent(event);
    },

    triggerStreakMilestone(streak) {
        const event = new CustomEvent('streakMilestone', {
            detail: {
                streak: streak,
                timestamp: Date.now()
            }
        });

        document.dispatchEvent(event);
    },

    triggerXPGain(amount, total, source) {
        const event = new CustomEvent('xpGained', {
            detail: {
                amount: amount,
                total: total,
                source: source || 'session',
                timestamp: Date.now()
            }
        });

        document.dispatchEvent(event);
    },

    triggerAchievement(achievement) {
        const event = new CustomEvent('achievementUnlocked', {
            detail: achievement
        });

        document.dispatchEvent(event);
    },

    // === HANDLERS ===

    handleSessionStart() {
        console.log('🎯“š Sessão de estudo iniciada');
        
        // Disparar evento se necessário
        const event = new CustomEvent('sessionStarted', {
            detail: {
                timestamp: Date.now()
            }
        });

        document.dispatchEvent(event);
    },

    handleSessionEnd(duration) {
        console.log(`â° Sessão de estudo finalizada: ${duration} minutos`);
        
        // Dados básicos da sessão
        const sessionData = {
            type: 'Estudo',
            duration: duration,
            subject: this.getCurrentSubject(),
            timestamp: Date.now()
        };

        this.triggerSessionCompleted(sessionData);
    },

    handlePageChange(from, to) {
        console.log(`🎯”„ Navegação: ${from} â†’ ${to}`);
        
        // Triggers específicos baseados na página
        if (to.includes('cronograma')) {
            this.handleCronogramaPage();
        } else if (to.includes('plan')) {
            this.handlePlanPage();
        }
    },

    handleCronogramaPage() {
        // Usuário voltou para estudar
        const event = new CustomEvent('userReturned', {
            detail: {
                page: 'cronograma',
                timestamp: Date.now()
            }
        });

        document.dispatchEvent(event);
    },

    handlePlanPage() {
        // Usuário verificando progresso
        const event = new CustomEvent('progressViewed', {
            detail: {
                page: 'plan',
                timestamp: Date.now()
            }
        });

        document.dispatchEvent(event);
    },

    // === UTILITÁRIOS ===

    extractSessionData(element) {
        const text = element.textContent || '';
        
        return {
            type: this.extractSessionType(text),
            duration: this.extractDuration(text),
            subject: this.extractSubject(text),
            difficulty: 3 // padrão
        };
    },

    extractSessionDataFromElement(element) {
        const sessionType = element.dataset?.sessionType || 
                           element.querySelector?.('[data-session-type]')?.dataset?.sessionType ||
                           'Estudo';
        
        const subject = element.dataset?.subject ||
                       element.querySelector?.('[data-subject]')?.dataset?.subject ||
                       this.getCurrentSubject();

        return {
            type: sessionType,
            subject: subject,
            duration: 25, // padrão pomodoro
            difficulty: 3
        };
    },

    extractSessionType(text) {
        if (text.includes('Novo Tópico')) return 'Novo Tópico';
        if (text.includes('Revisão')) return 'Revisão';
        if (text.includes('Simulado')) return 'Simulado';
        return 'Estudo';
    },

    extractDuration(text) {
        const match = text.match(/(\d+)\s*minutos?/i);
        return match ? parseInt(match[1]) : 25;
    },

    extractSubject(text) {
        // Tentar extrair matéria do texto
        const subjects = ['Direito Constitucional', 'Direito Administrativo', 'PortuguÃªs', 'Matemática'];
        for (const subject of subjects) {
            if (text.includes(subject)) {
                return subject;
            }
        }
        return this.getCurrentSubject();
    },

    getCurrentSubject() {
        // Tentar detectar matéria atual da página
        const titleElement = document.querySelector('h1, h2, .session-title, .subject-title');
        if (titleElement) {
            return titleElement.textContent.trim();
        }
        
        return 'Matéria';
    },

    detectXPChange(element) {
        const text = element.textContent;
        const xpMatch = text.match(/(\d+)\s*XP/i);
        
        if (xpMatch) {
            const currentXP = parseInt(xpMatch[1]);
            // Lógica para detectar ganho de XP seria mais complexa
            // Por simplicidade, assumir ganho se elemento foi alterado
            this.triggerXPGain(10, currentXP, 'activity');
        }
    },

    detectAchievement(element) {
        const text = element.textContent;
        
        // Extrair título da conquista
        const titleMatch = text.match(/(?:Nova conquista|desbloqueou):\s*["']?([^"']+)["']?/i);
        
        if (titleMatch) {
            const achievement = {
                title: titleMatch[1],
                description: 'Conquista desbloqueada!',
                timestamp: Date.now()
            };
            
            this.triggerAchievement(achievement);
        }
    },

    enhanceToast(toastElement) {
        // Adicionar classes ou funcionalidades ao toast se necessário
        const text = toastElement.textContent;
        
        if (text.includes('concluído') || text.includes('Parabéns')) {
            toastElement.classList.add('enhanced-success');
        }
    },

    // === CONTROLES ===

    getStatus() {
        return {
            initialized: this.initialized,
            observers: this.observers.length,
            listeners: this.listeners.length,
            intervals: this.intervals.length
        };
    },

    // Rollback completo - remove todas as integraçÃµes
    rollback() {
        console.log('🎯”„ Executando rollback das integraçÃµes...');

        // Parar todos os observers
        this.observers.forEach(observer => {
            try {
                observer.disconnect();
            } catch (e) {}
        });

        // Remover listeners
        this.listeners.forEach(({ element, event, handler }) => {
            try {
                element.removeEventListener(event, handler);
            } catch (e) {}
        });

        // Parar intervalos
        this.intervals.forEach(interval => {
            try {
                clearInterval(interval);
            } catch (e) {}
        });

        // Limpar arrays
        this.observers = [];
        this.listeners = [];
        this.intervals = [];

        this.initialized = false;
        
        console.log('âœ… Rollback das integraçÃµes concluído');
    }
};

// Disponibilizar globalmente
window.NotificationIntegrations = NotificationIntegrations;

// Inicialização automática quando ContextualNotifications estiver disponível
const waitForContextualNotifications = () => {
    if (window.ContextualNotifications) {
        setTimeout(() => NotificationIntegrations.init(), 2000);
    } else {
        setTimeout(waitForContextualNotifications, 500);
    }
};

// Iniciar após DOM carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForContextualNotifications);
} else {
    waitForContextualNotifications();
}

console.log('🎯”— Módulo NotificationIntegrations carregado');
