/**
 * Contextual Notifications PRO - Sistema Inteligente de Notificações
 * 
 * Este módulo implementa notificações contextuais baseadas no comportamento
 * do usuário, progresso de estudos e padrões de engajamento.
 */

const ContextualNotifications = {
    // Estado interno
    initialized: false,
    userData: null,
    recentNotifications: new Map(), // Deduplicação de notificações
    notificationCooldowns: new Map(), // Cooldowns por tipo
    patterns: {
        lastSessionTime: null,
        studyStreak: 0,
        consecutiveDays: 0,
        procrastinationCount: 0,
        lastSubjectStudied: null
    },

    // Configurações
    config: {
        enabled: true,
        maxNotificationsPerDay: 6,
        notificationCooldown: 300000, // 5 minutos
        procrastinationThreshold: 3,
        streakMilestones: [3, 7, 14, 21, 30],
        debug: true
    },

    // Inicialização segura
    async init() {
        if (this.initialized) return;
        
        try {
            console.log('🔔 Inicializando Sistema de Notificações Contextuais...');
            
            // Verificar dependências
            if (!window.app) {
                throw new Error('App principal não encontrado');
            }
            
            // Garantir que showToast existe
            if (!window.app.showToast && !window.app.showMessage) {
                console.warn('⚠️ showToast não encontrado, usando fallback');
                window.app.showToast = function(message, type) {
                    if (window.app.showMessage) {
                        window.app.showMessage(message, type);
                    } else {
                        console.log(`📱 ${message} (${type})`);
                    }
                };
            }

            // Carregar dados do usuário
            await this.loadUserData();
            
            // Registrar event listeners de forma segura
            this.setupEventListeners();
            
            // Inicializar detecção de padrões
            this.initPatternDetection();
            
            this.initialized = true;
            console.log('✅ Sistema de Notificações Contextuais inicializado com sucesso');
            
            // Notificação de boas-vindas (se não for primeira vez hoje)
            const today = new Date().toDateString();
            const lastWelcome = localStorage.getItem('lastWelcomeDate');
            
            if (this.config.showWelcome && lastWelcome !== today) {
                setTimeout(() => {
                    console.log('🔔 Disparando mensagem de boas-vindas...');
                    this.showWelcomeMessage();
                    localStorage.setItem('lastWelcomeDate', today);
                }, 3000);
            }
            
            // Teste imediato (apenas em desenvolvimento)
            if (window.location.hostname === 'localhost' && this.config.debug) {
                setTimeout(() => {
                    console.log('🔔 TESTE: Notificação de desenvolvimento');
                    this.showContextualToast({
                        type: 'info',
                        title: '🧪 Sistema Ativo',
                        message: 'Notificações Inteligentes funcionando perfeitamente!',
                        duration: 4000
                    });
                }, 5000);
            }
            
        } catch (error) {
            console.error('❌ Erro na inicialização das notificações contextuais:', error);
            // Fallback silencioso - não quebra a aplicação
        }
    },

    // Carregamento seguro de dados do usuário
    async loadUserData() {
        try {
            // Tentar carregar dados de gamificação existentes
            if (window.app && window.app.getGamificationData && window.app.state?.activePlanId) {
                this.userData = await window.app.getGamificationData(window.app.state.activePlanId);
                
                if (this.userData) {
                    this.patterns.studyStreak = this.userData.studyStreak || 0;
                    this.patterns.consecutiveDays = this.userData.totalStudyDays || 0;
                }
            }
            
            // Dados do localStorage para padrões comportamentais
            const storedPatterns = localStorage.getItem('editaliza_notification_patterns');
            if (storedPatterns) {
                const parsed = JSON.parse(storedPatterns);
                this.patterns = { ...this.patterns, ...parsed };
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao carregar dados do usuário para notificações:', error);
            // Continuar com dados padrão
        }
    },

    // Configuração de event listeners não invasivos
    setupEventListeners() {
        // Listener para conclusão de sessões
        document.addEventListener('sessionCompleted', (event) => {
            this.handleSessionCompleted(event.detail);
        });

        // Listener para conquistas
        document.addEventListener('achievementUnlocked', (event) => {
            this.handleAchievement(event.detail);
        });

        // Listener para milestones de XP
        document.addEventListener('xpGained', (event) => {
            this.handleXPGain(event.detail);
        });

        // Listener para mudanças de level
        document.addEventListener('levelUp', (event) => {
            this.handleLevelUp(event.detail);
        });

        // Detecção de inatividade
        this.setupInactivityDetection();
    },

    // Detecção de padrões comportamentais
    initPatternDetection() {
        // Verificar procrastinação (usuário abrindo app mas não estudando)
        this.detectProcrastination();
        
        // Verificar consistência de horários
        this.analyzeStudyTiming();
        
        // Salvar padrões periodicamente
        setInterval(() => this.savePatterns(), 60000); // 1 minuto
    },

    // === HANDLERS DE EVENTOS ===

    handleSessionCompleted(sessionData) {
        if (!this.isEnabled()) return;

        const { sessionType, duration, subject, difficulty, sessionId } = sessionData;
        
        // Criar chave única para deduplicação
        const notificationKey = `session_completed_${sessionId || Date.now()}_${subject}`;
        
        // Verificar se já processamos esta notificação recentemente
        if (this.recentNotifications.has(notificationKey)) {
            console.log('🔔 Notificação de sessão já processada, ignorando duplicata:', notificationKey);
            return;
        }
        
        // Verificar cooldown para notificações de sessão (30 segundos)
        const cooldownKey = 'session_completion';
        const lastNotification = this.notificationCooldowns.get(cooldownKey);
        const now = Date.now();
        
        if (lastNotification && (now - lastNotification) < 30000) {
            console.log('🔔 Cooldown ativo para notificações de sessão, ignorando');
            return;
        }
        
        // Registrar notificação para deduplicação
        this.recentNotifications.set(notificationKey, now);
        this.notificationCooldowns.set(cooldownKey, now);
        
        // Limpar notificações antigas (manter apenas últimas 5 minutos)
        this.cleanupOldNotifications();
        
        // Atualizar padrões
        this.patterns.lastSessionTime = now;
        this.patterns.lastSubjectStudied = subject;
        this.procrastinationCount = 0; // Reset procrastination counter
        
        console.log('🔔 Processando notificação de sessão concluída:', { sessionType, duration, subject, sessionId });
        
        // Mensagem contextual baseada no tipo de sessão
        setTimeout(() => {
            this.showSessionCompletionMessage(sessionType, duration, subject, difficulty);
        }, 1000);

        // Verificar streaks e milestones
        this.checkStreakMilestones();
    },

    handleAchievement(achievement) {
        if (!this.isEnabled()) return;
        
        setTimeout(() => {
            this.showAchievementMessage(achievement);
        }, 500);
    },

    handleXPGain(xpData) {
        if (!this.isEnabled()) return;
        
        const { amount, total, source } = xpData;
        
        // Mostrar XP gain apenas para valores significativos
        if (amount >= 50) {
            setTimeout(() => {
                this.showXPMessage(amount, total, source);
            }, 1500);
        }
    },

    handleLevelUp(levelData) {
        if (!this.isEnabled()) return;
        
        setTimeout(() => {
            this.showLevelUpMessage(levelData);
        }, 2000);
    },

    // === TIPOS DE MENSAGENS ===

    showSessionCompletionMessage(sessionType, duration, subject, difficulty) {
        // Verificação adicional para evitar duplicatas na exibição
        const messageKey = `completion_message_${Date.now()}`;
        
        if (this.recentNotifications.has(messageKey)) {
            console.log('🔔 Mensagem de conclusão já exibida, evitando duplicata');
            return;
        }
        
        this.recentNotifications.set(messageKey, Date.now());
        
        const messages = this.getSessionMessages(sessionType, subject, difficulty, duration);
        const message = this.selectRandomMessage(messages);
        
        console.log('🔔 Exibindo mensagem de conclusão de sessão:', { sessionType, subject, message });
        
        this.showContextualToast({
            type: 'celebration',
            title: '🎉 Sessão Concluída!',
            message: message,
            duration: 6000,
            actions: [
                {
                    text: 'Próxima Sessão',
                    action: () => this.suggestNextSession()
                }
            ]
        });
    },

    showAchievementMessage(achievement) {
        this.showContextualToast({
            type: 'achievement',
            title: '🏆 Nova Conquista!',
            message: `Você desbloqueou: "${achievement.title}"! ${achievement.description}`,
            duration: 8000,
            actions: [
                {
                    text: 'Ver Conquistas',
                    action: () => this.openAchievementsPanel()
                }
            ]
        });
    },

    showXPMessage(amount, total, source) {
        const levelProgress = this.calculateLevelProgress(total);
        
        this.showContextualToast({
            type: 'motivational',
            title: '✨ Experiência Ganha!',
            message: `+${amount} XP! Você tem ${total} XP total. ${levelProgress}`,
            duration: 5000
        });
    },

    showLevelUpMessage(levelData) {
        this.showContextualToast({
            type: 'celebration',
            title: '🎖️ Level Up!',
            message: `Parabéns! Você alcançou: ${levelData.newLevel}! Continue assim!`,
            duration: 8000,
            actions: [
                {
                    text: 'Ver Progresso',
                    action: () => this.openProgressPanel()
                }
            ]
        });
    },

    showWelcomeMessage() {
        const streak = this.patterns.studyStreak;
        let welcomeMessage;

        if (streak === 0) {
            welcomeMessage = "Que bom te ver de volta! Vamos retomar os estudos com força total! 💪";
        } else if (streak < 3) {
            welcomeMessage = `Você tem ${streak} ${streak === 1 ? 'dia' : 'dias'} de sequência! Continue construindo seu hábito! 🔥`;
        } else if (streak < 7) {
            welcomeMessage = `Incrível! ${streak} dias consecutivos! Você está criando um hábito sólido! ⭐`;
        } else {
            welcomeMessage = `Que constância! ${streak} dias de sequência! Você é um exemplo de disciplina! 🏆`;
        }

        this.showContextualToast({
            type: 'motivational',
            title: '👋 Olá!',
            message: welcomeMessage,
            duration: 6000
        });
        
        console.log('🔔 Mensagem de boas-vindas exibida:', welcomeMessage);
    },

    // === DETECÇÃO DE PADRÕES ===

    detectProcrastination() {
        const now = Date.now();
        const lastSession = this.patterns.lastSessionTime;
        
        // Se usuário não estuda há mais de 2 dias
        if (lastSession && (now - lastSession) > (48 * 60 * 60 * 1000)) {
            this.patterns.procrastinationCount++;
            
            if (this.patterns.procrastinationCount >= this.config.procrastinationThreshold) {
                this.showProcrastinationNudge();
            }
        }
    },

    showProcrastinationNudge() {
        const nudges = [
            "Que tal começar com apenas 15 minutos de estudo hoje? Pequenos passos fazem grandes diferenças! 🌱",
            "Sentindo resistência para estudar? É normal! Que tal escolher o tópico mais fácil para quebrar o gelo? ❄️",
            "Lembra da sua meta? Cada sessão, mesmo curta, te aproxima da aprovação! 🎯",
            "Que tal definir um horário fixo de estudo? A consistência é mais importante que a duração! ⏰"
        ];

        this.showContextualToast({
            type: 'reminder',
            title: '💭 Pensamento do dia',
            message: this.selectRandomMessage(nudges),
            duration: 8000,
            actions: [
                {
                    text: 'Estudar Agora',
                    action: () => window.location.href = '/cronograma.html'
                }
            ]
        });
    },

    analyzeStudyTiming() {
        const hour = new Date().getHours();
        let timingMessage = null;

        if (hour >= 6 && hour <= 9) {
            timingMessage = "Manhã é um ótimo horário para estudar! Seu cérebro está 23% mais focado agora! 🧠";
        } else if (hour >= 14 && hour <= 16) {
            timingMessage = "Tarde perfeita para revisões! É quando a retenção de memória está no pico! 🔄";
        } else if (hour >= 19 && hour <= 21) {
            timingMessage = "Noite ideal para simulados! Teste seus conhecimentos do dia! 📝";
        }

        if (timingMessage && Math.random() < 0.3) { // 30% chance
            setTimeout(() => {
                this.showContextualToast({
                    type: 'info',
                    title: '⏰ Dica de Timing',
                    message: timingMessage,
                    duration: 6000
                });
            }, 5000);
        }
    },

    checkStreakMilestones() {
        const streak = this.patterns.studyStreak;
        
        if (this.config.streakMilestones.includes(streak)) {
            const milestoneMessages = {
                3: "3 dias consecutivos! Você está construindo um hábito poderoso! 🔥",
                7: "Uma semana inteira! Sua disciplina está impressionante! 💪",
                14: "2 semanas de consistência! Você é imparável! ⭐",
                21: "3 semanas! Cientificamente, você já tem um hábito consolidado! 🧠",
                30: "1 mês de estudos! Você é oficialmente um concurseiro dedicado! 🏆"
            };

            this.showContextualToast({
                type: 'celebration',
                title: '🎊 Marco Alcançado!',
                message: milestoneMessages[streak],
                duration: 10000,
                actions: [
                    {
                        text: 'Compartilhar',
                        action: () => this.shareAchievement(streak)
                    }
                ]
            });
        }
    },

    // === MENSAGENS CONTEXTUAIS ===

    getSessionMessages(sessionType, subject, difficulty, duration) {
        const baseMessages = {
            'Novo Tópico': [
                `Excelente! Você expandiu seu conhecimento em ${subject}! O aprendizado de novos conceitos fortalece conexões neurais! 🧠`,
                `Novo tópico dominado! Em ${subject}, você está construindo uma base sólida para a aprovação! 📚`,
                `Parabéns por explorar ${subject}! Cada novo tópico é um passo rumo ao seu objetivo! 🎯`
            ],
            'Revisão': [
                `Revisão concluída! A repetição espaçada em ${subject} aumenta sua retenção em até 90%! 🔄`,
                `Ótima revisão! Você está solidificando ${subject} na memória de longo prazo! 💾`,
                `Revisão perfeita! Em ${subject}, você está aplicando a ciência da aprendizagem! 🔬`
            ],
            'Simulado': [
                `Simulado finalizado! Testar ${subject} na prática é essencial para o sucesso na prova! ✅`,
                `Bem feito! O simulado de ${subject} te prepara para o formato real da prova! 📝`,
                `Simulado concluído! Você está medindo e melhorando seu desempenho em ${subject}! 📊`
            ]
        };

        let messages = baseMessages[sessionType] || [
            `Sessão de ${subject} concluída! Você está no caminho certo! 🚀`,
            `Excelente trabalho em ${subject}! Cada minuto conta para sua aprovação! ⏰`,
            `Parabéns! Mais uma sessão produtiva de ${subject} finalizada! 🎉`
        ];

        // Adicionar contexto de duração
        if (duration > 60) {
            messages = messages.map(msg => msg + ` Impressionante foco por ${Math.round(duration)} minutos!`);
        }

        // Adicionar contexto de dificuldade
        if (difficulty && difficulty >= 4) {
            messages = messages.map(msg => msg + ` Tópico desafiador dominado! 💪`);
        }

        return messages;
    },

    // === UTILITÁRIOS ===

    showContextualToast(options) {
        console.log('🔔 Exibindo notificação contextual:', options);
        
        // Fallback para app.showToast se não encontrar container
        if (!document.getElementById('toast-container') && window.app && window.app.showToast) {
            console.log('🔔 Usando fallback app.showToast');
            const emoji = options.type === 'celebration' ? '🎉' : options.type === 'achievement' ? '🏆' : '💡';
            window.app.showToast(`${emoji} ${options.message}`, 'success');
            return;
        }
        
        const container = document.getElementById('toast-container') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = 'bg-white rounded-lg shadow-lg border p-4 max-w-sm w-full transform transition-all duration-300 opacity-0 translate-x-full';

        const typeClasses = {
            celebration: 'border-l-4 border-yellow-400 bg-yellow-50',
            achievement: 'border-l-4 border-purple-500 bg-purple-50',
            motivational: 'border-l-4 border-blue-500 bg-blue-50',
            reminder: 'border-l-4 border-red-500 bg-red-50',
            info: 'border-l-4 border-gray-400 bg-gray-50'
        };

        // Extrair emoji do título
        const titleParts = options.title.split(' ');
        const emoji = titleParts[0];
        const titleText = titleParts.slice(1).join(' ');

        toast.innerHTML = `
            <div class="${typeClasses[options.type] || typeClasses.info} rounded-lg p-3">
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <span class="text-2xl" role="img" aria-hidden="true">${emoji}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-gray-900 mb-1">${titleText}</h4>
                        <p class="text-sm text-gray-700 leading-relaxed">${options.message}</p>
                    </div>
                    <div class="flex-shrink-0">
                        <button type="button" class="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Fechar notificação">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const closeButton = toast.querySelector('button');
        const close = () => {
            toast.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => toast.remove(), 300);
        };
        closeButton.addEventListener('click', close);

        container.appendChild(toast);

        // Animate in (slide from right)
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-x-full');
        });

        setTimeout(close, options.duration || 6000);
    },

    createToastContainer() {
        let container = document.getElementById('toast-container');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-50 space-y-3';
        document.body.appendChild(container);
        return container;
    },

    selectRandomMessage(messages) {
        return messages[Math.floor(Math.random() * messages.length)];
    },

    calculateLevelProgress(totalXP) {
        // Lógica simplificada de progress
        const nextLevel = Math.ceil(totalXP / 500) * 500;
        const remaining = nextLevel - totalXP;
        
        if (remaining <= 50) {
            return `Faltam apenas ${remaining} XP para o próximo nível!`;
        }
        
        return `Continue assim para alcançar ${nextLevel} XP!`;
    },

    setupInactivityDetection() {
        let inactiveTimer;
        
        const resetTimer = () => {
            clearTimeout(inactiveTimer);
            inactiveTimer = setTimeout(() => {
                this.handleInactivity();
            }, 15 * 60 * 1000); // 15 minutos
        };

        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        resetTimer();
    },

    handleInactivity() {
        if (!this.isEnabled()) return;

        const inactivityMessages = [
            "Que tal uma pausa ativa? Levante, estique o corpo e volte com tudo! 🧘",
            "15 minutos de pausa! Hidrate-se e prepare-se para a próxima sessão! 💧",
            "Momento para respirar! Seu cérebro agradece pelas pausas estratégicas! 🫁"
        ];

        this.showContextualToast({
            type: 'reminder',
            title: '⏸️ Pausa Detectada',
            message: this.selectRandomMessage(inactivityMessages),
            duration: 5000
        });
    },

    // === AÇÕES ===

    suggestNextSession() {
        if (window.location.pathname !== '/cronograma.html') {
            window.location.href = '/cronograma.html';
        }
    },

    openAchievementsPanel() {
        if (window.location.pathname !== '/plan.html') {
            window.location.href = '/plan.html';
        }
    },

    openProgressPanel() {
        if (window.location.pathname !== '/plan.html') {
            window.location.href = '/plan.html';
        }
    },

    shareAchievement(streak) {
        if (navigator.share) {
            navigator.share({
                title: 'Editaliza - Progresso nos Estudos',
                text: `Consegui manter ${streak} dias consecutivos de estudo com a Editaliza! 🔥`,
                url: window.location.href
            });
        }
    },

    // === CONTROLES ===

    isEnabled() {
        return this.config.enabled && this.initialized;
    },

    enable() {
        this.config.enabled = true;
        localStorage.setItem('editaliza_notifications_enabled', 'true');
    },

    disable() {
        this.config.enabled = false;
        localStorage.setItem('editaliza_notifications_enabled', 'false');
    },

    savePatterns() {
        localStorage.setItem('editaliza_notification_patterns', JSON.stringify(this.patterns));
    },

    // Limpar notificações antigas para evitar vazamento de memória
    cleanupOldNotifications() {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        
        // Limpar notificações antigas
        for (const [key, timestamp] of this.recentNotifications.entries()) {
            if (timestamp < fiveMinutesAgo) {
                this.recentNotifications.delete(key);
            }
        }
        
        // Limpar cooldowns antigos
        for (const [key, timestamp] of this.notificationCooldowns.entries()) {
            if (timestamp < fiveMinutesAgo) {
                this.notificationCooldowns.delete(key);
            }
        }
    },

    // === DEBUG ===
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            patterns: this.patterns,
            userData: this.userData ? 'Loaded' : 'Not loaded',
            recentNotifications: this.recentNotifications.size,
            cooldowns: this.notificationCooldowns.size
        };
    },

    // Método para teste manual
    testSessionCompletion(sessionId = 3625) {
        console.log('🧪 TESTE: Simulando conclusão de sessão', sessionId);
        
        // Limpar notificações anteriores para este teste
        const testKey = `session_completed_${sessionId}_Teste`;
        this.recentNotifications.delete(testKey);
        this.notificationCooldowns.delete('session_completion');
        
        // Simular evento de conclusão
        this.handleSessionCompleted({
            sessionType: 'Novo Tópico',
            duration: 25,
            subject: 'Direito Constitucional',
            difficulty: 3,
            sessionId: sessionId
        });
    },

    // Limpar todos os caches de notificação (para teste)
    clearNotificationCache() {
        this.recentNotifications.clear();
        this.notificationCooldowns.clear();
        console.log('🔄 Cache de notificações limpo');
    }
};

// Disponibilizar globalmente
window.ContextualNotifications = ContextualNotifications;

// Auto-inicialização segura quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => ContextualNotifications.init(), 1000);
    });
} else {
    setTimeout(() => ContextualNotifications.init(), 1000);
}

console.log('📦 Módulo ContextualNotifications carregado');