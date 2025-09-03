/* global app */
/**
 * @file js/checklist.js
 * @description Sistema de checklist e gerenciamento da sessão de estudo em modal.
 */

const StudyChecklist = {
    session: null, // Armazena o objeto completo da sessão
    checklistShownSessions: new Set(), // Track sessions that have already shown checklist

    items: [
        { id: 'hydration', icon: '💧', text: 'Água por perto?', tip: 'Mantenha-se hidratado!' },
        { id: 'bathroom', icon: '🚻', text: 'Banheiro OK?', tip: 'Evite interrupções' },
        { id: 'phone', icon: '📱', text: 'Celular no silencioso?', tip: 'Foco total!' },
        { id: 'materials', icon: '📚', text: 'Material em mãos?', tip: 'Livros, caderno, caneta...' },
        { id: 'snacks', icon: '☕', text: 'Café ultra forte e lanche preparados?', tip: 'Energia para o cérebro' },
        { id: 'comfort', icon: '🪑', text: 'Postura confortável?', tip: 'Cuide da sua coluna' },
        { id: 'mindset', icon: '🎯', text: 'Vontade de vencer ativada?', tip: 'Você consegue!' }
    ],

    motivationalQuotes: [
        'A aprovação está mais perto do que você imagina! 🎉',
        'Cada minuto de estudo é um passo em direção ao seu sonho! 🚀',
        'Hoje você está construindo o seu futuro! 🏗️',
        'Disciplina é a ponte entre objetivos e conquistas! 🌉',
        'O sucesso é a soma de pequenos esforços repetidos dia após dia! 💪',
        'Você não chegou até aqui para desistir agora! 🔥',
        'Foco no processo, o resultado é consequência! 🎯',
        'Grandes jornadas começam com pequenos passos! 👣'
    ],

    show(sessionObject) {
        this.session = sessionObject;
        
        // Check if checklist was already shown for this session or if timer is active
        const hasActiveTimer = window.TimerSystem && TimerSystem.hasActiveTimer(sessionObject.id);
        const checklistAlreadyShown = this.checklistShownSessions.has(sessionObject.id);
        
        if (hasActiveTimer || checklistAlreadyShown) {
            console.info(`Sessão ${sessionObject.id} - Pulando checklist (timer ativo: ${hasActiveTimer}, já mostrado: ${checklistAlreadyShown})`);
            // Skip checklist and go directly to timer
            this.startStudySession(false); // Don't start new timer if one is already active
            return;
        }
        
        console.info(`✅ Mostrando checklist para sessão ${sessionObject.id} pela primeira vez`);
        
        const modal = document.getElementById('studySessionModal');
        const modalContainer = document.getElementById('studySessionModalContainer');
        
        modalContainer.innerHTML = this.getChecklistHtml();
        modal.classList.remove('hidden');
        
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modalContainer.classList.remove('scale-95');
        }, 10);
        
        this.addAnimations();
        this.addChecklistListeners();
        this.addModalClickListener(); // CORREO 1: Fechar modal ao clicar fora
    },

    startStudySession(shouldStartTimer = true) { // CORREO 2: Controla se deve iniciar o timer
        // Mark this session as having shown the checklist
        if (this.session && this.session.id) {
            this.checklistShownSessions.add(this.session.id);
            console.info(`Sessão ${this.session.id} marcada como checklist mostrado`);
        }
        
        const modalContainer = document.getElementById('studySessionModalContainer');
        modalContainer.innerHTML = this.getTimerHtml();
        this.addTimerSessionListeners();
        
        // CORREÇÃO: Verificar se já existe timer ativo antes de iniciar
        const hasActiveTimer = TimerSystem.hasActiveTimer(this.session.id);
        
        if (hasActiveTimer) {
            // Timer já está rodando, apenas conectar
            console.info('Reconectando ao timer ativo:', this.session.id);
            // Button será atualizado automaticamente pelo timer
        } else if (shouldStartTimer) {
            // Iniciar novo timer
            TimerSystem.start(this.session.id);
        }
        
        // Display será atualizado automaticamente pelo timer
    },

    async markAsComplete() {
        try {
            // Desabilitar botão durante processamento
            const completeBtn = document.getElementById('modal-complete-btn');
            if (completeBtn) {
                completeBtn.disabled = true;
                completeBtn.innerHTML = '<span class="animate-spin">🔄</span> Concluindo...';
            }

            // Chamar markAsCompleted existente
            await this.markAsCompleted();

            // Invalidar cache e atualizar métricas
            app.invalidatePlanCache(this.session.study_plan_id);
            app.triggerMetricsUpdate(this.session.study_plan_id, 'session_status_changed');
            
            console.info('✅ Sessão concluída - atualizando estatísticas...');
            app.invalidatePlanCache(this.session.study_plan_id, 'gamification');
            
            // Atualizar métricas e dashboard se estivermos na tela plan.html
            if (window.location.pathname.includes('plan.html')) {
                try {
                    // Atualizar dashboard do plano
                    if (window.PlanPageFixed && typeof window.PlanPageFixed.refreshDashboard === 'function') {
                        console.info('🔄 Atualizando dashboard após conclusão da sessão...');
                        setTimeout(() => {
                            window.PlanPageFixed.refreshDashboard();
                        }, 1500);
                    }
                    
                    // Manter compatibilidade com funções antigas
                    if (typeof window.refreshAllMetrics === 'function') {
                        console.info('✅ Atualizando todas as métricas após conclusão da sessão...');
                        setTimeout(() => {
                            window.refreshAllMetrics();
                        }, 1000);
                    } else if (typeof window.refreshGamificationData === 'function') {
                        setTimeout(() => {
                            window.refreshGamificationData();
                        }, 500);
                    }
                } catch (error) {
                    console.error('Erro ao atualizar métricas:', error);
                }
            }

            // Fechar modal e recarregar se necessário
            // Aguardar 3 segundos para dar tempo de ler a notificação
            setTimeout(() => {
                this.close();
                if (!window.location.pathname.includes('plan.html')) {
                    // Esperar mais 500ms após fechar o modal para suavizar a transição
                    setTimeout(() => location.reload(), 500);
                }
            }, 3000);
            
        } catch (error) {
            console.error('Erro ao concluir sessão:', error);
            app.showToast('Erro ao concluir sessão', 'error');
            
            // Reabilitar botão em caso de erro
            const completeBtn = document.getElementById('modal-complete-btn');
            if (completeBtn) {
                completeBtn.disabled = false;
                completeBtn.innerHTML = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Marcar como Concluído';
            }
        }
    },

    close() {
        // CORREO: NO parar o timer automaticamente
        // Timer continua rodando em background para permitir continuao
        // if (this.session) {
        //     TimerSystem.stop(this.session.id);
        // }
        
        const modal = document.getElementById('studySessionModal');
        const modalContainer = document.getElementById('studySessionModalContainer');
        
        modal.classList.add('opacity-0');
        modalContainer.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modalContainer.innerHTML = '';
            // NO limpar this.session para permitir reconexo
            // this.session = null;
        }, 300);
    },
    
    getChecklistHtml() {
        return `
            <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-editaliza-black mb-2">Preparado para Estudar? 📖</h2>
                <p class="text-gray-600 text-sm">${this.getRandomQuote()}</p>
            </div>
            
            <div class="space-y-3 mb-6">
                ${this.items.map(item => `
                    <label class="checklist-row flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-all">
                        <input type="checkbox" id="checklist-${item.id}" class="checklist-item w-5 h-5 text-editaliza-blue rounded focus:ring-editaliza-blue">
                        <span class="checkmark-visual inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-gray-300 text-white transition-all">
                            <svg class="checkmark-icon w-4 h-4 opacity-0 transform scale-50 transition-all" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" clip-rule="evenodd" />
                            </svg>
                        </span>
                        <span class="text-2xl">${item.icon}</span>
                        <div class="flex-1">
                            <span class="checklist-text text-gray-700 font-medium">${item.text}</span>
                            <p class="checklist-tip text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">${item.tip}</p>
                        </div>
                    </label>
                `).join('')}
            </div>
            
            <div class="space-y-3">
                <button id="start-study-btn" class="w-full btn-primary py-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                    Vamos lá! 🚀
                </button>
                <button id="skip-checklist-btn" class="w-full text-sm text-gray-500 hover:text-gray-700 font-medium">
                    Pular desta vez
                </button>
            </div>
        `;
    },

    getTimerHtml() {
        // Sanitize data before rendering
        const safeSubjectName = app.sanitizeHtml(this.session.subject_name);
        const safeTopicDescription = app.sanitizeHtml(this.session.topic_description);
        const safeNotes = app.sanitizeHtml(this.session.notes || '');
        const safeQuestionsSolved = app.sanitizeHtml(this.session.questions_solved || '');

        const style = app.getSubjectStyle(this.session.subject_name);
        return `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-800 flex items-center"><span class="text-3xl mr-3">${style.icon}</span>${safeSubjectName}</h2>
                <button onclick="StudyChecklist.close()" class="text-gray-400 hover:text-gray-600 text-3xl font-light"></button>
            </div>
            <p class="mb-6 text-gray-600">${safeTopicDescription}</p>
            
            ${TimerSystem.createTimerUI(this.session.id)}

            <div class="mt-6 space-y-4">
                 <div>
                    <label for="modal-questions-solved" class="text-sm font-medium text-gray-700">Questões Resolvidas</label>
                    <input type="number" id="modal-questions-solved" value="${safeQuestionsSolved}" class="form-input py-2" placeholder="0">
                </div>
                <div>
                    <label for="modal-notes" class="text-sm font-medium text-gray-700">Anotações</label>
                    <textarea id="modal-notes" class="form-input py-2" rows="4" placeholder="Suas anotações...">${safeNotes}</textarea>
                </div>
            </div>

            <div class="mt-6 pt-6 border-t flex items-center justify-end space-x-3">
                <button id="modal-complete-btn" onclick="StudyChecklist.markAsComplete()" class="btn-success py-3 px-6 text-sm font-medium flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Marcar como Concluído
                </button>
                <button onclick="StudyChecklist.close()" class="btn-secondary py-3 px-6 text-sm font-medium">Fechar</button>
            </div>
        `;
    },

    addChecklistListeners() {
        const startBtn = document.getElementById('start-study-btn');
        const skipBtn = document.getElementById('skip-checklist-btn');
        
        document.querySelectorAll('.checklist-item').forEach(cb => cb.addEventListener('change', (e) => {
            const input = e.target;
            const row = input.closest('label.checklist-row');
            if (row) {
                if (input.checked) {
                    row.classList.add('checked');
                } else {
                    row.classList.remove('checked');
                }
            }
            this.playCheckSound();
            const allChecked = this.items.every(item => document.getElementById(`checklist-${item.id}`).checked);
            startBtn.disabled = !allChecked;
        }));
        
        startBtn.addEventListener('click', () => this.startStudySession(true)); // CORREO 2: Indica que deve iniciar timer
        skipBtn.addEventListener('click', () => {
            // Mark session as checklist shown and close modal without starting study
            if (this.session && this.session.id) {
                this.checklistShownSessions.add(this.session.id);
                console.info(`Sessão ${this.session.id} - Checklist pulado, fechando modal`);
            }
            this.close();
        });
    },

    addTimerSessionListeners() {
        const updateSessionData = app.debounce(async (field, value) => {
            try {
                // CORREO 3: Usar endpoint correto e validar dados
                const endpoint = `/sessions/${this.session.id}`;
                const payload = { [field]: value };
                console.info('Salvando dados da sessão:', { sessionId: this.session.id, field, value });
                
                await app.apiFetch(endpoint, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });
                this.session[field] = value;
                console.info('Dados salvos com sucesso');
            } catch (error) {
                console.error('Erro ao salvar dados da sessão:', error);
                app.showToast('Erro ao salvar dados da sessão: ' + error.message, 'error');
            }
        }, 1000);
        
        // CORREO 4: Salvar tempo do timer periodicamente
        if (window.TimerSystem && this.session) {
            const sessionId = this.session.id;
            
            // Salvar tempo periodicamente se timer estiver ativo
            const saveTimer = setInterval(() => {
                if (TimerSystem.timers[sessionId] && TimerSystem.timers[sessionId].isRunning) {
                    const timerData = TimerSystem.timers[sessionId];
                    const secondsElapsed = Math.floor(timerData.elapsed / 1000);
                    if (secondsElapsed > 10) { // Só salvar após 10 segundos
                        // Persistir via endpoint dedicado de tempo
                        // O timer salva automaticamente a cada 30 segundos
                    }
                }
            }, 30000); // A cada 30 segundos
            
            // Limpar intervalo quando modal for fechado
            window.addEventListener('beforeunload', () => clearInterval(saveTimer));
        }

        // CORREO: Verificar se os elementos existem antes de adicionar event listeners
        const questionsElement = document.getElementById('modal-questions-solved');
        const notesElement = document.getElementById('modal-notes');
        const _statusElement = document.getElementById('modal-status');

        if (questionsElement) {
            questionsElement.addEventListener('input', (e) => updateSessionData('questions_solved', e.target.value));
        } else {
            console.warn('⚠️ Elemento modal-questions-solved não encontrado');
        }

        if (notesElement) {
            notesElement.addEventListener('input', (e) => updateSessionData('notes', e.target.value));
        } else {
            console.warn('⚠️ Elemento modal-notes não encontrado');
        }

        // Remove old status element listener since we're using a button now
        // Button click is handled by markAsComplete() function
    },

    addAnimations() {
        if (document.getElementById('checklist-animations')) return;
        const style = document.createElement('style');
        style.id = 'checklist-animations';
        style.textContent = `
            .checklist-item:checked + span + div span { text-decoration: line-through; color: #10b981; }
            .checklist-item:checked + span { animation: bounce 0.5s ease-out; }
            @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        `;
        document.head.appendChild(style);
    },

    playCheckSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.05);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) { console.error('Web Audio API not supported', e); }
    },
    
    getRandomQuote() {
        return this.motivationalQuotes[Math.floor(Math.random() * this.motivationalQuotes.length)];
    },

    // CORREO 1: Adicionar listener para fechar modal ao clicar fora
    addModalClickListener() {
        const modal = document.getElementById('studySessionModal');
        modal.addEventListener('click', (event) => {
            // Se clicou no overlay (fundo), mas no no container do modal
            if (event.target === modal) {
                this.close();
            }
        });
    },
    
    // UNIFIED: Combined function to mark as completed AND capture study time
    async markAsCompleted() {
        if (!this.session) return;
        
        try {
            // Capture time from timer if running
            const sessionId = this.session.id;
            let studyTimeSeconds = 0;
            
            if (window.TimerSystem && TimerSystem.timers[sessionId]) {
                const timerData = TimerSystem.timers[sessionId];
                studyTimeSeconds = Math.floor(timerData.elapsed / 1000);
                
                // Stop the timer and mark session as completed
                TimerSystem.stop(sessionId);
                
                // CORREO: Marcar timer como concludo para evitar boto "Continuar"
                if (TimerSystem.timers[sessionId]) {
                    TimerSystem.timers[sessionId].isCompleted = true;
                }
                
                // Limpar do localStorage para evitar reaparecimento
                TimerSystem.clearStoredTimer(sessionId);
                
                console.info(`⏱️ Timer parado e sessão marcada como concluída. Tempo capturado: ${studyTimeSeconds} segundos`);
            }
            
            // Get notes and questions from modal
            const notesElement = document.getElementById('modal-notes');
            const questionsElement = document.getElementById('modal-questions-solved');
            
            const notes = notesElement ? notesElement.value.trim() : '';
            const questionsSolved = questionsElement ? parseInt(questionsElement.value) || 0 : 0;
            
            // Ensure minimum time for validation (API requires minimum 60 seconds)
            const timeToSend = Math.max(studyTimeSeconds, 60);
            
            // Save to database using dedicated completion endpoint
            const endpoint = `/sessions/${sessionId}/complete`;
            await app.apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    timeStudied: timeToSend,
                    questionsSolved: questionsSolved,
                    notes: notes
                })
            });
            
            // Show appropriate success message
            const timeMessage = studyTimeSeconds > 0 ? ` (${TimerSystem.formatTime(studyTimeSeconds * 1000)} estudados)` : '';
            app.showToast(`✅ Sessão marcada como concluída${timeMessage}!`, 'success');
            
            console.info(`✅ Sessão ${sessionId} finalizada com sucesso`);
            
            // Update client cache/state
            if (window.updateDashboardStats) {
                window.updateDashboardStats();
            }
            if (window.todaySessionsData && Array.isArray(window.todaySessionsData)) {
                const idx = window.todaySessionsData.findIndex(s => String(s.id) === String(sessionId));
                if (idx !== -1) {
                    window.todaySessionsData[idx].status = 'Concluído';
                    window.todaySessionsData[idx].completed_at = new Date().toISOString();
                }
            }
            
            // CORREO: Atualizar visual do card imediatamente
            setTimeout(() => {
                // Atualizar visual do card - buscar pelo ID do card
                const card = document.getElementById(`session-card-${sessionId}`);
                if (card) {
                    card.classList.add('completed');
                    // Desabilitar botão de iniciar
                    const startBtn = card.querySelector('.start-study-btn');
                    if (startBtn) {
                        startBtn.disabled = true;
                        startBtn.textContent = 'Concluído';
                        startBtn.classList.add('btn-completed');
                    }
                    // Também desabilitar botão de adiar
                    const postponeBtn = card.querySelector('.postpone-btn');
                    if (postponeBtn) {
                        postponeBtn.style.display = 'none';
                    }
                }
            }, 100);
            
            // Close modal
            this.close();
            
            // Reload page if not on plan.html
            // Aguardar 3.5 segundos para dar tempo de ler a notificação
            if (!window.location.pathname.includes('plan.html')) {
                setTimeout(() => location.reload(), 3500);
            }
            
        } catch (error) {
            console.error('❌ Erro ao marcar sessão como concluída:', error);
            app.showToast('Erro ao salvar dados da sesso. Tente novamente.', 'error');
        }
    },
    
    // LEGACY: Keep for backward compatibility but redirect to markAsCompleted
    async finishSessionWithTime() {
        console.info('⚠️ finishSessionWithTime is deprecated, redirecting to markAsCompleted');
        return this.markAsCompleted();
    }
};

// Expor globalmente
window.StudyChecklist = StudyChecklist;
