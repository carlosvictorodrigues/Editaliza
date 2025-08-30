/**
 * @file js/timer.js
 * @description Sistema robusto de cronômetro com state machine e auto-save idempotente
 * @version 2.0.0 - Implementação definitiva com proteção contra spam
 */

// ============================================================================
// STATE MACHINE - Um único ciclo sem overlap
// ============================================================================
const SAVE_INTERVAL = 30; // segundos
const MAX_INCREMENT = 600; // máximo de segundos por envio
const RETRY_BACKOFF = [5000, 10000, 15000]; // backoff exponencial com teto

// Estado global do timer
let state = {
    running: false,
    accumulated: 0,          // segundos acumulados desde último save
    inflight: false,         // requisição em voo
    cooldownUntil: 0,        // timestamp até quando não pode salvar
    retryCount: 0,           // contador de retries para backoff
    sessionId: null,
    intervalId: null,
    lastSaveAt: 0,           // timestamp do último save bem-sucedido
    totalSeconds: 0,         // total de segundos salvos no servidor
    displayInterval: null,   // interval para atualizar display
    startTime: null,         // timestamp de início do timer
    pausedElapsed: 0        // tempo acumulado antes de pausar
};

// Toast control - evita spam
let lastTimerToastAt = 0;

/**
 * Mostra toast uma vez por minuto no máximo
 */
function showTimerToastOncePerMinute(msg, type = 'error') {
    if (Date.now() - lastTimerToastAt < 60000) return;
    lastTimerToastAt = Date.now();
    
    if (window.app && window.app.showToast) {
        window.app.showToast(msg, type);
    } else {
        console.warn(`[TIMER TOAST] ${msg}`);
    }
}

/**
 * Gera UUID v4 para idempotência
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Formata tempo em HH:MM:SS
 */
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

/**
 * Calcula tempo total decorrido
 */
function getElapsedSeconds() {
    if (!state.startTime) return state.pausedElapsed;
    
    if (state.running) {
        const now = Date.now();
        const elapsed = Math.floor((now - state.startTime) / 1000);
        return state.pausedElapsed + elapsed;
    }
    
    return state.pausedElapsed;
}

/**
 * Atualiza display do timer
 */
function updateDisplay() {
    const totalElapsed = getElapsedSeconds();
    const displays = document.querySelectorAll(`.timer-display[data-session="${state.sessionId}"]`);
    
    displays.forEach(display => {
        display.textContent = formatTime(totalElapsed);
    });
    
    // Atualizar botão do card também
    updateCardVisuals();
}

/**
 * Atualiza visuais do card de sessão
 */
function updateCardVisuals() {
    // Função desabilitada temporariamente para não interferir nos cards
    // Os cards já têm seu próprio sistema de atualização visual
    return;
}

/**
 * Atualiza botão de controle do timer
 */
function updateButton(isRunning) {
    const button = document.querySelector(`.btn-timer-toggle[data-session="${state.sessionId}"]`);
    if (!button) return;
    
    button.classList.remove('bg-editaliza-blue', 'hover:bg-blue-700', 'bg-orange-500', 'hover:bg-orange-600');
    
    if (isRunning) {
        button.classList.add('bg-orange-500', 'hover:bg-orange-600');
        button.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg><span>Pausar</span>`;
    } else {
        button.classList.add('bg-editaliza-blue', 'hover:bg-blue-700');
        const buttonText = (getElapsedSeconds() > 0) ? 'Continuar' : 'Iniciar';
        button.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg><span>${buttonText}</span>`;
    }
}

/**
 * Salva tempo no servidor com idempotência
 */
