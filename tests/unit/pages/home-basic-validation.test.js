/**
 * @file tests/home-basic-validation.test.js
 * @description Testes básicos de validação da tela inicial
 */

const fs = require('fs');
const path = require('path');

describe('Validação Básica da Tela Inicial', () => {
    let htmlContent;
    
    beforeAll(() => {
        const homePath = path.join(__dirname, '..', 'home.html');
        htmlContent = fs.readFileSync(homePath, 'utf-8');
    });

    describe('✅ ESTRUTURA HTML', () => {
        test('Arquivo home.html deve existir', () => {
            expect(htmlContent).toBeDefined();
            expect(htmlContent.length).toBeGreaterThan(100);
        });

        test('Deve ter DOCTYPE e estrutura HTML válida', () => {
            expect(htmlContent).toContain('<!DOCTYPE html>');
            expect(htmlContent).toContain('<html');
            expect(htmlContent).toContain('<head>');
            expect(htmlContent).toContain('</html>');
        });

        test('Deve ter título correto', () => {
            expect(htmlContent).toContain('<title>Painel Principal - Editaliza</title>');
        });

        test('Deve ter meta viewport para responsividade', () => {
            expect(htmlContent).toContain('name="viewport"');
            expect(htmlContent).toContain('width=device-width');
        });
    });

    describe('✅ DEPENDÊNCIAS EXTERNAS', () => {
        test('Deve carregar Tailwind CSS', () => {
            expect(htmlContent).toContain('tailwindcss.com');
        });

        test('Deve carregar fonte Inter', () => {
            expect(htmlContent).toContain('fonts.googleapis.com');
            expect(htmlContent).toContain('Inter');
        });

        test('Deve incluir CSS customizado', () => {
            expect(htmlContent).toContain('css/style.css');
        });
    });

    describe('✅ SCRIPTS JAVASCRIPT', () => {
        test('Deve carregar scripts principais', () => {
            expect(htmlContent).toContain('js/app.js');
            expect(htmlContent).toContain('js/components.js');
            expect(htmlContent).toContain('js/checklist.js');
            expect(htmlContent).toContain('js/timer.js');
        });

        test('Deve ter configuração do Tailwind', () => {
            expect(htmlContent).toContain('tailwind.config');
            expect(htmlContent).toContain('editaliza-blue');
            expect(htmlContent).toContain('editaliza-green');
        });
    });

    describe('✅ ELEMENTOS DE NAVEGAÇÃO', () => {
        test('Deve ter marca/logo Editaliza', () => {
            expect(htmlContent).toContain('Editaliza');
        });

        test('Deve ter navegação principal', () => {
            expect(htmlContent).toContain('Painel Principal');
            expect(htmlContent).toContain('Gerenciar Planos');
            expect(htmlContent).toContain('Perfil');
            expect(htmlContent).toContain('FAQ');
        });

        test('Deve ter menu dropdown', () => {
            expect(htmlContent).toContain('dropdown');
            expect(htmlContent).toContain('dashboard.html');
            expect(htmlContent).toContain('cronograma.html');
        });

        test('Deve ter elemento para avatar do usuário', () => {
            expect(htmlContent).toContain('id="userAvatar"');
            expect(htmlContent).toContain('user-avatar');
        });
    });

    describe('✅ SEÇÃO PRINCIPAL', () => {
        test('Deve ter mensagem de boas-vindas', () => {
            expect(htmlContent).toContain('id="welcomeMessage"');
            expect(htmlContent).toContain('Bem-vindo');
        });

        test('Deve ter métricas principais', () => {
            expect(htmlContent).toContain('id="todayDateHero"');
            expect(htmlContent).toContain('id="daysToExamHero"');
            expect(htmlContent).toContain('id="generalProgressHero"');
        });

        test('Deve ter container para atividades do dia', () => {
            expect(htmlContent).toContain('id="todaySchedule"');
            expect(htmlContent).toContain('Atividades de hoje');
        });

        test('Deve ter seletor de plano', () => {
            expect(htmlContent).toContain('id="planSelector"');
            expect(htmlContent).toContain('Plano ativo');
        });
    });

    describe('✅ MODAL DE SESSÃO DE ESTUDO', () => {
        test('Deve ter modal overlay', () => {
            expect(htmlContent).toContain('id="studySessionModal"');
            expect(htmlContent).toContain('modal-overlay');
        });

        test('Deve ter container do modal', () => {
            expect(htmlContent).toContain('id="studySessionModalContainer"');
        });

        test('Modal deve começar oculto', () => {
            expect(htmlContent).toContain('hidden');
        });
    });

    describe('✅ FUNCIONALIDADES JAVASCRIPT', () => {
        test('Deve ter função de abertura de sessão de estudo', () => {
            expect(htmlContent).toContain('window.openStudySession');
        });

        test('Deve ter funções de carregamento de dados', () => {
            expect(htmlContent).toContain('loadUserProfile');
            expect(htmlContent).toContain('loadMetrics');
            expect(htmlContent).toContain('loadTodaySchedule');
        });

        test('Deve ter listener DOMContentLoaded', () => {
            expect(htmlContent).toContain('DOMContentLoaded');
        });

        test('Deve ter integração com APIs', () => {
            expect(htmlContent).toContain('/profile');
            expect(htmlContent).toContain('/plans/');
            expect(htmlContent).toContain('/schedules/');
        });
    });

    describe('✅ ESTILOS E DESIGN', () => {
        test('Deve ter cores da marca definidas', () => {
            expect(htmlContent).toContain('#0528f2'); // editaliza-blue
            expect(htmlContent).toContain('#1ad937'); // editaliza-green
        });

        test('Deve ter classes CSS customizadas', () => {
            expect(htmlContent).toContain('modal-overlay');
            expect(htmlContent).toContain('user-avatar');
            expect(htmlContent).toContain('metric-card');
            expect(htmlContent).toContain('study-card');
        });

        test('Deve ter design responsivo', () => {
            expect(htmlContent).toContain('md:grid-cols-4');
            expect(htmlContent).toContain('sm:px-6');
            expect(htmlContent).toContain('lg:px-8');
        });
    });

    describe('✅ SEGURANÇA BÁSICA', () => {
        test('Não deve ter eval() malicioso', () => {
            expect(htmlContent).not.toContain('eval(');
        });

        test('Não deve ter document.write', () => {
            expect(htmlContent).not.toContain('document.write');
        });

        test('Não deve ter javascript: URLs', () => {
            expect(htmlContent).not.toContain('javascript:');
        });

        test('IDs devem ser únicos (verificação básica)', () => {
            const idMatches = htmlContent.match(/id="([^"]+)"/g) || [];
            const ids = idMatches.map(match => match.replace(/id="([^"]+)"/, '$1'));
            const uniqueIds = [...new Set(ids)];
            expect(ids.length).toBe(uniqueIds.length);
        });
    });
});

