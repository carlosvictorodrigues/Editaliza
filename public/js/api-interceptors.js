/**
 * API Interceptors - Sistema Avançado de Interceptação
 * 
 * FUNCIONALIDADES:
 * - Renovação automática de token
 * - Retry inteligente em falhas
 * - Queue de requisições durante renovação
 * - Circuit breaker para falhas consecutivas
 * - Cache de respostas GET
 * - Logging de performance
 */

(function(window) {
    'use strict';

    // Configurações
    const config = {
        maxRetries: 3,
        retryDelay: 1000, // ms
        tokenRefreshEndpoint: '/api/auth/refresh',
        cacheTimeout: 5 * 60 * 1000, // 5 minutos
        circuitBreakerThreshold: 5, // falhas consecutivas
        circuitBreakerTimeout: 30000 // 30 segundos
    };

    // Estado global
    const state = {
        isRefreshingToken: false,
        refreshTokenPromise: null,
        requestQueue: [],
        responseCache: new Map(),
        failureCount: 0,
        circuitBreakerOpen: false,
        circuitBreakerTimer: null
    };

    // Métricas
    const metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        retriedRequests: 0,
        cachedResponses: 0,
        tokenRefreshes: 0,
        averageResponseTime: 0,
        responseTimes: []
    };

    /**
     * Circuit Breaker - Previne requisições quando há muitas falhas
     */
    class CircuitBreaker {
        static open() {
            state.circuitBreakerOpen = true;
            console.warn('🔴 Circuit breaker ABERTO - requisições pausadas');
            
            // Reabrir após timeout
            clearTimeout(state.circuitBreakerTimer);
            state.circuitBreakerTimer = setTimeout(() => {
                this.close();
            }, config.circuitBreakerTimeout);
        }

        static close() {
            state.circuitBreakerOpen = false;
            state.failureCount = 0;
            console.info('🟢 Circuit breaker FECHADO - requisições retomadas');
        }

        static isOpen() {
            return state.circuitBreakerOpen;
        }

        static recordSuccess() {
            state.failureCount = 0;
        }

        static recordFailure() {
            state.failureCount++;
            if (state.failureCount >= config.circuitBreakerThreshold) {
                this.open();
            }
        }
    }

    /**
     * Cache Manager - Gerencia cache de respostas GET
     */
    class CacheManager {
        static getCacheKey(url, options) {
            return `${url}::${JSON.stringify(options.params || {})}`;
        }

        static get(url, options) {
            const key = this.getCacheKey(url, options);
            const cached = state.responseCache.get(key);
            
            if (cached && Date.now() - cached.timestamp < config.cacheTimeout) {
                metrics.cachedResponses++;
                console.debug(`📦 Cache hit: ${url}`);
                return cached.data;
            }
            
            return null;
        }

        static set(url, options, data) {
            // Só cachear GETs sem parâmetros sensíveis
            if (options.method !== 'GET') return;
            
            const key = this.getCacheKey(url, options);
            state.responseCache.set(key, {
                data: data,
                timestamp: Date.now()
            });

            // Limpar cache antigo
            this.cleanup();
        }

        static cleanup() {
            const now = Date.now();
            for (const [key, value] of state.responseCache.entries()) {
                if (now - value.timestamp > config.cacheTimeout) {
                    state.responseCache.delete(key);
                }
            }
        }

        static clear() {
            state.responseCache.clear();
        }
    }

    /**
     * Token Manager - Gerencia renovação de tokens
     */
    class TokenManager {
        static async refreshToken() {
            // Se já está renovando, aguardar
            if (state.isRefreshingToken) {
                return state.refreshTokenPromise;
            }

            state.isRefreshingToken = true;
            metrics.tokenRefreshes++;

            state.refreshTokenPromise = new Promise((resolve, reject) => {
                try {
                    // DESABILITADO: Refresh token não implementado
                    // Redirecionar direto para login em vez de tentar refresh
                    console.warn('⚠️ Token expirado, redirecionando para login...');
                    
                    // Limpar token inválido
                    localStorage.removeItem('editaliza_token');
                    
                    // Evitar loop - só redirecionar se não estiver já no login
                    if (!window.location.pathname.includes('/login.html')) {
                        setTimeout(() => {
                            window.location.href = '/login.html';
                        }, 100);
                    }
                    
                    reject(new Error('Token expirado - faça login novamente'));
                    return;
                } catch (error) {
                    console.error('❌ Erro ao renovar token:', error);
                    
                    // Limpar token inválido
                    localStorage.removeItem('editaliza_token');
                    
                    // Redirecionar para login
                    if (window.location.pathname !== '/login.html') {
                        window.location.href = '/login.html?expired=true';
                    }
                    
                    reject(error);
                } finally {
                    state.isRefreshingToken = false;
                    state.refreshTokenPromise = null;
                }
            });

            return state.refreshTokenPromise;
        }

        static queueRequest(request) {
            state.requestQueue.push(request);
        }

        static async processQueue() {
            const queue = [...state.requestQueue];
            state.requestQueue = [];

            for (const request of queue) {
                try {
                    await request();
                } catch (error) {
                    console.error('Erro ao processar requisição da fila:', error);
                }
            }
        }
    }

    /**
     * Retry Manager - Gerencia tentativas de retry
     */
    class RetryManager {
        static shouldRetry(error, attempt, url) {
            // Não fazer retry se circuit breaker está aberto
            if (CircuitBreaker.isOpen()) return false;
            
            // NUNCA fazer retry para endpoint do timer
            if (this.isTimerEndpoint(url)) return false;
            
            // Não fazer retry em erros de cliente (4xx)
            if (error.status >= 400 && error.status < 500) return false;
            
            // Fazer retry em erros de rede ou servidor (5xx)
            return attempt < config.maxRetries;
        }
        
        static isTimerEndpoint(url) {
            return /\/api\/sessions\/\d+\/time$/.test(url || '');
        }

        static async retry(fn, attempt = 0, url = '') {
            try {
                const result = await fn();
                // Não registrar sucesso no circuit breaker para timer endpoint
                if (!this.isTimerEndpoint(url)) {
                    CircuitBreaker.recordSuccess();
                }
                return result;
            } catch (error) {
                // Marcar erro como timer se for endpoint do timer
                if (this.isTimerEndpoint(url)) {
                    error.isTimer = true;
                    throw error; // Não fazer retry, nem registrar no circuit breaker
                }
                
                CircuitBreaker.recordFailure();
                
                if (this.shouldRetry(error, attempt, url)) {
                    metrics.retriedRequests++;
                    const delay = config.retryDelay * Math.pow(2, attempt); // Exponential backoff
                    
                    console.warn(`⏳ Retry ${attempt + 1}/${config.maxRetries} após ${delay}ms`);
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.retry(fn, attempt + 1, url);
                }
                
                throw error;
            }
        }
    }

    /**
     * Performance Monitor - Monitora performance das requisições
     */
    class PerformanceMonitor {
        static recordTiming(duration) {
            metrics.responseTimes.push(duration);
            
            // Manter apenas últimas 100 medições
            if (metrics.responseTimes.length > 100) {
                metrics.responseTimes.shift();
            }
            
            // Calcular média
            const sum = metrics.responseTimes.reduce((a, b) => a + b, 0);
            metrics.averageResponseTime = Math.round(sum / metrics.responseTimes.length);
        }

        static getMetrics() {
            return {
                ...metrics,
                cacheHitRate: metrics.totalRequests > 0 
                    ? (metrics.cachedResponses / metrics.totalRequests * 100).toFixed(2) + '%'
                    : '0%',
                successRate: metrics.totalRequests > 0
                    ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2) + '%'
                    : '0%',
                retryRate: metrics.totalRequests > 0
                    ? (metrics.retriedRequests / metrics.totalRequests * 100).toFixed(2) + '%'
                    : '0%'
            };
        }
    }

    /**
     * API Interceptor Principal
     */
    class ApiInterceptor {
        static async intercept(url, options = {}) {
            // Circuit breaker check
            if (CircuitBreaker.isOpen()) {
                throw new Error('Serviço temporariamente indisponível. Tente novamente em alguns segundos.');
            }

            // Cache check para GET
            if (options.method === 'GET' || !options.method) {
                const cached = CacheManager.get(url, options);
                if (cached) {
                    return Promise.resolve(cached);
                }
            }

            metrics.totalRequests++;
            const startTime = Date.now();

            // Função de requisição encapsulada para retry
            const makeRequest = async () => {
                // Adicionar token se existir (usar a chave correta)
                const token = localStorage.getItem('editaliza_token');
                if (token) {
                    options.headers = {
                        ...options.headers,
                        'Authorization': `Bearer ${token}`
                    };
                }

                const response = await window.originalFetch(url, options);
                
                // Token expirado - renovar e tentar novamente
                if (response.status === 401 && !url.includes('/auth/')) {
                    await TokenManager.refreshToken();
                    
                    // Atualizar token na requisição
                    const newToken = localStorage.getItem('editaliza_token');
                    if (newToken) {
                        options.headers['Authorization'] = `Bearer ${newToken}`;
                    }
                    
                    // Tentar novamente com novo token
                    return window.originalFetch(url, options);
                }

                if (!response.ok) {
                    const error = new Error(`HTTP ${response.status}`);
                    error.status = response.status;
                    error.response = response;
                    throw error;
                }

                return response;
            };

            try {
                // Executar com retry (passando URL para verificação de timer)
                const response = await RetryManager.retry(makeRequest, 0, url);
                
                // Clone response para cache
                const responseClone = response.clone();
                const data = await response.json();
                
                // Cachear resposta GET
                if (options.method === 'GET' || !options.method) {
                    CacheManager.set(url, options, data);
                }

                // Registrar métricas
                const duration = Date.now() - startTime;
                PerformanceMonitor.recordTiming(duration);
                metrics.successfulRequests++;

                return data;
                
            } catch (error) {
                metrics.failedRequests++;
                
                // Log detalhado de erro
                console.error('API Error:', {
                    url,
                    method: options.method || 'GET',
                    status: error.status,
                    message: error.message,
                    duration: Date.now() - startTime
                });
                
                throw error;
            }
        }

        static install() {
            // Salvar fetch original
            if (!window.originalFetch) {
                window.originalFetch = window.fetch;
            }

            // Substituir fetch global
            window.fetch = function(url, options) {
                // Apenas interceptar chamadas à API
                if (url.startsWith('/api/') || url.startsWith('http')) {
                    return ApiInterceptor.intercept(url, options);
                }
                
                // Passar direto outras requisições
                return window.originalFetch(url, options);
            };

            // Estender app.apiFetch se existir
            if (window.app && window.app.apiFetch) {
                const originalApiFetch = window.app.apiFetch.bind(window.app);
                
                window.app.apiFetch = async function(endpoint, options = {}) {
                    const url = `/api${endpoint}`;
                    
                    try {
                        return await ApiInterceptor.intercept(url, {
                            ...options,
                            headers: {
                                'Content-Type': 'application/json',
                                ...options.headers
                            }
                        });
                    } catch (error) {
                        // Compatibilidade com tratamento de erro existente
                        if (window.app.handleApiError) {
                            window.app.handleApiError(error);
                        }
                        throw error;
                    }
                };
            }

            console.info('✨ API Interceptors instalados com sucesso');
        }

        static uninstall() {
            if (window.originalFetch) {
                window.fetch = window.originalFetch;
            }
            console.info('🔌 API Interceptors desinstalados');
        }

        static getMetrics() {
            return PerformanceMonitor.getMetrics();
        }

        static clearCache() {
            CacheManager.clear();
            console.info('🧹 Cache limpo');
        }

        static resetCircuitBreaker() {
            CircuitBreaker.close();
        }
    }

    // Exportar para window
    window.ApiInterceptor = ApiInterceptor;

    // Auto-instalar ao carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ApiInterceptor.install();
        });
    } else {
        ApiInterceptor.install();
    }

    // Comandos úteis no console
    window.apiMetrics = () => ApiInterceptor.getMetrics();
    window.clearApiCache = () => ApiInterceptor.clearCache();
    window.resetCircuitBreaker = () => ApiInterceptor.resetCircuitBreaker();

})(window);