async function saveTime(increment) {
    if (state.inflight) {
        console.log('[TIMER] Requisição em voo, ignorando save');
        return;
    }
    
    state.inflight = true;
    const startMs = Date.now();
    
    try {
        const sessionId = Number(state.sessionId);
        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            throw new Error('Invalid sessionId');
        }
        
        const idempotencyKey = generateUUID();
        const body = {
            incrementSeconds: increment,
            source: 'timer-auto',
            at: new Date().toISOString()
        };
        
        console.log(`[TIMER] Salvando ${increment}s para sessão ${sessionId} com key ${idempotencyKey}`);
        
        const response = await window.app.apiFetch(`/api/sessions/${sessionId}/time`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey
            },
            body: JSON.stringify(body)
        });
        
        const elapsed = Date.now() - startMs;
        console.log(`[TIMER] Save bem-sucedido em ${elapsed}ms - Total: ${response.totalSeconds}s`);
        
        // Atualizar total do servidor
        if (Number.isFinite(response.totalSeconds)) {
            state.totalSeconds = response.totalSeconds;
        }
        
        // Reset retry count em sucesso
        state.retryCount = 0;
        state.lastSaveAt = Date.now();
        
        // Log de telemetria
        console.log(`[TIMER] uid=${window.app?.currentUser?.id} sid=${sessionId} inc=${increment} ms=${elapsed} status=200 total=${response.totalSeconds}`);
        
    } catch (error) {
        const elapsed = Date.now() - startMs;
        
        // Log de erro sem spam
        if (!error.isTimer) {
            console.error(`[TIMER] Erro ao salvar: ${error.message} (${elapsed}ms)`);
        }
        
        // Re-acumular o tempo não salvo
        state.accumulated += increment;
        
        // Aplicar backoff
        const backoffIndex = Math.min(state.retryCount, RETRY_BACKOFF.length - 1);
        const backoffMs = RETRY_BACKOFF[backoffIndex];
        state.cooldownUntil = Date.now() + backoffMs;
        state.retryCount++;
        
        console.log(`[TIMER] Entrando em cooldown por ${backoffMs}ms (retry ${state.retryCount})`);
        
        // Toast controlado
        showTimerToastOncePerMinute('Auto-save temporariamente indisponível. Continuando a contar...', 'warning');
        
        // Log de telemetria de erro
        console.log(`[TIMER] uid=${window.app?.currentUser?.id} sid=${state.sessionId} inc=${increment} ms=${elapsed} status=error`);
        
    } finally {
        state.inflight = false;
    }
}

/**
 * Tick do timer - executado a cada segundo
 */
async function onTick() {
    if (!state.running) return;
    
    // Incrementar acumulador
    state.accumulated++;
    
    // Atualizar display
    updateDisplay();
    
    // Verificar se está em cooldown
    if (Date.now() < state.cooldownUntil) {
        const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
        if (remaining % 10 === 0) {
            console.log(`[TIMER] Em cooldown por mais ${remaining}s`);
        }
        return;
    }
    
    // Verificar se deve salvar
    if (!state.inflight && state.accumulated >= SAVE_INTERVAL) {
        const toSave = Math.min(state.accumulated, MAX_INCREMENT);
        state.accumulated -= toSave; // Descontar ANTES de salvar
        
        console.log(`[TIMER] Triggering save: ${toSave}s (acumulado restante: ${state.accumulated}s)`);
        await saveTime(toSave);
    }
}

/**
 * Inicia o timer
 */
function startTimer(sessionId) {
    console.log(`[TIMER] Iniciando timer para sessão ${sessionId}`);
    
    // Limpar timer anterior se existir
    if (state.intervalId) {
        clearInterval(state.intervalId);
    }
    if (state.displayInterval) {
        clearInterval(state.displayInterval);
    }
    
    // Resetar state para nova sessão
    state = {
        running: true,
        accumulated: 0,
        inflight: false,
        cooldownUntil: 0,
        retryCount: 0,
        sessionId: sessionId,
        intervalId: null,
        lastSaveAt: 0,
        totalSeconds: 0,
        displayInterval: null,
        startTime: Date.now(),
        pausedElapsed: 0
    };
    
    // Iniciar intervals
    state.intervalId = setInterval(onTick, 1000);
    state.displayInterval = setInterval(updateDisplay, 100); // Display mais fluido
    
    // Atualizar UI
    updateButton(true);
    updateDisplay();
    
    // Salvar no localStorage
    saveToLocalStorage();
    
    console.log(`[TIMER] Timer iniciado com sucesso`);
}

