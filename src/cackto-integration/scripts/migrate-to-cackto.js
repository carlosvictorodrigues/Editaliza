#!/usr/bin/env node

/**
 * Script de migração para integração CAKTO
 * 
 * Este script executa todas as mudanças necessárias no banco de dados
 * para suportar a integração completa com CAKTO
 */

const db = require('../../../database-postgresql');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando migração CAKTO...\n');

// SQL da migração
const migrationSQL = `
-- =====================================================
-- MIGRAÇÃO CAKTO - EDITALIZA
-- =====================================================

-- 1. Adicionar coluna cakto_transaction_id à tabela subscriptions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name = 'cakto_transaction_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN cakto_transaction_id VARCHAR(255);
        RAISE NOTICE '✅ Coluna cakto_transaction_id adicionada à tabela subscriptions';
    ELSE
        RAISE NOTICE '⚠️  Coluna cakto_transaction_id já existe na tabela subscriptions';
    END IF;
END $$;

-- 2. Criar índice para cakto_transaction_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'subscriptions' 
        AND indexname = 'idx_subscriptions_cakto_transaction_id'
    ) THEN
        CREATE INDEX idx_subscriptions_cakto_transaction_id ON subscriptions(cakto_transaction_id);
        RAISE NOTICE '✅ Índice idx_subscriptions_cakto_transaction_id criado';
    ELSE
        RAISE NOTICE '⚠️  Índice idx_subscriptions_cakto_transaction_id já existe';
    END IF;
END $$;

-- 3. Criar tabela integration_metrics
CREATE TABLE IF NOT EXISTS integration_metrics (
    id SERIAL PRIMARY KEY,
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    metric_data JSONB DEFAULT '{}',
    entity_id VARCHAR(255),
    entity_type VARCHAR(100),
    source VARCHAR(50) DEFAULT 'cakto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para integration_metrics
CREATE INDEX IF NOT EXISTS idx_integration_metrics_type ON integration_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_created_at ON integration_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_entity ON integration_metrics(entity_type, entity_id);

-- 4. Criar tabela cakto_cache
CREATE TABLE IF NOT EXISTS cakto_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para cakto_cache
CREATE INDEX IF NOT EXISTS idx_cakto_cache_expires_at ON cakto_cache(expires_at);

-- 5. Criar tabela webhook_events (se não existir)
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    webhook_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    processing_id UUID,
    raw_payload JSONB NOT NULL,
    processed_payload JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    payment_processor VARCHAR(50) DEFAULT 'cakto',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processor ON webhook_events(payment_processor);

-- 6. Criar tabela webhook_dead_letter_queue
CREATE TABLE IF NOT EXISTS webhook_dead_letter_queue (
    id SERIAL PRIMARY KEY,
    webhook_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    raw_payload JSONB NOT NULL,
    processing_id UUID,
    payment_processor VARCHAR(50) DEFAULT 'cakto',
    status VARCHAR(50) DEFAULT 'queued',
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_retry_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para webhook_dead_letter_queue  
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_webhook_id ON webhook_dead_letter_queue(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_status ON webhook_dead_letter_queue(status);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_next_retry_at ON webhook_dead_letter_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_processor ON webhook_dead_letter_queue(payment_processor);

-- 7. Adicionar campos de auditoria às tabelas existentes (se necessário)
DO $$ 
BEGIN
    -- Adicionar payment_processor à tabela subscriptions se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name = 'payment_processor'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN payment_processor VARCHAR(50) DEFAULT 'cakto';
        RAISE NOTICE '✅ Coluna payment_processor adicionada à tabela subscriptions';
    ELSE
        RAISE NOTICE '⚠️  Coluna payment_processor já existe na tabela subscriptions';
    END IF;

    -- Adicionar metadata JSONB se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN metadata JSONB DEFAULT '{}';
        RAISE NOTICE '✅ Coluna metadata adicionada à tabela subscriptions';
    ELSE
        RAISE NOTICE '⚠️  Coluna metadata já existe na tabela subscriptions';
    END IF;
END $$;

-- 8. Criar função para limpeza automática de cache expirado
CREATE OR REPLACE FUNCTION cleanup_expired_cakto_cache() 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cakto_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Criar função de limpeza de webhooks antigos
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_events 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep 
    AND status IN ('success', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 10. Inserir métricas iniciais
INSERT INTO integration_metrics (metric_type, metric_value, metric_data) VALUES
    ('cakto_integration_version', 1.0, '{"migration_date": "' || NOW() || '", "status": "initialized"}')
ON CONFLICT DO NOTHING;

-- 11. Comentários nas tabelas
COMMENT ON TABLE integration_metrics IS 'Métricas de integração com processadores de pagamento';
COMMENT ON TABLE cakto_cache IS 'Cache otimizado para dados da CAKTO com TTL';
COMMENT ON TABLE webhook_events IS 'Log de todos os webhooks recebidos dos processadores';
COMMENT ON TABLE webhook_dead_letter_queue IS 'Fila de webhooks que falharam para retry automático';

-- 12. Verificar se subscriptions table existe, se não, criar estrutura básica
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'BRL',
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE,
    renewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Campos específicos para CAKTO
    cakto_transaction_id VARCHAR(255),
    payment_processor VARCHAR(50) DEFAULT 'cakto',
    metadata JSONB DEFAULT '{}'
);

-- Índices para subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);

COMMENT ON TABLE subscriptions IS 'Assinaturas de usuários com suporte a múltiplos processadores de pagamento';

-- =====================================================
-- MIGRAÇÃO CAKTO CONCLUÍDA
-- =====================================================
`;

