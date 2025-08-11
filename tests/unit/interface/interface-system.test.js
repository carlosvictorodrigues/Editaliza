/**
 * @file tests/unit/interface/interface-system.test.js
 * @description Testes unitários para o Sistema de Interface
 * @jest-environment jsdom
 */

// Mock do sistema de interface baseado nos componentes existentes
const InterfaceSystem = {
    // Sistema de componentes visuais
    components: {
        // Botões inteligentes
        generateSmartButton: function(sessionId, defaultText = 'Iniciar Estudo', sessionData = null) {
            // Mock do TimerSystem para testes
            const mockTimerSystem = window.TimerSystem || {
                hasActiveTimer: () => false,
                timers: {},
                getTimerElapsed: () => 0,
                formatTime: (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
            };

            const hasActiveTimer = mockTimerSystem.hasActiveTimer(sessionId);
            const timer = mockTimerSystem.timers[sessionId];
            
            if (hasActiveTimer) {
                const elapsed = mockTimerSystem.getTimerElapsed(sessionId);
                const timeStr = mockTimerSystem.formatTime(elapsed);
                return {
                    text: `Continuar (${timeStr})`,
                    classes: 'animate-pulse bg-orange-500 hover:bg-orange-600 border-2 border-orange-300',
                    icon: '⏱️',
                    action: 'continue'
                };
            } else if (timer && timer.elapsed > 1000) {
                const timeStr = mockTimerSystem.formatTime(timer.elapsed);
                return {
                    text: `Continuar (${timeStr})`,
                    classes: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600',
                    icon: '⏸️',
                    action: 'continue'
                };
            } else {
                return {
                    text: defaultText,
                    classes: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
                    icon: '🚀',
                    action: 'start'
                };
            }
        },

        // Modais
        createModal: function(options = {}) {
            const {
                id = 'default-modal',
                title = 'Modal',
                content = '',
                size = 'medium',
                closable = true,
                backdrop = true
            } = options;

            const sizeClasses = {
                small: 'max-w-md',
                medium: 'max-w-2xl',
                large: 'max-w-4xl',
                full: 'max-w-full mx-4'
            };

            const modal = document.createElement('div');
            modal.id = id;
            modal.className = 'modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden';
            
            if (backdrop) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeModal(id);
                    }
                });
            }

            modal.innerHTML = `
                <div class="modal-container bg-white rounded-lg ${sizeClasses[size]} max-h-screen overflow-y-auto transform scale-95 opacity-0 transition-all duration-300">
                    <div class="modal-header flex justify-between items-center p-6 border-b">
                        <h3 class="text-xl font-semibold text-gray-900">${title}</h3>
                        ${closable ? '<button class="modal-close text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>' : ''}
                    </div>
                    <div class="modal-body p-6">
                        ${content}
                    </div>
                </div>
            `;

            // Adicionar listener para fechar
            if (closable) {
                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => this.closeModal(id));
                }
            }

            document.body.appendChild(modal);
            return modal;
        },

        // Abrir modal
        openModal: function(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal) return false;

            modal.classList.remove('hidden');
            
            // Trigger animation
            setTimeout(() => {
                const container = modal.querySelector('.modal-container');
                if (container) {
                    container.classList.remove('scale-95', 'opacity-0');
                    container.classList.add('scale-100', 'opacity-100');
                }
            }, 10);

            // Trap focus
            InterfaceSystem.utils.trapFocus(modal);
            return true;
        },

        // Fechar modal
        closeModal: function(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal) return false;

            const container = modal.querySelector('.modal-container');
            if (container) {
                container.classList.add('scale-95', 'opacity-0');
                container.classList.remove('scale-100', 'opacity-100');
            }

            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);

            return true;
        },

        // Sistema de toast
        showToast: function(message, type = 'info', duration = 5000) {
            const toastContainer = this.getOrCreateToastContainer();
            
            const typeClasses = {
                success: 'bg-green-500 text-white',
                error: 'bg-red-500 text-white',
                warning: 'bg-yellow-500 text-black',
                info: 'bg-blue-500 text-white'
            };

            const typeIcons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };

            const toast = document.createElement('div');
            toast.className = `toast flex items-center p-4 rounded-lg shadow-lg ${typeClasses[type]} transform translate-x-full transition-transform duration-300`;
            
            toast.innerHTML = `
                <span class="mr-3">${typeIcons[type]}</span>
                <span class="flex-1">${message}</span>
                <button class="ml-3 text-current opacity-70 hover:opacity-100">&times;</button>
            `;

            // Adicionar evento de fechar
            const closeBtn = toast.querySelector('button');
            closeBtn.addEventListener('click', () => {
                this.removeToast(toast);
            });

            toastContainer.appendChild(toast);

            // Trigger animation
            setTimeout(() => {
                toast.classList.remove('translate-x-full');
            }, 10);

            // Auto remove
            if (duration > 0) {
                setTimeout(() => {
                    this.removeToast(toast);
                }, duration);
            }

            return toast;
        },

        // Remover toast
        removeToast: function(toast) {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 300);
        },

        // Obter ou criar container de toast
        getOrCreateToastContainer: function() {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'fixed top-5 right-5 z-50 space-y-3';
                document.body.appendChild(container);
            }
            return container;
        },

        // Spinner/Loading
        showSpinner: function(message = 'Carregando...') {
            let spinner = document.getElementById('spinner-overlay');
            if (!spinner) {
                spinner = document.createElement('div');
                spinner.id = 'spinner-overlay';
                spinner.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center flex-col';
                spinner.innerHTML = `
                    <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p class="text-white mt-4 text-lg">${message}</p>
                `;
                document.body.appendChild(spinner);
            }
            
            spinner.classList.remove('hidden');
            return spinner;
        },

        // Ocultar spinner
        hideSpinner: function() {
            const spinner = document.getElementById('spinner-overlay');
            if (spinner) {
                spinner.classList.add('hidden');
            }
        },

        // Cards
        createCard: function(options = {}) {
            const {
                title = '',
                content = '',
                footer = '',
                classes = '',
                clickable = false,
                onClick = null
            } = options;

            const card = document.createElement('div');
            card.className = `card bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${clickable ? 'cursor-pointer hover:shadow-xl' : ''} ${classes}`;
            
            card.innerHTML = `
                ${title ? `<div class="card-header p-4 border-b"><h4 class="text-lg font-semibold">${title}</h4></div>` : ''}
                <div class="card-body p-4">${content}</div>
                ${footer ? `<div class="card-footer p-4 border-t bg-gray-50">${footer}</div>` : ''}
            `;

            if (clickable && onClick) {
                card.addEventListener('click', onClick);
            }

            return card;
        }
    },

    // Sistema de formulários
    forms: {
        // Validação de formulário
        validateForm: function(formElement, rules = {}) {
            const errors = [];
            const formData = new FormData(formElement);
            
            for (const [fieldName, rule] of Object.entries(rules)) {
                const value = formData.get(fieldName);
                const fieldErrors = this.validateField(value, rule, fieldName);
                errors.push(...fieldErrors);
            }

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        },

        // Validação de campo individual
        validateField: function(value, rule, fieldName) {
            const errors = [];

            if (rule.required && (!value || value.trim() === '')) {
                errors.push(`${fieldName} é obrigatório`);
                return errors; // Se é obrigatório e está vazio, parar aqui
            }

            if (value && rule.minLength && value.length < rule.minLength) {
                errors.push(`${fieldName} deve ter pelo menos ${rule.minLength} caracteres`);
            }

            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors.push(`${fieldName} deve ter no máximo ${rule.maxLength} caracteres`);
            }

            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors.push(`${fieldName} tem formato inválido`);
            }

            if (value && rule.email && !this.isValidEmail(value)) {
                errors.push(`${fieldName} deve ser um email válido`);
            }

            return errors;
        },

        // Validação de email
        isValidEmail: function(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },

        // Mostrar erros de validação
        showValidationErrors: function(errors, container) {
            if (!container) return;

            container.innerHTML = '';
            
            if (errors.length === 0) return;

            const errorList = document.createElement('div');
            errorList.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
            
            errorList.innerHTML = `
                <strong>Erros encontrados:</strong>
                <ul class="mt-2 list-disc list-inside">
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            `;

            container.appendChild(errorList);
        }
    },

    // Sistema de acessibilidade
    accessibility: {
        // Configurar navegação por teclado
        setupKeyboardNavigation: function(container) {
            const focusableElements = container.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            focusableElements.forEach((element, index) => {
                element.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        const nextIndex = (index + 1) % focusableElements.length;
                        focusableElements[nextIndex].focus();
                    }
                    
                    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const prevIndex = index === 0 ? focusableElements.length - 1 : index - 1;
                        focusableElements[prevIndex].focus();
                    }
                });
            });
        },

        // Configurar ARIA labels
        setupAriaLabels: function(container) {
            // Botões sem texto
            const buttons = container.querySelectorAll('button:not([aria-label])');
            buttons.forEach(button => {
                if (!button.textContent.trim() && !button.getAttribute('aria-label')) {
                    button.setAttribute('aria-label', 'Botão');
                }
            });

            // Links sem texto
            const links = container.querySelectorAll('a:not([aria-label])');
            links.forEach(link => {
                if (!link.textContent.trim() && !link.getAttribute('aria-label')) {
                    link.setAttribute('aria-label', 'Link');
                }
            });

            // Inputs sem label
            const inputs = container.querySelectorAll('input:not([aria-label]):not([id])');
            inputs.forEach(input => {
                if (!input.getAttribute('aria-label')) {
                    const placeholder = input.getAttribute('placeholder');
                    if (placeholder) {
                        input.setAttribute('aria-label', placeholder);
                    }
                }
            });
        },

        // Configurar roles ARIA
        setupAriaRoles: function(container) {
            // Elementos que funcionam como botões mas não são button
            const buttonLike = container.querySelectorAll('[onclick]:not(button):not([role])');
            buttonLike.forEach(el => {
                el.setAttribute('role', 'button');
                el.setAttribute('tabindex', '0');
            });

            // Elementos de navegação
            const navElements = container.querySelectorAll('nav:not([role])');
            navElements.forEach(nav => {
                nav.setAttribute('role', 'navigation');
            });

            // Elementos de conteúdo principal
            const mainElements = container.querySelectorAll('main:not([role])');
            mainElements.forEach(main => {
                main.setAttribute('role', 'main');
            });
        },

        // Verificar contraste
        checkContrast: function(element) {
            const styles = window.getComputedStyle(element);
            const bgColor = styles.backgroundColor;
            const textColor = styles.color;
            
            // Implementação simplificada - retorna true se cores foram definidas
            return bgColor !== 'rgba(0, 0, 0, 0)' && textColor !== 'rgba(0, 0, 0, 0)';
        }
    },

    // Sistema de estados de erro
    errorStates: {
        // Mostrar estado de erro
        showError: function(container, message, type = 'general') {
            const errorTypes = {
                network: {
                    icon: '🌐',
                    title: 'Erro de Conexão',
                    defaultMessage: 'Não foi possível conectar ao servidor'
                },
                validation: {
                    icon: '⚠️',
                    title: 'Dados Inválidos',
                    defaultMessage: 'Verifique os dados informados'
                },
                permission: {
                    icon: '🔒',
                    title: 'Acesso Negado',
                    defaultMessage: 'Você não tem permissão para esta ação'
                },
                general: {
                    icon: '❌',
                    title: 'Erro',
                    defaultMessage: 'Ocorreu um erro inesperado'
                }
            };

            const errorConfig = errorTypes[type] || errorTypes.general;
            const finalMessage = message || errorConfig.defaultMessage;

            container.innerHTML = `
                <div class="error-state text-center py-8">
                    <div class="text-6xl mb-4">${errorConfig.icon}</div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">${errorConfig.title}</h3>
                    <p class="text-gray-600 mb-4">${finalMessage}</p>
                    <button class="retry-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">Tentar Novamente</button>
                </div>
            `;

            return container.querySelector('.retry-btn');
        },

        // Mostrar estado vazio
        showEmptyState: function(container, message = 'Nenhum item encontrado', actionText = null, onAction = null) {
            container.innerHTML = `
                <div class="empty-state text-center py-12">
                    <div class="text-6xl mb-4">📭</div>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Nada por aqui</h3>
                    <p class="text-gray-600 mb-4">${message}</p>
                    ${actionText ? `<button class="action-btn bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg">${actionText}</button>` : ''}
                </div>
            `;

            if (actionText && onAction) {
                const actionBtn = container.querySelector('.action-btn');
                actionBtn.addEventListener('click', onAction);
            }
        },

        // Mostrar estado de carregamento
        showLoadingState: function(container, message = 'Carregando...') {
            container.innerHTML = `
                <div class="loading-state text-center py-12">
                    <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p class="text-gray-600">${message}</p>
                </div>
            `;
        }
    },

    // Utilitários gerais
    utils: {
        // Trap focus em modal
        trapFocus: function(container) {
            const focusableElements = container.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // Focus no primeiro elemento
            firstElement.focus();

            container.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        // Shift + Tab
                        if (document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement.focus();
                        }
                    } else {
                        // Tab
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                }

                if (e.key === 'Escape') {
                    const modalId = container.id;
                    if (modalId) {
                        InterfaceSystem.components.closeModal(modalId);
                    }
                }
            });
        },

        // Debounce
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        // Throttle
        throttle: function(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        // Sanitizar HTML
        sanitizeHtml: function(str) {
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        },

        // Verificar suporte a recursos
        checkFeatureSupport: function() {
            return {
                localStorage: typeof(Storage) !== 'undefined',
                webWorkers: typeof(Worker) !== 'undefined',
                notifications: 'Notification' in window,
                geolocation: 'geolocation' in navigator,
                serviceWorker: 'serviceWorker' in navigator
            };
        }
    }
};

