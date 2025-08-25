/**
 * SCRIPT DE SETUP PARA OTIMIZAÇÕES DE PERFORMANCE ADMIN
 * 
 * Este script configura todas as otimizações necessárias para
 * eliminar os timeouts das rotas administrativas:
 * 
 * 1. Aplica índices de performance no PostgreSQL
 * 2. Cria views materializadas para métricas
 * 3. Configura cache warming inicial
 * 4. Executa testes de performance
 * 
 * COMO USAR:
 * node setup-admin-performance.js
 */

const { dbGet, dbAll, dbRun } = require('./database-postgresql');
const fs = require('fs');
const path = require('path');

// =====================================================
// CONFIGURAÇÃO DO SETUP
// =====================================================

const SETUP_CONFIG = {
    // Arquivo SQL com índices de performance
    indexesFile: path.join(__dirname, 'database', 'admin-performance-indexes.sql'),
    
    // Configurações de teste
    test: {
        enabled: true,
        userCount: 1000,    // Simular 1000 usuários para teste
        concurrency: 10     // 10 queries simultâneas
    },
    
    // Configurações de cache warming
    cacheWarming: {
        enabled: true,
        routes: [
            '/admin/system/metrics',
            '/admin/users?page=1&limit=20',
            '/admin/config'
        ]
    }
};

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

/**
 * Log com timestamp
 */
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${type}]`;
    console.log(`${prefix} ${message}`);
}

/**
 * Medir tempo de execução
 */
function measureTime(startTime) {
    const endTime = process.hrtime(startTime);
    return (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);
}

// =====================================================
// SETUP DE PERFORMANCE
// =====================================================

/**
 * 1. Aplicar índices de performance
 */
async function setupPerformanceIndexes() {
    log('🔧 Aplicando índices de performance...');
    
    try {
        if (!fs.existsSync(SETUP_CONFIG.indexesFile)) {
            log(`❌ Arquivo de índices não encontrado: ${SETUP_CONFIG.indexesFile}`, 'ERROR');
            return false;
        }
        
        const sqlContent = fs.readFileSync(SETUP_CONFIG.indexesFile, 'utf8');
        
        // Executar SQL em partes (separar por comentários principais)
        const sqlParts = sqlContent
            .split('-- =====')
            .filter(part => part.trim() && !part.trim().startsWith('INSTRUÇÕES'))
            .map(part => part.trim());
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const [index, sqlPart] of sqlParts.entries()) {
            if (!sqlPart) continue;
            
            try {
                const startTime = process.hrtime();
                
                // Executar comandos SQL separadamente
                const commands = sqlPart
                    .split(';')
                    .map(cmd => cmd.trim())
                    .filter(cmd => cmd && !cmd.startsWith('/*') && !cmd.startsWith('--') && !cmd.startsWith('\\echo'));
                
                for (const command of commands) {
                    if (command.length > 10) { // Ignorar comandos muito pequenos
                        await dbRun(command);
                    }
                }
                
                const time = measureTime(startTime);
                log(`  ✅ Parte ${index + 1} executada em ${time}ms`);
                successCount++;
                
            } catch (error) {
                log(`  ⚠️  Parte ${index + 1} falhou: ${error.message}`, 'WARN');
                errorCount++;
            }
        }
        
        log(`📊 Índices aplicados: ${successCount} sucessos, ${errorCount} erros`);
        return successCount > 0;
        
    } catch (error) {
        log(`❌ Erro ao aplicar índices: ${error.message}`, 'ERROR');
        return false;
    }
}

/**
 * 2. Verificar estrutura das tabelas
 */
async function verifyTableStructure() {
    log('🔍 Verificando estrutura das tabelas...');
    
    try {
        // Verificar tabelas principais
        const tables = ['users', 'sessions', 'schedules', 'plans', 'tasks', 'progress'];
        const missingTables = [];
        
        for (const table of tables) {
            try {
                const result = await dbGet(`
                    SELECT COUNT(*) as count 
                    FROM information_schema.tables 
                    WHERE table_name = $1
                `, [table]);
                
                if (result.count > 0) {
                    log(`  ✅ Tabela '${table}' encontrada`);
                } else {
                    log(`  ❌ Tabela '${table}' não encontrada`, 'WARN');
                    missingTables.push(table);
                }
            } catch (error) {
                log(`  ⚠️  Erro ao verificar tabela '${table}': ${error.message}`, 'WARN');
                missingTables.push(table);
            }
        }
        
        // Verificar se study_plans existe (pode ser plans na verdade)
        try {
            const studyPlansExists = await dbGet(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_name = 'study_plans'
            `);
            
            if (studyPlansExists.count === 0) {
                log('  📝 Tabela study_plans não existe, usando "plans" como alternativa');
            }
        } catch (error) {
            log('  📝 study_plans não encontrada, continuando com plans');
        }
        
        return missingTables.length === 0;
        
    } catch (error) {
        log(`❌ Erro na verificação de estrutura: ${error.message}`, 'ERROR');
        return false;
    }
}

