/**
 * @file tests/e2e/home.spec.js
 * @description Testes E2E para a página Home
 */

const { test, expect } = require('@playwright/test');

test.describe('Home Page - Integração completa', () => {
    
    test.beforeEach(async ({ page, context }) => {
        // Mockar localStorage com um planId ativo
        await context.addInitScript(() => {
            window.localStorage.setItem('activePlanId', 'test-plan-123');
            window.localStorage.setItem('authToken', 'mock-token-123');
        });
        
        // Interceptar e mockar as rotas da API ANTES de navegar
        await page.route('**/api/sessions/by-date/**', async route => {
            const today = new Date().toISOString().split('T')[0];
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    [today]: [
                        {
                            id: 1,
                            title: 'Direito Constitucional',
                            topic_name: 'Princípios Fundamentais',
                            scheduled_date: today,
                            time_of_day: 'morning',
                            duration: 60,
                            completed: false,
                            priority: 'high'
                        },
                        {
                            id: 2,
                            title: 'Português',
                            topic_name: 'Interpretação de Texto',
                            scheduled_date: today,
                            time_of_day: 'afternoon',
                            duration: 45,
                            completed: true,
                            priority: 'medium'
                        }
                    ]
                })
            });
        });
        
        await page.route('**/api/sessions/overdue-check/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    count: 2,
                    sessions: [
                        { id: 3, title: 'Matemática', daysOverdue: 1 },
                        { id: 4, title: 'Redação', daysOverdue: 2 }
                    ]
                })
            });
        });
        
        await page.route('**/api/plans/**', async route => {
            if (route.request().url().includes('/plans/') && !route.request().url().includes('/sessions')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'test-plan-123',
                        name: 'TJPE 2025',
                        exam_date: '2025-06-01',
                        reta_final_mode: false
                    })
                });
            } else {
                await route.continue();
            }
        });
        
        await page.route('**/api/user/profile', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 1,
                    name: 'João Silva',
                    email: 'joao@example.com',
                    avatar_url: null
                })
            });
        });
        
        await page.route('**/api/statistics/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    totalHours: 120,
                    averageHoursPerDay: 4.5,
                    completionRate: 0.75,
                    currentStreak: 5
                })
            });
        });
    });
    
    test('deve carregar sem erros no console', async ({ page }) => {
        const consoleErrors = [];
        
        // Capturar erros do console
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Filtrar erros não críticos
                if (!text.includes('favicon') && 
                    !text.includes('manifest') &&
                    !text.includes('service worker') &&
                    !text.includes('Failed to load resource')) {
                    consoleErrors.push(text);
                }
            }
        });
        
        // Capturar erros de página
        page.on('pageerror', error => {
            consoleErrors.push(error.message);
        });
        
        // Navegar para a Home
        const response = await page.goto('/home.html', { waitUntil: 'networkidle' });
        expect(response.status()).toBeLessThan(400);
        
        // Aguardar componentes carregarem
        await page.waitForTimeout(2000);
        
        // Verificar que não há erros críticos
        expect(consoleErrors).toHaveLength(0);
    });
    
    test('deve renderizar cards de sessões de estudo', async ({ page }) => {
        await page.goto('/home.html', { waitUntil: 'networkidle' });
        
        // Aguardar o container de atividades
        const todaySchedule = await page.waitForSelector('[data-testid="todaySchedule"]', {
            timeout: 5000
        });
        expect(todaySchedule).toBeTruthy();
        
        // Verificar que há cards de sessão
        await page.waitForSelector('.session-card, .card, [class*="card"]', {
            timeout: 5000
        });
        
        const sessionCards = await page.$$('.session-card, .card, [class*="card"]');
        expect(sessionCards.length).toBeGreaterThan(0);
    });
    
    test('deve mostrar alerta de tarefas atrasadas quando count > 0', async ({ page }) => {
        await page.goto('/home.html', { waitUntil: 'networkidle' });
        
        // Aguardar o alerta de tarefas atrasadas
        const overdueAlert = await page.waitForSelector('#overdueAlert, #overdue-alert-container > div', {
            timeout: 5000
        });
        expect(overdueAlert).toBeTruthy();
        
        // Verificar que contém o texto esperado
        const alertText = await overdueAlert.textContent();
        expect(alertText).toContain('2'); // 2 tarefas atrasadas
        expect(alertText).toContain('tarefa');
    });
    
    test('deve validar módulos críticos carregados', async ({ page }) => {
        await page.goto('/home.html', { waitUntil: 'networkidle' });
        
        // Aguardar um pouco para garantir que defer carregou
        await page.waitForTimeout(1000);
        
        // Verificar que os módulos críticos estão disponíveis
        const modulesStatus = await page.evaluate(() => {
            return {
                app: typeof window.app !== 'undefined',
                ComponentsCore: typeof window.ComponentsCore !== 'undefined' || typeof window.componentsCore !== 'undefined',
                gamification: typeof window.gamification !== 'undefined' || typeof window.Gamification !== 'undefined',
                components: typeof window.components !== 'undefined'
            };
        });
        
        expect(modulesStatus.app).toBeTruthy();
        expect(modulesStatus.ComponentsCore).toBeTruthy();
        expect(modulesStatus.gamification).toBeTruthy();
        expect(modulesStatus.components).toBeTruthy();
    });
    
    test('deve persistir activePlanId no localStorage', async ({ page, context }) => {
        await page.goto('/home.html', { waitUntil: 'networkidle' });
        
        // Verificar que o planId está no localStorage
        const activePlanId = await page.evaluate(() => {
            return window.localStorage.getItem('activePlanId');
        });
        
        expect(activePlanId).toBe('test-plan-123');
    });
    
    test('deve mostrar CTA quando não há planos', async ({ page, context }) => {
        // Limpar localStorage
        await context.addInitScript(() => {
            window.localStorage.clear();
        });
        
        // Mockar resposta vazia de planos
        await page.route('**/api/plans', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });
        
        await page.goto('/home.html', { waitUntil: 'networkidle' });
        
        // Verificar que mostra CTA para criar plano
        const ctaButton = await page.waitForSelector('a[href*="plan.html?new=true"]', {
            timeout: 5000
        });
        expect(ctaButton).toBeTruthy();
        
        const ctaText = await ctaButton.textContent();
        expect(ctaText).toContain('Criar Plano');
    });
    
    test('não deve ter requests falhando (>= 400)', async ({ page }) => {
        const failedRequests = [];
        
        page.on('response', response => {
            if (response.status() >= 400 && !response.url().includes('favicon')) {
                failedRequests.push({
                    url: response.url(),
                    status: response.status()
                });
            }
        });
        
        await page.goto('/home.html', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        expect(failedRequests).toHaveLength(0);
    });
});

