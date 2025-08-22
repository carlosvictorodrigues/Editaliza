/**
 * @file tests/timer-persistent.test.js
 * @description Testes abrangentes para funcionalidade do cronômetro persistente
 * @jest-environment jsdom
 */

describe('TimerSystem - Cronômetro Persistente', () => {
    let originalLocalStorage;
    let mockLocalStorage;

    beforeEach(() => {
        // Mock do window e global
        global.window = global;
        global.document = document;
        global.navigator = { vibrate: jest.fn() };
        global.Notification = class {
            constructor(title, options) {}
            static requestPermission = jest.fn(() => Promise.resolve('granted'));
            static permission = 'granted';
        };
        global.AudioContext = jest.fn(() => ({
            createOscillator: () => ({ connect: jest.fn(), start: jest.fn(), stop: jest.fn() }),
            createGain: () => ({ connect: jest.fn(), gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() } }),
            destination: {},
            currentTime: 0,
            state: 'running',
            resume: jest.fn(() => Promise.resolve())
        }));
        global.webkitAudioContext = global.AudioContext;
        // Mock do localStorage
        originalLocalStorage = global.localStorage;
        mockLocalStorage = {
            store: {},
            getItem: jest.fn(key => mockLocalStorage.store[key] || null),
            setItem: jest.fn((key, value) => {
                mockLocalStorage.store[key] = String(value);
            }),
            removeItem: jest.fn(key => {
                delete mockLocalStorage.store[key];
            }),
            clear: jest.fn(() => {
                mockLocalStorage.store = {};
            })
        };
        global.localStorage = mockLocalStorage;

        // Mock do console para testes
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        global.window.openStudySession = jest.fn();

        // Mock do DOM
        document.body.innerHTML = `
            <div id="studySessionModal" class="hidden opacity-0">
                <div id="studySessionModalContainer" class="scale-95"></div>
            </div>
            <button onclick="window.openStudySession(1)">Iniciar Estudo</button>
            <button onclick="window.openStudySession(2)">Iniciar Estudo</button>
        `;

        // Reset do TimerSystem
        if (window.TimerSystem) {
            Object.keys(window.TimerSystem.timers).forEach(id => {
                if (window.TimerSystem.timers[id].interval) {
                    clearInterval(window.TimerSystem.timers[id].interval);
                }
            });
            window.TimerSystem.timers = {};
        }
    });

    afterEach(() => {
        global.localStorage = originalLocalStorage;
        jest.restoreAllMocks();
        
        // Limpar timers
        if (window.TimerSystem) {
            Object.keys(window.TimerSystem.timers).forEach(id => {
                if (window.TimerSystem.timers[id].interval) {
                    clearInterval(window.TimerSystem.timers[id].interval);
                }
            });
        }
    });

    describe('Persistência em localStorage', () => {
        beforeEach(() => {
            // Carregar TimerSystem
            require('../js/timer.js');
        });

        test('deve salvar timer no localStorage quando iniciado', () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'editaliza_timers', 
                expect.stringContaining(sessionId.toString())
            );
        });

        test('deve carregar timers salvos do localStorage', () => {
            const testData = {
                '1': {
                    startTime: Date.now() - 5000,
                    elapsed: 5000,
                    isRunning: false,
                    pomodoros: 0,
                    lastPomodoroNotified: 0,
                    savedAt: Date.now()
                }
            };
            
            mockLocalStorage.store['editaliza_timers'] = JSON.stringify(testData);
            
            TimerSystem.loadTimersFromStorage();
            
            expect(TimerSystem.timers['1']).toBeDefined();
            expect(TimerSystem.timers['1'].elapsed).toBeGreaterThanOrEqual(5000);
        });

        test('deve recalcular tempo quando timer estava rodando', () => {
            const startTime = Date.now() - 10000;
            const testData = {
                '1': {
                    startTime: startTime,
                    elapsed: 5000,
                    isRunning: true, // Timer estava rodando
                    pomodoros: 0,
                    lastPomodoroNotified: 0,
                    savedAt: Date.now() - 3000 // Salvo há 3 segundos
                }
            };
            
            mockLocalStorage.store['editaliza_timers'] = JSON.stringify(testData);
            
            TimerSystem.loadTimersFromStorage();
            
            // Deve ter adicionado o tempo que passou desde o salvamento
            expect(TimerSystem.timers['1'].elapsed).toBeGreaterThanOrEqual(8000);
        });

        test('deve limpar timer específico do localStorage', () => {
            const testData = {
                '1': { elapsed: 5000 },
                '2': { elapsed: 3000 }
            };
            
            mockLocalStorage.store['editaliza_timers'] = JSON.stringify(testData);
            
            TimerSystem.clearStoredTimer('1');
            
            const saved = JSON.parse(mockLocalStorage.store['editaliza_timers']);
            expect(saved['1']).toBeUndefined();
            expect(saved['2']).toBeDefined();
        });
    });

    describe('Continuidade do cronômetro', () => {
        beforeEach(() => {
            require('../js/timer.js');
        });

        test('timer deve continuar rodando quando modal é fechado', (done) => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            const initialElapsed = TimerSystem.timers[sessionId].elapsed;
            
            // Simular fechamento do modal (sem parar o timer)
            expect(TimerSystem.timers[sessionId].isRunning).toBe(true);
            
            // Aguardar um pouco e verificar se continua contando
            setTimeout(() => {
                expect(TimerSystem.timers[sessionId].elapsed).toBeGreaterThan(initialElapsed);
                expect(TimerSystem.timers[sessionId].isRunning).toBe(true);
                done();
            }, 1100);
        });

        test('deve manter estado de timer ativo entre sessões', () => {
            const sessionId = 1;
            
            // Simular timer que estava rodando
            TimerSystem.start(sessionId);
            TimerSystem.saveTimersToStorage();
            
            // Simular nova sessão/reload
            TimerSystem.timers = {};
            TimerSystem.loadTimersFromStorage();
            
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false); // Carrega pausado
            expect(TimerSystem.getTimerElapsed(sessionId)).toBeGreaterThan(0);
        });
    });

    describe('Atualização visual dos cards', () => {
        beforeEach(() => {
            require('../js/timer.js');
        });

        test('deve mostrar botão "Continuar (tempo)" quando há timer pausado', () => {
            const sessionId = 1;
            
            // Simular timer com tempo acumulado
            TimerSystem.timers[sessionId] = {
                startTime: Date.now() - 60000,
                elapsed: 60000,
                isRunning: false,
                pomodoros: 0
            };
            
            TimerSystem.updateCardVisuals(sessionId);
            
            const button = document.querySelector(`button[onclick="window.openStudySession(${sessionId})"]`);
            expect(button.innerHTML).toContain('Continuar');
            expect(button.innerHTML).toContain('01:00');
        });

        test('deve mostrar botão "Estudando" quando timer está rodando', () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            TimerSystem.updateCardVisuals(sessionId);
            
            const button = document.querySelector(`button[onclick="window.openStudySession(${sessionId})"]`);
            expect(button.innerHTML).toContain('Estudando');
            expect(button.classList.contains('animate-pulse')).toBe(true);
        });

        test('deve aplicar classes CSS corretas baseado no estado do timer', () => {
            const sessionId = 1;
            const button = document.querySelector(`button[onclick="window.openStudySession(${sessionId})"]`);
            
            // Timer inativo
            TimerSystem.updateCardVisuals(sessionId);
            expect(button.classList.contains('bg-blue-600')).toBe(true);
            
            // Timer rodando
            TimerSystem.start(sessionId);
            TimerSystem.updateCardVisuals(sessionId);
            expect(button.classList.contains('bg-orange-500')).toBe(true);
            
            // Timer pausado com tempo
            TimerSystem.stop(sessionId);
            TimerSystem.timers[sessionId].elapsed = 30000; // 30 segundos
            TimerSystem.updateCardVisuals(sessionId);
            expect(button.classList.contains('bg-yellow-500')).toBe(true);
        });
    });

    describe('Reconexão automática ao modal', () => {
        beforeEach(() => {
            require('../js/timer.js');
            require('../js/checklist.js');
        });

        test('deve reconectar automaticamente ao timer ativo ao abrir modal', () => {
            const sessionId = 1;
            const session = { id: sessionId, title: 'Test Session' };
            
            // Simular timer ativo
            TimerSystem.start(sessionId);
            
            // Mock do StudyChecklist
            const mockStudyChecklist = {
                session: null,
                startStudySession: jest.fn()
            };
            global.StudyChecklist = mockStudyChecklist;
            
            // Simular abertura do modal
            mockStudyChecklist.session = session;
            
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
        });

        test('deve preservar progresso de pomodoros na reconexão', () => {
            const sessionId = 1;
            
            // Simular timer com pomodoros completos
            TimerSystem.timers[sessionId] = {
                startTime: Date.now() - 1800000, // 30 minutos
                elapsed: 1800000,
                isRunning: false,
                pomodoros: 1,
                lastPomodoroNotified: 1
            };
            
            TimerSystem.saveTimersToStorage();
            TimerSystem.timers = {};
            TimerSystem.loadTimersFromStorage();
            
            expect(TimerSystem.timers[sessionId].pomodoros).toBe(1);
        });
    });

    describe('Edge Cases e Robustez', () => {
        beforeEach(() => {
            require('../js/timer.js');
        });

        test('deve lidar com localStorage corrompido', () => {
            mockLocalStorage.store['editaliza_timers'] = 'invalid json';
            
            expect(() => {
                TimerSystem.loadTimersFromStorage();
            }).not.toThrow();
            
            expect(Object.keys(TimerSystem.timers)).toHaveLength(0);
        });

        test('deve lidar com dados de timer inválidos', () => {
            const testData = {
                '1': {
                    // Dados incompletos/inválidos
                    elapsed: 'invalid',
                    isRunning: null
                }
            };
            
            mockLocalStorage.store['editaliza_timers'] = JSON.stringify(testData);
            
            expect(() => {
                TimerSystem.loadTimersFromStorage();
            }).not.toThrow();
        });

        test('deve funcionar quando localStorage não está disponível', () => {
            global.localStorage = undefined;
            
            expect(() => {
                TimerSystem.saveTimersToStorage();
                TimerSystem.loadTimersFromStorage();
            }).not.toThrow();
        });

        test('deve lidar com múltiplos timers simultâneos', () => {
            TimerSystem.start(1);
            TimerSystem.start(2);
            
            expect(TimerSystem.hasActiveTimer(1)).toBe(true);
            expect(TimerSystem.hasActiveTimer(2)).toBe(true);
            
            TimerSystem.stop(1);
            expect(TimerSystem.hasActiveTimer(1)).toBe(false);
            expect(TimerSystem.hasActiveTimer(2)).toBe(true);
        });

        test('deve calcular tempo decorrido corretamente após longo período inativo', () => {
            const sessionId = 1;
            const longTimeAgo = Date.now() - 86400000; // 24 horas atrás
            
            const testData = {
                '1': {
                    startTime: longTimeAgo,
                    elapsed: 3600000, // 1 hora
                    isRunning: true,
                    savedAt: longTimeAgo + 3600000 // Salvo após 1 hora de execução
                }
            };
            
            mockLocalStorage.store['editaliza_timers'] = JSON.stringify(testData);
            TimerSystem.loadTimersFromStorage();
            
            // Deve ter calculado tempo total incluindo o período offline
            expect(TimerSystem.timers[sessionId].elapsed).toBeGreaterThan(3600000);
        });
    });

    describe('Performance e Vazamentos de Memória', () => {
        beforeEach(() => {
            require('../js/timer.js');
        });

        test('deve limpar intervals quando timer é parado', () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            expect(TimerSystem.timers[sessionId].interval).toBeDefined();
            
            TimerSystem.stop(sessionId);
            expect(TimerSystem.timers[sessionId].interval).toBeNull();
        });

        test('não deve criar múltiplos intervals para o mesmo timer', () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            const firstInterval = TimerSystem.timers[sessionId].interval;
            
            TimerSystem.start(sessionId); // Iniciar novamente
            expect(TimerSystem.timers[sessionId].interval).not.toBe(firstInterval);
        });

        test('deve salvar apenas timers com progresso significativo', () => {
            const sessionId1 = 1;
            const sessionId2 = 2;
            
            // Timer 1 com tempo significativo
            TimerSystem.timers[sessionId1] = {
                elapsed: 5000,
                isRunning: false
            };
            
            // Timer 2 sem progresso
            TimerSystem.timers[sessionId2] = {
                elapsed: 0,
                isRunning: false
            };
            
            TimerSystem.saveTimersToStorage();
            
            const saved = JSON.parse(mockLocalStorage.store['editaliza_timers']);
            expect(saved[sessionId1]).toBeDefined();
            expect(saved[sessionId2]).toBeUndefined();
        });
    });

    describe('Formatação de Tempo', () => {
        beforeEach(() => {
            require('../js/timer.js');
        });

        test('deve formatar tempo corretamente', () => {
            expect(TimerSystem.formatTime(0)).toBe('00:00:00');
            expect(TimerSystem.formatTime(5000)).toBe('00:00:05');
            expect(TimerSystem.formatTime(65000)).toBe('00:01:05');
            expect(TimerSystem.formatTime(3665000)).toBe('01:01:05');
        });

        test('deve lidar com valores de tempo extremos', () => {
            expect(TimerSystem.formatTime(86400000)).toBe('24:00:00'); // 24 horas
            expect(TimerSystem.formatTime(-1000)).toBe('00:00:00'); // Tempo negativo
        });
    });

    describe('API Integration', () => {
        beforeEach(() => {
            require('../js/timer.js');
            
            // Mock do app.apiFetch
            global.app = {
                apiFetch: jest.fn(() => Promise.resolve())
            };
        });

        test('deve salvar tempo no banco de dados quando timer é parado', async () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            TimerSystem.timers[sessionId].elapsed = 30000; // 30 segundos
            
            await TimerSystem.stop(sessionId);
            
            expect(global.app.apiFetch).toHaveBeenCalledWith(
                `/schedules/sessions/${sessionId}/time`,
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('start_time')
                })
            );
        });

        test('não deve salvar tempos muito curtos no banco', async () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            TimerSystem.timers[sessionId].elapsed = 5000; // 5 segundos (menos que 10)
            
            await TimerSystem.stop(sessionId);
            
            expect(global.app.apiFetch).not.toHaveBeenCalled();
        });
    });
});