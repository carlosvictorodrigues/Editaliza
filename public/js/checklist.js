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
        { id: 'snacks', icon: '🍎', text: 'Café ultra forte e lanche preparados?', tip: 'Energia para o cérebro' },
        { id: 'comfort', icon: '🪑', text: 'Postura confortável?', tip: 'Cuide da sua coluna' },
        { id: 'mindset', icon: '💪', text: 'Vontade de vencer ativada?', tip: 'Você consegue!' }
    ],

    motivationalQuotes: [
        "A aprovação está mais perto do que você imagina! 🎯",
        "Cada minuto de estudo é um passo em direção ao seu sonho! ✨",
        "Hoje você está construindo o seu futuro! 🚀",
        "Disciplina é a ponte entre objetivos e conquistas! 🌉",
        "O sucesso é a soma de pequenos esforços repetidos dia após dia! 💫",
        "Você não chegou até aqui para desistir agora! 🔥",
        "Foco no processo, o resultado é consequência! 📈",
        "Grandes jornadas começam com pequenos passos! 👣"
    ],

    show(sessionObject) {
        this.session = sessionObject;
        
        // Check if checklist was already shown for this session or if timer is active
        const hasActiveTimer = window.TimerSystem && TimerSystem.hasActiveTimer(sessionObject.id);
        const checklistAlreadyShown = this.checklistShownSessions.has(sessionObject.id);
        
        if (hasActiveTimer || checklistAlreadyShown) {
            console.log(`⚡ Sessão ${sessionObject.id} - Pulando checklist (timer ativo: ${hasActiveTimer}, já mostrado: ${checklistAlreadyShown})`);
            // Skip checklist and go directly to timer
            this.startStudySession(false); // Don't start new timer if one is already active
            return;
        }
        
        console.log(`📋 Mostrando checklist para sessão ${sessionObject.id} pela primeira vez`);
        
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
        this.addModalClickListener(); // CORREÇÃO 1: Fechar modal ao clicar fora
    },

    startStudySession(shouldStartTimer = true) { // CORREÇÃO 2: Controla se deve iniciar o timer
        // Mark this session as having shown the checklist
        if (this.session && this.session.id) {
            this.checklistShownSessions.add(this.session.id);
            console.log(`✅ Sessão ${this.session.id} marcada como checklist mostrado`);
        }
        
        const modalContainer = document.getElementById('studySessionModalContainer');
        modalContainer.innerHTML = this.getTimerHtml();
        this.addTimerSessionListeners();
        
        // CORREÇÃO: Verificar se já existe timer ativo antes de iniciar
        const existingTimer = TimerSystem.getActiveTimer(this.session.id);
        
        if (existingTimer) {
            // Timer já está rodando, apenas conectar
            console.log('Reconectando ao timer ativo:', this.session.id);
            TimerSystem.updateButton(this.session.id, true);
        } else if (shouldStartTimer) {
            // Iniciar novo timer
            TimerSystem.start(this.session.id);
        }
        
        // Atualizar display imediatamente
        TimerSystem.updateDisplay(this.session.id);
    },

    close() {
        // CORREÇÃO: NÃO parar o timer automaticamente
        // Timer continua rodando em background para permitir continuação
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
            // NÃO limpar this.session para permitir reconexão
            // this.session = null;
        }, 300);
    },
    
    getChecklistHtml() {
        return `
            <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-editaliza-black mb-2">Preparado para Estudar? 🎯</h2>
                <p class="text-gray-600 text-sm">${this.getRandomQuote()}</p>
            </div>
            
            <div class="space-y-3 mb-6">
                ${this.items.map(item => `
                    <label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">
                        <input type="checkbox" id="checklist-${item.id}" class="w-5 h-5 text-editaliza-blue rounded focus:ring-editaliza-blue checklist-item">
                        <span class="text-2xl">${item.icon}</span>
                        <div class="flex-1">
                            <span class="text-gray-700 font-medium">${item.text}</span>
                            <p class="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">${item.tip}</p>
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
                <button onclick="StudyChecklist.close()" class="text-gray-400 hover:text-gray-600 text-3xl font-light">×</button>
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
                <div>
                    <label for="modal-status" class="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" id="modal-status" class="w-5 h-5 text-editaliza-blue rounded focus:ring-editaliza-blue">
                        <span class="text-sm font-medium text-gray-700">Marcar como concluído</span>
                    </label>
                </div>
            </div>

            <div class="mt-6 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex space-x-3">
                    <button onclick="StudyChecklist.markAsCompleted()" class="btn-primary py-3 px-6 text-sm font-medium flex items-center space-x-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                        </svg>
                        <span>Marcar como Concluído</span>
                    </button>
                    <button onclick="StudyChecklist.close()" class="btn-secondary py-3 px-6 text-sm font-medium">Fechar</button>
                </div>
            </div>
        `;
    },

    addChecklistListeners() {
        const startBtn = document.getElementById('start-study-btn');
        const skipBtn = document.getElementById('skip-checklist-btn');
        
        document.querySelectorAll('.checklist-item').forEach(cb => cb.addEventListener('change', () => {
            this.playCheckSound();
            const allChecked = this.items.every(item => document.getElementById(`checklist-${item.id}`).checked);
            startBtn.disabled = !allChecked;
        }));
        
        startBtn.addEventListener('click', () => this.startStudySession(true)); // CORREÇÃO 2: Indica que deve iniciar timer
        skipBtn.addEventListener('click', () => {
            // Mark session as checklist shown and close modal without starting study
            if (this.session && this.session.id) {
                this.checklistShownSessions.add(this.session.id);
                console.log(`⏭️ Sessão ${this.session.id} - Checklist pulado, fechando modal`);
            }
            this.close();
        });
    },

    addTimerSessionListeners() {
        const updateSessionData = app.debounce(async (field, value) => {
            try {
                // CORREÇÃO 3: Usar endpoint correto e validar dados
                const endpoint = `/schedules/sessions/${this.session.id}`;
                const payload = { [field]: value };
                console.log('Salvando dados da sessão:', { sessionId: this.session.id, field, value });
                
                await app.apiFetch(endpoint, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });
                this.session[field] = value;
                console.log('Dados salvos com sucesso');
            } catch (error) {
                console.error('Erro ao salvar dados da sessão:', error);
                app.showToast('Erro ao salvar dados da sessão: ' + error.message, 'error');
            }
        }, 1000);
        
        // CORREÇÃO 4: Salvar tempo do timer periodicamente
        if (window.TimerSystem && this.session) {
            const sessionId = this.session.id;
            
            // Salvar tempo periodicamente se timer estiver ativo
            const saveTimer = setInterval(() => {
                if (TimerSystem.timers[sessionId] && TimerSystem.timers[sessionId].isRunning) {
                    const timerData = TimerSystem.timers[sessionId];
                    const secondsElapsed = Math.floor(timerData.elapsed / 1000);
                    if (secondsElapsed > 10) { // Só salvar após 10 segundos
                        updateSessionData('time_studied_seconds', secondsElapsed);
                    }
                }
            }, 30000); // A cada 30 segundos
            
            // Limpar intervalo quando modal for fechado
            window.addEventListener('beforeunload', () => clearInterval(saveTimer));
        }

        // CORREÇÃO: Verificar se os elementos existem antes de adicionar event listeners
        const questionsElement = document.getElementById('modal-questions-solved');
        const notesElement = document.getElementById('modal-notes');
        const statusElement = document.getElementById('modal-status');

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

        if (statusElement) {
            statusElement.addEventListener('change', async (e) => {
                const newStatus = e.target.checked ? 'Concluído' : 'Pendente';
                try {
                    // CORREÇÃO 3: Usar endpoint correto
                    const endpoint = `/schedules/sessions/${this.session.id}`;
                    console.log('Atualizando status da sessão:', { sessionId: this.session.id, status: newStatus });
                    
                    await app.apiFetch(endpoint, {
                        method: 'PATCH',
                        body: JSON.stringify({ 'status': newStatus })
                    });
                    console.log('Status atualizado com sucesso');
                } catch (error) {
                    console.error('Erro ao atualizar status:', error);
                    app.showToast('Erro ao salvar status: ' + error.message, 'error');
                    e.target.checked = !e.target.checked; // Reverter checkbox em caso de erro
                    return;
                }

                // ***** CORREÇÃO APLICADA AQUI *****
                // Invalida o cache do plano para que a tela de Desempenho busque os novos dados.
                app.invalidatePlanCache(this.session.study_plan_id);
                
                // CORREÇÃO: Disparar evento de atualização de métricas
                app.triggerMetricsUpdate(this.session.study_plan_id, 'session_status_changed');
                
                // CORREÇÃO: Atualizar TODAS as métricas quando sessão é concluída
                if (newStatus === 'Concluído') {
                    console.log('✅ Sessão concluída - atualizando estatísticas...');
                    app.invalidatePlanCache(this.session.study_plan_id, 'gamification');
                    
                    // CORREÇÃO: Atualizar TODAS as métricas se estivermos na tela plan.html
                    if (window.location.pathname.includes('plan.html')) {
                        try {
                            if (typeof window.refreshAllMetrics === 'function') {
                                console.log('🔄 Atualizando todas as métricas após conclusão da sessão...');
                                setTimeout(() => {
                                    window.refreshAllMetrics();
                                }, 1000); // Delay para garantir que backend processou
                            } else if (typeof window.refreshGamificationData === 'function') {
                                // Fallback para função antiga
                                setTimeout(() => {
                                    window.refreshGamificationData();
                                }, 500);
                            }
                        } catch (error) {
                            console.error('Erro ao atualizar métricas:', error);
                        }
                    }
                }

                app.showToast(newStatus === 'Concluído' ? 'Sessão concluída! 🎉 As métricas serão atualizadas...' : 'Status da tarefa atualizado!', 'success');
                
                // CORREÇÃO: Não atualizar painéis aqui, deixar para a função global fazer isso
                // O refresh será feito pela função refreshAllMetrics() chamada acima
                
                if (e.target.checked) {
                    this.close();
                    // Não precisa mais recarregar a página inteira, já atualizamos os painéis
                    if (!window.location.pathname.includes('plan.html')) {
                        location.reload(); 
                    }
                }
            });
        } else {
            console.warn('⚠️ Elemento modal-status não encontrado');
        }
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
        } catch (e) { console.error("Web Audio API not supported", e); }
    },
    
    getRandomQuote() {
        return this.motivationalQuotes[Math.floor(Math.random() * this.motivationalQuotes.length)];
    },

    // CORREÇÃO 1: Adicionar listener para fechar modal ao clicar fora
    addModalClickListener() {
        const modal = document.getElementById('studySessionModal');
        modal.addEventListener('click', (event) => {
            // Se clicou no overlay (fundo), mas não no container do modal
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
                
                // CORREÇÃO: Marcar timer como concluído para evitar botão "Continuar"
                if (TimerSystem.timers[sessionId]) {
                    TimerSystem.timers[sessionId].isCompleted = true;
                }
                
                // Limpar do localStorage para evitar reaparecimento
                TimerSystem.clearStoredTimer(sessionId);
                
                console.log(`⏱️ Timer parado e sessão marcada como concluída. Tempo capturado: ${studyTimeSeconds} segundos`);
            }
            
            // Get notes and questions from modal
            const notesElement = document.getElementById('modal-notes');
            const questionsElement = document.getElementById('modal-questions-solved');
            
            const notes = notesElement ? notesElement.value.trim() : '';
            const questionsSolved = questionsElement ? parseInt(questionsElement.value) || 0 : 0;
            
            // Prepare update payload
            const updateData = { 
                status: 'Concluído'
            };
            
            // Add study time if there was timer activity
            if (studyTimeSeconds > 0) {
                updateData.study_time_seconds = studyTimeSeconds;
            }
            
            // Add notes if provided
            if (notes) {
                updateData.notes = notes;
            }
            
            // Add questions solved if provided
            if (questionsSolved > 0) {
                updateData.questions_solved = questionsSolved;
            }
            
            // Save to database
            const endpoint = `/schedules/sessions/${sessionId}`;
            await app.apiFetch(endpoint, {
                method: 'PATCH',
                body: JSON.stringify(updateData)
            });
            
            // Show appropriate success message
            const timeMessage = studyTimeSeconds > 0 ? ` (${TimerSystem.formatTime(studyTimeSeconds * 1000)} estudados)` : '';
            app.showToast(`✅ Sessão marcada como concluída${timeMessage}!`, 'success');
            
            console.log(`✅ Sessão ${sessionId} finalizada:`, updateData);
            
            // Update dashboard stats if available
            if (window.updateDashboardStats) {
                window.updateDashboardStats();
            }
            
            // CORREÇÃO: Atualizar visual do card imediatamente
            setTimeout(() => {
                TimerSystem.updateCardVisuals(sessionId);
            }, 100);
            
            // Close modal
            this.close();
            
            // Reload page if not on plan.html
            if (!window.location.pathname.includes('plan.html')) {
                setTimeout(() => location.reload(), 1000);
            }
            
        } catch (error) {
            console.error('❌ Erro ao marcar sessão como concluída:', error);
            app.showToast('Erro ao salvar dados da sessão. Tente novamente.', 'error');
        }
    },
    
    // LEGACY: Keep for backward compatibility but redirect to markAsCompleted
    async finishSessionWithTime() {
        console.log('⚠️ finishSessionWithTime is deprecated, redirecting to markAsCompleted');
        return this.markAsCompleted();
    }
};