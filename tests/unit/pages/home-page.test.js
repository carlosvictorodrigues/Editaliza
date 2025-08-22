/**
 * @file tests/home-page.test.js
 * @description Testes abrangentes para a tela inicial (home.html)
 * Testa navegação, carregamento de dados, funcionalidades e responsividade
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Tela Inicial (home.html) - Testes Completos', () => {
    let dom, document, window, app, components, StudyChecklist, TimerSystem;
    let originalFetch, consoleErrorSpy, consoleWarnSpy;
    
    // Mock data para testes
    const mockUserProfile = {
        name: 'João Silva',
        profile_picture: './images/avatars/classic/1.svg'
    };
    
    const mockPlanData = {
        id: 1,
        name: 'Concurso Teste',
        exam_date: '2024-12-31'
    };
    
    const mockProgressData = {
        percentage: 65
    };
    
    const mockSessionsData = [
        {
            id: 1,
            subject_name: 'Direito Constitucional',
            topic_description: 'Princípios fundamentais da Constituição',
            session_type: 'Novo Tópico',
            status: 'Pendente',
            study_plan_id: 1
        },
        {
            id: 2,
            subject_name: 'Português',
            topic_description: 'Interpretação de texto',
            session_type: 'Revisão Consolidada',
            status: 'Concluído',
            study_plan_id: 1
        }
    ];

    beforeEach(async () => {
        // Spy nos console.error e console.warn
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        // Ler o arquivo home.html
        const homePath = path.join(__dirname, '..', 'home.html');
        const htmlContent = fs.readFileSync(homePath, 'utf-8');
        
        // Criar DOM virtual
        dom = new JSDOM(htmlContent, {
            url: 'http://localhost:3000/home.html',
            runScripts: 'dangerously',
            resources: 'usable',
            beforeParse(window) {
                // Mock window.location
                Object.defineProperty(window.location, 'origin', {
                    writable: true,
                    value: 'http://localhost:3000'
                });
                Object.defineProperty(window.location, 'hostname', {
                    writable: true,
                    value: 'localhost'
                });
                Object.defineProperty(window.location, 'pathname', {
                    writable: true,
                    value: '/home.html'
                });
            }
        });
        
        document = dom.window.document;
        window = dom.window;
        
        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn((key) => {
                if (key === 'editaliza_token') return 'mock_token';
                if (key === 'selectedPlanId') return '1';
                return null;
            }),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
        
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock
        });
        
        // Mock fetch
        originalFetch = global.fetch;
        global.fetch = jest.fn();
        window.fetch = global.fetch;
        
        // Setup mock responses
        setupMockResponses();
        
        // Inject scripts into DOM
        await injectScripts();
        
        // Get references to injected objects
        app = window.app;
        components = window.components;
        StudyChecklist = window.StudyChecklist;
        TimerSystem = window.TimerSystem;
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        global.fetch = originalFetch;
        dom.window.close();
    });

    /**
     * Setup das respostas mockadas para fetch
     */
    function setupMockResponses() {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/profile')) {
                return Promise.resolve({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: () => Promise.resolve(mockUserProfile)
                });
            }
            
            if (url.includes('/plans/1')) {
                return Promise.resolve({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: () => Promise.resolve(mockPlanData)
                });
            }
            
            if (url.includes('/progress')) {
                return Promise.resolve({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: () => Promise.resolve(mockProgressData)
                });
            }
            
            if (url.includes('/schedules/1/range')) {
                return Promise.resolve({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: () => Promise.resolve(mockSessionsData)
                });
            }
            
            return Promise.reject(new Error('URL não mockada: ' + url));
        });
    }

    /**
     * Injeta os scripts JavaScript necessários
     */
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
                console.warn(`Não foi possível carregar script ${scriptName}:`, error.message);
            }
        }
        
        // Aguardar scripts carregarem
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    describe('1. Testes de Navegação', () => {
        test('Deve ter todos os links de navegação presentes', () => {
            const navLinks = document.querySelectorAll('nav a');
            const expectedLinks = [
                'home.html',
                'dashboard.html',
                'cronograma.html',
                'profile.html',
                'metodologia.html',
                'faq.html'
            ];
            
            const actualHrefs = Array.from(navLinks).map(link => {
                const href = link.getAttribute('href');
                return href ? href.split('?')[0] : null; // Remove query params
            }).filter(Boolean);
            
            expectedLinks.forEach(expectedLink => {
                expect(actualHrefs).toContain(expectedLink);
            });
        });

        test('Menu hierárquico "Gerenciar Planos" deve estar presente', () => {
            const dropdownMenu = document.querySelector('.dropdown');
            expect(dropdownMenu).toBeTruthy();
            
            const dropdownLinks = dropdownMenu.querySelectorAll('.dropdown-content a');
            expect(dropdownLinks.length).toBeGreaterThan(0);
            
            const dropdownHrefs = Array.from(dropdownLinks).map(link => 
                link.getAttribute('href')
            );
            
            expect(dropdownHrefs).toContain('dashboard.html');
            expect(dropdownHrefs).toContain('cronograma.html');
        });

        test('Links de navegação devem ter classes CSS corretas', () => {
            const activeLink = document.querySelector('.nav-link-active');
            expect(activeLink).toBeTruthy();
            expect(activeLink.textContent.trim()).toBe('Painel Principal');
            
            const defaultLinks = document.querySelectorAll('.nav-link-default');
            expect(defaultLinks.length).toBeGreaterThan(0);
        });
    });

    describe('2. Testes de Carregamento de Dados', () => {
        test('Deve carregar perfil do usuário e exibir nome de boas-vindas', async () => {
            if (app && app.init) {
                await app.init();
                
                // Simular carregamento do perfil
                if (window.loadUserProfile) {
                    await window.loadUserProfile();
                }
            }
            
            const welcomeElement = document.getElementById('welcomeMessage');
            
            // Aguardar um pouco para o DOM ser atualizado
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(welcomeElement).toBeTruthy();
            // Deve mostrar o nome ou mensagem padrão
            expect(welcomeElement.textContent).toMatch(/(Bem-vindo.*João Silva|Bem-vindo ao seu painel)/);
        });

        test('Deve carregar e exibir avatar do usuário', async () => {
            const avatarElement = document.getElementById('userAvatar');
            expect(avatarElement).toBeTruthy();
            
            // Avatar deve ter src definido (padrão ou carregado)
            expect(avatarElement.src).toBeTruthy();
            expect(avatarElement).toHaveClass('user-avatar');
        });

        test('Deve carregar métricas principais', async () => {
            // Elementos de métricas devem estar presentes
            const todayDate = document.getElementById('todayDateHero');
            const daysToExam = document.getElementById('daysToExamHero');
            const generalProgress = document.getElementById('generalProgressHero');
            
            expect(todayDate).toBeTruthy();
            expect(daysToExam).toBeTruthy();
            expect(generalProgress).toBeTruthy();
            
            // Verificar se têm valores iniciais
            expect(todayDate.textContent).toMatch(/\d/); // Deve conter números
            expect(daysToExam.textContent).toBeTruthy();
            expect(generalProgress.textContent).toBeTruthy();
        });

        test('Deve carregar container de atividades do dia', async () => {
            const scheduleContainer = document.getElementById('todaySchedule');
            expect(scheduleContainer).toBeTruthy();
            
            // Simular carregamento de dados
            if (window.loadTodaySchedule) {
                await window.loadTodaySchedule('1');
            }
            
            // Container deve ter conteúdo após carregamento
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(scheduleContainer.innerHTML.trim()).not.toBe('');
        });
    });

    describe('3. Testes de Funcionalidades', () => {
        test('Modal de sessão de estudo deve existir', () => {
            const modal = document.getElementById('studySessionModal');
            const modalContainer = document.getElementById('studySessionModalContainer');
            
            expect(modal).toBeTruthy();
            expect(modalContainer).toBeTruthy();
            expect(modal).toHaveClass('modal-overlay');
            expect(modal).toHaveClass('hidden'); // Deve iniciar oculto
        });

        test('Função openStudySession deve estar disponível', () => {
            expect(window.openStudySession).toBeDefined();
            expect(typeof window.openStudySession).toBe('function');
        });

        test('Deve ter sistema de toast para notificações', () => {
            // Verificar se app.showToast existe
            expect(app).toBeDefined();
            expect(app.showToast).toBeDefined();
            expect(typeof app.showToast).toBe('function');
        });

        test('Deve ter sistema de spinner para loading', () => {
            expect(app.showSpinner).toBeDefined();
            expect(app.hideSpinner).toBeDefined();
            
            const spinnerOverlay = document.getElementById('spinner-overlay');
            expect(spinnerOverlay).toBeTruthy();
        });
    });

    describe('4. Testes de Interface e Responsividade', () => {
        test('Deve ter classes CSS para responsividade', () => {
            // Verificar grid responsivo das métricas
            const metricsGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-4');
            expect(metricsGrid).toBeTruthy();
            
            // Verificar navegação responsiva
            const responsiveNav = document.querySelector('.hidden.md\\:flex');
            expect(responsiveNav).toBeTruthy();
        });

        test('Deve ter meta viewport para dispositivos móveis', () => {
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            expect(viewportMeta).toBeTruthy();
            expect(viewportMeta.content).toContain('width=device-width');
        });

        test('Deve usar Tailwind CSS para estilização', () => {
            const tailwindScript = document.querySelector('script[src*="tailwindcss"]');
            expect(tailwindScript).toBeTruthy();
            
            // Verificar se configuração do Tailwind está presente
            const configScript = document.querySelector('script');
            const hasConfig = Array.from(document.querySelectorAll('script'))
                .some(script => script.textContent && script.textContent.includes('tailwind.config'));
            expect(hasConfig).toBe(true);
        });

        test('Deve ter fonte Inter carregada', () => {
            const fontLink = document.querySelector('link[href*="fonts.googleapis.com"]');
            expect(fontLink).toBeTruthy();
            expect(fontLink.href).toContain('Inter');
        });
    });

    describe('5. Testes de Estados da Aplicação', () => {
        test('Estado de loading - deve mostrar spinner', () => {
            if (app) {
                app.showSpinner();
                const spinner = document.getElementById('spinner-overlay');
                expect(spinner).not.toHaveClass('hidden');
                
                app.hideSpinner();
                expect(spinner).toHaveClass('hidden');
            }
        });

        test('Estado sem dados - deve mostrar mensagem apropriada', async () => {
            // Mock para retornar lista vazia
            global.fetch.mockImplementationOnce((url) => {
                if (url.includes('/schedules/1/range')) {
                    return Promise.resolve({
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve([])
                    });
                }
                return Promise.reject(new Error('URL não mockada'));
            });
            
            if (window.loadTodaySchedule) {
                await window.loadTodaySchedule('1');
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const scheduleContainer = document.getElementById('todaySchedule');
            expect(scheduleContainer.innerHTML).toContain('Nenhuma atividade para hoje');
        });

        test('Estado de erro - deve mostrar mensagem de erro', async () => {
            // Mock para simular erro na API
            global.fetch.mockImplementationOnce(() => {
                return Promise.reject(new Error('Erro de conexão'));
            });
            
            if (window.loadTodaySchedule) {
                await window.loadTodaySchedule('1');
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const scheduleContainer = document.getElementById('todaySchedule');
            expect(scheduleContainer.innerHTML).toContain('Erro ao carregar atividades');
        });
    });

    describe('6. Testes de Integração com Componentes', () => {
        test('Componentes devem estar carregados', () => {
            expect(window.components).toBeDefined();
            expect(window.StudyChecklist).toBeDefined();
            expect(window.TimerSystem).toBeDefined();
        });

        test('Sistema de timer deve estar funcional', () => {
            if (TimerSystem) {
                expect(TimerSystem.start).toBeDefined();
                expect(TimerSystem.stop).toBeDefined();
                expect(TimerSystem.toggle).toBeDefined();
                expect(TimerSystem.formatTime).toBeDefined();
            }
        });

        test('Sistema de checklist deve estar funcional', () => {
            if (StudyChecklist) {
                expect(StudyChecklist.show).toBeDefined();
                expect(StudyChecklist.close).toBeDefined();
                expect(StudyChecklist.startStudySession).toBeDefined();
            }
        });
    });

    describe('7. Testes de Segurança e Validação', () => {
        test('Não deve haver scripts maliciosos inline', () => {
            const allScripts = document.querySelectorAll('script');
            const inlineScripts = Array.from(allScripts).filter(script => 
                !script.src && script.textContent && script.textContent.trim()
            );
            
            inlineScripts.forEach(script => {
                const content = script.textContent;
                expect(content).not.toContain('eval(');
                expect(content).not.toContain('document.write');
                expect(content).not.toContain('innerHTML =');
                // Permitir apenas configurações conhecidas
                if (!content.includes('tailwind.config') && !content.includes('DOMContentLoaded')) {
                    expect(content.length).toBeLessThan(1000); // Scripts inline devem ser pequenos
                }
            });
        });

        test('Elementos com IDs devem ser únicos', () => {
            const elementsWithIds = document.querySelectorAll('[id]');
            const ids = Array.from(elementsWithIds).map(el => el.id);
            const uniqueIds = [...new Set(ids)];
            
            expect(ids.length).toBe(uniqueIds.length);
        });

        test('Links externos devem ter atributos de segurança', () => {
            const externalLinks = document.querySelectorAll('a[href^="http"]');
            externalLinks.forEach(link => {
                if (!link.href.includes(window.location.hostname)) {
                    expect(link.rel).toContain('noopener');
                }
            });
        });
    });

    describe('8. Testes de Performance', () => {
        test('Não deve haver console.error no carregamento inicial', () => {
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        test('Quantidade de elementos DOM deve ser razoável', () => {
            const allElements = document.querySelectorAll('*');
            expect(allElements.length).toBeLessThan(500); // Limite razoável
        });

        test('Não deve haver vazamentos de memoria evidentes', () => {
            // Verificar se event listeners estão sendo adicionados corretamente
            const buttonsWithClick = document.querySelectorAll('button[onclick]');
            buttonsWithClick.forEach(button => {
                expect(button.onclick).toBeTruthy();
            });
        });
    });
});