/**
 * @file tests/fortress/fortress-config.js
 * @description Configuração principal da Testing Fortress - Sistema completo de testes automatizados
 * @version 1.0.0
 */

const FortressConfig = {
    // Configurações gerais da Testing Fortress
    name: 'Editaliza Testing Fortress',
    version: '1.0.0',
    description: 'Suíte completa de testes automatizados para garantir qualidade e confiabilidade',
    
    // Configurações de execução
    execution: {
        timeout: 30000,
        retries: 2,
        parallel: true,
        coverage: {
            threshold: 80,
            reports: ['text', 'lcov', 'html', 'json'],
            directory: 'coverage/fortress'
        }
    },
    
    // Configurações de ambiente
    environments: {
        test: {
            database: ':memory:',
            port: 0, // porta aleatória
            logLevel: 'error',
            mockExternalServices: true
        },
        integration: {
            database: 'test_integration.db',
            port: 3001,
            logLevel: 'warn',
            mockExternalServices: false
        }
    },
    
    // Categorias de teste da Fortress
    categories: {
        authentication: {
            name: 'Testes de Autenticação',
            priority: 'critical',
            modules: ['login', 'register', 'tokens', 'sessions', 'oauth']
        },
        timer: {
            name: 'Testes de Cronômetro/Timer',
            priority: 'high',
            modules: ['start', 'pause', 'stop', 'persistence', 'sync', 'pomodoro']
        },
        sessions: {
            name: 'Testes de Sessões de Estudo',
            priority: 'high',
            modules: ['checklist', 'continuation', 'completion', 'data-saving']
        },
        metrics: {
            name: 'Testes de Métricas',
            priority: 'medium',
            modules: ['progress', 'sync', 'cache', 'gamification']
        },
        navigation: {
            name: 'Testes de Navegação',
            priority: 'medium',
            modules: ['links', 'menu', 'loading', 'responsive', 'breadcrumbs']
        },
        api: {
            name: 'Testes de API',
            priority: 'critical',
            modules: ['endpoints', 'errors', 'timeouts', 'rate-limit', 'validation']
        },
        interface: {
            name: 'Testes de Interface',
            priority: 'medium',
            modules: ['components', 'errors', 'modals', 'forms', 'feedback']
        },
        annotations: {
            name: 'Testes de Sistema de Anotações',
            priority: 'medium',
            modules: ['crud', 'organization', 'search', 'persistence', 'sync']
        },
        e2e_integration: {
            name: 'Testes de Integração E2E',
            priority: 'high',
            modules: ['complete_flows', 'user_scenarios', 'cross_browser', 'performance']
        }
    },
    
    // Configurações de dados de teste
    fixtures: {
        users: {
            valid: [
                { email: 'test@editaliza.com', password: 'TestPass123!' },
                { email: 'user@example.com', password: 'SecurePass456!' }
            ],
            invalid: [
                { email: 'invalid-email', password: '123' },
                { email: '', password: '' }
            ]
        },
        sessions: {
            valid: [
                { 
                    sessionId: 'test-session-1',
                    planId: 1,
                    disciplineId: 1,
                    duration: 50,
                    type: 'study'
                }
            ]
        },
        plans: {
            sample: [
                {
                    id: 1,
                    name: 'Plano Teste Concurso',
                    disciplines: ['Português', 'Matemática', 'Direito']
                }
            ]
        }
    },
    
    // Configurações de relatórios
    reporting: {
        formats: ['json', 'html', 'junit'],
        destinations: ['./tests/fortress/reports'],
        includeScreenshots: true,
        includeLogs: true,
        notifications: {
            slack: false,
            email: false,
            webhook: false
        }
    },
    
    // Configurações de mocks
    mocks: {
        external_apis: {
            google_oauth: true,
            file_upload: true,
            notifications: true
        },
        database: {
            use_memory: true,
            seed_data: true,
            cleanup_after_tests: true
        }
    },
    
    // Configurações de performance
    performance: {
        max_response_time: 1000, // ms
        max_memory_usage: 100, // MB
        max_cpu_usage: 80, // %
        benchmarks: {
            login_flow: 500, // ms máximo para login completo
            session_start: 300, // ms máximo para iniciar sessão
            api_response: 200, // ms máximo para resposta API
            dom_render: 100 // ms máximo para renderização DOM
        }
    },
    
    // Configurações de CI/CD
    ci: {
        enabled: true,
        trigger_on: ['push', 'pull_request'],
        parallel_jobs: 4,
        fail_fast: false,
        artifact_retention: 30, // dias
        notification_channels: {
            success: ['console'],
            failure: ['console', 'file']
        }
    },
    
    // Configurações de Dashboard
    dashboard: {
        enabled: true,
        port: 8080,
        real_time_updates: true,
        metrics_retention: 90, // dias
        charts: {
            coverage_trends: true,
            test_execution_time: true,
            failure_rates: true,
            performance_metrics: true
        }
    },
    
    // Scripts de automação
    scripts: {
        pre_test: [
            'npm run seed-test-data',
            'node tests/setup/validate-environment.js'
        ],
        post_test: [
            'node tests/fortress/cleanup.js',
            'node tests/fortress/generate-report.js'
        ],
        coverage_check: 'node tests/fortress/coverage-validator.js',
        performance_check: 'node tests/fortress/performance-validator.js'
    },
    
    // Configurações de alertas
    alerts: {
        coverage_drop: {
            enabled: true,
            threshold: 5, // % de queda máxima permitida
            severity: 'warning'
        },
        performance_degradation: {
            enabled: true,
            threshold: 20, // % de degradação máxima
            severity: 'error'
        },
        test_failures: {
            enabled: true,
            consecutive_failures: 3,
            severity: 'critical'
        }
    }
};

module.exports = FortressConfig;