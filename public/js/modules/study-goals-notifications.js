/**
 * Study Goals Notifications - Sistema de Notificações para Metas de Estudo
 * 
 * Este módulo monitora o progresso de estudo e dispara notificações quando
 * metas de tempo são atingidas, fornecendo gamificação positiva.
 */

const StudyGoalsNotifications = {
    initialized: false,
    dailyGoalMinutes: 120, // Meta padrão: 2 horas por dia
    currentSessionMinutes: 0,
    totalDailyMinutes: 0,
    milestones: [30, 60, 90, 120, 150, 180, 240, 300], // Marcos em minutos
    achievedMilestones: new Set(),

    // Inicialização
    async init() {
        if (this.initialized) return;

        try {
            console.log('🎯 Inicializando Sistema de Notificações de Metas...');

            // Carregar configurações do usuário
            await this.loadUserGoals();
            
            // Carregar progresso do dia
            this.loadTodayProgress();
            
            // Configurar listeners
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('✅ Sistema de Notificações de Metas inicializado');
            
        } catch (error) {
            console.error('❌ Erro na inicialização das notificações de metas:', error);
        }
    },

    // Carregar metas do usuário
    async loadUserGoals() {
        try {
            // Tentar buscar do plano ativo
            if (window.app && window.app.state?.activePlanId) {
                const plan = await window.app.apiFetch(`/plans/${window.app.state.activePlanId}`);
                if (plan && plan.daily_goal_minutes) {
                    this.dailyGoalMinutes = plan.daily_goal_minutes;
                }
            }
            
            // Fallback para localStorage
            const savedGoal = localStorage.getItem('editaliza_daily_goal_minutes');
            if (savedGoal) {
                this.dailyGoalMinutes = parseInt(savedGoal);
            }
            
            console.log(`🎯 Meta diária carregada: ${this.dailyGoalMinutes} minutos`);
            
        } catch (error) {
            console.warn('⚠️ Erro ao carregar metas, usando padrão:', error);
        }
    },

    // Carregar progresso do dia atual
    loadTodayProgress() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const key = `editaliza_daily_progress_${today}`;
            const saved = localStorage.getItem(key);
            
            if (saved) {
                const data = JSON.parse(saved);
                this.totalDailyMinutes = data.totalMinutes || 0;
                this.achievedMilestones = new Set(data.milestones || []);
            }
            
            console.log(`📊 Progresso do dia carregado: ${this.totalDailyMinutes} minutos`);
            
        } catch (error) {
            console.warn('⚠️ Erro ao carregar progresso do dia:', error);
            this.totalDailyMinutes = 0;
            this.achievedMilestones = new Set();
        }
    },

    // Salvar progresso do dia
    saveTodayProgress() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const key = `editaliza_daily_progress_${today}`;
            
            const data = {
                totalMinutes: this.totalDailyMinutes,
                milestones: Array.from(this.achievedMilestones),
                lastUpdate: Date.now()
            };
            
            localStorage.setItem(key, JSON.stringify(data));
            
        } catch (error) {
            console.warn('⚠️ Erro ao salvar progresso:', error);
        }
    },

    // Configurar listeners de eventos
    setupEventListeners() {
        // Listener para conclusão real de sessões
        document.addEventListener('sessionCompleted', (event) => {
            this.handleSessionCompleted(event.detail);
        });

        // Listener para tempo de timer (atualização contínua)
        document.addEventListener('timerUpdate', (event) => {
            this.handleTimerUpdate(event.detail);
        });

        // Salvar progresso periodicamente
        setInterval(() => {
            this.saveTodayProgress();
        }, 60000); // A cada minuto
    },

    // Handler para sessão completada
    handleSessionCompleted(sessionData) {
        if (!this.initialized) return;

        const minutesStudied = sessionData.duration || 0;
        console.log(`📚 Sessão concluída: +${minutesStudied} minutos`);
        
        this.addStudyTime(minutesStudied);
    },

    // Handler para atualização de timer
    handleTimerUpdate(timerData) {
        if (!this.initialized) return;
        
        // Atualizar tempo da sessão atual (sem adicionar ao total ainda)
        this.currentSessionMinutes = Math.floor((timerData.elapsed || 0) / 60000);
    },

    // Adicionar tempo de estudo e verificar metas
    addStudyTime(minutes) {
        if (minutes <= 0) return;

        const previousTotal = this.totalDailyMinutes;
        this.totalDailyMinutes += minutes;
        
        console.log(`⏱️ Tempo total hoje: ${this.totalDailyMinutes} minutos (+${minutes})`);
        
        // Verificar marcos alcançados
        this.checkMilestones(previousTotal, this.totalDailyMinutes);
        
        // Verificar meta diária
        this.checkDailyGoal(previousTotal, this.totalDailyMinutes);
        
        // Salvar progresso
        this.saveTodayProgress();
    },

    // Verificar marcos de tempo
    checkMilestones(previousTotal, currentTotal) {
        this.milestones.forEach(milestone => {
            if (currentTotal >= milestone && 
                previousTotal < milestone && 
                !this.achievedMilestones.has(milestone)) {
                
                this.achievedMilestones.add(milestone);
                this.showMilestoneNotification(milestone);
            }
        });
    },

    // Verificar meta diária
    checkDailyGoal(previousTotal, currentTotal) {
        if (currentTotal >= this.dailyGoalMinutes && 
            previousTotal < this.dailyGoalMinutes) {
            
            this.showDailyGoalNotification();
        }
    },

    // Mostrar notificação de marco
    showMilestoneNotification(milestone) {
        const messages = this.getMilestoneMessages(milestone);
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        if (window.ContextualNotifications) {
            window.ContextualNotifications.showContextualToast({
                type: 'celebration',
                title: `🎯 Marco Alcançado: ${milestone} minutos!`,
                message: message,
                duration: 8000,
                actions: [
                    {
                        text: 'Continuar Estudando! 🚀',
                        action: () => {
                            if (!window.location.pathname.includes('home.html')) {
                                window.location.href = 'home.html';
                            }
                        }
                    }
                ]
            });
        } else {
            // Fallback para toast padrão
            window.app?.showToast(`🎯 ${milestone} minutos estudados hoje! ${message}`, 'success');
        }
        
        console.log(`🎯 Marco de ${milestone} minutos alcançado!`);
    },

    // Mostrar notificação de meta diária
    showDailyGoalNotification() {
        const goalMessages = [
            `Meta diária conquistada! ${this.dailyGoalMinutes} minutos de estudo no bolso! Você é imparável! 🔥`,
            `UHUUL! Meta do dia batida! ${this.dailyGoalMinutes} minutos de dedicação pura! Aprovação, lá vamos nós! 🚀`,
            `Disciplina level MÁXIMO! ${this.dailyGoalMinutes} minutos estudados hoje! Você é uma máquina! 💪`,
            `Meta diária 100% completa! ${this.dailyGoalMinutes} minutos de foco total! Parabéns, guerreiro(a)! ⭐`,
            `GOAL! Meta diária atingida! ${this.dailyGoalMinutes} minutos de estudo no currículo de hoje! 🏆`
        ];
        
        const message = goalMessages[Math.floor(Math.random() * goalMessages.length)];
        
        if (window.ContextualNotifications) {
            window.ContextualNotifications.showContextualToast({
                type: 'celebration',
                title: '🏆 META DIÁRIA CONQUISTADA!',
                message: message,
                duration: 10000,
                actions: [
                    {
                        text: 'Compartilhar Conquista 📱',
                        action: () => this.shareAchievement()
                    },
                    {
                        text: 'Continuar Estudando 💪',
                        action: () => {
                            if (!window.location.pathname.includes('home.html')) {
                                window.location.href = 'home.html';
                            }
                        }
                    }
                ]
            });
        } else {
            window.app?.showToast(`🏆 META DIÁRIA CONQUISTADA! ${message}`, 'success');
        }
        
        console.log(`🏆 Meta diária de ${this.dailyGoalMinutes} minutos alcançada!`);
    },

    // Mensagens para diferentes marcos
    getMilestoneMessages(milestone) {
        const messages = {
            30: [
                'Primeira meia hora no bolso! Você já saiu da zona de procrastinação! 🎯',
                '30 minutos de foco! Seu cérebro está esquentando os motores! 🧠',
                'Meia hora estudada! Você está no caminho certo para a aprovação! ⭐'
            ],
            60: [
                '1 hora de estudos! Você já está mais dedicado que 90% dos concurseiros! 💪',
                '60 minutos focados! Sua concentração está em modo BEAST! 🦁',
                '1 hora no cronômetro! Você está construindo disciplina de ferro! ⚔️'
            ],
            90: [
                '1h30 de estudos! Você está virando uma máquina de aprendizado! 🤖',
                '90 minutos! Sua consistência está mais sólida que concreto! 🏗️',
                '1h30 focado! Você está esculpindo sua aprovação minuto a minuto! 🎨'
            ],
            120: [
                '2 HORAS! Meta padrão atingida! Você é um exemplo de dedicação! 🏆',
                '120 minutos! Disciplina level EXPERT desbloqueada! 🎮',
                '2 horas de estudos! Você está na reta da excelência! 🚀'
            ],
            150: [
                '2h30! Você ultrapassou a meta! Agora é pura determinação! 🔥',
                '150 minutos! Você está voando alto rumo à aprovação! ✈️',
                '2h30 de foco! Você é implacável na busca pelo sucesso! ⚡'
            ],
            180: [
                '3 HORAS! Você é uma lenda viva dos estudos! 👑',
                '180 minutos! Sua dedicação está inspirando até os livros! 📚',
                '3 horas focado! Você transcendeu o nível mortal de estudante! 🌟'
            ],
            240: [
                '4 HORAS! Você quebrou a matrix da procrastinação! 🕶️',
                '240 minutos! Você é o Chuck Norris dos concursos! 💥',
                '4 horas! Até Einstein faria reverência para essa dedicação! 🧠👑'
            ],
            300: [
                '5 HORAS! Você não é humano, é um cyborg programado para aprovação! 🤖',
                '300 minutos! Você oficialmente virou um deus dos estudos! ⚡👑',
                '5 horas! Você quebrou todos os recordes de dedicação! 🏆🥇'
            ]
        };
        
        return messages[milestone] || [
            `${milestone} minutos estudados! Você está arrasando! 🎯`,
            `Marco de ${milestone} minutos conquistado! Continue assim! 💪`,
            `${milestone} minutos de foco! Você é inspirador! ⭐`
        ];
    },

    // Compartilhar conquista
    shareAchievement() {
        const text = `Acabei de estudar ${this.totalDailyMinutes} minutos hoje no Editaliza! 🔥 Meta diária conquistada! #Editaliza #Concursos #Foco`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Editaliza - Meta Diária Conquistada!',
                text: text,
                url: window.location.href
            }).catch(err => console.log('Erro ao compartilhar:', err));
        } else {
            // Fallback para clipboard
            navigator.clipboard.writeText(text).then(() => {
                window.app?.showToast('📋 Texto copiado! Cole onde quiser compartilhar! 🚀', 'success');
            }).catch(() => {
                console.log('Fallback de compartilhamento');
            });
        }
    },

    // Obter estatísticas atuais
    getStats() {
        const percentage = Math.min((this.totalDailyMinutes / this.dailyGoalMinutes) * 100, 100);
        const nextMilestone = this.milestones.find(m => m > this.totalDailyMinutes);
        
        return {
            totalMinutes: this.totalDailyMinutes,
            dailyGoal: this.dailyGoalMinutes,
            percentage: Math.round(percentage),
            milestonesAchieved: this.achievedMilestones.size,
            nextMilestone: nextMilestone,
            minutesToNextMilestone: nextMilestone ? nextMilestone - this.totalDailyMinutes : 0
        };
    },

    // Método de debug para testar notificações
    testMilestone(milestone) {
        console.log(`🧪 Testando notificação de marco: ${milestone} minutos`);
        this.showMilestoneNotification(milestone);
    },

    testDailyGoal() {
        console.log('🧪 Testando notificação de meta diária');
        this.showDailyGoalNotification();
    }
};

// Disponibilizar globalmente
window.StudyGoalsNotifications = StudyGoalsNotifications;

// Auto-inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => StudyGoalsNotifications.init(), 2000);
    });
} else {
    setTimeout(() => StudyGoalsNotifications.init(), 2000);
}

console.log('🎯 Módulo StudyGoalsNotifications carregado');