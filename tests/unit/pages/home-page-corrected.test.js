/**
 * @file tests/home-page-corrected.test.js
 * @description Testes corrigidos para a tela inicial (home.html)
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Tela Inicial - Testes Funcionais', () => {
    let dom, document, window;
    let originalFetch;
    
    beforeEach(async () => {
        // Silenciar console durante testes
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        
        // Ler arquivo HTML
        const homePath = path.join(__dirname, '..', 'home.html');
        const htmlContent = fs.readFileSync(homePath, 'utf-8');
        
        // Criar DOM simples
        dom = new JSDOM(htmlContent, {
            url: 'http://localhost:3000/home.html'
        });
        
        document = dom.window.document;
        window = dom.window;
        
        // Mock window.location apenas se necessário
        if (!window.location.origin) {
            window.location = {
                ...window.location,
                origin: 'http://localhost:3000',
                hostname: 'localhost',
                pathname: '/home.html'
            };
        }
        
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
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.fetch = originalFetch;
        if (dom) {
            dom.window.close();
        }
    });

    describe('Estrutura HTML Básica', () => {
        test('Deve ter título correto', () => {
            const title = document.querySelector('title');
            expect(title).toBeTruthy();
            expect(title.textContent).toContain('Painel Principal - Editaliza');
        });

        test('Deve incluir Tailwind CSS', () => {
            const tailwindScript = document.querySelector('script[src*="tailwindcss"]');
            expect(tailwindScript).toBeTruthy();
        });

        test('Deve ter meta viewport', () => {
            const viewport = document.querySelector('meta[name="viewport"]');
            expect(viewport).toBeTruthy();
            expect(viewport.content).toContain('width=device-width');
        });

        test('Deve carregar fonte Inter', () => {
            const fontLink = document.querySelector('link[href*="fonts.googleapis.com"]');
            expect(fontLink).toBeTruthy();
            expect(fontLink.href).toContain('Inter');
        });
    });

    describe('Elementos de Navegação', () => {
        test('Deve ter logo/marca Editaliza', () => {
            const logoElements = document.querySelectorAll('h1, .text-brand, [class*="editaliza"]');
            const hasEditaliza = Array.from(logoElements).some(el => 
                el.textContent && el.textContent.includes('Editaliza')
            );
            expect(hasEditaliza).toBe(true);
        });

        test('Deve ter navegação principal', () => {
            const nav = document.querySelector('nav') || document.querySelector('.nav') || document.querySelector('[role="navigation"]');
            expect(nav).toBeTruthy();
        });

        test('Deve ter links de navegação básicos', () => {
            const links = document.querySelectorAll('a[href]');
            const hrefs = Array.from(links).map(link => link.getAttribute('href')).filter(Boolean);
            
            const expectedLinks = ['home.html', 'profile.html', 'dashboard.html'];
            const foundLinks = expectedLinks.filter(expected => 
                hrefs.some(href => href.includes(expected))
            );
            
            expect(foundLinks.length).toBeGreaterThan(0);
        });

        test('Deve ter menu dropdown "Gerenciar Planos"', () => {
            const dropdown = document.querySelector('.dropdown, [class*="dropdown"]');
            expect(dropdown).toBeTruthy();
        });

        test('Deve ter elemento para avatar do usuário', () => {
            const avatar = document.getElementById('userAvatar') || 
                          document.querySelector('.user-avatar') ||
                          document.querySelector('[class*="avatar"]');
            expect(avatar).toBeTruthy();
        });
    });

    describe('Seção Principal de Conteúdo', () => {
        test('Deve ter container principal', () => {
            const main = document.querySelector('main') || 
                         document.querySelector('.container') ||
                         document.querySelector('[class*="container"]');
            expect(main).toBeTruthy();
        });

        test('Deve ter seção de boas-vindas', () => {
            const welcome = document.getElementById('welcomeMessage') ||
                           document.querySelector('[class*="welcome"]') ||
                           document.querySelector('h1, h2, h3');
            expect(welcome).toBeTruthy();
        });

        test('Deve ter métricas principais', () => {
            const todayDate = document.getElementById('todayDateHero');
            const daysToExam = document.getElementById('daysToExamHero');
            const generalProgress = document.getElementById('generalProgressHero');
            
            expect(todayDate).toBeTruthy();
            expect(daysToExam).toBeTruthy();
            expect(generalProgress).toBeTruthy();
        });

        test('Deve ter container para cronograma do dia', () => {
            const schedule = document.getElementById('todaySchedule');
            expect(schedule).toBeTruthy();
        });

        test('Deve ter grid responsivo para métricas', () => {
            const grids = document.querySelectorAll('[class*="grid"]');
            expect(grids.length).toBeGreaterThan(0);
            
            const responsiveGrid = Array.from(grids).some(grid => 
                grid.className.includes('grid-cols') && grid.className.includes('md:')
            );
            expect(responsiveGrid).toBe(true);
        });
    });

    describe('Modal de Sessão de Estudo', () => {
        test('Deve ter modal overlay', () => {
            const modal = document.getElementById('studySessionModal');
            expect(modal).toBeTruthy();
            expect(modal.classList.contains('modal-overlay')).toBe(true);
        });

        test('Modal deve começar oculto', () => {
            const modal = document.getElementById('studySessionModal');
            expect(modal.classList.contains('hidden')).toBe(true);
        });

        test('Deve ter container do modal', () => {
            const container = document.getElementById('studySessionModalContainer');
            expect(container).toBeTruthy();
        });
    });

    describe('Scripts e Funcionalidades', () => {
        test('Deve incluir scripts principais', () => {
            const scripts = document.querySelectorAll('script[src]');
            const scriptSources = Array.from(scripts).map(script => script.src);
            
            const expectedScripts = ['app.js', 'components.js', 'checklist.js', 'timer.js'];
            const foundScripts = expectedScripts.filter(expected =>
                scriptSources.some(src => src.includes(expected))
            );
            
            expect(foundScripts.length).toBe(expectedScripts.length);
        });

        test('Deve ter configuração do Tailwind', () => {
            const allScripts = document.querySelectorAll('script');
            const hasConfig = Array.from(allScripts).some(script => 
                script.textContent && script.textContent.includes('tailwind.config')
            );
            expect(hasConfig).toBe(true);
        });

        test('Deve ter script de inicialização', () => {
            const allScripts = document.querySelectorAll('script');
            const hasInit = Array.from(allScripts).some(script => 
                script.textContent && (
                    script.textContent.includes('DOMContentLoaded') ||
                    script.textContent.includes('loadUserProfile') ||
                    script.textContent.includes('loadMetrics')
                )
            );
            expect(hasInit).toBe(true);
        });
    });

    describe('Estilos e Design', () => {
        test('Deve ter cores da marca definidas', () => {
            const allScripts = document.querySelectorAll('script');
            const hasColors = Array.from(allScripts).some(script => 
                script.textContent && (
                    script.textContent.includes('editaliza-blue') ||
                    script.textContent.includes('editaliza-green')
                )
            );
            expect(hasColors).toBe(true);
        });

        test('Deve ter estilos CSS customizados', () => {
            const styles = document.querySelectorAll('style');
            expect(styles.length).toBeGreaterThan(0);
            
            const hasCustomStyles = Array.from(styles).some(style =>
                style.textContent.includes('.modal-overlay') ||
                style.textContent.includes('.user-avatar') ||
                style.textContent.includes('.metric-card')
            );
            expect(hasCustomStyles).toBe(true);
        });

        test('Deve ter classes para cards de métrica', () => {
            const metricsCards = document.querySelectorAll('[class*="metric-card"]');
            expect(metricsCards.length).toBeGreaterThan(0);
        });
    });

    describe('Elementos de Interface', () => {
        test('Deve ter sistema de toast container', () => {
            // O container pode ser criado dinamicamente, então verificamos na estrutura de styles
            const styles = document.querySelectorAll('style, script');
            const hasToast = Array.from(styles).some(el =>
                el.textContent && el.textContent.includes('toast-container')
            );
            expect(hasToast).toBe(true);
        });

        test('Deve ter sistema de spinner', () => {
            const styles = document.querySelectorAll('style, script');
            const hasSpinner = Array.from(styles).some(el =>
                el.textContent && el.textContent.includes('spinner-overlay')
            );
            expect(hasSpinner).toBe(true);
        });

        test('Deve ter seletor de plano', () => {
            const planSelector = document.getElementById('planSelector');
            expect(planSelector).toBeTruthy();
            expect(planSelector.tagName.toLowerCase()).toBe('select');
        });
    });

    describe('Validação de Segurança', () => {
        test('Não deve ter scripts inline maliciosos', () => {
            const inlineScripts = document.querySelectorAll('script:not([src])');
            
            Array.from(inlineScripts).forEach(script => {
                const content = script.textContent || script.innerHTML;
                
                // Verificações de segurança básicas
                expect(content).not.toContain('eval(');
                expect(content).not.toContain('document.write');
                expect(content).not.toContain('javascript:');
                
                // Se contém innerHTML, deve ser controlado (não user input)
                if (content.includes('innerHTML')) {
                    expect(content).toMatch(/innerHTML\s*=\s*(`|'|")[\s\S]*?\1/);
                }
            });
        });

        test('IDs devem ser únicos', () => {
            const elementsWithIds = document.querySelectorAll('[id]');
            const ids = Array.from(elementsWithIds).map(el => el.id);
            const uniqueIds = [...new Set(ids)];
            
            expect(ids.length).toBe(uniqueIds.length);
        });

        test('Não deve ter elementos com onclick inseguro', () => {
            const clickableElements = document.querySelectorAll('[onclick]');
            
            Array.from(clickableElements).forEach(el => {
                const onclick = el.getAttribute('onclick');
                
                // Verificar que são apenas chamadas de função controladas
                expect(onclick).toMatch(/^[a-zA-Z_$][a-zA-Z0-9_$]*\([^;]*\)$/);
                expect(onclick).not.toContain('eval');
                expect(onclick).not.toContain('javascript:');
            });
        });
    });

    describe('Responsividade', () => {
        test('Deve usar classes responsivas do Tailwind', () => {
            const allElements = document.querySelectorAll('*[class]');
            const responsiveClasses = ['sm:', 'md:', 'lg:', 'xl:'];
            
            let hasResponsive = false;
            Array.from(allElements).forEach(el => {
                const className = el.className;
                if (responsiveClasses.some(prefix => className.includes(prefix))) {
                    hasResponsive = true;
                }
            });
            
            expect(hasResponsive).toBe(true);
        });

        test('Container principal deve ser responsivo', () => {
            const containers = document.querySelectorAll('[class*="container"]');
            expect(containers.length).toBeGreaterThan(0);
            
            const hasResponsiveContainer = Array.from(containers).some(container =>
                container.className.includes('mx-auto') || 
                container.className.includes('px-')
            );
            expect(hasResponsiveContainer).toBe(true);
        });
    });

    describe('Funcionalidades JavaScript Esperadas', () => {
        test('Deve ter função window.openStudySession definida', () => {
            expect(window.openStudySession).toBeDefined();
            expect(typeof window.openStudySession).toBe('function');
        });

        test('Deve ter funções de carregamento de dados', () => {
            const scripts = document.querySelectorAll('script');
            const hasFunctions = Array.from(scripts).some(script =>
                script.textContent && (
                    script.textContent.includes('loadUserProfile') ||
                    script.textContent.includes('loadMetrics') ||
                    script.textContent.includes('loadTodaySchedule')
                )
            );
            expect(hasFunctions).toBe(true);
        });

        test('Deve ter listener DOMContentLoaded', () => {
            const scripts = document.querySelectorAll('script');
            const hasListener = Array.from(scripts).some(script =>
                script.textContent && script.textContent.includes('DOMContentLoaded')
            );
            expect(hasListener).toBe(true);
        });
    });
});