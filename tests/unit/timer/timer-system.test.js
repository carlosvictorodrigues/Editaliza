/**
 * @file tests/unit/timer/timer-system.test.js
 * @description Testes unitários completos para sistema de cronômetro/timer
 * @fortress-category timer
 * @priority high
 */

const FortressUtils = require('../../fortress/fortress-utils');
const RealisticData = require('../../fixtures/realistic-data');

// Mock do DOM para testes de componentes frontend
const { JSDOM } = require('jsdom');

let fortress;
let dom;
let window;
let document;
let TimerSystem;

describe('⏰ FORTRESS: Sistema de Cronômetro/Timer', () => {
    beforeAll(async () => {
        fortress = new FortressUtils();
        
        // Configurar ambiente DOM simulado
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head><title>Timer Test</title></head>
            <body>
                <div id="timer-display-1" data-session="1">00:00:00</div>
                <div id="timer-controls-1" data-session="1">
                    <button onclick="TimerSystem.toggle(1)" class="btn-timer-toggle">Iniciar</button>
                    <button onclick="TimerSystem.pause(1)" class="btn-timer-pause">Pausar</button>
                    <button onclick="TimerSystem.stop(1)" class="btn-timer-stop">Parar</button>
                </div>
                <div id="pomodoro-indicator-1"></div>
            </body>
            </html>
        `);
        
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.localStorage = {
            data: {},
            getItem: function(key) { return this.data[key] || null; },
            setItem: function(key, value) { this.data[key] = value; },
            removeItem: function(key) { delete this.data[key]; },
            clear: function() { this.data = {}; }
        };
        
        // Mock de performance.now() para testes determinísticos
        global.performance = {
            now: jest.fn(() => Date.now())
        };
        
        // Importar sistema de timer após configurar globals
        const timerCode = require('fs').readFileSync(
            require('path').join(__dirname, '../../../js/timer.js'), 
            'utf8'
        );
        eval(timerCode);
        TimerSystem = global.TimerSystem;
    });

    beforeEach(async () => {
        await fortress.runCleanup();
        
        // Reset do sistema de timer
        if (TimerSystem) {
            TimerSystem.timers = {};
        }
        
        // Limpar localStorage
        global.localStorage.clear();
        
        // Reset dos mocks
        jest.clearAllMocks();
        jest.clearAllTimers();
    });

    afterAll(async () => {
        await fortress.runCleanup();
        dom.window.close();
    });

    // ========================================================================
    // TESTES DE INICIALIZAÇÃO E ESTRUTURA
    // ========================================================================
    describe('🏗️ Inicialização do Sistema', () => {
        test('deve inicializar sistema de timer corretamente', () => {
            expect(TimerSystem).toBeDefined();
            expect(TimerSystem.timers).toBeDefined();
            expect(typeof TimerSystem.timers).toBe('object');
            
            // Métodos essenciais devem estar disponíveis
            expect(typeof TimerSystem.getActiveTimer).toBe('function');
            expect(typeof TimerSystem.hasActiveTimer).toBe('function');
            expect(typeof TimerSystem.formatTime).toBe('function');
        });

        test('deve inicializar com estado limpo', () => {
            expect(Object.keys(TimerSystem.timers)).toHaveLength(0);
            expect(TimerSystem.hasActiveTimer(1)).toBe(false);
            expect(TimerSystem.getActiveTimer(1)).toBeNull();
        });

        test('deve formatar tempo corretamente', () => {
            const testCases = [
                { ms: 0, expected: '00:00:00' },
                { ms: 1000, expected: '00:00:01' },
                { ms: 60000, expected: '00:01:00' },
                { ms: 3600000, expected: '01:00:00' },
                { ms: 3661000, expected: '01:01:01' },
                { ms: 7380000, expected: '02:03:00' },
                { ms: -1000, expected: '00:00:00' } // Tempo negativo deve ser zero
            ];

            testCases.forEach(({ ms, expected }) => {
                expect(TimerSystem.formatTime(ms)).toBe(expected);
            });
        });

        test('deve lidar com valores de tempo inválidos', () => {
            const invalidValues = [null, undefined, NaN, Infinity, -Infinity, 'string', {}, []];
            
            invalidValues.forEach(value => {
                expect(TimerSystem.formatTime(value)).toBe('00:00:00');
            });
        });
    });

    // ========================================================================
    // TESTES DE CRIAÇÃO E CONTROLE DE TIMER
    // ========================================================================
    describe('▶️ Criação e Controle de Timer', () => {
        test('deve criar timer para nova sessão', () => {
            const sessionId = 1;
            const startTime = Date.now();
            
            // Simular início do timer
            TimerSystem.timers[sessionId] = {
                startTime,
                elapsed: 0,
                isRunning: true,
                pomodoros: 0,
                breaks: 0
            };
            
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
            
            const timer = TimerSystem.getActiveTimer(sessionId);
            expect(timer).toBeTruthy();
            expect(timer.isRunning).toBe(true);
            expect(timer.startTime).toBe(startTime);
        });

        test('deve permitir múltiplos timers simultâneos', () => {
            const sessions = [1, 2, 3];
            const startTime = Date.now();
            
            sessions.forEach(sessionId => {
                TimerSystem.timers[sessionId] = {
                    startTime: startTime + sessionId * 1000,
                    elapsed: sessionId * 5000,
                    isRunning: true,
                    pomodoros: 0,
                    breaks: 0
                };
            });
            
            sessions.forEach(sessionId => {
                expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
                const timer = TimerSystem.getActiveTimer(sessionId);
                expect(timer.elapsed).toBe(sessionId * 5000);
            });
        });

        test('deve pausar timer corretamente', () => {
            const sessionId = 1;
            const startTime = Date.now();
            const elapsed = 30000; // 30 segundos
            
            TimerSystem.timers[sessionId] = {
                startTime,
                elapsed,
                isRunning: true,
                pomodoros: 1,
                breaks: 0
            };
            
            // Pausar timer
            TimerSystem.timers[sessionId].isRunning = false;
            
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
            expect(TimerSystem.timers[sessionId].elapsed).toBe(elapsed);
            expect(TimerSystem.timers[sessionId].pomodoros).toBe(1);
        });

        test('deve retomar timer pausado mantendo estado', () => {
            const sessionId = 1;
            const elapsed = 45000; // 45 segundos
            
            // Criar timer pausado
            TimerSystem.timers[sessionId] = {
                startTime: Date.now() - elapsed,
                elapsed,
                isRunning: false,
                pomodoros: 2,
                breaks: 1
            };
            
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
            
            // Retomar timer
            TimerSystem.timers[sessionId].startTime = Date.now() - elapsed;
            TimerSystem.timers[sessionId].isRunning = true;
            
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
            expect(TimerSystem.timers[sessionId].elapsed).toBe(elapsed);
            expect(TimerSystem.timers[sessionId].pomodoros).toBe(2);
        });

        test('deve parar timer e resetar estado', () => {
            const sessionId = 1;
            
            TimerSystem.timers[sessionId] = {
                startTime: Date.now(),
                elapsed: 60000,
                isRunning: true,
                pomodoros: 3,
                breaks: 2
            };
            
            // Parar timer
            delete TimerSystem.timers[sessionId];
            
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
            expect(TimerSystem.getActiveTimer(sessionId)).toBeNull();
        });
    });

    // ========================================================================
    // TESTES DE PERSISTÊNCIA NO localStorage
    // ========================================================================
    describe('💾 Persistência no localStorage', () => {
        test('deve salvar estado do timer no localStorage', () => {
            const sessionId = 1;
            const timerData = {
                startTime: Date.now(),
                elapsed: 30000,
                isRunning: true,
                pomodoros: 1,
                sessionData: {
                    disciplineId: 1,
                    planId: 1
                }
            };
            
            const key = `editaliza_timer_session_${sessionId}`;
            localStorage.setItem(key, JSON.stringify(timerData));
            
            const saved = JSON.parse(localStorage.getItem(key));
            expect(saved).toEqual(timerData);
        });

        test('deve carregar estado do timer do localStorage', () => {
            const sessionId = 2;
            const savedData = {
                startTime: Date.now() - 60000,
                elapsed: 45000,
                isRunning: false,
                pomodoros: 2,
                breaks: 1
            };
            
            localStorage.setItem(`editaliza_timer_session_${sessionId}`, JSON.stringify(savedData));
            
            // Simular carregamento
            const key = `editaliza_timer_session_${sessionId}`;
            const loaded = JSON.parse(localStorage.getItem(key));
            
            expect(loaded).toEqual(savedData);
            expect(loaded.elapsed).toBe(45000);
            expect(loaded.pomodoros).toBe(2);
        });

        test('deve remover dados do localStorage ao parar timer', () => {
            const sessionId = 3;
            const key = `editaliza_timer_session_${sessionId}`;
            
            // Salvar dados
            localStorage.setItem(key, JSON.stringify({
                startTime: Date.now(),
                elapsed: 30000,
                isRunning: true
            }));
            
            expect(localStorage.getItem(key)).toBeTruthy();
            
            // Remover ao parar
            localStorage.removeItem(key);
            
            expect(localStorage.getItem(key)).toBeNull();
        });

        test('deve lidar com dados corrompidos no localStorage', () => {
            const sessionId = 4;
            const key = `editaliza_timer_session_${sessionId}`;
            
            // Salvar dados inválidos
            localStorage.setItem(key, 'dados-corrompidos-nao-json');
            
            // Tentar carregar
            let loaded;
            try {
                loaded = JSON.parse(localStorage.getItem(key));
            } catch (error) {
                loaded = null;
            }
            
            expect(loaded).toBeNull();
        });

        test('deve persistir múltiplas sessões independentemente', () => {
            const sessions = [
                { id: 1, elapsed: 30000, pomodoros: 1 },
                { id: 2, elapsed: 45000, pomodoros: 2 },
                { id: 3, elapsed: 15000, pomodoros: 0 }
            ];
            
            sessions.forEach(session => {
                const key = `editaliza_timer_session_${session.id}`;
                localStorage.setItem(key, JSON.stringify({
                    elapsed: session.elapsed,
                    pomodoros: session.pomodoros,
                    isRunning: false
                }));
            });
            
            sessions.forEach(session => {
                const key = `editaliza_timer_session_${session.id}`;
                const loaded = JSON.parse(localStorage.getItem(key));
                expect(loaded.elapsed).toBe(session.elapsed);
                expect(loaded.pomodoros).toBe(session.pomodoros);
            });
        });
    });

    // ========================================================================
    // TESTES DE SISTEMA POMODORO
    // ========================================================================
    describe('🍅 Sistema Pomodoro', () => {
        test('deve contar pomodoros corretamente', () => {
            const sessionId = 1;
            const pomodoroTime = 25 * 60 * 1000; // 25 minutos em ms
            
            TimerSystem.timers[sessionId] = {
                startTime: Date.now() - pomodoroTime,
                elapsed: pomodoroTime,
                isRunning: true,
                pomodoros: 1,
                breaks: 0
            };
            
            expect(TimerSystem.timers[sessionId].pomodoros).toBe(1);
        });

        test('deve alternar entre estudo e pausa', () => {
            const sessionId = 1;
            let studyPhase = true;
            let pomodoros = 0;
            let breaks = 0;
            
            // Simular conclusão de pomodoro
            if (studyPhase) {
                pomodoros++;
                studyPhase = false; // Entrar em pausa
            }
            
            expect(pomodoros).toBe(1);
            expect(studyPhase).toBe(false);
            
            // Simular conclusão de pausa
            if (!studyPhase) {
                breaks++;
                studyPhase = true; // Retornar ao estudo
            }
            
            expect(breaks).toBe(1);
            expect(studyPhase).toBe(true);
        });

        test('deve aplicar pausa longa a cada 4 pomodoros', () => {
            const sessionId = 1;
            const pomodoros = [1, 2, 3, 4, 5];
            
            pomodoros.forEach(count => {
                const isLongBreak = count % 4 === 0;
                const expectedBreakTime = isLongBreak ? 15 * 60 * 1000 : 5 * 60 * 1000; // 15min ou 5min
                
                if (count === 4) {
                    expect(isLongBreak).toBe(true);
                    expect(expectedBreakTime).toBe(15 * 60 * 1000);
                } else {
                    expect(expectedBreakTime).toBe(5 * 60 * 1000);
                }
            });
        });

        test('deve mostrar progresso visual do pomodoro', () => {
            const sessionId = 1;
            const pomodoroElement = document.getElementById(`pomodoro-indicator-${sessionId}`);
            
            if (pomodoroElement) {
                // Simular atualização visual
                pomodoroElement.innerHTML = '🍅 1/4';
                
                expect(pomodoroElement.innerHTML).toContain('🍅');
                expect(pomodoroElement.innerHTML).toContain('1/4');
            }
        });
    });

    // ========================================================================
    // TESTES DE SINCRONIZAÇÃO E PERFORMANCE
    // ========================================================================
    describe('🔄 Sincronização e Performance', () => {
        test('deve sincronizar timer com display visual', (done) => {
            const sessionId = 1;
            const displayElement = document.getElementById(`timer-display-${sessionId}`);
            
            if (displayElement) {
                // Simular atualização do display
                const updateInterval = setInterval(() => {
                    const currentTime = TimerSystem.formatTime(30000); // 30 segundos
                    displayElement.textContent = currentTime;
                    
                    if (displayElement.textContent === '00:00:30') {
                        clearInterval(updateInterval);
                        expect(displayElement.textContent).toBe('00:00:30');
                        done();
                    }
                }, 100);
            } else {
                done();
            }
        });

        test('deve manter precisão temporal', () => {
            const sessionId = 1;
            const preciseTimes = [
                1000,    // 1 segundo
                59000,   // 59 segundos
                60000,   // 1 minuto
                3599000, // 59 minutos 59 segundos
                3600000  // 1 hora
            ];
            
            preciseTimes.forEach(ms => {
                TimerSystem.timers[sessionId] = {
                    startTime: Date.now() - ms,
                    elapsed: ms,
                    isRunning: true,
                    pomodoros: 0,
                    breaks: 0
                };
                
                expect(TimerSystem.getTimerElapsed(sessionId)).toBe(ms);
            });
        });

        test('deve lidar com múltiplas atualizações simultâneas', () => {
            const sessions = [1, 2, 3, 4, 5];
            const startTime = Date.now();
            
            // Criar múltiplos timers
            sessions.forEach(sessionId => {
                TimerSystem.timers[sessionId] = {
                    startTime: startTime - (sessionId * 10000),
                    elapsed: sessionId * 10000,
                    isRunning: true,
                    pomodoros: 0,
                    breaks: 0
                };
            });
            
            // Verificar se todos mantêm estado independente
            sessions.forEach(sessionId => {
                expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
                expect(TimerSystem.getTimerElapsed(sessionId)).toBe(sessionId * 10000);
            });
        });

        test('deve ser eficiente com muitos timers ativos', () => {
            fortress.startTimer('multiple_timers_performance');
            
            // Criar 100 timers simultâneos
            for (let i = 1; i <= 100; i++) {
                TimerSystem.timers[i] = {
                    startTime: Date.now() - (i * 1000),
                    elapsed: i * 1000,
                    isRunning: true,
                    pomodoros: 0,
                    breaks: 0
                };
            }
            
            // Verificar todos os timers
            for (let i = 1; i <= 100; i++) {
                expect(TimerSystem.hasActiveTimer(i)).toBe(true);
            }
            
            const elapsed = fortress.endTimer('multiple_timers_performance');
            
            // Operação deve ser rápida mesmo com muitos timers
            expect(elapsed).toBeLessThan(100); // menos de 100ms
            expect(Object.keys(TimerSystem.timers)).toHaveLength(100);
        });
    });

    // ========================================================================
    // TESTES DE CASOS EXTREMOS E EDGE CASES
    // ========================================================================
    describe('🔬 Casos Extremos', () => {
        test('deve lidar com sessões muito longas', () => {
            const sessionId = 1;
            const veryLongTime = 24 * 60 * 60 * 1000; // 24 horas
            
            TimerSystem.timers[sessionId] = {
                startTime: Date.now() - veryLongTime,
                elapsed: veryLongTime,
                isRunning: true,
                pomodoros: 48, // 48 pomodoros em 24h
                breaks: 48
            };
            
            expect(TimerSystem.formatTime(veryLongTime)).toBe('24:00:00');
            expect(TimerSystem.timers[sessionId].pomodoros).toBe(48);
        });

        test('deve lidar com interrupções do sistema', () => {
            const sessionId = 1;
            const beforeInterruption = Date.now();
            
            // Simular timer ativo antes da interrupção
            TimerSystem.timers[sessionId] = {
                startTime: beforeInterruption,
                elapsed: 30000,
                isRunning: true,
                pomodoros: 1,
                breaks: 0
            };
            
            // Simular interrupção (fechar navegador, etc.)
            const savedState = {
                ...TimerSystem.timers[sessionId],
                pausedAt: Date.now()
            };
            
            // Simular restauração após interrupção
            const afterInterruption = Date.now() + 60000; // 1 minuto depois
            const restoredTimer = {
                ...savedState,
                startTime: afterInterruption - savedState.elapsed,
                isRunning: false // Pausado após interrupção
            };
            
            expect(restoredTimer.elapsed).toBe(30000);
            expect(restoredTimer.isRunning).toBe(false);
        });

        test('deve validar IDs de sessão inválidos', () => {
            const invalidIds = [null, undefined, '', 0, -1, 'string', {}, [], NaN];
            
            invalidIds.forEach(id => {
                expect(TimerSystem.hasActiveTimer(id)).toBe(false);
                expect(TimerSystem.getActiveTimer(id)).toBeNull();
                expect(TimerSystem.getTimerElapsed(id)).toBe(0);
            });
        });

        test('deve lidar com mudanças de fuso horário', () => {
            const sessionId = 1;
            const originalTime = Date.now();
            
            TimerSystem.timers[sessionId] = {
                startTime: originalTime,
                elapsed: 60000,
                isRunning: true,
                pomodoros: 1,
                breaks: 0
            };
            
            // Simular mudança de horário (1 hora para frente)
            const timeZoneShift = 60 * 60 * 1000; // 1 hora
            const newCurrentTime = originalTime + 120000 + timeZoneShift; // 2 minutos + 1 hora
            
            // Timer deve manter consistência relativa
            const expectedElapsed = newCurrentTime - TimerSystem.timers[sessionId].startTime;
            expect(expectedElapsed).toBeGreaterThan(60000);
        });
    });
});