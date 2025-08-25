#!/usr/bin/env node

/**
 * Script para aplicar otimizações de performance nas rotas admin
 * Resolve problema de timeout nas rotas /admin/users e /admin/system/metrics
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Configuração do banco
const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d',
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.error(`${colors.red}❌${colors.reset} ${msg}`)
};

async function applyIndexes() {
    const client = await pool.connect();
    
    try {
        log.info('Aplicando índices de performance...');
        
        // Lista de índices para criar
        const indexes = [
            {
                name: 'idx_users_created_at_desc',
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_created_at_desc ON users(created_at DESC)',
                description: 'Otimização para ordenação por data'
            },
            {
                name: 'idx_users_email_lower',
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email))',
                description: 'Busca case-insensitive por email'
            },
            {
                name: 'idx_users_role',
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
                description: 'Filtro por role'
            },
            {
                name: 'idx_users_search',
                sql: `CREATE INDEX IF NOT EXISTS idx_users_search ON users 
                      USING gin(to_tsvector('portuguese', COALESCE(email, '') || ' ' || COALESCE(name, '')))`,
                description: 'Busca textual rápida'
            },
            {
                name: 'idx_plans_active_created',
                sql: 'CREATE INDEX IF NOT EXISTS idx_plans_active_created ON study_plans(is_active, created_at DESC)',
                description: 'Queries de estatísticas de planos'
            },
            {
                name: 'idx_sessions_completed',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_completed ON sessions(status) WHERE status = \'completed\'',
                description: 'Contagem de sessões completadas'
            }
        ];
        
        // Aplicar cada índice
        for (const index of indexes) {
            try {
                await client.query(index.sql);
                log.success(`Índice criado: ${index.name} - ${index.description}`);
            } catch (err) {
                if (err.code === '42P07') { // duplicate_table
                    log.warning(`Índice já existe: ${index.name}`);
                } else {
                    log.error(`Erro ao criar índice ${index.name}: ${err.message}`);
                }
            }
        }
        
        // Criar view materializada para métricas
        log.info('Criando view materializada para métricas...');
        
        await client.query(`
            CREATE MATERIALIZED VIEW IF NOT EXISTS admin_metrics_summary AS
            WITH user_stats AS (
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as users_24h,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as users_7d
                FROM users
            ),
            plan_stats AS (
                SELECT 
                    COUNT(*) as total_plans,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_plans,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as plans_24h
                FROM study_plans
            ),
            session_stats AS (
                SELECT 
                    COUNT(*) as total_sessions,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions
                FROM sessions
            )
            SELECT 
                NOW() as last_updated,
                row_to_json(user_stats.*) as user_metrics,
                row_to_json(plan_stats.*) as plan_metrics,
                row_to_json(session_stats.*) as session_metrics
            FROM user_stats, plan_stats, session_stats
        `);
        
        log.success('View materializada criada');
        
        // Criar índice na view
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_metrics_summary_unique 
            ON admin_metrics_summary(last_updated)
        `);
        
        // Atualizar view
        await client.query('REFRESH MATERIALIZED VIEW admin_metrics_summary');
        log.success('View materializada atualizada');
        
        // Criar função para refresh automático
        await client.query(`
            CREATE OR REPLACE FUNCTION refresh_admin_metrics()
            RETURNS void AS $$
            BEGIN
                REFRESH MATERIALIZED VIEW CONCURRENTLY admin_metrics_summary;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        log.success('Função de refresh criada');
        
        // Analisar tabelas para atualizar estatísticas
        log.info('Atualizando estatísticas do banco...');
        await client.query('ANALYZE users');
        await client.query('ANALYZE study_plans');
        await client.query('ANALYZE sessions');
        log.success('Estatísticas atualizadas');
        
        return true;
        
    } catch (error) {
        log.error(`Erro geral: ${error.message}`);
        throw error;
    } finally {
        client.release();
    }
}

async function testPerformance() {
    const client = await pool.connect();
    
    try {
        log.info('\n🧪 Testando performance das queries otimizadas...\n');
        
        // Teste 1: Listar usuários com paginação
        const start1 = Date.now();
        const result1 = await client.query(`
            WITH paginated_users AS (
                SELECT 
                    id, email, name, role, created_at,
                    COUNT(*) OVER() as total_count,
                    ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
                FROM users
                WHERE 1=1
            )
            SELECT * FROM paginated_users 
            WHERE rn BETWEEN 1 AND 20
        `);
        const time1 = Date.now() - start1;
        log.success(`Query de usuários: ${time1}ms (${result1.rows.length} resultados)`);
        
        // Teste 2: Métricas do sistema
        const start2 = Date.now();
        const result2 = await client.query(`
            SELECT * FROM admin_metrics_summary
        `);
        const time2 = Date.now() - start2;
        log.success(`Query de métricas: ${time2}ms`);
        
        // Teste 3: Busca textual
        const start3 = Date.now();
        const result3 = await client.query(`
            SELECT id, email, name 
            FROM users 
            WHERE email ILIKE '%test%' OR name ILIKE '%test%'
            LIMIT 10
        `);
        const time3 = Date.now() - start3;
        log.success(`Query de busca: ${time3}ms (${result3.rows.length} resultados)`);
        
        // Resultado final
        const totalTime = time1 + time2 + time3;
        const avgTime = Math.round(totalTime / 3);
        
        console.log('\n' + '='.repeat(50));
        console.log(`${colors.green}📊 RESULTADO DOS TESTES${colors.reset}`);
        console.log('='.repeat(50));
        console.log(`Total: ${totalTime}ms | Média: ${avgTime}ms`);
        
        if (avgTime < 100) {
            log.success('Performance EXCELENTE! 🚀');
        } else if (avgTime < 500) {
            log.success('Performance BOA! ✨');
        } else {
            log.warning('Performance pode ser melhorada');
        }
        
    } catch (error) {
        log.error(`Erro nos testes: ${error.message}`);
    } finally {
        client.release();
    }
}

async function main() {
    console.log('\n' + '='.repeat(50));
    console.log(`${colors.cyan}🚀 OTIMIZAÇÃO DE PERFORMANCE - ROTAS ADMIN${colors.reset}`);
    console.log('='.repeat(50) + '\n');
    
    try {
        // Aplicar otimizações
        await applyIndexes();
        
        // Testar performance
        await testPerformance();
        
        console.log('\n' + '='.repeat(50));
        console.log(`${colors.green}✅ OTIMIZAÇÕES APLICADAS COM SUCESSO!${colors.reset}`);
        console.log('='.repeat(50));
        
        console.log('\n📋 Próximos passos:');
        console.log('1. Reinicie a aplicação para ativar o cache');
        console.log('2. Configure refresh automático: SELECT refresh_admin_metrics();');
        console.log('3. Monitore com: GET /admin/cache/stats\n');
        
    } catch (error) {
        log.error(`Falha na otimização: ${error.message}`);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Executar
main().catch(console.error);