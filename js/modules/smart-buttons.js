/**
 * @file js/modules/smart-buttons.js
 * @description Smart button system with timer awareness
 * @version 2.0 - Modularized for performance
 */

const SmartButtons = {
    // CORREO: Gerar boto inteligente baseado no estado preciso do timer
    generateSmartButton(sessionId, defaultText = 'Iniciar Estudo', sessionData = null) {
        // Verificar diferentes estados do timer
        if (!window.TimerSystem) {
            return {
                text: defaultText,
                classes: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
                icon: '▶️'
            };
        }
        
        const hasActiveTimer = TimerSystem.hasActiveTimer(sessionId);
        const timer = TimerSystem.timers[sessionId];
        
        if (hasActiveTimer) {
            // Timer ativo - rodando
            const elapsed = TimerSystem.getTimerElapsed(sessionId);
            const timeStr = TimerSystem.formatTime(elapsed);
            return {
                text: `Continuar (${timeStr})`,
                classes: 'animate-pulse bg-orange-500 hover:bg-orange-600 border-2 border-orange-300',
                icon: '⏵️',
                action: 'continue' // Indica que  uma continuao
            };
        } else if (timer && timer.elapsed > 1000) {
            // Timer pausado com tempo acumulado
            const timeStr = TimerSystem.formatTime(timer.elapsed);
            return {
                text: `Continuar (${timeStr})`,
                classes: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600',
                icon: '⏵️',
                action: 'continue' // Indica que  uma continuao
            };
        } else {
            // Sem timer ou timer zerado
            return {
                text: defaultText,
                classes: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
                icon: '▶️',
                action: 'start' // Indica que  um novo incio
            };
        }
    },
    
    // Funo para atualizar todos os botes de sesso quando timers mudam de estado
    updateAllTimerButtons() {
        const timerButtons = document.querySelectorAll('.timer-aware-button');
        timerButtons.forEach(button => {
            const sessionId = button.getAttribute('onclick')?.match(/\d+/)?.[0];
            if (sessionId) {
                this.updateTimerButton(sessionId);
            }
        });
    },
    
    // CORREO: Funo para atualizar um boto especfico com estado preciso
    updateTimerButton(sessionId) {
        const buttons = document.querySelectorAll(`button[onclick*="window.openStudySession(${sessionId})"], .timer-aware-button[onclick*="window.openStudySession(${sessionId})"]`);
        if (buttons.length === 0) return;
        
        buttons.forEach(button => {
            const buttonText = button.querySelector('.button-text');
            const buttonIcon = button.querySelector('.button-icon');
            
            // Só atualizar se há um timer ativo ou pausado com tempo
            const hasActiveTimer = window.TimerSystem && TimerSystem.hasActiveTimer(sessionId);
            const timer = window.TimerSystem && TimerSystem.timers[sessionId];
            const hasPausedTimer = timer && timer.elapsed > 1000 && !timer.isRunning;
            
            if (!hasActiveTimer && !hasPausedTimer) {
                return; // Não atualizar se não há timer
            }
            
            // Gerar informaes do boto baseado no estado atual
            const currentText = buttonText ? buttonText.textContent.trim() : 'Iniciar Estudo';
            const smartButton = this.generateSmartButton(sessionId, currentText);
            
            if (buttonText) {
                // Atualizar apenas o texto interno, sem duplicar
                buttonText.textContent = smartButton.text;
            }
            
            if (buttonIcon) {
                // Atualizar ícone se existir
                buttonIcon.textContent = smartButton.icon;
            }
            
            // Limpar classes antigas de estilo
            const oldClasses = [
                'bg-gradient-to-r', 'from-blue-600', 'to-purple-600', 'hover:from-blue-700', 'hover:to-purple-700',
                'from-yellow-500', 'to-orange-500', 'hover:from-yellow-600', 'hover:to-orange-600',
                'animate-pulse', 'bg-orange-500', 'hover:bg-orange-600', 'border-2', 'border-orange-300'
            ];
            
            button.classList.remove(...oldClasses);
            
            // Adicionar novas classes
            const classArray = smartButton.classes.split(' ').filter(c => c.trim());
            button.classList.add(...classArray);
            
            void(`= Boto da sesso ${sessionId} atualizado:`, smartButton.text);
        });
    },

    // Funo para criar boto de ao padronizado
    createActionButton(config = {}) {
        const {
            text = 'Ao',
            icon = '=',
            classes = 'btn-primary',
            onClick = () => {},
            size = 'md'
        } = config;

        const sizeClasses = {
            sm: 'px-4 py-2 text-sm',
            md: 'px-6 py-3',
            lg: 'px-8 py-4 text-lg'
        };

        const button = document.createElement('button');
        button.className = `${classes} ${sizeClasses[size]} rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2`;
        button.innerHTML = `
            <span class="text-xl">${icon}</span>
            <span>${text}</span>
        `;
        
        button.addEventListener('click', onClick);
        
        return button;
    },

    // Sistema de botes de estado (loading, success, error)
    setButtonState(button, state = 'normal', text = null) {
        if (!button) return;

        const originalContent = button.dataset.originalContent || button.innerHTML;
        if (!button.dataset.originalContent) {
            button.dataset.originalContent = originalContent;
        }

        const states = {
            normal: {
                content: text || originalContent,
                disabled: false,
                classes: []
            },
            loading: {
                content: `
                    <svg class="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    ${text || 'Carregando...'}
                `,
                disabled: true,
                classes: ['opacity-75', 'cursor-not-allowed']
            },
            success: {
                content: `
                    <svg class="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                    ${text || 'Sucesso!'}
                `,
                disabled: false,
                classes: ['text-green-600']
            },
            error: {
                content: `
                    <svg class="w-5 h-5 mr-2 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                    ${text || 'Erro'}
                `,
                disabled: false,
                classes: ['text-red-600']
            }
        };

        const stateConfig = states[state] || states.normal;
        
        // Limpar classes antigas
        Object.values(states).forEach(s => {
            button.classList.remove(...s.classes);
        });
        
        // Aplicar novo estado
        button.innerHTML = stateConfig.content;
        button.disabled = stateConfig.disabled;
        button.classList.add(...stateConfig.classes);
    }
};

// Atualizar botes a cada 5 segundos quando o mdulo for carregado
let buttonUpdateInterval;

function startButtonUpdates() {
    if (buttonUpdateInterval) return; // Evitar mltiplos intervalos
    
    buttonUpdateInterval = setInterval(() => {
        if (window.TimerSystem && SmartButtons.updateAllTimerButtons) {
            SmartButtons.updateAllTimerButtons();
        }
    }, 5000);
}

function stopButtonUpdates() {
    if (buttonUpdateInterval) {
        clearInterval(buttonUpdateInterval);
        buttonUpdateInterval = null;
    }
}

// Auto-start updates quando o mdulo  carregado
document.addEventListener('DOMContentLoaded', () => {
    startButtonUpdates();
});

// Disponibilizar globalmente para compatibilidade
window.SmartButtons = SmartButtons;
window.startButtonUpdates = startButtonUpdates;
window.stopButtonUpdates = stopButtonUpdates;