/**
 * @file tests/home-functionality.test.js
 * @description Testes específicos para funcionalidades da tela inicial
 * Foca em timer, checklist e interações do usuário
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Funcionalidades da Tela Inicial - Timer e Checklist', () => {
    let dom, document, window, app, components, StudyChecklist, TimerSystem;
    let mockFetch, consoleLogSpy;

    const mockSession = {
        id: 123,
        subject_name: 'Direito Constitucional',
        topic_description: 'Princípios fundamentais',
        session_type: 'Novo Tópico',
        status: 'Pendente',
        study_plan_id: 1,
        notes: '',
        questions_solved: '0'
    };

    beforeEach(async () => {
        // Setup console spy
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Ler arquivo HTML
        const homePath = path.join(__dirname, '..', 'home.html');
        const htmlContent = fs.readFileSync(homePath, 'utf-8');

        // Criar DOM
        dom = new JSDOM(htmlContent, {
            url: 'http://localhost:3000/home.html',
            runScripts: 'dangerously',
            resources: 'usable',
            beforeParse(window) {
                // Mock básicos
                Object.defineProperty(window.location, 'origin', { value: 'http://localhost:3000' });
                Object.defineProperty(window.location, 'hostname', { value: 'localhost' });
                Object.defineProperty(window.location, 'pathname', { value: '/home.html' });
            }
        });

        document = dom.window.document;
        window = dom.window;

        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn((key) => {
                if (key === 'editaliza_token') return 'mock_token';
                if (key === 'selectedPlanId') return '1';
                if (key === 'editaliza_timers') return JSON.stringify({});
                return null;
            }),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });

        // Mock fetch
        mockFetch = jest.fn().mockImplementation((url) => {
            const responses = {
                '/profile': { name: 'Test User', profile_picture: './test.svg' },
                '/plans/1': { id: 1, name: 'Test Plan', exam_date: '2024-12-31' },
                '/plans/1/progress': { percentage: 50 },
                '/schedules/1/range': [mockSession],
                [`/schedules/sessions/${mockSession.id}`]: mockSession
            };

            const matchedUrl = Object.keys(responses).find(key => url.includes(key));
            if (matchedUrl) {
                return Promise.resolve({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: () => Promise.resolve(responses[matchedUrl])
                });
            }

            return Promise.resolve({
                ok: true,
                headers: { get: () => 'application/json' },
                json: () => Promise.resolve({})
            });
        });
        
        window.fetch = mockFetch;
        global.fetch = mockFetch;

        // Mock timer específicos
        setupTimerMocks();

        // Injetar scripts
        await injectScripts();

        // Obter referencias
        app = window.app;
        components = window.components;
        StudyChecklist = window.StudyChecklist;
        TimerSystem = window.TimerSystem;

        // Simular carregamento de dados da página
        if (window.todaySessionsData) {
            window.todaySessionsData = [mockSession];
        } else {
            window.todaySessionsData = [mockSession];
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (dom) {
            dom.window.close();
        }
    });

    function setupTimerMocks() {
        // Mock Web Audio API
        const mockAudioContext = {
            createOscillator: jest.fn(() => ({
                connect: jest.fn(),
                frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
                type: 'sine',
                start: jest.fn(),
                stop: jest.fn()
            })),
            createGain: jest.fn(() => ({
                connect: jest.fn(),
                gain: { 
                    setValueAtTime: jest.fn(), 
                    exponentialRampToValueAtTime: jest.fn(),
                    linearRampToValueAtTime: jest.fn()
                }
            })),
            destination: {},
            currentTime: 0,
            state: 'running',
            resume: jest.fn(() => Promise.resolve())
        };

        window.AudioContext = jest.fn(() => mockAudioContext);
        window.webkitAudioContext = jest.fn(() => mockAudioContext);

        // Mock Notification API
        window.Notification = {
            permission: 'granted',
            requestPermission: jest.fn(() => Promise.resolve('granted'))
        };

        // Mock navigator.vibrate
        Object.defineProperty(window.navigator, 'vibrate', {
            value: jest.fn(),
            writable: true
        });

        // Mock Date para testes consistentes
        const mockDate = new Date('2024-01-15T10:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        Date.now = jest.fn(() => mockDate.getTime());
    }

    async function injectScripts() {
        const scripts = ['app.js', 'components.js', 'checklist.js', 'timer.js'];
        
        for (const scriptName of scripts) {
            try {
                const scriptPath = path.join(__dirname, '..', 'js', scriptName);
                const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
                
                const scriptElement = document.createElement('script');
                scriptElement.textContent = scriptContent;
                document.head.appendChild(scriptElement);
            } catch (error) {
                console.warn(`Script ${scriptName} não encontrado:`, error.message);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    describe('Sistema de Timer', () => {
        test('TimerSystem deve estar disponível e funcional', () => {
            expect(TimerSystem).toBeDefined();
            expect(TimerSystem.start).toBeDefined();
            expect(TimerSystem.stop).toBeDefined();
            expect(TimerSystem.toggle).toBeDefined();
            expect(TimerSystem.formatTime).toBeDefined();
        });

        test('Deve iniciar timer para uma sessão', () => {
            const sessionId = mockSession.id;
            
            TimerSystem.start(sessionId);
            
            expect(TimerSystem.timers[sessionId]).toBeDefined();
            expect(TimerSystem.timers[sessionId].isRunning).toBe(true);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
        });

        test('Deve parar timer corretamente', () => {
            const sessionId = mockSession.id;
            
            TimerSystem.start(sessionId);
            TimerSystem.stop(sessionId);
            
            expect(TimerSystem.timers[sessionId].isRunning).toBe(false);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
        });

        test('Deve alternar estado do timer (toggle)', () => {
            const sessionId = mockSession.id;
            
            // Primeira chamada deve iniciar
            TimerSystem.toggle(sessionId);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
            
            // Segunda chamada deve parar
            TimerSystem.toggle(sessionId);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
        });

        test('Deve formatar tempo corretamente', () => {
            expect(TimerSystem.formatTime(0)).toBe('00:00:00');
            expect(TimerSystem.formatTime(60000)).toBe('00:01:00'); // 1 minuto
            expect(TimerSystem.formatTime(3600000)).toBe('01:00:00'); // 1 hora
            expect(TimerSystem.formatTime(3661000)).toBe('01:01:01'); // 1h 1min 1s
        });

        test('Deve detectar tempo decorrido corretamente', () => {
            const sessionId = mockSession.id;
            
            TimerSystem.start(sessionId);
            
            // Simular passagem de tempo
            const mockElapsed = 30000; // 30 segundos
            TimerSystem.timers[sessionId].elapsed = mockElapsed;
            
            expect(TimerSystem.getTimerElapsed(sessionId)).toBe(mockElapsed);
        });

        test('Deve persistir timers no localStorage', () => {
            const sessionId = mockSession.id;
            
            TimerSystem.start(sessionId);
            TimerSystem.saveTimersToStorage();
            
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                'editaliza_timers',
                expect.stringContaining(`"${sessionId}"`)
            );
        });
    });

    describe('Sistema de Checklist', () => {
        test('StudyChecklist deve estar disponível', () => {
            expect(StudyChecklist).toBeDefined();
            expect(StudyChecklist.show).toBeDefined();
            expect(StudyChecklist.close).toBeDefined();
            expect(StudyChecklist.startStudySession).toBeDefined();
        });

        test('Deve abrir modal do checklist', () => {
            StudyChecklist.show(mockSession);
            
            const modal = document.getElementById('studySessionModal');
            const modalContainer = document.getElementById('studySessionModalContainer');
            
            expect(modal).not.toHaveClass('hidden');
            expect(modalContainer.innerHTML).toContain('Preparado para Estudar?');
            expect(StudyChecklist.session).toEqual(mockSession);
        });

        test('Deve fechar modal do checklist', () => {
            StudyChecklist.show(mockSession);
            StudyChecklist.close();
            
            // Aguardar animação
            setTimeout(() => {
                const modal = document.getElementById('studySessionModal');
                expect(modal).toHaveClass('hidden');
            }, 350);
        });

        test('Deve renderizar itens do checklist', () => {
            StudyChecklist.show(mockSession);
            
            const checklistItems = document.querySelectorAll('.checklist-item');
            expect(checklistItems.length).toBeGreaterThan(0);
            expect(checklistItems.length).toBe(StudyChecklist.items.length);
        });

        test('Deve habilitar botão apenas quando todos os itens estão checados', () => {
            StudyChecklist.show(mockSession);
            
            const startBtn = document.getElementById('start-study-btn');
            const checklistItems = document.querySelectorAll('.checklist-item');
            
            // Inicialmente desabilitado
            expect(startBtn.disabled).toBe(true);
            
            // Marcar todos os itens
            checklistItems.forEach(item => {
                item.checked = true;
                item.dispatchEvent(new window.Event('change'));
            });
            
            // Agora deve estar habilitado
            expect(startBtn.disabled).toBe(false);
        });

        test('Deve iniciar sessão de estudo após checklist', () => {
            StudyChecklist.show(mockSession);
            StudyChecklist.startStudySession();
            
            const modalContainer = document.getElementById('studySessionModalContainer');
            expect(modalContainer.innerHTML).toContain(mockSession.subject_name);
            expect(modalContainer.innerHTML).toContain('timer-container');
        });
    });

    describe('Integração Timer e Checklist', () => {
        test('Deve iniciar timer ao começar sessão de estudo', () => {
            StudyChecklist.show(mockSession);
            StudyChecklist.startStudySession(true);
            
            const sessionId = mockSession.id;
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
        });

        test('Não deve iniciar timer quando especificado', () => {
            StudyChecklist.show(mockSession);
            StudyChecklist.startStudySession(false);
            
            const sessionId = mockSession.id;
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(false);
        });

        test('Deve atualizar UI do timer no modal', () => {
            const sessionId = mockSession.id;
            StudyChecklist.show(mockSession);
            StudyChecklist.startStudySession(true);
            
            const timerDisplay = document.querySelector(`[data-session="${sessionId}"]`);
            expect(timerDisplay).toBeTruthy();
            
            // Simular atualização do timer
            TimerSystem.timers[sessionId].elapsed = 60000; // 1 minuto
            TimerSystem.updateDisplay(sessionId);
            
            // Timer display deve mostrar o tempo
            expect(timerDisplay.textContent).toContain('01:00');
        });
    });

    describe('Interações do Usuário', () => {
        test('Função openStudySession deve estar disponível globalmente', () => {
            expect(window.openStudySession).toBeDefined();
            expect(typeof window.openStudySession).toBe('function');
        });

        test('openStudySession deve abrir checklist para nova sessão', async () => {
            await window.openStudySession(mockSession.id);
            
            const modal = document.getElementById('studySessionModal');
            expect(modal).not.toHaveClass('hidden');
        });

        test('openStudySession deve continuar timer ativo existente', async () => {
            const sessionId = mockSession.id;
            
            // Criar timer ativo
            TimerSystem.start(sessionId);
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
            
            // Chamar openStudySession
            await window.openStudySession(sessionId);
            
            // Timer deve continuar ativo
            expect(TimerSystem.hasActiveTimer(sessionId)).toBe(true);
        });

        test('Deve mostrar modal de continuação para timer pausado', async () => {
            const sessionId = mockSession.id;
            
            // Criar timer com tempo acumulado mas pausado
            TimerSystem.start(sessionId);
            TimerSystem.timers[sessionId].elapsed = 30000; // 30 segundos
            TimerSystem.stop(sessionId);
            
            // Mock da função de modal de continuação
            window.showContinueStudyModal = jest.fn(() => Promise.resolve(true));
            
            await window.openStudySession(sessionId);
            
            expect(window.showContinueStudyModal).toHaveBeenCalled();
        });
    });

    describe('Renderização de Cards', () => {
        test('components.createSessionCard deve gerar HTML válido', () => {
            const cardHtml = components.createSessionCard(mockSession);
            
            expect(cardHtml).toContain(mockSession.subject_name);
            expect(cardHtml).toContain(mockSession.topic_description);
            expect(cardHtml).toContain(`window.openStudySession(${mockSession.id})`);
            expect(cardHtml).toContain('study-card');
        });

        test('Botão do card deve mostrar estado correto do timer', () => {
            const sessionId = mockSession.id;
            
            // Sem timer - deve mostrar "Iniciar Estudo"
            let buttonInfo = components.generateSmartButton(sessionId, 'Iniciar Estudo');
            expect(buttonInfo.text).toBe('Iniciar Estudo');
            expect(buttonInfo.icon).toBe('🚀');
            
            // Com timer ativo - deve mostrar "Continuar"
            TimerSystem.start(sessionId);
            TimerSystem.timers[sessionId].elapsed = 30000;
            
            buttonInfo = components.generateSmartButton(sessionId, 'Iniciar Estudo');
            expect(buttonInfo.text).toContain('Continuar');
            expect(buttonInfo.icon).toBe('⏱️');
        });

        test('Deve atualizar visuais dos cards quando timer muda', () => {
            const sessionId = mockSession.id;
            
            // Adicionar card ao DOM
            const cardHtml = components.createSessionCard(mockSession);
            document.body.innerHTML = cardHtml;
            
            // Iniciar timer
            TimerSystem.start(sessionId);
            TimerSystem.updateCardVisuals(sessionId);
            
            const button = document.querySelector(`button[onclick="window.openStudySession(${sessionId})"]`);
            expect(button).toBeTruthy();
            expect(button.innerHTML).toContain('Estudando');
        });
    });

    describe('Tratamento de Erros', () => {
        test('Deve lidar com sessão não encontrada', async () => {
            window.todaySessionsData = [];
            
            const showToastSpy = jest.spyOn(app, 'showToast');
            await window.openStudySession(999); // ID inexistente
            
            expect(showToastSpy).toHaveBeenCalledWith(
                expect.stringContaining('não encontrada'),
                'error'
            );
        });

        test('Deve lidar com erro na API', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Erro de rede'));
            
            const consoleErrorSpy = jest.spyOn(console, 'error');
            await window.fetchSessionData(mockSession.id);
            
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        test('Deve continuar funcionando sem Web Audio API', () => {
            // Remover Web Audio API
            delete window.AudioContext;
            delete window.webkitAudioContext;
            
            // Timer deve ainda funcionar
            expect(() => {
                TimerSystem.start(mockSession.id);
                TimerSystem.notifyPomodoroComplete();
            }).not.toThrow();
        });
    });
});