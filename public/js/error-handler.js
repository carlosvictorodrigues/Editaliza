/**
 * Sistema Padronizado de Tratamento de Erros - FASE 6
 * 
 * FUNCIONALIDADES:
 * - Notificações visuais elegantes
 * - Logging estruturado de erros
 * - Tradução de códigos de erro
 * - Recuperação automática
 * - Relatório de erros para debug
 * - Integração com interceptadores
 */

(function(window) {
    'use strict';

    // Configurações
    const config = {
        notificationDuration: 5000, // 5 segundos
        maxNotifications: 3,
        enableLogging: true,
        enableReporting: true,
        debugMode: window.location.hostname === 'localhost'
    };

    // Mapeamento de códigos de erro para mensagens amigáveis
    const errorMessages = {
        // Erros de autenticação
        'AUTH_TOKEN_MISSING': 'Você precisa fazer login para acessar esta funcionalidade',
        'AUTH_TOKEN_INVALID': 'Sua sessão expirou. Por favor, faça login novamente',
        'AUTH_TOKEN_EXPIRED': 'Sua sessão expirou. Por favor, faça login novamente',
        'INVALID_CREDENTIALS': 'Email ou senha incorretos',
        'USER_NOT_FOUND': 'Usuário não encontrado',
        'ACCOUNT_LOCKED': 'Conta temporariamente bloqueada. Tente novamente em alguns minutos',
        
        // Erros de validação
        'VALIDATION_ERROR': 'Por favor, verifique os dados informados',
        'INVALID_EMAIL': 'Email inválido',
        'INVALID_PASSWORD': 'Senha deve ter pelo menos 6 caracteres',
        'PASSWORDS_DONT_MATCH': 'As senhas não coincidem',
        'REQUIRED_FIELD': 'Este campo é obrigatório',
        
        // Erros de permissão
        'PERMISSION_DENIED': 'Você não tem permissão para realizar esta ação',
        'ADMIN_ONLY': 'Apenas administradores podem acessar esta funcionalidade',
        'PLAN_NOT_FOUND': 'Plano não encontrado ou sem permissão de acesso',
        
        // Erros de negócio
        'SCHEDULE_NOT_VIABLE': 'Não é possível gerar o cronograma com estas configurações',
        'MISSING_EXAM_DATE': 'Defina a data da prova antes de gerar o cronograma',
        'NO_STUDY_HOURS': 'Configure as horas de estudo disponíveis',
        'DUPLICATE_EMAIL': 'Este email já está cadastrado',
        'PLAN_LIMIT_REACHED': 'Você atingiu o limite de planos ativos',
        
        // Erros de servidor
        'INTERNAL_ERROR': 'Erro interno do servidor. Tente novamente',
        'SERVICE_UNAVAILABLE': 'Serviço temporariamente indisponível',
        'RATE_LIMIT_EXCEEDED': 'Muitas tentativas. Aguarde alguns minutos',
        'DATABASE_ERROR': 'Erro ao acessar o banco de dados',
        
        // Erros de rede
        'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet',
        'TIMEOUT': 'A requisição demorou muito. Tente novamente',
        'OFFLINE': 'Você está offline. Verifique sua conexão',
        
        // CSRF
        'CSRF_VALIDATION_FAILED': 'Token de segurança inválido. Recarregue a página',
        
        // Genérico
        'UNKNOWN_ERROR': 'Ocorreu um erro inesperado. Tente novamente'
    };

    // Classes de ícones para diferentes tipos de erro
    const errorIcons = {
        auth: '🔐',
        validation: '⚠️',
        permission: '🚫',
        server: '🔧',
        network: '📡',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };

    // Histórico de erros para debug
    const errorHistory = [];

    /**
     * Classe principal do Error Handler
     */
    class ErrorHandler {
        constructor() {
            this.notificationContainer = null;
            this.activeNotifications = [];
            this.init();
        }

        init() {
            // Criar container de notificações
            this.createNotificationContainer();
            
            // Interceptar erros globais
            this.setupGlobalErrorHandling();
            
            // Integrar com app.js se existir
            this.integrateWithApp();
            
            console.info('✅ Sistema de tratamento de erros iniciado');
        }

        createNotificationContainer() {
            if (document.getElementById('error-notifications')) {
                this.notificationContainer = document.getElementById('error-notifications');
                return;
            }

            const container = document.createElement('div');
            container.id = 'error-notifications';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
                pointer-events: none;
            `;
            
            document.body.appendChild(container);
            this.notificationContainer = container;
        }

        setupGlobalErrorHandling() {
            // Capturar erros não tratados
            window.addEventListener('unhandledrejection', (event) => {
                this.handleError(event.reason);
                event.preventDefault();
            });

            window.addEventListener('error', (event) => {
                // Ignore benign IMG resource errors (e.g., avatar not found or slow load)
                const isImgError = event.target && event.target.tagName === 'IMG';
                if (isImgError) {
                    if (config.debugMode) {
                        console.warn('Resource IMG error ignored:', {
                            src: event.target && event.target.src,
                            message: event.message
                        });
                    }
                    event.preventDefault();
                    return; // do not surface toast for image load failures
                }

                const extra = {
                    source: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                };
                const err = event.error || { message: event.message, ...extra };
                this.handleError(err);
                if (config.debugMode) {
                    console.error('GlobalError:', { message: event.message, ...extra });
                }
                event.preventDefault();
            });

            // Detectar quando fica offline/online
            window.addEventListener('offline', () => {
                this.showNotification('Você está offline', 'warning', errorIcons.network);
            });

            window.addEventListener('online', () => {
                this.showNotification('Conexão restaurada', 'success', errorIcons.success);
            });
        }

        integrateWithApp() {
            // Integrar com app.handleApiError se existir
            if (window.app && !window.app.originalHandleApiError) {
                window.app.originalHandleApiError = window.app.handleApiError;
                window.app.handleApiError = (error) => {
                    this.handleError(error);
                    if (window.app.originalHandleApiError) {
                        window.app.originalHandleApiError(error);
                    }
                };
            }

            // Integrar com ApiInterceptor se existir
            if (window.ApiInterceptor) {
                const originalIntercept = window.ApiInterceptor.intercept;
                window.ApiInterceptor.intercept = async function(...args) {
                    try {
                        return await originalIntercept.apply(this, args);
                    } catch (error) {
                        // Usar a instância para tratar erros (método não é estático)
                        if (window.errorHandler && typeof window.errorHandler.handleError === 'function') {
                            window.errorHandler.handleError(error);
                        } else if (window.ErrorHandler && typeof window.ErrorHandler.error === 'function') {
                            // Fallback para método estático que delega para a instância
                            window.ErrorHandler.error(error);
                        }
                        throw error;
                    }
                };
            }
        }

        handleError(error) {
            // Normalizar erro
            const normalizedError = this.normalizeError(error);
            
            // Logar erro
            if (config.enableLogging) {
                this.logError(normalizedError);
            }
            
            // Adicionar ao histórico
            this.addToHistory(normalizedError);
            
            // Mostrar notificação
            this.showErrorNotification(normalizedError);
            
            // Tentar recuperação automática
            this.attemptRecovery(normalizedError);
        }

        normalizeError(error) {
            if (typeof error === 'string') {
                return {
                    message: error,
                    code: 'UNKNOWN_ERROR',
                    type: 'generic'
                };
            }

            if (error.response) {
                // Erro de resposta HTTP
                return {
                    message: error.response.data?.error || error.message,
                    code: error.response.data?.code || 'HTTP_ERROR',
                    status: error.response.status,
                    type: this.getErrorType(error.response.status)
                };
            }

            if (error.code) {
                // Erro com código
                return {
                    message: errorMessages[error.code] || error.message,
                    code: error.code,
                    type: this.getErrorTypeFromCode(error.code)
                };
            }

            // Erro genérico
            return {
                message: error.message || 'Erro desconhecido',
                code: 'UNKNOWN_ERROR',
                type: 'generic',
                stack: error.stack
            };
        }

        getErrorType(status) {
            if (status >= 400 && status < 500) {
                if (status === 401 || status === 403) return 'auth';
                if (status === 422) return 'validation';
                return 'client';
            }
            if (status >= 500) return 'server';
            return 'generic';
        }

        getErrorTypeFromCode(code) {
            if (code.startsWith('AUTH_')) return 'auth';
            if (code.startsWith('VALIDATION_') || code.includes('INVALID')) return 'validation';
            if (code.includes('PERMISSION') || code.includes('DENIED')) return 'permission';
            if (code.includes('NETWORK') || code.includes('OFFLINE')) return 'network';
            if (code.includes('DATABASE') || code.includes('INTERNAL')) return 'server';
            return 'generic';
        }

        showErrorNotification(error) {
            const message = errorMessages[error.code] || error.message;
            const type = error.type === 'auth' ? 'error' : 
                        error.type === 'validation' ? 'warning' :
                        error.type === 'network' ? 'warning' :
                        'error';
            
            const icon = errorIcons[error.type] || errorIcons.warning;
            
            this.showNotification(message, type, icon);
        }

        showNotification(message, type = 'info', icon = 'ℹ️') {
            // Limitar número de notificações
            if (this.activeNotifications.length >= config.maxNotifications) {
                const oldest = this.activeNotifications.shift();
                if (oldest && oldest.element) {
                    oldest.element.remove();
                }
            }

            const notification = document.createElement('div');
            notification.style.cssText = `
                padding: 16px 20px;
                background: ${this.getNotificationColor(type)};
                color: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideIn 0.3s ease-out;
                pointer-events: all;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.5;
                max-width: 100%;
                word-wrap: break-word;
            `;

            notification.innerHTML = `
                <span style="font-size: 20px; flex-shrink: 0;">${icon}</span>
                <span style="flex: 1;">${this.escapeHtml(message)}</span>
                <button style="
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 20px;
                    padding: 0;
                    margin-left: 8px;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">×</button>
            `;

            // Adicionar animação de entrada
            notification.style.animation = 'slideIn 0.3s ease-out';

            // Click para fechar
            notification.onclick = () => this.removeNotification(notification);

            // Adicionar ao container
            this.notificationContainer.appendChild(notification);
            
            const notificationData = {
                element: notification,
                timeout: null
            };

            // Auto-remover após timeout
            notificationData.timeout = setTimeout(() => {
                this.removeNotification(notification);
            }, config.notificationDuration);

            this.activeNotifications.push(notificationData);

            // Adicionar estilos de animação se não existirem
            if (!document.getElementById('error-handler-styles')) {
                const style = document.createElement('style');
                style.id = 'error-handler-styles';
                style.textContent = `
                    @keyframes slideIn {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    @keyframes slideOut {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(style);
            }
        }

        removeNotification(notification) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                notification.remove();
                // Remover da lista de notificações ativas
                const index = this.activeNotifications.findIndex(n => n.element === notification);
                if (index > -1) {
                    clearTimeout(this.activeNotifications[index].timeout);
                    this.activeNotifications.splice(index, 1);
                }
            }, 300);
        }

        getNotificationColor(type) {
            const colors = {
                error: 'linear-gradient(135deg, #f5365c 0%, #d62149 100%)',
                warning: 'linear-gradient(135deg, #fb6340 0%, #ea5126 100%)',
                success: 'linear-gradient(135deg, #2dce89 0%, #26a06c 100%)',
                info: 'linear-gradient(135deg, #11cdef 0%, #0da5c8 100%)'
            };
            return colors[type] || colors.info;
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        logError(error) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                code: error.code,
                message: error.message,
                type: error.type,
                status: error.status,
                url: window.location.href,
                userAgent: navigator.userAgent
            };

            if (config.debugMode) {
                console.group('🔴 Error Handler');
                console.error('Error:', logEntry);
                if (error.stack) {
                    console.error('Stack:', error.stack);
                }
                console.groupEnd();
            }

            // Enviar para servidor se configurado
            if (config.enableReporting) {
                this.reportError(logEntry);
            }
        }

        addToHistory(error) {
            errorHistory.push({
                ...error,
                timestamp: Date.now()
            });

            // Manter apenas últimos 50 erros
            if (errorHistory.length > 50) {
                errorHistory.shift();
            }
        }

        async reportError(error) {
            // Implementar envio para servidor se necessário
            // Por enquanto, apenas logar localmente
            if (window.localStorage) {
                try {
                    const errors = JSON.parse(localStorage.getItem('errorReports') || '[]');
                    errors.push(error);
                    // Manter apenas últimos 20 erros
                    if (errors.length > 20) {
                        errors.shift();
                    }
                    localStorage.setItem('errorReports', JSON.stringify(errors));
                } catch (e) {
                    // Ignorar erros de localStorage
                }
            }
        }

        attemptRecovery(error) {
            // Recuperação automática baseada no tipo de erro
            switch (error.type) {
                case 'auth':
                    // Se erro de autenticação e não está na página de login
                    if (error.code === 'AUTH_TOKEN_EXPIRED' && !window.location.pathname.includes('login')) {
                        setTimeout(() => {
                            window.location.href = '/login.html?expired=true';
                        }, 2000);
                    }
                    break;
                    
                case 'network':
                    // Tentar reconectar após alguns segundos
                    setTimeout(() => {
                        if (navigator.onLine) {
                            this.showNotification('Tentando reconectar...', 'info', errorIcons.network);
                        }
                    }, 5000);
                    break;
                    
                case 'server':
                    // Para erros 503, tentar novamente
                    if (error.status === 503) {
                        setTimeout(() => {
                            this.showNotification('Tentando novamente...', 'info', errorIcons.info);
                            // Recarregar a página ou reenviar última ação
                        }, 10000);
                    }
                    break;
            }
        }

        // Métodos públicos
        static success(message) {
            window.errorHandler.showNotification(message, 'success', errorIcons.success);
        }

        static info(message) {
            window.errorHandler.showNotification(message, 'info', errorIcons.info);
        }

        static warning(message) {
            window.errorHandler.showNotification(message, 'warning', errorIcons.warning);
        }

        static error(message) {
            window.errorHandler.handleError(message);
        }

        static getHistory() {
            return errorHistory;
        }

        static clearHistory() {
            errorHistory.length = 0;
            console.info('📋 Histórico de erros limpo');
        }

        static getReport() {
            return {
                history: errorHistory,
                localStorage: JSON.parse(localStorage.getItem('errorReports') || '[]'),
                stats: {
                    total: errorHistory.length,
                    byType: errorHistory.reduce((acc, err) => {
                        acc[err.type] = (acc[err.type] || 0) + 1;
                        return acc;
                    }, {}),
                    recent: errorHistory.slice(-10)
                }
            };
        }
    }

    // Criar instância global
    window.errorHandler = new ErrorHandler();
    window.ErrorHandler = ErrorHandler;

    // Atalhos convenientes
    window.showSuccess = ErrorHandler.success;
    window.showError = ErrorHandler.error;
    window.showWarning = ErrorHandler.warning;
    window.showInfo = ErrorHandler.info;

})(window);