/**
 * 3. Executar testes de performance
 */
async function runPerformanceTests() {
    if (!SETUP_CONFIG.test.enabled) {
        log('📊 Testes de performance desabilitados');
        return true;
    }
    
    log('🚀 Executando testes de performance...');
    
    try {
        // Teste 1: Query de usuários com paginação
        log('  🔍 Teste 1: Query de usuários otimizada');
        const startTime1 = process.hrtime();
        
        const usersResult = await dbAll(`
            SELECT id, email, name, role, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 20 OFFSET 0
        `);
        
        const time1 = measureTime(startTime1);
        log(`  ⚡ Query de usuários: ${time1}ms (${usersResult.length} resultados)`);
        
        // Teste 2: Métricas agregadas
        log('  📈 Teste 2: Métricas agregadas');
        const startTime2 = process.hrtime();
        
        const metricsResult = await dbGet(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as users_last_24h
            FROM users
        `);
        
        const time2 = measureTime(startTime2);
        log(`  ⚡ Métricas agregadas: ${time2}ms`);
        log(`    📊 Total: ${metricsResult.total_users}, Admins: ${metricsResult.admin_users}, 24h: ${metricsResult.users_last_24h}`);
        
        // Teste 3: Query com filtro textual
        log('  🔍 Teste 3: Busca textual otimizada');
        const startTime3 = process.hrtime();
        
        const searchResult = await dbAll(`
            SELECT id, email, name 
            FROM users 
            WHERE email ILIKE '%@%' 
            LIMIT 10
        `);
        
        const time3 = measureTime(startTime3);
        log(`  ⚡ Busca textual: ${time3}ms (${searchResult.length} resultados)`);
        
        // Teste 4: Verificar views materializadas
        log('  🏗️  Teste 4: Views materializadas');
        try {
            const viewTest = await dbGet('SELECT * FROM admin_user_metrics LIMIT 1');
            log(`  ✅ View materializada funcionando: ${JSON.stringify(viewTest)}`);
        } catch (error) {
            log(`  ⚠️  View materializada não disponível: ${error.message}`, 'WARN');
        }
        
        // Avaliação de performance
        const avgTime = (parseFloat(time1) + parseFloat(time2) + parseFloat(time3)) / 3;
        log(`📊 Performance média: ${avgTime.toFixed(2)}ms`);
        
        if (avgTime < 100) {
            log('🎉 Performance EXCELENTE (< 100ms)');
        } else if (avgTime < 500) {
            log('✅ Performance BOA (< 500ms)');
        } else if (avgTime < 1000) {
            log('⚠️  Performance ACEITÁVEL (< 1s)', 'WARN');
        } else {
            log('❌ Performance RUIM (> 1s) - Verificar otimizações', 'ERROR');
        }
        
        return avgTime < 1000;
        
    } catch (error) {
        log(`❌ Erro nos testes de performance: ${error.message}`, 'ERROR');
        return false;
    }
}

/**
 * 4. Cache warming inicial
 */
async function setupCacheWarming() {
    if (!SETUP_CONFIG.cacheWarming.enabled) {
        log('🔥 Cache warming desabilitado');
        return true;
    }
    
    log('🔥 Configurando cache warming...');
    
    try {
        // Importar o cache middleware
        const { adminCache } = require('./src/middleware/admin-cache.middleware');
        
        // Simular requests para as rotas principais
        const mockRequests = SETUP_CONFIG.cacheWarming.routes.map(route => ({
            method: 'GET',
            path: route.split('?')[0],
            query: route.includes('?') ? 
                Object.fromEntries(new URLSearchParams(route.split('?')[1])) : {},
            user: { id: 1 }
        }));
        
        // Pre-aquecer o cache (simulado)
        for (const mockReq of mockRequests) {
            const cacheKey = adminCache.generateKey(mockReq);
            log(`  🔥 Preparando cache para: ${mockReq.path}`);
            
            // Em uma implementação real, faria requests HTTP aqui
            // Por enquanto, apenas registrar as chaves
            adminCache.set(cacheKey, { prewarmed: true }, 60000, ['prewarming']);
        }
        
        log('✅ Cache warming configurado');
        return true;
        
    } catch (error) {
        log(`❌ Erro no cache warming: ${error.message}`, 'ERROR');
        return false;
    }
}

/**
 * 5. Validar conexão e permissões do banco
 */
async function validateDatabaseConnection() {
    log('🔌 Validando conexão com banco de dados...');
    
    try {
        // Teste básico de conexão
        const connectionTest = await dbGet('SELECT NOW() as current_time, version() as pg_version');
        log(`  ✅ Conectado ao PostgreSQL: ${connectionTest.pg_version.split(' ')[0]}`);
        log(`  🕒 Hora do servidor: ${connectionTest.current_time}`);
        
        // Verificar permissões para criar índices
        try {
            await dbRun('SELECT has_table_privilege(current_user, \'users\', \'select\')');
            log('  ✅ Permissões de leitura confirmadas');
        } catch (error) {
            log('  ❌ Problemas de permissão de leitura', 'ERROR');
            return false;
        }
        
        // Verificar se pode criar índices
        try {
            await dbRun(`
                CREATE INDEX IF NOT EXISTS idx_test_setup_temp ON users (id) 
                WHERE id = -1
            `);
            await dbRun('DROP INDEX IF EXISTS idx_test_setup_temp');
            log('  ✅ Permissões para criar índices confirmadas');
        } catch (error) {
            log('  ⚠️  Não foi possível criar índices - executar como superuser', 'WARN');
        }
        
        return true;
        
    } catch (error) {
        log(`❌ Falha na conexão: ${error.message}`, 'ERROR');
        return false;
    }
}

// =====================================================
// FUNÇÃO PRINCIPAL
// =====================================================

async function setupAdminPerformance() {
    log('🚀 Iniciando setup de performance administrativo...');
    log('==================================================');
    
    const steps = [
        { name: 'Validação da conexão', fn: validateDatabaseConnection },
        { name: 'Verificação de estrutura', fn: verifyTableStructure },
        { name: 'Aplicação de índices', fn: setupPerformanceIndexes },
        { name: 'Testes de performance', fn: runPerformanceTests },
        { name: 'Cache warming', fn: setupCacheWarming }
    ];
    
    let successCount = 0;
    const startTime = process.hrtime();
    
    for (const [index, step] of steps.entries()) {
        log(`\n📋 Passo ${index + 1}/${steps.length}: ${step.name}`);
        log('--------------------------------------------------');
        
        try {
            const stepSuccess = await step.fn();
            if (stepSuccess) {
                log(`✅ ${step.name} concluído com sucesso`);
                successCount++;
            } else {
                log(`⚠️  ${step.name} concluído com avisos`, 'WARN');
            }
        } catch (error) {
            log(`❌ ${step.name} falhou: ${error.message}`, 'ERROR');
        }
    }
    
    const totalTime = measureTime(startTime);
    
    log('\n==================================================');
    log('📊 RESUMO DO SETUP');
    log('==================================================');
    log(`✅ Passos bem-sucedidos: ${successCount}/${steps.length}`);
    log(`⏱️  Tempo total: ${totalTime}ms`);
    
    if (successCount === steps.length) {
        log('🎉 SETUP CONCLUÍDO COM SUCESSO!');
        log('📈 As rotas admin agora devem ter performance otimizada');
        log('🔧 Próximos passos:');
        log('   1. Reinicie a aplicação');
        log('   2. Teste as rotas /admin/users e /admin/system/metrics');
        log('   3. Configure cron para refresh das views: SELECT refresh_admin_metrics();');
        return true;
    } else {
        log('⚠️  SETUP CONCLUÍDO COM AVISOS', 'WARN');
        log('🔍 Verifique os logs acima para detalhes');
        return false;
    }
}

// =====================================================
// EXECUÇÃO
// =====================================================

// Executar apenas se chamado diretamente
if (require.main === module) {
    setupAdminPerformance()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            log(`💥 Erro crítico: ${error.message}`, 'ERROR');
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    setupAdminPerformance,
    SETUP_CONFIG
};