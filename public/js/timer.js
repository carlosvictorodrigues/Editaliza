/**
 * @file js/timer.js
 * @description Sistema de cronômetro para sessões de estudo (O Motor).
 */

const TimerSystem = {
    timers: {}, // { sessionId: { startTime, elapsed, isRunning, pomodoros } }
    
    // Novos métodos para persistência
    getActiveTimer(sessionId) {
        const timer = this.timers[sessionId];
        return timer && timer.isRunning ? timer : null;
    },
    
    hasActiveTimer(sessionId) {
        return !!(this.timers[sessionId] && this.timers[sessionId].isRunning);
    },
    
    getTimerElapsed(sessionId) {
        const timer = this.timers[sessionId];
        return timer ? timer.elapsed : 0;
    },
    
    formatTime(milliseconds) {
        // Garantir que não seja negativo
        const ms = Math.max(0, milliseconds);
        const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
        const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    },
    
    // O `createTimerUI` foi movido para checklist.js para um controle centralizado do modal
    createTimerUI(sessionId) {
        const sessionDuration = 50; // Duração padrão, pode ser aprimorado para buscar do plano
        // Este HTML é gerado dentro do modal pela `checklist.js` agora.
        return `
            <div class="timer-container mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="timer-display text-3xl font-mono font-bold text-editaliza-blue" data-session="${sessionId}">00:00:00</div>
                    </div>
                    <div class="timer-controls flex items-center space-x-2">
                        <button onclick="TimerSystem.toggle(${sessionId})" class="btn-timer-toggle px-4 py-2 bg-editaliza-blue text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md flex items-center space-x-2" data-session="${sessionId}">
                           <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg><span>Iniciar</span>
                        </button>
                    </div>
                </div>
                 <div class="mt-3">
                    <div class="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progresso da Sessão</span><span class="pomodoro-status" data-session="${sessionId}" data-duration="${sessionDuration}">0 / ${sessionDuration} min</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2"><div class="pomodoro-progress bg-editaliza-green h-2 rounded-full transition-all" data-session="${sessionId}" style="width: 0%"></div></div>
                </div>
                 <div class="mt-2 flex items-center space-x-1"><span class="text-xs text-gray-600">Pomodoros:</span><div class="pomodoro-dots flex space-x-1" data-session="${sessionId}"></div></div>
            </div>`;
    },

    start(sessionId) {
        // CORREÇÃO 3: Inicializar áudio na primeira interação
        this.initAudio();
        
        console.log(`⏰ Iniciando timer para sessão ${sessionId}`);
        
        if (!this.timers[sessionId]) {
            this.timers[sessionId] = { 
                startTime: Date.now(), 
                elapsed: 0, 
                isRunning: true, 
                pomodoros: 0,
                lastPomodoroNotified: 0 // CORREÇÃO 3: Controlar notificações duplicadas
            };
        } else {
            this.timers[sessionId].startTime = Date.now() - this.timers[sessionId].elapsed;
            this.timers[sessionId].isRunning = true;
        }
        
        this.timers[sessionId].interval = setInterval(() => this.update(sessionId), 1000); // CORREÇÃO: Reduzir frequência para 1s
        this.updateButton(sessionId, true);
        this.saveTimersToStorage(); // Salvar estado
    },

    stop(sessionId) {
        if (this.timers[sessionId] && this.timers[sessionId].isRunning) {
            this.timers[sessionId].isRunning = false;
            clearInterval(this.timers[sessionId].interval);
            this.timers[sessionId].interval = null;
            this.updateButton(sessionId, false);
            this.saveTimersToStorage(); // Salvar estado pausado
            this.saveTimeToDatabase(sessionId, Math.floor(this.timers[sessionId].elapsed / 1000));
        }
    },

    toggle(sessionId) {
        if (!this.timers[sessionId] || !this.timers[sessionId].isRunning) this.start(sessionId);
        else this.stop(sessionId);
    },

    update(sessionId) {
        if (!this.timers[sessionId] || !this.timers[sessionId].isRunning) return;
        
        this.timers[sessionId].elapsed = Date.now() - this.timers[sessionId].startTime;
        this.updateDisplay(sessionId);
        
        // CORREÇÃO 3: Melhorar detecção de pomodoros completos
        const completedPomodoros = Math.floor((this.timers[sessionId].elapsed / 60000) / 25);
        const lastNotified = this.timers[sessionId].lastPomodoroNotified || 0;
        
        if (completedPomodoros > lastNotified && completedPomodoros > 0) {
            console.log(`🍅 Pomodoro ${completedPomodoros} completado para sessão ${sessionId}`);
            this.timers[sessionId].pomodoros = completedPomodoros;
            this.timers[sessionId].lastPomodoroNotified = completedPomodoros;
            this.notifyPomodoroComplete();
            this.saveTimersToStorage(); // Salvar progresso
        }
    },

    updateDisplay(sessionId) {
        const timerData = this.timers[sessionId];
        if (!timerData) return;

        const display = document.querySelector(`#studySessionModal .timer-display[data-session="${sessionId}"]`);
        const progressBar = document.querySelector(`#studySessionModal .pomodoro-progress[data-session="${sessionId}"]`);
        const statusText = document.querySelector(`#studySessionModal .pomodoro-status[data-session="${sessionId}"]`);
        const dotsContainer = document.querySelector(`#studySessionModal .pomodoro-dots[data-session="${sessionId}"]`);
        
        // CORREÇÃO: Timer continua rodando mesmo sem modal visível
        // Atualizar cards externos também
        this.updateCardVisuals(sessionId);
        
        if (!display) return; // Se o modal não estiver visível, não atualiza display interno
        
        const h = Math.floor(timerData.elapsed / 3600000).toString().padStart(2, '0');
        const m = Math.floor((timerData.elapsed % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((timerData.elapsed % 60000) / 1000).toString().padStart(2, '0');
        display.textContent = `${h}:${m}:${s}`;
        
        if (progressBar && statusText) {
            const minutes = Math.floor(timerData.elapsed / 60000);
            const sessionDuration = parseInt(statusText.dataset.duration) || 50;
            const progress = Math.min((minutes / sessionDuration) * 100, 100);
            progressBar.style.width = `${progress}%`;
            statusText.textContent = `${minutes} / ${sessionDuration} min`;
        }

        if (dotsContainer) {
            dotsContainer.innerHTML = Array(timerData.pomodoros).fill('<div class="w-2 h-2 bg-editaliza-green rounded-full"></div>').join('');
        }
    },
    
    // CORREÇÃO: Método melhorado para atualizar visuais dos cards com tempo preciso
    updateCardVisuals(sessionId) {
        const timerData = this.timers[sessionId];
        
        // Atualizar botão do card para mostrar timer ativo
        const studyButton = document.querySelector(`button[onclick="window.openStudySession(${sessionId})"]`);
        if (studyButton) {
            // Remover todas as classes de estado anterior
            studyButton.classList.remove(
                'bg-blue-600', 'hover:bg-blue-700', 
                'bg-orange-500', 'hover:bg-orange-600', 
                'bg-yellow-500', 'hover:bg-yellow-600',
                'bg-green-600', 'hover:bg-green-700',
                'animate-pulse'
            );
            
            // CORREÇÃO: Verificar se sessão foi concluída
            if (timerData && timerData.isCompleted) {
                // Sessão concluída - verde com ícone de check
                studyButton.classList.add('bg-green-600', 'hover:bg-green-700');
                studyButton.innerHTML = `✅ Concluído`;
                studyButton.disabled = true;
                studyButton.style.cursor = 'not-allowed';
                studyButton.style.opacity = '0.7';
                console.log(`✅ Card atualizado - Sessão concluída: ${sessionId}`);
                return;
            }
            
            if (!timerData) {
                // Sem timer - azul padrão  
                studyButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
                studyButton.innerHTML = `🚀 Iniciar Estudo`;
                studyButton.disabled = false;
                studyButton.style.cursor = 'pointer';
                studyButton.style.opacity = '1';
                return;
            }
            
            const isRunning = timerData.isRunning;
            const hasTime = timerData.elapsed > 1000; // Mais de 1 segundo
            const timeStr = hasTime ? this.formatTime(timerData.elapsed) : '00:00:00';
            
            if (isRunning) {
                // Timer rodando - laranja pulsante com tempo atualizado
                studyButton.classList.add('bg-orange-500', 'hover:bg-orange-600', 'animate-pulse');
                studyButton.innerHTML = `⏱️ Estudando (${timeStr.substring(0, 5)})`;
                studyButton.disabled = false;
                studyButton.style.cursor = 'pointer';
                studyButton.style.opacity = '1';
                console.log(`🔄 Card atualizado - Timer rodando: ${timeStr}`);
            } else if (hasTime) {
                // Timer pausado com tempo - amarelo com tempo exato
                studyButton.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
                studyButton.innerHTML = `⏸️ Continuar (${timeStr.substring(0, 5)})`;
                studyButton.disabled = false;
                studyButton.style.cursor = 'pointer';
                studyButton.style.opacity = '1';
                console.log(`🔄 Card atualizado - Timer pausado: ${timeStr}`);
            } else {
                // Sem timer - azul padrão  
                studyButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
                studyButton.innerHTML = `🚀 Iniciar Estudo`;
                studyButton.disabled = false;
                studyButton.style.cursor = 'pointer';
                studyButton.style.opacity = '1';
            }
        }
        
        // CORREÇÃO: Também atualizar qualquer display de tempo visível no card
        const cardTimeDisplay = document.querySelector(`[data-session-time="${sessionId}"]`);
        if (cardTimeDisplay && timerData.elapsed > 0) {
            cardTimeDisplay.textContent = this.formatTime(timerData.elapsed);
        }
    },
    
    updateButton(sessionId, isRunning) {
        const button = document.querySelector(`#studySessionModal .btn-timer-toggle[data-session="${sessionId}"]`);
        if (!button) return;

        button.classList.remove('bg-editaliza-blue', 'hover:bg-blue-700', 'bg-orange-500', 'hover:bg-orange-600');
        
        if (isRunning) {
            button.classList.add('bg-orange-500', 'hover:bg-orange-600');
            button.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg><span>Pausar</span>`;
        } else {
            button.classList.add('bg-editaliza-blue', 'hover:bg-blue-700');
            const buttonText = (this.timers[sessionId]?.elapsed > 100) ? 'Continuar' : 'Iniciar';
            button.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg><span>${buttonText}</span>`;
        }
    },
    
    notifyPomodoroComplete() {
        // CORREÇÃO 3: Notificação mais robusta
        console.log('🍅 Executando notificação de Pomodoro completo...');
        
        // Notificação visual
        app.showToast('🍅 Pomodoro completo! Parabéns! Hora de uma pausa de 5 minutos.', 'success');
        
        // Vibração (se suportada)
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate([200, 100, 200, 100, 200]);
            } catch (e) {
                console.warn('⚠️ Vibração não suportada:', e.message);
            }
        }
        
        // Som (com fallbacks)
        this.playPomodoroSound();
        
        // Notificação do sistema (se permitida)
        this.showSystemNotification();
    },
    
    showSystemNotification() {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('🍅 Pomodoro Completo!', {
                    body: 'Parabéns! Você completou 25 minutos de estudo focado. Hora da pausa!',
                    icon: '/favicon.ico',
                    tag: 'pomodoro-complete'
                });
            } catch (e) {
                console.warn('⚠️ Notificação do sistema falhou:', e.message);
            }
        } else if ('Notification' in window && Notification.permission === 'default') {
            // Solicitar permissão para próxima vez
            Notification.requestPermission();
        }
    },

    // CORREÇÃO: Sistema de som melhorado com inicialização adequada
    audioContext: null,
    audioInitialized: false,
    
    // CORREÇÃO 3: Inicializar contexto de áudio melhorado
    initAudio() {
        if (this.audioInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resolver problema de autoplay policy de forma mais robusta
            const resumeAudio = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        console.log('🎵 Contexto de áudio ativado');
                    }).catch(e => {
                        console.warn('⚠️ Não foi possível ativar áudio:', e.message);
                    });
                }
            };
            
            // Tentar ativar em vários eventos de interação
            ['click', 'keydown', 'touchstart'].forEach(event => {
                document.addEventListener(event, resumeAudio, { once: true });
            });
            
            // Tentar ativar imediatamente
            resumeAudio();
            
            this.audioInitialized = true;
            console.log('🎵 Sistema de áudio inicializado para notificações Pomodoro');
        } catch (e) {
            console.warn('⚠️ Web Audio API não suportada:', e.message);
            this.audioInitialized = false;
        }
    },
    
    playPomodoroSound() {
        // CORREÇÃO 3: Sistema de som melhorado com múltiplos fallbacks
        console.log('🎵 Tentando reproduzir notificação sonora do Pomodoro...');
        
        // Método 1: Tentar Web Audio API primeiro
        if (this.tryWebAudioNotification()) {
            console.log('✅ Som reproduzido via Web Audio API');
            return;
        }
        
        // Método 2: Fallback com HTML5 Audio
        if (this.tryHTML5AudioNotification()) {
            console.log('✅ Som reproduzido via HTML5 Audio');
            return;
        }
        
        // Método 3: Fallback com beep simples
        if (this.trySimpleBeep()) {
            console.log('✅ Som reproduzido via beep simples');
            return;
        }
        
        console.warn('⚠️ Não foi possível reproduzir som - usando apenas notificação visual');
    },
    
    tryWebAudioNotification() {
        try {
            // Garantir que o áudio esteja inicializado
            this.initAudio();
            
            if (!this.audioContext || !this.audioInitialized) {
                return false;
            }
            
            // Verificar se contexto está suspenso e tentar reativar
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    this.playWebAudioTones();
                });
            } else {
                this.playWebAudioTones();
            }
            return true;
        } catch (e) {
            console.warn('⚠️ Web Audio API falhou:', e.message);
            return false;
        }
    },
    
    playWebAudioTones() {
        try {
            this.playDingWarm();
        } catch (e) {
            console.error('❌ Erro nos tons Web Audio:', e.message);
            throw e;
        }
    },

    playDingWarm() {
        const masterGain = this.audioContext.createGain();
        masterGain.connect(this.audioContext.destination);
        masterGain.gain.setValueAtTime(0.4, this.audioContext.currentTime);

        function playTone(frequency, startTime, duration, volume = 0.22) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine'; // Sine mantém a suavidade
            osc.frequency.setValueAtTime(frequency, startTime);
            osc.connect(gain);
            gain.connect(masterGain);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(volume, startTime + 0.18);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.start(startTime);
            osc.stop(startTime + duration);
        }

        const now = this.audioContext.currentTime;
        playTone.call(this, 587.33, now, 1.4, 0.22);    // Ré
        playTone.call(this, 493.88, now + 0.35, 1.6, 0.18); // Si
    },
    
    tryHTML5AudioNotification() {
        try {
            // Criar um beep usando data URL
            const audioData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEbBzqS2MmNaS0GK4LV8N2ASAkTh9vx';
            const audio = new Audio(audioData);
            audio.volume = 0.3;
            const playPromise = audio.play();
            
            if (playPromise) {
                playPromise.catch(e => {
                    console.warn('⚠️ HTML5 Audio falhou:', e.message);
                });
            }
            return true;
        } catch (e) {
            console.warn('⚠️ HTML5 Audio não funcionou:', e.message);
            return false;
        }
    },
    
    trySimpleBeep() {
        try {
            // Beep simples usando frequency
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, context.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
            
            oscillator.start(context.currentTime);
            oscillator.stop(context.currentTime + 0.5);
            
            return true;
        } catch (e) {
            console.warn('⚠️ Beep simples falhou:', e.message);
            return false;
        }
    },

    // CORREÇÃO: Método para continuar timer sem abrir modal
    continueTimer(sessionId) {
        console.log(`🔄 Continuando timer para sessão ${sessionId}`);
        
        // Se timer já existe, apenas continuar
        if (this.timers[sessionId]) {
            this.start(sessionId);
        } else {
            // Carregar dados do localStorage e continuar
            this.loadTimersFromStorage();
            if (this.timers[sessionId]) {
                this.start(sessionId);
            } else {
                console.warn('⚠️ Nenhum timer encontrado para continuar. Iniciando novo.');
                this.start(sessionId);
            }
        }
        
        // Não abrir modal - apenas continuar o timer
        return true;
    },
    
    // Métodos de persistência em localStorage
    saveTimersToStorage() {
        try {
            const timersToSave = {};
            Object.keys(this.timers).forEach(sessionId => {
                const timer = this.timers[sessionId];
                if (timer.elapsed > 0 || timer.isRunning) {
                    // Salvar apenas dados necessários, removendo interval
                    timersToSave[sessionId] = {
                        startTime: timer.startTime,
                        elapsed: timer.elapsed,
                        isRunning: timer.isRunning,
                        pomodoros: timer.pomodoros,
                        lastPomodoroNotified: timer.lastPomodoroNotified,
                        savedAt: Date.now() // Timestamp para recuperação
                    };
                }
            });
            localStorage.setItem('editaliza_timers', JSON.stringify(timersToSave));
            console.log('💾 Timers salvos no localStorage:', Object.keys(timersToSave));
        } catch (error) {
            console.error('❌ Erro ao salvar timers no localStorage:', error);
        }
    },

    loadTimersFromStorage() {
        try {
            const saved = localStorage.getItem('editaliza_timers');
            if (!saved) return;

            const timersData = JSON.parse(saved);
            const now = Date.now();

            Object.keys(timersData).forEach(sessionId => {
                const timerData = timersData[sessionId];
                const timeSinceSave = now - (timerData.savedAt || now);
                
                // Recalcular elapsed se timer estava rodando
                let actualElapsed = timerData.elapsed;
                if (timerData.isRunning) {
                    actualElapsed += timeSinceSave;
                }

                this.timers[sessionId] = {
                    startTime: now - actualElapsed,
                    elapsed: actualElapsed,
                    isRunning: false, // Sempre carrega pausado para evitar problemas
                    pomodoros: timerData.pomodoros || 0,
                    lastPomodoroNotified: timerData.lastPomodoroNotified || 0,
                    interval: null
                };
            });

            console.log('🔄 Timers carregados do localStorage:', Object.keys(this.timers));
        } catch (error) {
            console.error('❌ Erro ao carregar timers do localStorage:', error);
        }
    },

    clearStoredTimer(sessionId) {
        try {
            // Limpar do localStorage
            const saved = localStorage.getItem('editaliza_timers');
            if (saved) {
                const timersData = JSON.parse(saved);
                delete timersData[sessionId];
                localStorage.setItem('editaliza_timers', JSON.stringify(timersData));
            }
            
            // CORREÇÃO: Remover completamente da memória local também
            if (this.timers[sessionId]) {
                // Parar interval se estiver rodando
                if (this.timers[sessionId].interval) {
                    clearInterval(this.timers[sessionId].interval);
                }
                // Remover da memória
                delete this.timers[sessionId];
            }
            
            console.log(`🗑️ Timer completamente removido: ${sessionId}`);
        } catch (error) {
            console.error('❌ Erro ao limpar timer:', error);
        }
    },

    async saveTimeToDatabase(sessionId, seconds) {
        if(seconds < 10) return; // Não salvar tempos muito curtos
        try {
            // CORREÇÃO: Usar nova rota modular e formato correto
            const now = new Date();
            const startTime = new Date(now.getTime() - seconds * 1000);
            
            await app.apiFetch(`/schedules/sessions/${sessionId}/time`, {
                method: 'POST',
                body: JSON.stringify({
                    start_time: startTime.toISOString(),
                    end_time: now.toISOString()
                })
            });
            console.log(`💾 Tempo salvo no banco: ${seconds}s para sessão ${sessionId}`);
        } catch (error) { 
            console.error('❌ Erro ao salvar tempo:', error); 
        }
    }
};

// CORREÇÃO: Carregar timers ao inicializar a página
document.addEventListener('DOMContentLoaded', () => {
    TimerSystem.loadTimersFromStorage();
    
    // CORREÇÃO: Atualizar visuais dos cards mais frequentemente para refletir tempo preciso
    setInterval(() => {
        Object.keys(TimerSystem.timers).forEach(sessionId => {
            const timerData = TimerSystem.timers[sessionId];
            // Só atualizar se há um timer com tempo significativo ou rodando
            if (timerData && (timerData.isRunning || timerData.elapsed > 1000)) {
                TimerSystem.updateCardVisuals(sessionId);
            }
        });
    }, 2000); // CORREÇÃO: Reduzir para 2 segundos para atualização mais freqüente
    
    // Atualizar imediatamente após carregar para mostrar timers pausados
    setTimeout(() => {
        console.log('🔄 Atualizando visuais dos timers na inicialização...');
        Object.keys(TimerSystem.timers).forEach(sessionId => {
            TimerSystem.updateCardVisuals(sessionId);
        });
    }, 1000);
    
    console.log('⚙️ TimerSystem inicializado e timers restaurados');
});

// Expor globalmente
window.TimerSystem = TimerSystem;