/**
 * Pausa o timer
 */
function pauseTimer() {
    if (!state.running) return;
    
    console.log(`[TIMER] Pausando timer da sessão ${state.sessionId}`);
    
    // Calcular tempo decorrido antes de pausar
    if (state.startTime) {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        state.pausedElapsed += elapsed;
        state.startTime = null;
    }
    
    state.running = false;
    
    // Limpar intervals
    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }
    if (state.displayInterval) {
        clearInterval(state.displayInterval);
        state.displayInterval = null;
    }
    
    // Salvar tempo acumulado se houver
    if (state.accumulated > 0) {
        const toSave = Math.min(state.accumulated, MAX_INCREMENT);
        state.accumulated -= toSave;
        console.log(`[TIMER] Salvando ${toSave}s ao pausar`);
        saveTime(toSave);
    }
    
    // Atualizar UI
    updateButton(false);
    updateDisplay();
    
    // Salvar no localStorage
    saveToLocalStorage();
}

/**
 * Retoma o timer pausado
 */
function resumeTimer() {
    if (state.running || !state.sessionId) return;
    
    console.log(`[TIMER] Retomando timer da sessão ${state.sessionId}`);
    
    state.running = true;
    state.startTime = Date.now();
    
    // Reiniciar intervals
    state.intervalId = setInterval(onTick, 1000);
    state.displayInterval = setInterval(updateDisplay, 100);
    
    // Atualizar UI
    updateButton(true);
    updateDisplay();
    
    // Salvar no localStorage
    saveToLocalStorage();
}

/**
 * Para o timer completamente
 */
function stopTimer() {
    console.log(`[TIMER] Parando timer da sessão ${state.sessionId}`);
    
    // Pausar primeiro
    pauseTimer();
    
    // Limpar localStorage
    clearFromLocalStorage();
    
    // Resetar state
    state = {
        running: false,
        accumulated: 0,
        inflight: false,
        cooldownUntil: 0,
        retryCount: 0,
        sessionId: null,
        intervalId: null,
        lastSaveAt: 0,
        totalSeconds: 0,
        displayInterval: null,
        startTime: null,
        pausedElapsed: 0
    };
    
    console.log(`[TIMER] Timer completamente parado`);
}

/**
 * Toggle entre play/pause
 */
function toggleTimer(sessionId) {
    if (!state.sessionId || state.sessionId !== sessionId) {
        // Novo timer
        startTimer(sessionId);
    } else if (state.running) {
        // Pausar
        pauseTimer();
    } else {
        // Retomar
        resumeTimer();
    }
}

/**
 * Salva estado no localStorage
 */
function saveToLocalStorage() {
    try {
        const data = {
            sessionId: state.sessionId,
            running: state.running,
            pausedElapsed: state.pausedElapsed,
            accumulated: state.accumulated,
            totalSeconds: state.totalSeconds,
            savedAt: Date.now()
        };
        
        localStorage.setItem('editaliza_timer_state', JSON.stringify(data));
        console.log('[TIMER] Estado salvo no localStorage');
    } catch (error) {
        console.error('[TIMER] Erro ao salvar no localStorage:', error);
    }
}

/**
 * Carrega estado do localStorage
 */
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('editaliza_timer_state');
        if (!saved) return null;
        
        const data = JSON.parse(saved);
        console.log('[TIMER] Estado carregado do localStorage:', data);
        
        return data;
    } catch (error) {
        console.error('[TIMER] Erro ao carregar do localStorage:', error);
        return null;
    }
}

/**
 * Limpa estado do localStorage
 */