test.describe('Home Page - Smoke Tests', () => {
    test('não deve ter problemas de encoding (sem caracteres corrompidos)', async ({ page }) => {
        await page.goto('/home.html', { waitUntil: 'networkidle' });
        
        // Obter todo o conteúdo do body
        const bodyContent = await page.evaluate(() => document.body.innerText);
        
        // Verificar que não há caracteres de encoding corrompido
        expect(bodyContent).not.toContain('�');
        expect(bodyContent).not.toMatch(/Ã[¡-¿]/); // Padrões comuns de UTF-8 mal interpretado
        expect(bodyContent).not.toContain('â€'); // Outro padrão comum
    });
    
    test('todos os scripts devem usar defer', async ({ page }) => {
        await page.goto('/home.html', { waitUntil: 'networkidle' });
        
        // Verificar que todos os scripts no head usam defer
        const scriptsInfo = await page.evaluate(() => {
            const scripts = Array.from(document.head.querySelectorAll('script[src]'));
            return scripts.map(script => ({
                src: script.src,
                defer: script.defer,
                async: script.async,
                type: script.type
            }));
        });
        
        // Todos os scripts JS locais devem ter defer
        const localScripts = scriptsInfo.filter(s => s.src.includes('/js/'));
        localScripts.forEach(script => {
            expect(script.defer).toBe(true);
            expect(script.async).toBe(false);
            expect(script.type).not.toBe('module');
        });
    });
});

test.describe('Home Page - Performance', () => {
    test('deve carregar em menos de 3 segundos', async ({ page }) => {
        const startTime = Date.now();
        
        await page.goto('/home.html', { waitUntil: 'domcontentloaded' });
        
        const loadTime = Date.now() - startTime;
        expect(loadTime).toBeLessThan(3000);
    });
    
    test('deve ter First Contentful Paint rápido', async ({ page }) => {
        await page.goto('/home.html');
        
        const metrics = await page.evaluate(() => {
            const paint = performance.getEntriesByType('paint');
            const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
            return fcp ? fcp.startTime : null;
        });
        
        expect(metrics).toBeTruthy();
        expect(metrics).toBeLessThan(2000); // FCP < 2s
    });
});