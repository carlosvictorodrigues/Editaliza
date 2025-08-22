#!/usr/bin/env node

/**
 * Script simples para criar tabelas CAKTO no banco de produção
 */

const db = require('./database-postgresql');

console.log('🚀 Criando tabelas CAKTO...');

const createTables = async () => {
  try {
    // 1. Criar tabela subscriptions
    console.log('📋 Criando tabela subscriptions...');
    await db.run(`
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
        cakto_transaction_id VARCHAR(255),
        payment_processor VARCHAR(50) DEFAULT 'cakto',
        metadata JSONB DEFAULT '{}'
      )
    `);
    console.log('✅ Tabela subscriptions criada');

    // 2. Criar índices para subscriptions
    await db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_cakto_id ON subscriptions(cakto_transaction_id)`);
    console.log('✅ Índices da subscriptions criados');

    // 3. Criar tabela webhook_events
    console.log('📋 Criando tabela webhook_events...');
    await db.run(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        webhook_id VARCHAR(255) UNIQUE NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        processing_id UUID,
        raw_payload JSONB NOT NULL,
        payment_processor VARCHAR(50) DEFAULT 'cakto',
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log('✅ Tabela webhook_events criada');

    // 4. Criar índices para webhook_events
    await db.run(`CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type)`);
    console.log('✅ Índices da webhook_events criados');

    // 5. Criar tabela integration_metrics
    console.log('📋 Criando tabela integration_metrics...');
    await db.run(`
      CREATE TABLE IF NOT EXISTS integration_metrics (
        id SERIAL PRIMARY KEY,
        metric_type VARCHAR(100) NOT NULL,
        metric_value DECIMAL(10,2) NOT NULL,
        metric_data JSONB DEFAULT '{}',
        entity_id VARCHAR(255),
        entity_type VARCHAR(100),
        source VARCHAR(50) DEFAULT 'cakto',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Tabela integration_metrics criada');

    // 6. Inserir métrica inicial
    await db.run(`
      INSERT INTO integration_metrics (metric_type, metric_value, metric_data) 
      VALUES ('cakto_setup', 1.0, '{"status": "tables_created", "date": "' + new Date().toISOString() + '"}')
    `);
    console.log('✅ Métrica inicial inserida');
    
    // 7. Verificar se tudo foi criado
    const tables = await db.all(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subscriptions', 'webhook_events', 'integration_metrics')
      ORDER BY table_name
    `);
    
    console.log('\n🎉 TABELAS CAKTO CRIADAS COM SUCESSO:');
    tables.forEach(table => {
      console.log(`   ✅ ${table.table_name}`);
    });
    
    console.log('\n🚀 Sistema pronto para receber webhooks CAKTO!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
    console.error('📋 Detalhes:', error);
    process.exit(1);
  }
};

createTables();