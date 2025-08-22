/**
 * @file tests/timer-basic.test.js  
 * @description Testes básicos e funcionais para o cronômetro persistente
 * @jest-environment jsdom
 */

describe('TimerSystem - Testes Básicos', () => {
    let mockLocalStorage;

    beforeAll(() => {
        // Carregar o TimerSystem
        require('../js/timer.js');
        
        // Mock das APIs do browser
        global.app = {
            apiFetch: jest.fn(() => Promise.resolve()),
            showToast: jest.fn()
        };
    });

    beforeEach(() => {
        // Mock do localStorage
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
        Object.defineProperty(global, 'localStorage', {
            value: mockLocalStorage,
            writable: true
        });

        global.window.openStudySession = jest.fn();

        // Mock DOM básico
        document.body.innerHTML = `
            <div id="studySessionModal" class="hidden opacity-0">
                <div id="studySessionModalContainer" class="scale-95"></div>
            </div>
            <button onclick="window.openStudySession(1)">Iniciar Estudo</button>
        `;

        // Limpar timers entre testes
        Object.keys(TimerSystem.timers).forEach(id => {
            if (TimerSystem.timers[id].interval) {
                clearInterval(TimerSystem.timers[id].interval);
            }
        });
        TimerSystem.timers = {};

        jest.clearAllMocks();
    });

    afterEach(() => {
        // Limpar timers
        Object.keys(TimerSystem.timers).forEach(id => {
            if (TimerSystem.timers[id].interval) {
                clearInterval(TimerSystem.timers[id].interval);
            }
        });
    });

    describe('Funcionalidades Básicas', () => {
        test('deve iniciar um cronômetro', () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            
            expect(TimerSystem.timers[sessionId]).toBeDefined();
            expect(TimerSystem.timers[sessionId].isRunning).toBe(true);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
        });

        test('deve parar um cronômetro', () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            TimerSystem.stop(sessionId);
            
            expect(TimerSystem.timers[sessionId].isRunning).toBe(false);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
            expect(TimerSystem.timers[sessionId].interval).toBeNull();
        });

        test('deve alternar entre iniciar e parar', () => {
            const sessionId = 1;
            
            // Primeiro toggle - iniciar
            TimerSystem.toggle(sessionId);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
            
            // Segundo toggle - parar
            TimerSystem.toggle(sessionId);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
        });

        test('deve acumular tempo decorrido', (done) => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            
            setTimeout(() => {
                const elapsed = TimerSystem.getTimerElapsed(sessionId);
                expect(elapsed).toBeGreaterThan(0);
                expect(elapsed).toBeLessThan(2000); // Menos de 2 segundos
                done();
            }, 100);
        });

        test('deve formatar tempo corretamente', () => {
            expect(TimerSystem.formatTime(0)).toBe('00:00:00');
            expect(TimerSystem.formatTime(5000)).toBe('00:00:05');
            expect(TimerSystem.formatTime(65000)).toBe('00:01:05');
            expect(TimerSystem.formatTime(3665000)).toBe('01:01:05');
            expect(TimerSystem.formatTime(-1000)).toBe('00:00:00');
        });
    });

    describe('Persistência', () => {
        test('deve salvar timer no localStorage', () => {
            const sessionId = 1;
            
            TimerSystem.start(sessionId);
            TimerSystem.saveTimersToStorage();
            
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'editaliza_timers',
                expect.stringContaining(sessionId.toString())
            );
        });

        test('deve carregar timers do localStorage', () => {
            const sessionId = 1;
            const testData = {
                [sessionId]: {
                    startTime: Date.now() - 10000,
                    elapsed: 10000,
                    isRunning: false,
                    pomodoros: 0,
                    lastPomodoroNotified: 0,
                    savedAt: Date.now()
                }
            };
            
            mockLocalStorage.store['editaliza_timers'] = JSON.stringify(testData);
            
            TimerSystem.loadTimersFromStorage();
            
            expect(TimerSystem.timers[sessionId]).toBeDefined();
            expect(TimerSystem.getTimerElapsed(sessionId)).toBeGreaterThanOrEqual(10000);
        });

        test('deve limpar timer específico', () => {
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

        test('deve lidar com localStorage corrompido sem quebrar', () => {
            mockLocalStorage.store['editaliza_timers'] = 'invalid json';
            
            expect(() => {
                TimerSystem.loadTimersFromStorage();
            }).not.toThrow();
        });
    });

    describe('Estados dos Timers', () => {
        test('deve identificar timer ativo', () => {
            const sessionId = 1;
            
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
            
            TimerSystem.start(sessionId);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
            
            TimerSystem.stop(sessionId);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
        });

        test('deve retornar timer ativo', () => {
            const sessionId = 1;
            
            expect(TimerSystem.getActiveTimer(sessionId)).toBeNull();
            
            TimerSystem.start(sessionId);
            const activeTimer = TimerSystem.getActiveTimer(sessionId);
            expect(activeTimer).toBeDefined();
            expect(activeTimer.isRunning).toBe(true);
            
            TimerSystem.stop(sessionId);
            expect(TimerSystem.getActiveTimer(sessionId)).toBeNull();
        });

        test('deve retornar tempo decorrido', () => {
            const sessionId = 1;
            
            expect(TimerSystem.getTimerElapsed(sessionId)).toBe(0);
            
            TimerSystem.timers[sessionId] = {
                elapsed: 30000,
                isRunning: false
            };
            
            expect(TimerSystem.getTimerElapsed(sessionId)).toBe(30000);
        });
    });

    describe('Múltiplos Timers', () => {
        test('deve gerenciar múltiplos timers independentemente', () => {
            TimerSystem.start(1);
            TimerSystem.start(2);
            
            expect(TimerSystem.hasActiveTimer(1)).toBe(true);
            expect(TimerSystem.hasActiveTimer(2)).toBe(true);
            
            TimerSystem.stop(1);
            expect(TimerSystem.hasActiveTimer(1)).toBe(false);
            expect(TimerSystem.hasActiveTimer(2)).toBe(true);
        });

        test('deve salvar apenas timers com progresso', () => {
            TimerSystem.timers[1] = { elapsed: 5000, isRunning: false };
            TimerSystem.timers[2] = { elapsed: 0, isRunning: false };
            
            TimerSystem.saveTimersToStorage();
            
            if (mockLocalStorage.store['editaliza_timers']) {
                const saved = JSON.parse(mockLocalStorage.store['editaliza_timers']);
                expect(saved['1']).toBeDefined();
                expect(saved['2']).toBeUndefined();
            }
        });
    });

    describe('Continuidade do Timer', () => {
        test('deve continuar timer existente', () => {
            const sessionId = 1;
            
            // Simular timer pausado com tempo acumulado
            TimerSystem.timers[sessionId] = {
                elapsed: 30000,
                isRunning: false,
                startTime: Date.now() - 30000,
                pomodoros: 0,
                lastPomodoroNotified: 0
            };
            
            const result = TimerSystem.continueTimer(sessionId);
            
            expect(result).toBe(true);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('deve lidar com sessionId inválido', () => {
            expect(() => {
                TimerSystem.start(null);
                TimerSystem.start(undefined);
                TimerSystem.stop(999);
            }).not.toThrow();
        });

        test('deve lidar com localStorage indisponível', () => {
            global.localStorage = undefined;
            
            expect(() => {
                TimerSystem.saveTimersToStorage();
                TimerSystem.loadTimersFromStorage();
            }).not.toThrow();
        });
    });
});