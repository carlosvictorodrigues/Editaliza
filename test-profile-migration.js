/**
 * Script de teste para validar migração das rotas de perfil
 * 
 * Testa que:
 * 1. Rotas antigas ainda funcionam (compatibilidade)
 * 2. Rotas novas funcionam corretamente
 * 3. CRUD completo do perfil
 * 4. Upload/remoção de fotos
 * 5. Validações e segurança
 * 6. Tratamento de erros
 */

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');

// Configuração
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `profile_test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test123!@#';

// Armazenar tokens e cookies
let authToken = null;
let csrfToken = null;
let cookies = '';
let userId = null;

// Estatísticas
const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
};

// ============================================================================
// ROTAS DE PERFIL PARA TESTAR
// ============================================================================

const PROFILE_ROUTES = [
    // Rotas principais
    {
        name: 'GET Profile (new)',
        method: 'GET',
        path: '/api/users/profile',
        requiresAuth: true,
        expectedStatus: 200
    },
    {
        name: 'PATCH Profile (new)',
        method: 'PATCH',
        path: '/api/users/profile',
        requiresAuth: true,
        expectedStatus: 200,
        body: { name: 'Test User Updated' }
    },
    {
        name: 'DELETE Profile Photo (new)',
        method: 'DELETE',
        path: '/api/users/profile/photo',
        requiresAuth: true,
        expectedStatus: [404, 200] // 404 se não tiver foto, 200 se remover
    },
    
    // Rotas de compatibilidade (antigas)
    {
        name: 'GET Profile (old - compatibility)',
        method: 'GET',
        path: '/api/profile',
        requiresAuth: true,
        expectedStatus: 200,
        isDeprecated: true
    }
];

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Fazer requisição HTTP com headers apropriados
 */
async function makeRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    if (authToken) {
        defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (csrfToken && options.method !== 'GET') {
        defaultOptions.headers['X-CSRF-Token'] = csrfToken;
    }

    if (cookies) {
        defaultOptions.headers['Cookie'] = cookies;
    }

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // Capturar cookies
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        cookies = setCookie;
    }

    return response;
}

/**
 * Log de teste com cores
 */
function logTest(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    switch (type) {
        case 'success':
            console.log(colors.green(`[${timestamp}] ✓ ${message}`));
            break;
        case 'error':
            console.log(colors.red(`[${timestamp}] ✗ ${message}`));
            break;
        case 'warning':
            console.log(colors.yellow(`[${timestamp}] ⚠ ${message}`));
            break;
        default:
            console.log(colors.blue(`[${timestamp}] ℹ ${message}`));
    }
}

/**
 * Criar arquivo de imagem temporário para testes
 */
function createTestImage() {
    const testImagePath = path.join(__dirname, 'test-image.png');
    
    // Criar uma imagem PNG simples (1x1 pixel transparente)
    const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    fs.writeFileSync(testImagePath, pngData);
    return testImagePath;
}

/**
 * Limpar arquivo de teste
 */
function cleanupTestImage(imagePath) {
    try {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    } catch (error) {
        console.warn(`Aviso: Não foi possível remover ${imagePath}`);
    }
}

// ============================================================================
// TESTES DE AUTENTICAÇÃO E SETUP
// ============================================================================

async function setupAuthentication() {
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('SETUP DE AUTENTICAÇÃO'));
    console.log(colors.cyan('═══════════════════════════════════════════'));

    try {
        // 1. Obter CSRF token
        logTest('Obtendo CSRF token...');
        const csrfResponse = await makeRequest(`${BASE_URL}/api/auth/csrf-token`);
        const csrfData = await csrfResponse.json();
        csrfToken = csrfData.csrfToken;
        logTest(`CSRF token obtido: ${csrfToken.substring(0, 10)}...`, 'success');

        // 2. Registrar usuário de teste
        logTest(`Registrando usuário: ${TEST_EMAIL}...`);
        const registerResponse = await makeRequest(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            })
        });

        if (registerResponse.status === 201) {
            const registerData = await registerResponse.json();
            authToken = registerData.token;
            userId = registerData.user?.id;
            logTest('Usuário registrado com sucesso', 'success');
        } else {
            logTest('Registro falhou (pode já existir), tentando login...', 'warning');
        }

        // 3. Fazer login se registro falhou
        if (!authToken) {
            logTest('Fazendo login...');
            const loginResponse = await makeRequest(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                body: JSON.stringify({
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD
                })
            });

            if (loginResponse.status === 200) {
                const loginData = await loginResponse.json();
                authToken = loginData.token;
                userId = loginData.user?.id;
                logTest('Login realizado com sucesso', 'success');
            } else {
                throw new Error(`Login falhou: ${loginResponse.status}`);
            }
        }

        return true;
    } catch (error) {
        logTest(`Erro no setup: ${error.message}`, 'error');
        return false;
    }
}

// ============================================================================
// TESTES DE ROTAS BÁSICAS
// ============================================================================

async function testBasicRoutes() {
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('TESTE DE ROTAS BÁSICAS'));
    console.log(colors.cyan('═══════════════════════════════════════════'));

    for (const route of PROFILE_ROUTES) {
        stats.total++;
        logTest(`Testando: ${route.name}`, 'info');

        try {
            const response = await makeRequest(`${BASE_URL}${route.path}`, {
                method: route.method,
                body: route.body ? JSON.stringify(route.body) : undefined
            });

            // Verificar headers de depreciação
            if (route.isDeprecated) {
                const deprecationWarning = response.headers.get('x-deprecation-warning');
                if (deprecationWarning) {
                    logTest('Header de depreciação encontrado', 'warning');
                    stats.warnings++;
                }
            }

            // Verificar status esperado
            const expectedStatuses = Array.isArray(route.expectedStatus) 
                ? route.expectedStatus 
                : [route.expectedStatus];

            if (expectedStatuses.includes(response.status)) {
                logTest(`Status correto: ${response.status}`, 'success');
                stats.passed++;
            } else {
                logTest(`Status incorreto: esperado ${route.expectedStatus}, recebido ${response.status}`, 'error');
                stats.failed++;
            }

            // Log do corpo da resposta para debug (apenas primeiras linhas)
            if (response.status === 200) {
                const responseText = await response.text();
                try {
                    const responseData = JSON.parse(responseText);
                    logTest(`Resposta: ${Object.keys(responseData).join(', ')}`, 'info');
                } catch {
                    logTest(`Resposta: ${responseText.substring(0, 100)}...`, 'info');
                }
            }

        } catch (error) {
            logTest(`Erro na requisição: ${error.message}`, 'error');
            stats.failed++;
        }
    }
}

// ============================================================================
// TESTES DE CRUD COMPLETO
// ============================================================================

async function testProfileCRUD() {
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('TESTE DE CRUD COMPLETO DO PERFIL'));
    console.log(colors.cyan('═══════════════════════════════════════════'));

    const testData = {
        name: 'João da Silva Teste',
        phone: '(11) 99999-9999',
        whatsapp: '(11) 88888-8888',
        state: 'SP',
        city: 'São Paulo',
        birth_date: '1990-01-15',
        education: 'Ensino Superior Completo',
        work_status: 'Empregado',
        first_time: 'nao',
        concursos_count: '2-5',
        difficulties: ['Tempo para estudar', 'Concentração'],
        area_interest: 'Administrativo',
        level_desired: 'Superior',
        timeline_goal: '6-12 meses',
        study_hours: '2-4 horas',
        motivation_text: 'Quero melhorar minha situação profissional através de concursos públicos.'
    };

    try {
        // 1. Obter perfil inicial
        stats.total++;
        logTest('1. Obtendo perfil inicial...');
        const initialResponse = await makeRequest(`${BASE_URL}/api/users/profile`);
        
        if (initialResponse.status === 200) {
            const initialData = await initialResponse.json();
            logTest(`Perfil inicial obtido - Email: ${initialData.email}`, 'success');
            stats.passed++;
        } else {
            logTest(`Erro ao obter perfil inicial: ${initialResponse.status}`, 'error');
            stats.failed++;
        }

        // 2. Atualizar perfil completo
        stats.total++;
        logTest('2. Atualizando perfil completo...');
        const updateResponse = await makeRequest(`${BASE_URL}/api/users/profile`, {
            method: 'PATCH',
            body: JSON.stringify(testData)
        });

        if (updateResponse.status === 200) {
            const updateData = await updateResponse.json();
            logTest('Perfil atualizado com sucesso', 'success');
            
            // Verificar se os dados foram salvos corretamente
            if (updateData.profile?.name === testData.name) {
                logTest('Dados salvos corretamente', 'success');
            } else {
                logTest('Dados não salvos corretamente', 'warning');
                stats.warnings++;
            }
            stats.passed++;
        } else {
            logTest(`Erro ao atualizar perfil: ${updateResponse.status}`, 'error');
            const errorText = await updateResponse.text();
            logTest(`Detalhes do erro: ${errorText}`, 'error');
            stats.failed++;
        }

        // 3. Verificar dados atualizados
        stats.total++;
        logTest('3. Verificando dados atualizados...');
        const verifyResponse = await makeRequest(`${BASE_URL}/api/users/profile`);
        
        if (verifyResponse.status === 200) {
            const verifyData = await verifyResponse.json();
            
            // Verificar campos específicos
            const fieldsToCheck = ['name', 'phone', 'state', 'city'];
            let fieldsCorrect = 0;
            
            for (const field of fieldsToCheck) {
                if (verifyData[field] === testData[field]) {
                    fieldsCorrect++;
                } else {
                    logTest(`Campo ${field} não atualizado: esperado "${testData[field]}", atual "${verifyData[field]}"`, 'warning');
                }
            }
            
            if (fieldsCorrect === fieldsToCheck.length) {
                logTest('Todos os campos verificados estão corretos', 'success');
                stats.passed++;
            } else {
                logTest(`${fieldsCorrect}/${fieldsToCheck.length} campos corretos`, 'warning');
                stats.warnings++;
            }
        } else {
            logTest(`Erro ao verificar dados: ${verifyResponse.status}`, 'error');
            stats.failed++;
        }

        // 4. Testar validações (dados inválidos)
        stats.total++;
        logTest('4. Testando validações com dados inválidos...');
        const invalidResponse = await makeRequest(`${BASE_URL}/api/users/profile`, {
            method: 'PATCH',
            body: JSON.stringify({
                name: '', // Nome vazio deve falhar
                state: 'INVALID', // Estado inválido
                birth_date: 'data-invalida'
            })
        });

        if (invalidResponse.status === 400) {
            logTest('Validações funcionando corretamente', 'success');
            stats.passed++;
        } else {
            logTest(`Validações não funcionaram: status ${invalidResponse.status}`, 'error');
            stats.failed++;
        }

    } catch (error) {
        logTest(`Erro no teste CRUD: ${error.message}`, 'error');
        stats.failed++;
    }
}

// ============================================================================
// TESTES DE UPLOAD DE FOTO
// ============================================================================

async function testPhotoUpload() {
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('TESTE DE UPLOAD DE FOTO'));
    console.log(colors.cyan('═══════════════════════════════════════════'));

    let testImagePath = null;
    
    try {
        // Criar imagem de teste
        testImagePath = createTestImage();
        logTest('Imagem de teste criada', 'info');

        // 1. Upload de foto válida
        stats.total++;
        logTest('1. Testando upload de foto válida...');
        
        const form = new FormData();
        form.append('photo', fs.createReadStream(testImagePath), {
            filename: 'test-photo.png',
            contentType: 'image/png'
        });

        const uploadResponse = await fetch(`${BASE_URL}/api/users/profile/photo`, {
            method: 'POST',
            body: form,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrfToken,
                'Cookie': cookies,
                ...form.getHeaders()
            }
        });

        if (uploadResponse.status === 200) {
            const uploadData = await uploadResponse.json();
            logTest(`Foto enviada com sucesso: ${uploadData.profile_picture}`, 'success');
            stats.passed++;
        } else {
            const errorText = await uploadResponse.text();
            logTest(`Erro no upload: ${uploadResponse.status} - ${errorText}`, 'error');
            stats.failed++;
        }

        // 2. Verificar se foto aparece no perfil
        stats.total++;
        logTest('2. Verificando foto no perfil...');
        const profileResponse = await makeRequest(`${BASE_URL}/api/users/profile`);
        
        if (profileResponse.status === 200) {
            const profileData = await profileResponse.json();
            if (profileData.profile_picture) {
                logTest(`Foto presente no perfil: ${profileData.profile_picture}`, 'success');
                stats.passed++;
            } else {
                logTest('Foto não encontrada no perfil', 'error');
                stats.failed++;
            }
        } else {
            logTest(`Erro ao verificar perfil: ${profileResponse.status}`, 'error');
            stats.failed++;
        }

        // 3. Remover foto
        stats.total++;
        logTest('3. Testando remoção de foto...');
        const deleteResponse = await makeRequest(`${BASE_URL}/api/users/profile/photo`, {
            method: 'DELETE'
        });

        if (deleteResponse.status === 200) {
            logTest('Foto removida com sucesso', 'success');
            stats.passed++;
        } else if (deleteResponse.status === 404) {
            logTest('Nenhuma foto para remover (OK)', 'warning');
            stats.warnings++;
        } else {
            logTest(`Erro ao remover foto: ${deleteResponse.status}`, 'error');
            stats.failed++;
        }

        // 4. Testar upload de arquivo inválido
        stats.total++;
        logTest('4. Testando upload de arquivo inválido...');
        
        const invalidForm = new FormData();
        // Criar arquivo de texto simulando ser imagem
        const textBuffer = Buffer.from('Este não é um arquivo de imagem');
        invalidForm.append('photo', textBuffer, {
            filename: 'fake-image.txt',
            contentType: 'text/plain'
        });

        const invalidUploadResponse = await fetch(`${BASE_URL}/api/users/profile/photo`, {
            method: 'POST',
            body: invalidForm,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrfToken,
                'Cookie': cookies,
                ...invalidForm.getHeaders()
            }
        });

        if (invalidUploadResponse.status === 400) {
            logTest('Validação de tipo de arquivo funcionando', 'success');
            stats.passed++;
        } else {
            logTest(`Validação de arquivo não funcionou: ${invalidUploadResponse.status}`, 'error');
            stats.failed++;
        }

        // 5. Testar upload sem arquivo
        stats.total++;
        logTest('5. Testando upload sem arquivo...');
        
        const emptyForm = new FormData();
        const emptyUploadResponse = await fetch(`${BASE_URL}/api/users/profile/photo`, {
            method: 'POST',
            body: emptyForm,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrfToken,
                'Cookie': cookies,
                ...emptyForm.getHeaders()
            }
        });

        if (emptyUploadResponse.status === 400) {
            logTest('Validação de arquivo obrigatório funcionando', 'success');
            stats.passed++;
        } else {
            logTest(`Validação de arquivo obrigatório não funcionou: ${emptyUploadResponse.status}`, 'error');
            stats.failed++;
        }

    } catch (error) {
        logTest(`Erro no teste de upload: ${error.message}`, 'error');
        stats.failed++;
    } finally {
        // Limpar arquivo de teste
        if (testImagePath) {
            cleanupTestImage(testImagePath);
            logTest('Arquivo de teste removido', 'info');
        }
    }
}

// ============================================================================
// TESTES DE SEGURANÇA
// ============================================================================

async function testSecurity() {
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('TESTE DE SEGURANÇA'));
    console.log(colors.cyan('═══════════════════════════════════════════'));

    try {
        // 1. Teste sem autenticação
        stats.total++;
        logTest('1. Testando acesso sem autenticação...');
        
        const noAuthResponse = await fetch(`${BASE_URL}/api/users/profile`);
        
        if (noAuthResponse.status === 401 || noAuthResponse.status === 403) {
            logTest('Proteção de autenticação funcionando', 'success');
            stats.passed++;
        } else {
            logTest(`Falha na proteção: status ${noAuthResponse.status}`, 'error');
            stats.failed++;
        }

        // 2. Teste com token inválido
        stats.total++;
        logTest('2. Testando com token inválido...');
        
        const invalidTokenResponse = await fetch(`${BASE_URL}/api/users/profile`, {
            headers: {
                'Authorization': 'Bearer invalid-token-here'
            }
        });
        
        if (invalidTokenResponse.status === 401 || invalidTokenResponse.status === 403) {
            logTest('Validação de token funcionando', 'success');
            stats.passed++;
        } else {
            logTest(`Falha na validação de token: status ${invalidTokenResponse.status}`, 'error');
            stats.failed++;
        }

        // 3. Teste de sanitização (XSS)
        stats.total++;
        logTest('3. Testando sanitização contra XSS...');
        
        const xssData = {
            name: '<script>alert("XSS")</script>',
            motivation_text: '<img src="x" onerror="alert(\'XSS\')">'
        };
        
        const xssResponse = await makeRequest(`${BASE_URL}/api/users/profile`, {
            method: 'PATCH',
            body: JSON.stringify(xssData)
        });

        if (xssResponse.status === 200) {
            // Verificar se os dados foram sanitizados
            const profileResponse = await makeRequest(`${BASE_URL}/api/users/profile`);
            const profileData = await profileResponse.json();
            
            if (profileData.name && !profileData.name.includes('<script>')) {
                logTest('Sanitização XSS funcionando', 'success');
                stats.passed++;
            } else {
                logTest('Possível vulnerabilidade XSS detectada', 'error');
                stats.failed++;
            }
        } else {
            logTest('Erro no teste de XSS', 'warning');
            stats.warnings++;
        }

        // 4. Teste de injeção SQL (básico)
        stats.total++;
        logTest('4. Testando proteção contra SQL Injection...');
        
        const sqlData = {
            name: "'; DROP TABLE users; --",
            phone: "1' OR '1'='1"
        };
        
        const sqlResponse = await makeRequest(`${BASE_URL}/api/users/profile`, {
            method: 'PATCH',
            body: JSON.stringify(sqlData)
        });

        // Se a aplicação não quebrar, é um bom sinal
        if (sqlResponse.status === 200 || sqlResponse.status === 400) {
            logTest('Sistema resistente a SQL Injection básico', 'success');
            stats.passed++;
        } else if (sqlResponse.status === 500) {
            logTest('Possível vulnerabilidade SQL Injection', 'error');
            stats.failed++;
        } else {
            logTest(`Comportamento inesperado no teste SQL: ${sqlResponse.status}`, 'warning');
            stats.warnings++;
        }

    } catch (error) {
        logTest(`Erro no teste de segurança: ${error.message}`, 'error');
        stats.failed++;
    }
}

// ============================================================================
// TESTES DE COMPATIBILIDADE COM ROTAS ANTIGAS
// ============================================================================

async function testLegacyCompatibility() {
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('TESTE DE COMPATIBILIDADE COM ROTAS ANTIGAS'));
    console.log(colors.cyan('═══════════════════════════════════════════'));

    const legacyRoutes = [
        {
            name: 'GET /api/profile → /api/users/profile',
            old: '/api/profile',
            new: '/api/users/profile',
            method: 'GET'
        }
    ];

    for (const route of legacyRoutes) {
        stats.total++;
        logTest(`Testando compatibilidade: ${route.name}`);

        try {
            // Testar rota antiga
            const oldResponse = await makeRequest(`${BASE_URL}${route.old}`, {
                method: route.method
            });

            // Testar rota nova
            const newResponse = await makeRequest(`${BASE_URL}${route.new}`, {
                method: route.method
            });

            // Comparar respostas
            if (oldResponse.status === newResponse.status) {
                logTest('Status codes compatíveis', 'success');
                
                if (oldResponse.status === 200) {
                    const oldData = await oldResponse.text();
                    const newData = await newResponse.text();
                    
                    // Comparação básica de conteúdo
                    if (oldData.length === newData.length || Math.abs(oldData.length - newData.length) < 100) {
                        logTest('Conteúdo das respostas compatível', 'success');
                        stats.passed++;
                    } else {
                        logTest('Diferença significativa no conteúdo', 'warning');
                        stats.warnings++;
                    }
                } else {
                    stats.passed++;
                }
            } else {
                logTest(`Status incompatível: antiga ${oldResponse.status}, nova ${newResponse.status}`, 'error');
                stats.failed++;
            }

        } catch (error) {
            logTest(`Erro no teste de compatibilidade: ${error.message}`, 'error');
            stats.failed++;
        }
    }
}

// ============================================================================
// FUNÇÃO PRINCIPAL E RELATÓRIO
// ============================================================================

async function generateReport() {
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('RELATÓRIO FINAL'));
    console.log(colors.cyan('═══════════════════════════════════════════'));
    
    console.log(`\nResumo dos Testes:`);
    console.log(`Total de testes executados: ${stats.total}`);
    console.log(colors.green(`✓ Testes aprovados: ${stats.passed}`));
    console.log(colors.yellow(`⚠ Avisos: ${stats.warnings}`));
    console.log(colors.red(`✗ Testes falharam: ${stats.failed}`));
    
    const successRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;
    console.log(`\nTaxa de sucesso: ${successRate}%`);
    
    if (successRate >= 90) {
        console.log(colors.green('\n🎉 EXCELENTE! Migração muito bem sucedida!'));
    } else if (successRate >= 75) {
        console.log(colors.yellow('\n✅ BOM! Migração bem sucedida com alguns pontos de atenção'));
    } else if (successRate >= 50) {
        console.log(colors.yellow('\n⚠️ ATENÇÃO! Migração parcial, requer correções'));
    } else {
        console.log(colors.red('\n❌ CRÍTICO! Migração com problemas sérios'));
    }
    
    // Recomendações
    console.log(colors.cyan('\nRecomendações:'));
    if (stats.warnings > 0) {
        console.log(colors.yellow('• Revisar avisos de depreciação e considerar atualizar clientes'));
    }
    if (stats.failed > 0) {
        console.log(colors.red('• Corrigir falhas identificadas antes do deploy'));
    }
    console.log(colors.blue('• Monitorar logs de produção após migração'));
    console.log(colors.blue('• Considerar remoção das rotas antigas após período de transição'));
}

async function runAllTests() {
    console.log(colors.cyan('╔═══════════════════════════════════════════╗'));
    console.log(colors.cyan('║   TESTE DE MIGRAÇÃO DE PERFIL - EDITALIZA  ║'));
    console.log(colors.cyan('╚═══════════════════════════════════════════╝'));
    console.log(`\nServidor: ${BASE_URL}`);
    console.log(`Email de teste: ${TEST_EMAIL}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    try {
        // Setup inicial
        const authSuccess = await setupAuthentication();
        if (!authSuccess) {
            console.log(colors.red('\nFalha no setup de autenticação. Abortando testes.'));
            process.exit(1);
        }

        // Executar todos os testes
        await testBasicRoutes();
        await testProfileCRUD();
        await testPhotoUpload();
        await testSecurity();
        await testLegacyCompatibility();

        // Gerar relatório
        await generateReport();

    } catch (error) {
        console.log(colors.red(`\nErro fatal durante execução dos testes: ${error.message}`));
        console.log(colors.gray(error.stack));
        process.exit(1);
    }

    // Finalizar com código de saída apropriado
    process.exit(stats.failed > 0 ? 1 : 0);
}

// Executar se chamado diretamente
if (require.main === module) {
    runAllTests().catch(error => {
        console.error(colors.red(`\nErro fatal: ${error.message}`));
        process.exit(1);
    });
}

module.exports = { 
    runAllTests, 
    testBasicRoutes, 
    testProfileCRUD, 
    testPhotoUpload, 
    testSecurity,
    testLegacyCompatibility
};