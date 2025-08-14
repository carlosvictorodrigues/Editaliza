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
                console.warn('⚠️ ContextualNotifications: Dependências não encontradas (app ou showToast)');
                // Não lançar erro, apenas avisar
            } else {
                console.log('✅ ContextualNotifications: Dependências encontradas');
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
        const currentHour = new Date().getHours();
        
        // Determinar período do dia para saudação
        let greeting, timeEmoji;
        if (currentHour < 12) {
            greeting = "Bom dia";
            timeEmoji = "☀️";
        } else if (currentHour < 18) {
            greeting = "Boa tarde";
            timeEmoji = "🌤️";
        } else {
            greeting = "Boa noite";
            timeEmoji = "🌙";
        }

        // Mensagens humoradas baseadas na sequência
        let welcomeMessage, title;
        
        if (streak === 0) {
            const funnyMessages = [
                "Olha quem voltou! Como um ex que aparece depois de meses... mas dessa vez é bem-vindo! 😂",
                "Sentimos sua falta! Os livros estavam perguntando onde você estava! 📚😢",
                "Eita! Alguém lembrou que tem concurso para passar! Bem-vindo de volta, campeão! 🎯",
                "Como um Phoenix renascendo das cinzas... só que das cinzas da procrastinação! 🔥",
                "Voltou! Agora é hora de transformar o Netflix em 'Studyflix'! 🍿➡️📖"
            ];
            title = `${timeEmoji} ${greeting}, Ressuscitado(a)!`;
            welcomeMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
        } else if (streak === 1) {
            const funnyMessages = [
                "1 dia de sequência! É o começo de algo lindo... como uma plantinha que acabou de brotar! 🌱",
                "Primeiro dia da nova vida! Hoje você é estudante, amanhã será aprovado(a)! ⭐",
                "Um dia! É pouco? Não! Todo império começou com uma única pedra! 🏰",
                "1 dia de estudos! Você está 1% mais próximo da aprovação! (matemática motivacional) 📊",
                "Dia 1 da operação 'Bye bye vida social, hello aprovação!' 🎯"
            ];
            title = `${timeEmoji} ${greeting}, Iniciante Determinado(a)!`;
            welcomeMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
        } else if (streak < 7) {
            const funnyMessages = [
                `${streak} dias! Você está mais consistente que minha internet! E isso é muito! 📶`,
                `${streak} dias seguidos! Parabéns, você está viciado(a)... em coisa boa! 🎮➡️📚`,
                `${streak} dias! Já pode se considerar um(a) 'Estudante em Série'! 📺➡️📖`,
                `${streak} dias de sequência! Tá mais regular que remédio pra pressão! 💊`,
                `${streak} dias! Você está no modo 'Tartaruga Ninja dos Estudos'! 🐢🥷`
            ];
            title = `${timeEmoji} ${greeting}, Viciado(a) em Sucesso!`;
            welcomeMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
        } else if (streak < 21) {
            const funnyMessages = [
                `${streak} dias! Você é mais constante que a gravidade! Newton ficaria orgulhoso! 🍎`,
                `${streak} dias! Tá mais disciplinado(a) que militar em continência! 🫡`,
                `${streak} dias seguidos! Você virou o 'The Rock' dos estudos! 💪`,
                `${streak} dias! Até o YouTube já deve estar com ciúmes da sua dedicação! 📱➡️📚`,
                `${streak} dias! Você é o(a) 'John Wick dos Concursos' - focado, determinado e implacável! 🎯`
            ];
            title = `${timeEmoji} ${greeting}, Máquina de Estudar!`;
            welcomeMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
        } else if (streak < 30) {
            const funnyMessages = [
                `${streak} dias! Você transcendeu! Já pode dar aula de disciplina no YouTube! 🎓`,
                `${streak} dias! Tá mais fiel aos estudos que cachorro com o dono! 🐕💙`,
                `${streak} dias! Você é o(a) 'Sensei dos Estudos' - mestre em consistência! 🥋`,
                `${streak} dias! Netflix chora, TikTok sofre, mas o concurso sorri! 😊`,
                `${streak} dias! Você virou lenda urbana: 'a pessoa que estuda todo dia!' 🦄`
            ];
            title = `${timeEmoji} ${greeting}, Lenda Viva!`;
            welcomeMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
        } else {
            const funnyMessages = [
                `${streak} dias! Você não é humano(a), é um(a) cyborg programado(a) para a aprovação! 🤖`,
                `${streak} dias! Até o Einstein faria reverência para essa dedicação! 🧠👑`,
                `${streak} dias! Você é o(a) 'Chuck Norris dos Concursos'! 💥`,
                `${streak} dias! Parabéns, você quebrou a matrix da procrastinação! 🕶️`,
                `${streak} dias! Você é oficialmente um(a) 'Deus(Deusa) dos Estudos'! ⚡👑`
            ];
            title = `${timeEmoji} ${greeting}, Divindade dos Estudos!`;
            welcomeMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
        }

        this.showContextualToast({
            type: 'motivational',
            title: title,
            message: welcomeMessage,
            duration: 8000,
            actions: [
                {
                    text: streak > 0 ? 'Vamos Continuar! 🚀' : 'Bora Estudar! 💪',
                    action: () => {
                        // Redirecionar para página de estudos se não estiver lá
                        if (!window.location.pathname.includes('home.html')) {
                            window.location.href = 'home.html';
                        }
                    }
                }
            ]
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
        const funnyBaseMessages = {
            'Novo Tópico': [
                `${subject} desbravado! Seu cérebro acabou de ganhar uma nova habilidade! Level up! 🎮`,
                `Novo tópico de ${subject} dominado! Você está coletando conhecimento como quem coleta cartas Pokémon! 📚✨`,
                `${subject} conquistado! Seu QI acabou de fazer um 'upgrade' de software! 🧠⬆️`,
                `Mais um tópico de ${subject}! Você está acumulando sabedoria como esquilo acumula castanhas! 🐿️🌰`,
                `${subject} destravado! Achievement unlocked: 'Desbravador de Conhecimento'! 🏆`
            ],
            'Revisão': [
                `Revisão de ${subject} completa! Seu cérebro agradece pela 'atualização de software'! 🔄💾`,
                `${subject} revisado! Você está martelando o conhecimento na cabeça... literalmente! 🔨🧠`,
                `Revisão finalizada! ${subject} agora está mais fixo que chiclete no cabelo! 💪`,
                `${subject} revisado com sucesso! Sua memória acabou de virar HD externo! 💾✨`,
                `Revisão concluída! ${subject} agora está gravado em 4K na sua mente! 📽️`
            ],
            'Simulado': [
                `Simulado de ${subject} finalizado! Você acabou de fazer um 'test drive' na aprovação! 🚗💨`,
                `${subject} testado! Você está mais preparado que Boy Scout em acampamento! ⛺`,
                `Simulado concluído! ${subject} foi posto à prova e você saiu vitorioso! 🥊🏆`,
                `${subject} simulado! Você está treinando como Rocky Balboa dos concursos! 🥊`,
                `Simulado finalizado! ${subject} foi testado e aprovado no 'laboratório mental'! 🔬✅`
            ],
            'Exercícios': [
                `Exercícios de ${subject} finalizados! Você está mais ativo mentalmente que personal trainer! 💪🧠`,
                `${subject} exercitado! Seu cérebro acabou de fazer uma sessão na 'academia mental'! 🏋️‍♂️`,
                `Exercícios concluídos! ${subject} foi à academia e voltou sarado! 💪`,
                `${subject} malhado! Você está bombando os músculos cerebrais! 🧠💪`,
                `Exercícios finalizados! ${subject} fez cardio e musculação mental! 🏃‍♂️🏋️‍♀️`
            ]
        };

        let messages = funnyBaseMessages[sessionType] || [
            `Sessão de ${subject} concluída! Você está mais focado que sniper em missão! 🎯`,
            `${subject} finalizado! Você está acumulando conhecimento como colecionador de raridades! 🎨`,
            `Mais uma de ${subject}! Você é tipo Netflix... sempre tem conteúdo novo! 📺✨`,
            `${subject} completed! Seu progresso está mais consistente que gravidade! 🌍`,
            `Sessão finalizada! ${subject} foi mais uma vitória no seu currículo de aprovação! 📜🏆`
        ];

        // Contexto humorado de duração
        if (duration > 90) {
            const longDurationMessages = [
                ` Uau! ${Math.round(duration)} minutos! Você tem mais resistência que maratonista! 🏃‍♂️`,
                ` ${Math.round(duration)} minutos de foco! Monge tibetano ficaria com inveja! 🧘‍♂️`,
                ` ${Math.round(duration)} minutos! Você quebrou o recorde de concentração da casa! 🏆`,
                ` ${Math.round(duration)} minutos straight! Você é o(a) 'The Rock' dos estudos! 💪`,
                ` ${Math.round(duration)} minutos! Sua concentração é mais sólida que concreto! 🏗️`
            ];
            const extraMsg = longDurationMessages[Math.floor(Math.random() * longDurationMessages.length)];
            messages = messages.map(msg => msg + extraMsg);
        } else if (duration > 50) {
            const mediumDurationMessages = [
                ` ${Math.round(duration)} minutos de dedicação! Parabéns, guerreiro(a)! ⚔️`,
                ` ${Math.round(duration)} minutos! Você está mais constante que relógio suíço! ⏰`,
                ` ${Math.round(duration)} minutos! Sua disciplina é inspiradora! 🌟`,
                ` ${Math.round(duration)} minutos de foco total! Ninja dos estudos! 🥷`,
                ` ${Math.round(duration)} minutos! Você é exemplo de persistência! 🏅`
            ];
            const extraMsg = mediumDurationMessages[Math.floor(Math.random() * mediumDurationMessages.length)];
            messages = messages.map(msg => msg + extraMsg);
        }

        // Contexto humorado de dificuldade
        if (difficulty && difficulty >= 4) {
            const difficultyMessages = [
                ` E ainda por cima era tópico difícil! Você é brabo(a) mesmo! 😎`,
                ` Tópico level hard dominado! Boss fight vencida! 🎮👑`,
                ` Conteúdo difícil conquistado! Você não teme desafio! 💪⚔️`,
                ` Tópico pesado detonado! Você é o(a) Hulk dos estudos! 💚💥`,
                ` Matéria difícil? Pra você é fichinha! Legend mode! 🏆✨`
            ];
            const extraMsg = difficultyMessages[Math.floor(Math.random() * difficultyMessages.length)];
            messages = messages.map(msg => msg + extraMsg);
        }

        return messages;
    },

    // === UTILITÁRIOS ===

    showContextualToast(options) {
        const container = document.getElementById('toast-container') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = 'bg-white rounded-xl shadow-2xl p-4 transform transition-all duration-500 opacity-0';
        toast.style.cssText = 'pointer-events: auto !important; margin-bottom: 10px !important; width: 380px !important; min-width: 320px !important;';

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
                        <span class="text-2xl">${options.icon || '📢'}</span>
                    </div>
                    <div class="ml-3 flex-1" style="min-width: 0;">
                        <p class="text-md font-bold text-gray-900" style="white-space: normal; word-wrap: break-word;">${options.title}</p>
                        <p class="mt-1 text-sm text-gray-600" style="white-space: normal; word-wrap: break-word;">${options.message}</p>
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

        // Animate in with better desktop support
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0');
            toast.classList.add('opacity-100');
            toast.style.transform = 'translateX(0)';
        });

        setTimeout(close, options.duration || 6000);
    },

    createToastContainer() {
        let container = document.getElementById('toast-container');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed z-50 space-y-3';
        container.style.cssText = 'position: fixed !important; top: 20px !important; right: 20px !important; z-index: 9999 !important; max-width: 400px !important; pointer-events: none !important;';
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
    },

    // Debug method for testing
    testNotification() {
        console.log('🧪 Testando sistema de notificações...');
        this.showContextualToast({
            type: 'celebration',
            title: '🧪 Teste de Notificação',
            message: 'Se você está vendo esta mensagem, o sistema de notificações está funcionando!',
            duration: 5000
        });
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