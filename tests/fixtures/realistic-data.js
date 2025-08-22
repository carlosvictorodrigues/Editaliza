/**
 * @file tests/fixtures/realistic-data.js
 * @description Dados de teste realísticos para a Testing Fortress
 * @version 1.0.0
 */

const RealisticData = {
    // ============================================================================
    // DADOS DE USUÁRIOS REALÍSTICOS
    // ============================================================================
    users: {
        valid: [
            {
                email: 'maria.silva@gmail.com',
                password: 'ConcursoFederal2024!',
                firstName: 'Maria',
                lastName: 'Silva',
                profile: {
                    concurso: 'Tribunal de Justiça - SP',
                    cargo: 'Analista Judiciário',
                    experienceLevel: 'intermediate',
                    studyGoals: 'Aprovação em 6 meses'
                }
            },
            {
                email: 'joao.santos@hotmail.com', 
                password: 'EstudoIntensivo123!',
                firstName: 'João',
                lastName: 'Santos',
                profile: {
                    concurso: 'Polícia Federal',
                    cargo: 'Agente',
                    experienceLevel: 'beginner',
                    studyGoals: 'Primeira aprovação'
                }
            },
            {
                email: 'ana.costa@yahoo.com.br',
                password: 'FocoTotal2024!',
                firstName: 'Ana',
                lastName: 'Costa',
                profile: {
                    concurso: 'Receita Federal',
                    cargo: 'Auditor Fiscal',
                    experienceLevel: 'advanced',
                    studyGoals: 'Melhorar classificação'
                }
            }
        ],
        invalid: [
            { email: 'email-invalido', password: '123' },
            { email: '@exemplo.com', password: 'curta' },
            { email: 'teste@', password: '' },
            { email: '', password: 'SenhaValida123!' },
            { email: 'espacos no email@gmail.com', password: 'Valida123!' },
            { email: 'test..test@example.com', password: 'Valida123!' }
        ],
        malicious: [
            { 
                email: '<script>alert("xss")</script>@test.com', 
                password: 'ValidPass123!' 
            },
            { 
                email: 'test@example.com', 
                password: '<script>alert("xss")</script>' 
            },
            { 
                email: 'test\'; DROP TABLE users; --@hack.com', 
                password: 'ValidPass123!' 
            }
        ]
    },

    // ============================================================================
    // DADOS DE PLANOS DE ESTUDO REALÍSTICOS
    // ============================================================================
    studyPlans: {
        tribunalJustice: {
            name: 'Tribunal de Justiça - Analista Judiciário',
            totalHours: 800,
            duration: 180, // dias
            disciplines: [
                { 
                    name: 'Direito Constitucional', 
                    weight: 5, 
                    hours: 150,
                    topics: [
                        'Princípios Fundamentais',
                        'Direitos e Garantias',
                        'Organização do Estado',
                        'Controle de Constitucionalidade'
                    ]
                },
                { 
                    name: 'Direito Administrativo', 
                    weight: 5, 
                    hours: 150,
                    topics: [
                        'Princípios da Administração',
                        'Atos Administrativos',
                        'Contratos Administrativos',
                        'Licitações'
                    ]
                },
                { 
                    name: 'Direito Civil', 
                    weight: 4, 
                    hours: 120,
                    topics: [
                        'Pessoas e Bens',
                        'Obrigações',
                        'Contratos',
                        'Responsabilidade Civil'
                    ]
                },
                { 
                    name: 'Direito Processual Civil', 
                    weight: 4, 
                    hours: 120,
                    topics: [
                        'Teoria Geral do Processo',
                        'Processo de Conhecimento',
                        'Recursos',
                        'Execução'
                    ]
                },
                { 
                    name: 'Português', 
                    weight: 3, 
                    hours: 100,
                    topics: [
                        'Interpretação de Textos',
                        'Gramática',
                        'Redação Oficial',
                        'Literatura'
                    ]
                },
                { 
                    name: 'Informática', 
                    weight: 2, 
                    hours: 80,
                    topics: [
                        'Windows e Linux',
                        'MS Office',
                        'Internet e Email',
                        'Segurança'
                    ]
                },
                { 
                    name: 'Raciocínio Lógico', 
                    weight: 2, 
                    hours: 80,
                    topics: [
                        'Lógica Proposicional',
                        'Sequências',
                        'Matemática Básica',
                        'Estatística'
                    ]
                }
            ]
        },
        policiaFederal: {
            name: 'Polícia Federal - Agente',
            totalHours: 1000,
            duration: 240,
            disciplines: [
                { name: 'Direito Constitucional', weight: 4, hours: 150 },
                { name: 'Direito Administrativo', weight: 4, hours: 150 },
                { name: 'Direito Penal', weight: 5, hours: 180 },
                { name: 'Direito Processual Penal', weight: 5, hours: 180 },
                { name: 'Legislação Especial', weight: 4, hours: 120 },
                { name: 'Português', weight: 3, hours: 100 },
                { name: 'Raciocínio Lógico', weight: 3, hours: 120 }
            ]
        }
    },

    // ============================================================================
    // DADOS DE SESSÕES DE ESTUDO
    // ============================================================================
    studySessions: {
        typical: [
            {
                disciplineName: 'Direito Constitucional',
                topic: 'Princípios Fundamentais',
                duration: 50,
                type: 'theory',
                notes: 'Estudar Art. 1º ao 4º da CF/88. Focar nos princípios da dignidade humana e cidadania.',
                objectives: [
                    'Memorizar princípios fundamentais',
                    'Entender aplicação prática',
                    'Revisar jurisprudência STF'
                ]
            },
            {
                disciplineName: 'Português',
                topic: 'Interpretação de Textos',
                duration: 40,
                type: 'practice',
                notes: 'Resolver 10 questões de interpretação. Atenção especial para inferência e pressupostos.',
                objectives: [
                    'Melhorar velocidade de leitura',
                    'Identificar ideia central',
                    'Reconhecer argumentos implícitos'
                ]
            },
            {
                disciplineName: 'Raciocínio Lógico',
                topic: 'Sequências Lógicas',
                duration: 30,
                type: 'exercises',
                notes: 'Praticar sequências numéricas e geométricas. Resolver 20 questões variadas.',
                objectives: [
                    'Identificar padrões rapidamente',
                    'Aplicar fórmulas de PA e PG',
                    'Resolver questões em menos tempo'
                ]
            }
        ],
        intense: [
            {
                disciplineName: 'Direito Penal',
                topic: 'Crimes contra a Administração',
                duration: 90,
                type: 'comprehensive',
                notes: 'Estudo intensivo dos crimes funcionais. Análise de casos práticos e jurisprudência.',
                objectives: [
                    'Dominar elementos dos crimes',
                    'Diferenciar modalidades',
                    'Memorizar penas'
                ]
            }
        ],
        review: [
            {
                disciplineName: 'Direito Administrativo',
                topic: 'Revisão Geral - Atos Administrativos',
                duration: 60,
                type: 'review',
                notes: 'Revisão completa dos atos administrativos. Mapas mentais e resumos.',
                objectives: [
                    'Consolidar conhecimentos',
                    'Identificar pontos fracos',
                    'Preparar para simulado'
                ]
            }
        ]
    },

    // ============================================================================
    // DADOS DE CRONÔMETRO/TIMER
    // ============================================================================
    timerData: {
        sessions: [
            {
                sessionId: 'timer_001',
                totalTime: 3000000, // 50 minutos em ms
                elapsedTime: 1800000, // 30 minutos
                isRunning: true,
                pomodoros: 2,
                breaks: 1,
                startedAt: new Date().toISOString()
            },
            {
                sessionId: 'timer_002',
                totalTime: 1500000, // 25 minutos
                elapsedTime: 1500000, // completo
                isRunning: false,
                pomodoros: 1,
                breaks: 0,
                completedAt: new Date().toISOString()
            }
        ],
        persistence: [
            {
                key: 'editaliza_timer_session_001',
                value: {
                    startTime: Date.now() - 1800000,
                    elapsed: 1800000,
                    isRunning: true,
                    sessionData: {
                        disciplineId: 1,
                        topicId: 15,
                        planId: 1
                    }
                }
            }
        ]
    },

    // ============================================================================
    // DADOS DE MÉTRICAS E GAMIFICAÇÃO
    // ============================================================================
    metrics: {
        userProgress: {
            totalStudyTime: 45600000, // 12.6 horas em ms
            sessionsCompleted: 28,
            currentStreak: 7,
            longestStreak: 15,
            xpPoints: 1450,
            level: 8,
            achievements: [
                'first_session',
                'week_warrior',
                'focus_master',
                'theory_lover'
            ],
            disciplineProgress: [
                { disciplineId: 1, progress: 75, hoursStudied: 18.5 },
                { disciplineId: 2, progress: 60, hoursStudied: 12.2 },
                { disciplineId: 3, progress: 45, hoursStudied: 8.7 }
            ]
        },
        weeklyStats: [
            { day: 'Segunda', hours: 2.5, sessions: 3 },
            { day: 'Terça', hours: 3.2, sessions: 4 },
            { day: 'Quarta', hours: 1.8, sessions: 2 },
            { day: 'Quinta', hours: 4.1, sessions: 5 },
            { day: 'Sexta', hours: 2.7, sessions: 3 },
            { day: 'Sábado', hours: 5.2, sessions: 6 },
            { day: 'Domingo', hours: 1.9, sessions: 2 }
        ]
    },

    // ============================================================================
    // DADOS DE ANOTAÇÕES
    // ============================================================================
    notes: {
        samples: [
            {
                title: 'Princípios da Administração Pública',
                content: `
                LIMPE - Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência
                
                Art. 37, CF/88:
                - Legalidade: Administração só pode fazer o que a lei permite
                - Impessoalidade: Tratamento igual para todos
                - Moralidade: Ética e probidade
                - Publicidade: Transparência dos atos
                - Eficiência: Melhores resultados com menor custo
                
                IMPORTANTE: Questões costumam cobrar diferença entre legalidade administrativa e legalidade penal!
                `,
                disciplineId: 2,
                topicId: 8,
                tags: ['princípios', 'administração', 'cf88', 'importantes'],
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                lastModified: new Date().toISOString()
            },
            {
                title: 'Controle de Constitucionalidade',
                content: `
                ADI - Ação Direta de Inconstitucionalidade
                ADC - Ação Declaratória de Constitucionalidade  
                ADPF - Arguição de Descumprimento de Preceito Fundamental
                
                Legitimados (Art. 103, CF):
                - Presidente da República
                - Mesa do Senado/Câmara
                - Governadores
                - PGR
                - Conselho Federal da OAB
                - Partidos com representação no CN
                - Confederações sindicais
                
                Efeitos:
                - Erga omnes (contra todos)
                - Ex tunc (retroativo)
                - Vinculante para administração e juízes
                `,
                disciplineId: 1,
                topicId: 12,
                tags: ['controle', 'constitucionalidade', 'adi', 'stf'],
                createdAt: new Date(Date.now() - 172800000).toISOString(),
                lastModified: new Date(Date.now() - 86400000).toISOString()
            },
            {
                title: 'Dicas de Interpretação de Textos',
                content: `
                Estratégias para questões de interpretação:
                
                1. PRIMEIRA LEITURA: 
                   - Leitura rápida para entender o tema geral
                   - Identificar tipo de texto (narrativo, argumentativo, etc.)
                
                2. ANÁLISE DAS ALTERNATIVAS:
                   - Ler todas antes de decidir
                   - Eliminar absurdas primeiro
                   - Cuidado com pegadinhas de tempo verbal
                
                3. SEGUNDA LEITURA:
                   - Mais detalhada
                   - Sublinhar informações importantes
                   - Atenção para conectivos (mas, porém, contudo)
                
                4. VERIFICAÇÃO:
                   - A resposta deve estar no texto
                   - Não usar conhecimento externo
                   - Revisar sempre!
                
                PEGADINHAS COMUNS:
                - Trocar "alguns" por "todos"
                - Inverter causa e consequência
                - Confundir opinião com fato
                `,
                disciplineId: 5,
                topicId: 1,
                tags: ['interpretação', 'estratégias', 'dicas', 'português'],
                createdAt: new Date(Date.now() - 259200000).toISOString(),
                lastModified: new Date(Date.now() - 172800000).toISOString()
            }
        ],
        categories: [
            'Resumos',
            'Jurisprudência',
            'Dicas de Prova',
            'Fórmulas',
            'Mapas Mentais',
            'Revisão',
            'Dúvidas',
            'Importantes'
        ]
    },

    // ============================================================================
    // DADOS PARA TESTES DE STRESS
    // ============================================================================
    stress: {
        largeDatasets: {
            users: Array.from({ length: 1000 }, (_, i) => ({
                email: `user${i}@stress.test`,
                password: `StressTest${i}!`,
                firstName: `User${i}`,
                lastName: `Test`
            })),
            sessions: Array.from({ length: 5000 }, (_, i) => ({
                sessionId: `stress_session_${i}`,
                userId: Math.floor(i / 5) + 1,
                duration: 30 + (i % 120), // 30 a 150 minutos
                completedAt: new Date(Date.now() - i * 3600000).toISOString()
            }))
        }
    }
};

module.exports = RealisticData;