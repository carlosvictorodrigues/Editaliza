/**
 * @file js/modules/smart-buttons.js
 * @description Smart button system with timer awareness
 * @version 2.0 - Modularized for performance
 */

export const SmartButtons = {
    // CORREÇÃO: Gerar botão inteligente baseado no estado preciso do timer
    generateSmartButton(sessionId, defaultText = 'Iniciar Estudo', sessionData = null) {
        // Verificar diferentes estados do timer
        if (!window.TimerSystem) {
            return {
                text: defaultText,
                classes: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
                icon: '🚀'
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
                icon: '⏱️',
                action: 'continue' // Indica que é uma continuação
            };
        } else if (timer && timer.elapsed > 1000) {
            // Timer pausado com tempo acumulado
            const timeStr = TimerSystem.formatTime(timer.elapsed);
            return {
                text: `Continuar (${timeStr})`,
                classes: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600',
                icon: '⏸️',
                action: 'continue' // Indica que é uma continuação
            };
        } else {
            // Sem timer ou timer zerado
            return {
                text: defaultText,
                classes: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
                icon: '🚀',
                action: 'start' // Indica que é um novo início
            };
        }
    },
    
    // Função para atualizar todos os botões de sessão quando timers mudam de estado
    updateAllTimerButtons() {
        const timerButtons = document.querySelectorAll('.timer-aware-button');
        timerButtons.forEach(button => {
            const sessionId = button.getAttribute('onclick')?.match(/\d+/)?.[0];
            if (sessionId) {
                this.updateTimerButton(sessionId);
            }
        });
    },
    
    // CORREÇÃO: Função para atualizar um botão específico com estado preciso
    updateTimerButton(sessionId) {
        const buttons = document.querySelectorAll(`button[onclick*="window.openStudySession(${sessionId})"], .timer-aware-button[onclick*="window.openStudySession(${sessionId})"]`);
        if (buttons.length === 0) return;
        
        buttons.forEach(button => {
            const buttonText = button.querySelector('.button-text');
            const buttonIcon = button.querySelector('.button-icon');
            
            // Gerar informações do botão baseado no estado atual
            const currentText = buttonText ? buttonText.textContent.replace(/Continuar \([^)]+\)/, '').replace('Continuar', 'Iniciar').trim() : 'Iniciar Estudo';
            const smartButton = this.generateSmartButton(sessionId, currentText || 'Iniciar Estudo');
            
            if (buttonText && buttonIcon) {
                // Atualizar elementos internos
                buttonText.textContent = smartButton.text;
                buttonIcon.textContent = smartButton.icon;
            } else {
                // Atualizar conteúdo direto do botão (para botões simples)
                const iconSpan = button.querySelector('svg') || button.querySelector('.icon');
                if (iconSpan) {
                    // Manter SVG/ícones existentes, atualizar apenas texto
                    const textNode = Array.from(button.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                    if (textNode) {
                        textNode.textContent = ` ${smartButton.text}`;
                    }
                } else {
                    button.innerHTML = `${smartButton.icon} ${smartButton.text}`;
                }
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
            
            console.log(`🔄 Botão da sessão ${sessionId} atualizado:`, smartButton.text);
        });
    },

    // Função para criar botão de ação padronizado
    createActionButton(config = {}) {
        const {
            text = 'Ação',
            icon = '🚀',
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

    // Sistema de botões de estado (loading, success, error)
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

// Atualizar botões a cada 5 segundos quando o módulo for carregado
let buttonUpdateInterval;

export function startButtonUpdates() {
    if (buttonUpdateInterval) return; // Evitar múltiplos intervalos
    
    buttonUpdateInterval = setInterval(() => {
        if (window.TimerSystem && SmartButtons.updateAllTimerButtons) {
            SmartButtons.updateAllTimerButtons();
        }
    }, 5000);
}

export function stopButtonUpdates() {
    if (buttonUpdateInterval) {
        clearInterval(buttonUpdateInterval);
        buttonUpdateInterval = null;
    }
}

// Auto-start updates quando o módulo é carregado
document.addEventListener('DOMContentLoaded', () => {
    startButtonUpdates();
});

// Disponibilizar globalmente para compatibilidade
window.SmartButtons = SmartButtons;