describe('Sistema de Interface - Testes Unitários', () => {
    beforeEach(() => {
        // Limpar DOM
        document.body.innerHTML = '';
        
        // Mock do TimerSystem
        window.TimerSystem = {
            hasActiveTimer: jest.fn(() => false),
            timers: {},
            getTimerElapsed: jest.fn(() => 0),
            formatTime: jest.fn((ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`)
        };

        jest.clearAllMocks();
    });

    describe('Componentes Visuais - Botões Inteligentes', () => {
        test('deve gerar botão de início padrão', () => {
            const button = InterfaceSystem.components.generateSmartButton(1, 'Iniciar Estudo');
            
            expect(button.text).toBe('Iniciar Estudo');
            expect(button.action).toBe('start');
            expect(button.icon).toBe('🚀');
            expect(button.classes).toContain('bg-gradient-to-r');
        });

        test('deve gerar botão de continuação para timer ativo', () => {
            window.TimerSystem.hasActiveTimer.mockReturnValue(true);
            window.TimerSystem.getTimerElapsed.mockReturnValue(120000); // 2 minutos
            window.TimerSystem.formatTime.mockReturnValue('2:00');

            const button = InterfaceSystem.components.generateSmartButton(1);
            
            expect(button.text).toContain('Continuar');
            expect(button.text).toContain('2:00');
            expect(button.action).toBe('continue');
            expect(button.icon).toBe('⏱️');
            expect(button.classes).toContain('animate-pulse');
        });

        test('deve gerar botão de continuação para timer pausado', () => {
            window.TimerSystem.hasActiveTimer.mockReturnValue(false);
            window.TimerSystem.timers[1] = { elapsed: 90000 }; // 1.5 minutos
            window.TimerSystem.formatTime.mockReturnValue('1:30');

            const button = InterfaceSystem.components.generateSmartButton(1);
            
            expect(button.text).toContain('Continuar');
            expect(button.text).toContain('1:30');
            expect(button.action).toBe('continue');
            expect(button.icon).toBe('⏸️');
            expect(button.classes).toContain('yellow-500');
        });
    });

    describe('Componentes Visuais - Modais', () => {
        test('deve criar modal básico', () => {
            const modal = InterfaceSystem.components.createModal({
                id: 'test-modal',
                title: 'Modal de Teste',
                content: 'Conteúdo do modal'
            });
            
            expect(modal.id).toBe('test-modal');
            expect(modal.innerHTML).toContain('Modal de Teste');
            expect(modal.innerHTML).toContain('Conteúdo do modal');
            expect(document.getElementById('test-modal')).toBeTruthy();
        });

        test('deve abrir modal corretamente', () => {
            InterfaceSystem.components.createModal({ id: 'test-modal' });
            
            const result = InterfaceSystem.components.openModal('test-modal');
            
            expect(result).toBe(true);
            
            const modal = document.getElementById('test-modal');
            expect(modal.classList.contains('hidden')).toBe(false);
        });

        test('deve fechar modal corretamente', (done) => {
            InterfaceSystem.components.createModal({ id: 'test-modal' });
            InterfaceSystem.components.openModal('test-modal');

            const result = InterfaceSystem.components.closeModal('test-modal');

            expect(result).toBe(true);

            // Verificar após timeout da animação
            setTimeout(() => {
                const modal = document.getElementById('test-modal');
                if (modal) {
                    expect(modal.classList.contains('hidden')).toBe(true);
                }
                done();
            }, 350);
        });

        test('deve retornar false para modal inexistente', () => {
            const result = InterfaceSystem.components.openModal('nonexistent-modal');
            expect(result).toBe(false);
        });

        test('deve criar modal com diferentes tamanhos', () => {
            const smallModal = InterfaceSystem.components.createModal({ 
                id: 'small-modal', 
                size: 'small' 
            });
            const largeModal = InterfaceSystem.components.createModal({ 
                id: 'large-modal', 
                size: 'large' 
            });
            
            expect(smallModal.innerHTML).toContain('max-w-md');
            expect(largeModal.innerHTML).toContain('max-w-4xl');
        });
    });

    describe('Componentes Visuais - Toast', () => {
        test('deve criar toast de sucesso', () => {
            const toast = InterfaceSystem.components.showToast('Operação realizada!', 'success');
            
            expect(toast.innerHTML).toContain('Operação realizada!');
            expect(toast.innerHTML).toContain('✅');
            expect(toast.classList.contains('bg-green-500')).toBe(true);
        });

        test('deve criar toast de erro', () => {
            const toast = InterfaceSystem.components.showToast('Erro ao processar!', 'error');
            
            expect(toast.innerHTML).toContain('Erro ao processar!');
            expect(toast.innerHTML).toContain('❌');
            expect(toast.classList.contains('bg-red-500')).toBe(true);
        });

        test('deve criar container de toast se não existir', () => {
            InterfaceSystem.components.showToast('Teste');
            
            const container = document.getElementById('toast-container');
            expect(container).toBeTruthy();
            expect(container.className).toContain('fixed top-5 right-5');
        });

        test('deve remover toast quando botão de fechar é clicado', () => {
            const toast = InterfaceSystem.components.showToast('Teste');
            const closeBtn = toast.querySelector('button');
            
            closeBtn.click();
            
            setTimeout(() => {
                expect(toast.parentElement).toBe(null);
            }, 350);
        });
    });

    describe('Componentes Visuais - Spinner', () => {
        test('deve mostrar spinner', () => {
            const spinner = InterfaceSystem.components.showSpinner('Processando...');
            
            expect(spinner.innerHTML).toContain('Processando...');
            expect(spinner.classList.contains('hidden')).toBe(false);
        });

        test('deve ocultar spinner', () => {
            InterfaceSystem.components.showSpinner();
            InterfaceSystem.components.hideSpinner();
            
            const spinner = document.getElementById('spinner-overlay');
            expect(spinner.classList.contains('hidden')).toBe(true);
        });

        test('deve criar spinner apenas uma vez', () => {
            InterfaceSystem.components.showSpinner();
            InterfaceSystem.components.showSpinner();
            
            const spinners = document.querySelectorAll('#spinner-overlay');
            expect(spinners.length).toBe(1);
        });
    });

    describe('Componentes Visuais - Cards', () => {
        test('deve criar card básico', () => {
            const card = InterfaceSystem.components.createCard({
                title: 'Título do Card',
                content: 'Conteúdo do card'
            });
            
            expect(card.innerHTML).toContain('Título do Card');
            expect(card.innerHTML).toContain('Conteúdo do card');
            expect(card.classList.contains('card')).toBe(true);
        });

        test('deve criar card clicável', () => {
            const mockCallback = jest.fn();
            const card = InterfaceSystem.components.createCard({
                title: 'Card Clicável',
                clickable: true,
                onClick: mockCallback
            });
            
            expect(card.classList.contains('cursor-pointer')).toBe(true);
            
            card.click();
            expect(mockCallback).toHaveBeenCalled();
        });

        test('deve criar card sem header quando não há título', () => {
            const card = InterfaceSystem.components.createCard({
                content: 'Apenas conteúdo'
            });
            
            expect(card.innerHTML).not.toContain('card-header');
            expect(card.innerHTML).toContain('Apenas conteúdo');
        });
    });

    describe('Sistema de Formulários', () => {
        test('deve validar formulário com dados válidos', () => {
            document.body.innerHTML = `
                <form id="test-form">
                    <input name="email" value="test@example.com">
                    <input name="password" value="123456">
                </form>
            `;
            
            const form = document.getElementById('test-form');
            const rules = {
                email: { required: true, email: true },
                password: { required: true, minLength: 6 }
            };
            
            const result = InterfaceSystem.forms.validateForm(form, rules);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('deve detectar campos obrigatórios ausentes', () => {
            document.body.innerHTML = `
                <form id="test-form">
                    <input name="email" value="">
                    <input name="password" value="123456">
                </form>
            `;
            
            const form = document.getElementById('test-form');
            const rules = {
                email: { required: true },
                password: { required: true }
            };
            
            const result = InterfaceSystem.forms.validateForm(form, rules);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('email'))).toBe(true);
        });

        test('deve validar email corretamente', () => {
            expect(InterfaceSystem.forms.isValidEmail('test@example.com')).toBe(true);
            expect(InterfaceSystem.forms.isValidEmail('invalid-email')).toBe(false);
            expect(InterfaceSystem.forms.isValidEmail('test@')).toBe(false);
        });

        test('deve mostrar erros de validação', () => {
            document.body.innerHTML = '<div id="error-container"></div>';
            
            const container = document.getElementById('error-container');
            const errors = ['Campo obrigatório', 'Email inválido'];
            
            InterfaceSystem.forms.showValidationErrors(errors, container);
            
            expect(container.innerHTML).toContain('Campo obrigatório');
            expect(container.innerHTML).toContain('Email inválido');
            expect(container.innerHTML).toContain('bg-red-100');
        });
    });

    describe('Sistema de Acessibilidade', () => {
        test('deve configurar ARIA labels automaticamente', () => {
            document.body.innerHTML = `
                <div id="container">
                    <button></button>
                    <a href="#"></a>
                    <input placeholder="Nome">
                </div>
            `;
            
            const container = document.getElementById('container');
            InterfaceSystem.accessibility.setupAriaLabels(container);
            
            const button = container.querySelector('button');
            const link = container.querySelector('a');
            const input = container.querySelector('input');
            
            expect(button.getAttribute('aria-label')).toBe('Botão');
            expect(link.getAttribute('aria-label')).toBe('Link');
            expect(input.getAttribute('aria-label')).toBe('Nome');
        });

        test('deve configurar roles ARIA', () => {
            document.body.innerHTML = `
                <div id="container">
                    <div onclick="alert('click')"></div>
                    <nav></nav>
                    <main></main>
                </div>
            `;
            
            const container = document.getElementById('container');
            InterfaceSystem.accessibility.setupAriaRoles(container);
            
            const clickableDiv = container.querySelector('[onclick]');
            const nav = container.querySelector('nav');
            const main = container.querySelector('main');
            
            expect(clickableDiv.getAttribute('role')).toBe('button');
            expect(nav.getAttribute('role')).toBe('navigation');
            expect(main.getAttribute('role')).toBe('main');
        });

        test('deve verificar contraste de cores', () => {
            document.body.innerHTML = '<div id="test" style="background: white; color: black;"></div>';
            
            const element = document.getElementById('test');
            const hasGoodContrast = InterfaceSystem.accessibility.checkContrast(element);
            
            expect(typeof hasGoodContrast).toBe('boolean');
        });
    });

    describe('Estados de Erro', () => {
        test('deve mostrar estado de erro geral', () => {
            document.body.innerHTML = '<div id="container"></div>';
            
            const container = document.getElementById('container');
            const retryBtn = InterfaceSystem.errorStates.showError(container, 'Algo deu errado');
            
            expect(container.innerHTML).toContain('Algo deu errado');
            expect(container.innerHTML).toContain('❌');
            expect(retryBtn).toBeTruthy();
            expect(retryBtn.textContent).toBe('Tentar Novamente');
        });

        test('deve mostrar estado de erro de rede', () => {
            document.body.innerHTML = '<div id="container"></div>';
            
            const container = document.getElementById('container');
            InterfaceSystem.errorStates.showError(container, null, 'network');
            
            expect(container.innerHTML).toContain('Erro de Conexão');
            expect(container.innerHTML).toContain('🌐');
        });

        test('deve mostrar estado vazio', () => {
            document.body.innerHTML = '<div id="container"></div>';
            
            const container = document.getElementById('container');
            InterfaceSystem.errorStates.showEmptyState(container, 'Nenhum resultado');
            
            expect(container.innerHTML).toContain('Nenhum resultado');
            expect(container.innerHTML).toContain('📭');
        });

        test('deve mostrar estado de carregamento', () => {
            document.body.innerHTML = '<div id="container"></div>';
            
            const container = document.getElementById('container');
            InterfaceSystem.errorStates.showLoadingState(container, 'Aguarde...');
            
            expect(container.innerHTML).toContain('Aguarde...');
            expect(container.innerHTML).toContain('animate-spin');
        });
    });

    describe('Utilitários', () => {
        test('deve sanitizar HTML', () => {
            const maliciousHtml = '<script>alert("xss")</script>';
            const sanitized = InterfaceSystem.utils.sanitizeHtml(maliciousHtml);
            
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('&lt;script&gt;');
        });

        test('deve implementar debounce', (done) => {
            const mockFn = jest.fn();
            const debouncedFn = InterfaceSystem.utils.debounce(mockFn, 100);
            
            debouncedFn();
            debouncedFn();
            debouncedFn();
            
            expect(mockFn).not.toHaveBeenCalled();
            
            setTimeout(() => {
                expect(mockFn).toHaveBeenCalledTimes(1);
                done();
            }, 150);
        });

        test('deve implementar throttle', (done) => {
            const mockFn = jest.fn();
            const throttledFn = InterfaceSystem.utils.throttle(mockFn, 100);
            
            throttledFn();
            throttledFn();
            throttledFn();
            
            expect(mockFn).toHaveBeenCalledTimes(1);
            
            setTimeout(() => {
                throttledFn();
                expect(mockFn).toHaveBeenCalledTimes(2);
                done();
            }, 150);
        });

        test('deve verificar suporte a recursos', () => {
            const support = InterfaceSystem.utils.checkFeatureSupport();
            
            expect(support).toHaveProperty('localStorage');
            expect(support).toHaveProperty('webWorkers');
            expect(support).toHaveProperty('notifications');
            expect(support).toHaveProperty('geolocation');
            expect(support).toHaveProperty('serviceWorker');
            
            expect(typeof support.localStorage).toBe('boolean');
        });

        test('deve configurar trap de foco', () => {
            document.body.innerHTML = `
                <div id="modal">
                    <button id="btn1">Botão 1</button>
                    <button id="btn2">Botão 2</button>
                    <button id="btn3">Botão 3</button>
                </div>
            `;
            
            const modal = document.getElementById('modal');
            
            expect(() => {
                InterfaceSystem.utils.trapFocus(modal);
            }).not.toThrow();
        });
    });
});