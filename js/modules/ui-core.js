/**
 * @file js/modules/ui-core.js
 * @description Core UI components - Spinner, Toast, Global UI elements
 * @version 2.0 - Modularized for performance
 */

export const UICore = {
    // Renderiza os componentes globais da UI (spinner, toast)
    renderGlobalUI() {
        if (document.getElementById('toast-container')) return; // Evitar duplicação
        
        const uiContainer = document.createElement('div');
        uiContainer.innerHTML = `
            <div id="toast-container" class="fixed top-5 right-5 z-50 space-y-3"></div>
            <div id="spinner-overlay" class="hidden fixed inset-0 bg-editaliza-black bg-opacity-60 z-50 flex items-center justify-center">
                <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-editaliza-blue"></div>
            </div>
        `;
        document.body.prepend(uiContainer);
    },

    // Sistema de Toast otimizado
    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? '✓' : '✕';
        
        // Sanitizar mensagem usando app.sanitizeHtml se disponível
        const safeMessage = window.app?.sanitizeHtml ? window.app.sanitizeHtml(message) : message;
        
        toast.className = `p-4 rounded-lg text-white shadow-lg ${bgColor} transform transition-all duration-300 translate-x-full opacity-0 flex items-center space-x-2`;
        toast.innerHTML = `<span class="text-xl">${icon}</span><span>${safeMessage}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Animar entrada
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
        
        // Remover após 3 segundos
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, { once: true });
        }, 3000);
    },

    // Sistema de Spinner otimizado
    showSpinner() {
        const spinner = document.getElementById('spinner-overlay');
        if (spinner) {
            spinner.classList.remove('hidden');
            spinner.dataset.count = (parseInt(spinner.dataset.count || 0) + 1).toString();
        }
    },

    hideSpinner() {
        const spinner = document.getElementById('spinner-overlay');
        if (spinner) {
            const count = parseInt(spinner.dataset.count || 1) - 1;
            spinner.dataset.count = count.toString();
            
            if (count <= 0) {
                spinner.classList.add('hidden');
                spinner.dataset.count = '0';
            }
        }
    },

    // Modal genérico reutilizável
    createModal(config = {}) {
        const {
            title = 'Confirmação',
            content = '',
            buttons = [
                { text: 'Cancelar', class: 'btn-secondary', action: 'close' },
                { text: 'Confirmar', class: 'btn-primary', action: 'confirm' }
            ],
            size = 'md'
        } = config;

        const sizeClasses = {
            sm: 'max-w-sm',
            md: 'max-w-md',
            lg: 'max-w-lg',
            xl: 'max-w-xl'
        };

        const modal = document.createElement('div');
        modal.className = 'modal-overlay fixed inset-0 bg-editaliza-black bg-opacity-70 z-50 flex items-center justify-center p-4';
        
        const buttonsHtml = buttons.map(btn => 
            `<button class="modal-btn ${btn.class} px-6 py-2 rounded-lg font-semibold transition-colors" data-action="${btn.action}">${btn.text}</button>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-container bg-white rounded-2xl shadow-2xl p-8 w-full ${sizeClasses[size]} transform scale-95">
                <h2 class="text-2xl font-bold text-editaliza-black mb-4">${title}</h2>
                <div class="modal-content mb-6">${content}</div>
                <div class="modal-buttons flex justify-end space-x-4">
                    ${buttonsHtml}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        return new Promise((resolve) => {
            // Animar entrada
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.querySelector('.modal-container').classList.remove('scale-95');
            }, 10);

            // Event listeners
            modal.querySelectorAll('.modal-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    this.closeModal(modal);
                    resolve(action);
                });
            });

            // Fechar ao clicar fora
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                    resolve('close');
                }
            });
        });
    },

    closeModal(modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('.modal-container').classList.add('scale-95');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
};

// Auto-initialize UI Core quando carregado
document.addEventListener('DOMContentLoaded', () => {
    UICore.renderGlobalUI();
});

// Integration with Contextual Notifications (safe extension)
UICore.showContextualToast = function(message, type = 'success', context = {}) {
    // Use existing showToast as fallback, extend with contextual features
    if (window.ContextualNotifications) {
        window.ContextualNotifications.showContextualNotification(message, type, context);
    } else {
        // Fallback to existing system
        this.showToast(message, type);
    }
};

// Disponibilizar globalmente para compatibilidade
window.UICore = UICore;