async function executeMigration() {
    try {
        console.log('📊 Executando SQL de migração...');
        
        // Executar SQL de migração
        await db.run(migrationSQL);
        
        console.log('✅ Migração executada com sucesso!\n');
        
        // Verificar tabelas criadas
        console.log('🔍 Verificando tabelas criadas...');
        
        const tables = await db.all(`
            SELECT table_name, table_comment 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('integration_metrics', 'cakto_cache', 'webhook_events', 'webhook_dead_letter_queue', 'subscriptions')
            ORDER BY table_name
        `);
        
        console.log('📋 Tabelas disponíveis:');
        tables.forEach(table => {
            console.log(`   ✅ ${table.table_name}`);
        });
        
        // Verificar colunas da tabela subscriptions
        const columns = await db.all(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'subscriptions' 
            ORDER BY ordinal_position
        `);
        
        console.log('\n📊 Estrutura da tabela subscriptions:');
        columns.forEach(col => {
            console.log(`   📄 ${col.column_name} (${col.data_type})`);
        });
        
        // Verificar índices
        const indexes = await db.all(`
            SELECT indexname, tablename 
            FROM pg_indexes 
            WHERE tablename IN ('subscriptions', 'integration_metrics', 'cakto_cache', 'webhook_events', 'webhook_dead_letter_queue')
            AND schemaname = 'public'
            ORDER BY tablename, indexname
        `);
        
        console.log('\n🔍 Índices criados:');
        indexes.forEach(idx => {
            console.log(`   📇 ${idx.tablename}.${idx.indexname}`);
        });
        
        // Testar inserção de métrica de teste
        await db.run(`
            INSERT INTO integration_metrics (metric_type, metric_value, metric_data) 
            VALUES ('migration_test', 1, '{"test": "successful", "timestamp": "' + new Date().toISOString() + '"}')
        `);
        
        console.log('\n✅ Teste de inserção bem-sucedido!');
        
        // Status final
        console.log('\n🎉 MIGRAÇÃO CAKTO CONCLUÍDA COM SUCESSO!');
        console.log('📊 Sistema pronto para receber webhooks da CAKTO');
        console.log('💳 Database preparado para assinaturas');
        console.log('🔒 Auditoria e cache configurados');
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        console.error('🔍 Detalhes:', error);
        
        // Rollback em caso de erro crítico
        try {
            console.log('\n🔄 Tentando rollback de segurança...');
            // Não fazer rollback automático para evitar perda de dados
            console.log('⚠️  Verifique o erro acima e execute correções manuais se necessário');
        } catch (rollbackError) {
            console.error('❌ Erro no rollback:', rollbackError.message);
        }
        
        return false;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    executeMigration().then(success => {
        if (success) {
            console.log('\n🚀 Próximo passo: Configurar credenciais CAKTO no arquivo .env');
            process.exit(0);
        } else {
            console.log('\n💥 Migração falhou. Verifique os erros acima.');
            process.exit(1);
        }
    });
}

module.exports = { executeMigration, migrationSQL };