function clearFromLocalStorage() {
    try {
        localStorage.removeItem('editaliza_timer_state');
        console.log('[TIMER] Estado removido do localStorage');
    } catch (error) {
        console.error('[TIMER] Erro ao limpar localStorage:', error);
    }
}

/**
 * Verifica se há timer para continuar
 */
function checkForExistingTimer(sessionId) {
    const saved = loadFromLocalStorage();
    
    if (saved && saved.sessionId === sessionId) {
        // Restaurar estado
        state.sessionId = saved.sessionId;
        state.pausedElapsed = saved.pausedElapsed || 0;
        state.accumulated = saved.accumulated || 0;
        state.totalSeconds = saved.totalSeconds || 0;
        state.running = false; // Sempre começa pausado
        
        console.log(`[TIMER] Timer existente encontrado: ${state.pausedElapsed}s`);
        
        // Atualizar display
        updateDisplay();
        updateButton(false);
        
        return true;
    }
    
    return false;
}

/**
 * Handler para visibilidade da página
 */
function handleVisibilityChange() {
    if (document.hidden && state.running) {
        console.log('[TIMER] Página oculta, continuando a contar em background');
    } else if (!document.hidden && state.running) {
        console.log('[TIMER] Página visível novamente');
        updateDisplay(); // Atualizar display imediatamente
    }
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

// Event listeners
document.addEventListener('visibilitychange', handleVisibilityChange);

// Verificar timer existente ao carregar
document.addEventListener('DOMContentLoaded', () => {
    const saved = loadFromLocalStorage();
    if (saved && saved.sessionId) {
        console.log(`[TIMER] Timer salvo encontrado para sessão ${saved.sessionId}`);
        // Não iniciar automaticamente, esperar interação do usuário
    }
});

// ============================================================================
// API PÚBLICA - Compatível com sistema existente
// ============================================================================

const TimerSystem = {
    // Propriedades para compatibilidade
    timers: {},
    
    // Métodos principais
    start(sessionId) {
        startTimer(sessionId);
        this.timers[sessionId] = { isRunning: true, elapsed: getElapsedSeconds() * 1000 };
    },
    
    stop(sessionId) {
        if (state.sessionId === sessionId) {
            pauseTimer();
            this.timers[sessionId] = { isRunning: false, elapsed: getElapsedSeconds() * 1000 };
        }
    },
    
    toggle(sessionId) {
        toggleTimer(sessionId);
        this.timers[sessionId] = { isRunning: state.running, elapsed: getElapsedSeconds() * 1000 };
    },
    
    // Métodos de compatibilidade
    hasActiveTimer(sessionId) {
        return state.sessionId === sessionId && state.running;
    },
    
    getTimerElapsed(sessionId) {
        if (state.sessionId === sessionId) {
            return getElapsedSeconds() * 1000; // Retornar em ms para compatibilidade
        }
        return 0;
    },
    
    formatTime(milliseconds) {
        return formatTime(Math.floor(milliseconds / 1000));
    },
    
    clearStoredTimer(sessionId) {
        if (state.sessionId === sessionId) {
            stopTimer();
        }
        delete this.timers[sessionId];
    },
    
    // Métodos de UI
    createTimerUI(sessionId) {
        const sessionDuration = 50; // Duração padrão
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
                    <div class="flex justify-between text-sm font-medium text-gray-600 mb-1">
                        <span>Progresso da Sessão</span><span class="timer-status" data-session="${sessionId}">0 / ${sessionDuration} min</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2"><div class="timer-progress bg-editaliza-green h-2 rounded-full transition-all" data-session="${sessionId}" style="width: 0%"></div></div>
                </div>
            </div>`;
    },
    
    // Verificar timer existente
    checkForExisting: checkForExistingTimer,
    
    // Métodos internos expostos para debug
    _getState: () => state,
    _saveTime: saveTime,
    _onTick: onTick
};

// Expor globalmente
window.TimerSystem = TimerSystem;

console.log('[TIMER] Sistema de timer v2.0 carregado com sucesso');