describe('Validação dos Arquivos JavaScript', () => {
    const jsFiles = [
        { name: 'app.js', required: true },
        { name: 'components.js', required: true },
        { name: 'checklist.js', required: true },
        { name: 'timer.js', required: true }
    ];

    jsFiles.forEach(({ name, required }) => {
        describe(`✅ ARQUIVO ${name.toUpperCase()}`, () => {
            let content;
            
            beforeAll(() => {
                const filePath = path.join(__dirname, '..', 'js', name);
                if (fs.existsSync(filePath)) {
                    content = fs.readFileSync(filePath, 'utf-8');
                }
            });

            test(`${name} deve existir`, () => {
                if (required) {
                    expect(content).toBeDefined();
                    expect(content.length).toBeGreaterThan(0);
                }
            });

            if (required) {
                test(`${name} deve ter sintaxe JavaScript válida`, () => {
                    expect(() => {
                        // Teste de sintaxe básica
                        new Function(content);
                    }).not.toThrow();
                });

                test(`${name} deve ter tratamento de erro`, () => {
                    expect(content).toMatch(/(try\s*{|catch\s*\(|\.catch\()/);
                });
            }
        });
    });

    describe('✅ INTEGRAÇÃO ENTRE SCRIPTS', () => {
        test('app.js deve expor objeto global app', () => {
            const appPath = path.join(__dirname, '..', 'js', 'app.js');
            if (fs.existsSync(appPath)) {
                const content = fs.readFileSync(appPath, 'utf-8');
                expect(content).toContain('window.app');
            }
        });

        test('components.js deve expor objeto components', () => {
            const componentsPath = path.join(__dirname, '..', 'js', 'components.js');
            if (fs.existsSync(componentsPath)) {
                const content = fs.readFileSync(componentsPath, 'utf-8');
                expect(content).toContain('window.components');
            }
        });

        test('Scripts devem referenciar uns aos outros', () => {
            const checklistPath = path.join(__dirname, '..', 'js', 'checklist.js');
            if (fs.existsSync(checklistPath)) {
                const content = fs.readFileSync(checklistPath, 'utf-8');
                expect(content).toMatch(/(TimerSystem|app\.)/);
            }
        });
    });
});

describe('Relatório de Funcionalidades Encontradas', () => {
    let htmlContent;
    
    beforeAll(() => {
        const homePath = path.join(__dirname, '..', 'home.html');
        htmlContent = fs.readFileSync(homePath, 'utf-8');
    });

    test('📊 RELATÓRIO GERAL DE FUNCIONALIDADES', () => {
        const funcionalidades = {
            '🎯 Navegação principal': htmlContent.includes('Painel Principal'),
            '📊 Métricas do usuário': htmlContent.includes('todayDateHero'),
            '📅 Cronograma do dia': htmlContent.includes('todaySchedule'), 
            '👤 Avatar do usuário': htmlContent.includes('userAvatar'),
            '🎮 Sistema de timer': htmlContent.includes('timer.js'),
            '✅ Sistema de checklist': htmlContent.includes('checklist.js'),
            '📱 Design responsivo': htmlContent.includes('md:grid-cols'),
            '🔒 Modal de estudo': htmlContent.includes('studySessionModal'),
            '🎨 Cores da marca': htmlContent.includes('editaliza-blue'),
            '⚡ Scripts carregados': htmlContent.includes('js/app.js')
        };

        console.log('\n📋 RELATÓRIO DE FUNCIONALIDADES DA TELA INICIAL:');
        console.log('='*50);
        
        Object.entries(funcionalidades).forEach(([feature, found]) => {
            const status = found ? '✅ FUNCIONANDO' : '❌ PROBLEMA';
            console.log(`${feature}: ${status}`);
        });

        console.log('='*50);
        
        const funcionando = Object.values(funcionalidades).filter(Boolean).length;
        const total = Object.values(funcionalidades).length;
        
        console.log(`\n📊 RESUMO: ${funcionando}/${total} funcionalidades verificadas`);
        console.log(`✅ Taxa de sucesso: ${Math.round((funcionando/total)*100)}%\n`);

        // Teste deve passar se a maioria das funcionalidades estiver presente
        expect(funcionando).toBeGreaterThanOrEqual(Math.ceil(total * 0.8));
    });
});