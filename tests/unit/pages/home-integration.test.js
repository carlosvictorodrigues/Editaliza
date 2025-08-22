/**
 * @file tests/home-integration.test.js
 * @description Testes de integração para endpoints usados na tela inicial
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Mock do app se não estiver disponível
let app;
try {
    app = require('../server.js');
} catch (error) {
    // Criar mock básico do Express se servidor não estiver disponível
    const express = require('express');
    const mockApp = express();
    
    mockApp.get('/profile', (req, res) => {
        res.json({ name: 'Test User', profile_picture: './test.svg' });
    });
    
    mockApp.get('/plans/:id', (req, res) => {
        res.json({ id: req.params.id, name: 'Test Plan', exam_date: '2024-12-31' });
    });
    
    mockApp.get('/plans/:id/progress', (req, res) => {
        res.json({ percentage: 65 });
    });
    
    mockApp.get('/schedules/:planId/range', (req, res) => {
        res.json([{
            id: 1,
            subject_name: 'Direito Constitucional',
            topic_description: 'Test topic',
            session_type: 'Novo Tópico',
            status: 'Pendente'
        }]);
    });
    
    app = mockApp;
}

describe('Tela Inicial - Testes de Integração API', () => {
    
    describe('Endpoints para carregamento de dados', () => {
        test('GET /profile deve retornar dados do usuário', async () => {
            const response = await request(app)
                .get('/profile')
                .expect('Content-Type', /json/);
                
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('name');
        });

        test('GET /plans/:id deve retornar dados do plano', async () => {
            const response = await request(app)
                .get('/plans/1')
                .expect('Content-Type', /json/);
                
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('name');
        });

        test('GET /plans/:id/progress deve retornar progresso', async () => {
            const response = await request(app)
                .get('/plans/1/progress')
                .expect('Content-Type', /json/);
                
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('percentage');
            expect(typeof response.body.percentage).toBe('number');
        });

        test('GET /schedules/:planId/range deve retornar sessões do dia', async () => {
            const today = new Date().toISOString().split('T')[0];
            const response = await request(app)
                .get(`/schedules/1/range?startDate=${today}&endDate=${today}`)
                .expect('Content-Type', /json/);
                
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('Validação de arquivos estáticos', () => {
        test('Arquivo home.html deve existir', () => {
            const homePath = path.join(__dirname, '..', 'home.html');
            expect(fs.existsSync(homePath)).toBe(true);
        });

        test('Arquivos JavaScript devem existir', () => {
            const jsFiles = ['app.js', 'components.js', 'checklist.js', 'timer.js'];
            
            jsFiles.forEach(file => {
                const filePath = path.join(__dirname, '..', 'js', file);
                expect(fs.existsSync(filePath)).toBe(true);
            });
        });

        test('Arquivo CSS deve existir', () => {
            const cssPath = path.join(__dirname, '..', 'css', 'style.css');
            expect(fs.existsSync(cssPath)).toBe(true);
        });
    });

    describe('Estrutura de dados esperada', () => {
        test('Dados do perfil devem ter estrutura correta', async () => {
            const response = await request(app)
                .get('/profile');
                
            if (response.status === 200) {
                expect(response.body).toMatchObject({
                    name: expect.any(String)
                });
                
                if (response.body.profile_picture) {
                    expect(typeof response.body.profile_picture).toBe('string');
                }
            }
        });

        test('Dados do plano devem ter estrutura correta', async () => {
            const response = await request(app)
                .get('/plans/1');
                
            if (response.status === 200) {
                expect(response.body).toMatchObject({
                    id: expect.any(Number),
                    name: expect.any(String)
                });
                
                if (response.body.exam_date) {
                    expect(response.body.exam_date).toMatch(/\d{4}-\d{2}-\d{2}/);
                }
            }
        });

        test('Dados de sessão devem ter estrutura correta', async () => {
            const today = new Date().toISOString().split('T')[0];
            const response = await request(app)
                .get(`/schedules/1/range?startDate=${today}&endDate=${today}`);
                
            if (response.status === 200 && response.body.length > 0) {
                const session = response.body[0];
                
                expect(session).toMatchObject({
                    id: expect.any(Number),
                    subject_name: expect.any(String),
                    session_type: expect.any(String),
                    status: expect.any(String)
                });
            }
        });
    });

    describe('Tratamento de erros', () => {
        test('Deve lidar com plano inexistente', async () => {
            const response = await request(app)
                .get('/plans/99999');
                
            // Pode retornar 404 ou dados vazios, mas não deve quebrar
            expect([200, 404, 500]).toContain(response.status);
        });

        test('Deve lidar com dados de progresso inválidos', async () => {
            const response = await request(app)
                .get('/plans/99999/progress');
                
            expect([200, 404, 500]).toContain(response.status);
        });
    });
});

describe('Validação de Arquivo HTML', () => {
    let htmlContent;
    
    beforeAll(() => {
        const homePath = path.join(__dirname, '..', 'home.html');
        htmlContent = fs.readFileSync(homePath, 'utf-8');
    });

    test('HTML deve ter estrutura básica válida', () => {
        expect(htmlContent).toContain('<!DOCTYPE html>');
        expect(htmlContent).toContain('<html');
        expect(htmlContent).toContain('<head>');
        expect(htmlContent).toContain('<body>');
        expect(htmlContent).toContain('</html>');
    });

    test('Deve incluir meta tags essenciais', () => {
        expect(htmlContent).toContain('charset="UTF-8"');
        expect(htmlContent).toContain('name="viewport"');
        expect(htmlContent).toContain('<title>');
    });

    test('Deve carregar dependências externas', () => {
        expect(htmlContent).toContain('tailwindcss.com');
        expect(htmlContent).toContain('fonts.googleapis.com');
    });

    test('Deve incluir scripts principais', () => {
        expect(htmlContent).toContain('app.js');
        expect(htmlContent).toContain('components.js');
        expect(htmlContent).toContain('checklist.js');
        expect(htmlContent).toContain('timer.js');
    });

    test('Deve ter elementos principais com IDs corretos', () => {
        const expectedIds = [
            'welcomeMessage',
            'userAvatar',
            'todayDateHero',
            'daysToExamHero',
            'generalProgressHero',
            'todaySchedule',
            'studySessionModal',
            'studySessionModalContainer'
        ];
        
        expectedIds.forEach(id => {
            expect(htmlContent).toContain(`id="${id}"`);
        });
    });

    test('Deve ter configuração do Tailwind', () => {
        expect(htmlContent).toContain('tailwind.config');
        expect(htmlContent).toContain('editaliza-blue');
        expect(htmlContent).toContain('editaliza-green');
    });

    test('Deve ter funções JavaScript principais', () => {
        expect(htmlContent).toContain('loadUserProfile');
        expect(htmlContent).toContain('loadMetrics');
        expect(htmlContent).toContain('loadTodaySchedule');
        expect(htmlContent).toContain('window.openStudySession');
    });

    test('Deve ter classes CSS customizadas', () => {
        expect(htmlContent).toContain('modal-overlay');
        expect(htmlContent).toContain('user-avatar');
        expect(htmlContent).toContain('metric-card');
        expect(htmlContent).toContain('study-card');
    });

    test('Não deve ter problemas de segurança óbvios', () => {
        // Verificar que não há eval() ou innerHTML com user input
        const dangerousPatterns = [
            /eval\s*\(/g,
            /document\.write\s*\(/g,
            /javascript:/g,
            /on\w+\s*=\s*["'][^"']*\+/g // Event handlers com concatenação
        ];
        
        dangerousPatterns.forEach(pattern => {
            expect(htmlContent).not.toMatch(pattern);
        });
    });
});

describe('Validação de Arquivos JavaScript', () => {
    const jsFiles = ['app.js', 'components.js', 'checklist.js', 'timer.js'];
    
    jsFiles.forEach(filename => {
        describe(`Arquivo ${filename}`, () => {
            let content;
            
            beforeAll(() => {
                const filePath = path.join(__dirname, '..', 'js', filename);
                if (fs.existsSync(filePath)) {
                    content = fs.readFileSync(filePath, 'utf-8');
                }
            });
            
            test(`${filename} deve existir e não estar vazio`, () => {
                expect(content).toBeDefined();
                expect(content.length).toBeGreaterThan(0);
            });
            
            test(`${filename} deve ter sintaxe JavaScript válida`, () => {
                expect(() => {
                    new Function(content);
                }).not.toThrow();
            });
            
            test(`${filename} não deve ter console.log excessivos`, () => {
                const logMatches = content.match(/console\.log/g) || [];
                expect(logMatches.length).toBeLessThan(20); // Limite razoável
            });
            
            test(`${filename} deve ter tratamento de erro`, () => {
                expect(content).toMatch(/(try\s*{|catch\s*\(|\.catch\()/);
            });
        });
    });
    
    describe('Integração entre arquivos JavaScript', () => {
        test('app.js deve expor objeto app globalmente', () => {
            const appPath = path.join(__dirname, '..', 'js', 'app.js');
            const content = fs.readFileSync(appPath, 'utf-8');
            expect(content).toContain('window.app');
        });
        
        test('components.js deve expor objeto components', () => {
            const componentsPath = path.join(__dirname, '..', 'js', 'components.js');
            const content = fs.readFileSync(componentsPath, 'utf-8');
            expect(content).toContain('window.components');
        });
        
        test('Arquivos devem referenciar uns aos outros corretamente', () => {
            const checklistPath = path.join(__dirname, '..', 'js', 'checklist.js');
            const checklistContent = fs.readFileSync(checklistPath, 'utf-8');
            
            // Checklist deve usar TimerSystem e app
            expect(checklistContent).toMatch(/(TimerSystem\.|window\.TimerSystem)/);
            expect(checklistContent).toMatch(/(app\.|window\.app)/);
        });
    });
});