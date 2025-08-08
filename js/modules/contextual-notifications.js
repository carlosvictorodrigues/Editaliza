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
            if (!window.app || !window.app.showToast) {
                throw new Error('Dependências não encontradas');
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
            setTimeout(() => this.showWelcomeMessage(), 2000);
            
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

        const { sessionType, duration, subject, difficulty } = sessionData;
        
        // Atualizar padrões
        this.patterns.lastSessionTime = Date.now();
        this.patterns.lastSubjectStudied = subject;
        this.procrastinationCount = 0; // Reset procrastination counter
        
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
        const messages = this.getSessionMessages(sessionType, subject, difficulty, duration);
        const message = this.selectRandomMessage(messages);
        
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
        const container = document.getElementById('toast-container') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = 'bg-white rounded-xl shadow-2xl p-4 w-full max-w-sm transform transition-all duration-500 opacity-0 -translate-y-12';

        const typeClasses = {
            celebration: 'border-yellow-400',
            achievement: 'border-purple-500',
            motivational: 'border-blue-500',
            reminder: 'border-red-500',
            info: 'border-gray-400'
        };

        toast.innerHTML = `
            <div class="border-l-4 ${typeClasses[options.type] || 'border-gray-400'} pl-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0 pt-0.5">
                        <span class="text-2xl">${options.title.split(' ')[0]}</span>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="text-md font-bold text-gray-900">${options.title}</p>
                        <p class="mt-1 text-sm text-gray-600">${options.message}</p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button class="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none">
                            <span class="sr-only">Close</span>
                            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const closeButton = toast.querySelector('button');
        const close = () => {
            toast.classList.add('opacity-0', 'translate-y-full');
            setTimeout(() => toast.remove(), 500);
        };
        closeButton.addEventListener('click', close);

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', '-translate-y-12');
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

    // === DEBUG ===
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            patterns: this.patterns,
            userData: this.userData ? 'Loaded' : 'Not loaded'
        };
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