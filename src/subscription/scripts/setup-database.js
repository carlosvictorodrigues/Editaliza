#!/usr/bin/env node
// setup-database.js - Script para configurar banco de dados do sistema de assinaturas

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Importar configurações
require('dotenv').config();
const db = require('../utils/database');
const AuditModel = require('../models/audit');

class DatabaseSetup {
    constructor() {
        this.migrationsPath = path.join(__dirname, '../migrations');
        this.verbose = process.argv.includes('--verbose');
        this.force = process.argv.includes('--force');
    }

    /**
     * Executa setup completo do banco
     */
    async setup() {
        try {
            console.log('🚀 Iniciando setup do banco de dados para sistema de assinaturas...');
            
            // 1. Verificar estrutura atual
            await this.checkCurrentStructure();
            
            // 2. Executar migrações
            await this.runMigrations();
            
            // 3. Inserir dados iniciais
            await this.seedInitialData();
            
            // 4. Verificar integridade
            await this.verifyIntegrity();
            
            // 5. Criar índices de performance
            await this.createPerformanceIndexes();
            
            console.log('✅ Setup do banco de dados concluído com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro durante setup do banco:', error.message);
            if (this.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Verifica estrutura atual do banco
     */
    async checkCurrentStructure() {
        console.log('🔍 Verificando estrutura atual do banco...');
        
        try {
            // Verificar se tabelas principais existem
            const tables = await db.all(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            );
            
            const tableNames = tables.map(t => t.name);
            const requiredTables = ['users'];
            const missingTables = requiredTables.filter(table => !tableNames.includes(table));
            
            if (missingTables.length > 0) {
                throw new Error(`Tabelas principais ausentes: ${missingTables.join(', ')}`);
            }
            
            console.log(`  ✓ Encontradas ${tableNames.length} tabelas existentes`);
            
            // Verificar se já tem tabelas de assinatura
            const subscriptionTables = tableNames.filter(name => 
                name.includes('subscription') || name.includes('webhook') || name.includes('audit')
            );
            
            if (subscriptionTables.length > 0 && !this.force) {
                console.log(`  ⚠️  Tabelas de assinatura já existem: ${subscriptionTables.join(', ')}`);
                console.log('  Use --force para recriar as tabelas');
                return false;
            }
            
            return true;
            
        } catch (error) {
            throw new Error(`Erro ao verificar estrutura: ${error.message}`);
        }
    }

    /**
     * Executa migrações
     */
    async runMigrations() {
        console.log('📁 Executando migrações...');
        
        try {
            // Ler arquivos de migração
            const migrationFiles = fs.readdirSync(this.migrationsPath)
                .filter(file => file.endsWith('.sql'))
                .sort();
            
            if (migrationFiles.length === 0) {
                console.log('  ⚠️  Nenhum arquivo de migração encontrado');
                return;
            }
            
            console.log(`  📄 Encontrados ${migrationFiles.length} arquivos de migração`);
            
            for (const file of migrationFiles) {
                console.log(`  🔄 Executando ${file}...`);
                
                const migrationPath = path.join(this.migrationsPath, file);
                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                
                // Dividir em statements individuais
                const statements = migrationSQL
                    .split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
                
                for (const statement of statements) {
                    try {
                        await db.run(statement);
                    } catch (error) {
                        if (!error.message.includes('already exists') || this.verbose) {
                            console.warn(`    ⚠️  Aviso: ${error.message}`);
                        }
                    }
                }
                
                console.log(`    ✓ ${file} executado com sucesso`);
            }
            
        } catch (error) {
            throw new Error(`Erro ao executar migrações: ${error.message}`);
        }
    }

    /**
     * Insere dados iniciais
     */
    async seedInitialData() {
        console.log('🌱 Inserindo dados iniciais...');
        
        try {
            // Configurar settings padrão se não existirem
            const defaultSettings = {
                'webhook_retry_max_attempts': '3',
                'webhook_retry_initial_delay': '1000',
                'subscription_grace_period_days': '3',
                'cache_ttl_seconds': '300',
                'audit_retention_days': '2555',
                'system_version': '1.0.0',
                'last_backup': null,
                'maintenance_mode': 'false'
            };
            
            for (const [key, value] of Object.entries(defaultSettings)) {
                await db.run(
                    `INSERT OR IGNORE INTO subscription_settings 
                     (key, value, description, updated_at) 
                     VALUES (?, ?, ?, ?)`,
                    [
                        key,
                        value,
                        this.getSettingDescription(key),
                        new Date().toISOString()
                    ]
                );
            }
            
            // Registrar evento de setup
            await AuditModel.logEvent({
                entityType: 'SYSTEM',
                entityId: 'database_setup',
                action: 'INITIAL_SETUP',
                userId: null,
                details: {
                    version: defaultSettings.system_version,
                    setupTime: new Date().toISOString(),
                    tablesCreated: true,
                    settingsInitialized: true
                },
                severity: 'INFO'
            });
            
            console.log('  ✓ Dados iniciais inseridos');
            
        } catch (error) {
            throw new Error(`Erro ao inserir dados iniciais: ${error.message}`);
        }
    }

    /**
     * Verifica integridade do banco
     */
    async verifyIntegrity() {
        console.log('🔒 Verificando integridade do banco...');
        
        try {
            // Verificar foreign keys
            const pragmaResult = await db.get('PRAGMA foreign_key_check');
            if (pragmaResult) {
                console.warn('  ⚠️  Problemas de foreign key detectados');
                if (this.verbose) {
                    console.log(pragmaResult);
                }
            }
            
            // Verificar índices
            const indexes = await db.all(
                "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
            );
            console.log(`  ✓ ${indexes.length} índices encontrados`);
            
            // Verificar triggers
            const triggers = await db.all(
                "SELECT name FROM sqlite_master WHERE type='trigger'"
            );
            console.log(`  ✓ ${triggers.length} triggers encontrados`);
            
            // Verificar views
            const views = await db.all(
                "SELECT name FROM sqlite_master WHERE type='view'"
            );
            console.log(`  ✓ ${views.length} views encontradas`);
            
            // Teste de integridade SQLite
            const integrityCheck = await db.get('PRAGMA integrity_check');
            if (integrityCheck.integrity_check !== 'ok') {
                throw new Error(`Falha na verificação de integridade: ${integrityCheck.integrity_check}`);
            }
            
            console.log('  ✓ Integridade do banco verificada');
            
        } catch (error) {
            throw new Error(`Erro na verificação de integridade: ${error.message}`);
        }
    }

    /**
     * Cria índices adicionais para performance
     */
    async createPerformanceIndexes() {
        console.log('⚡ Criando índices de performance...');
        
        const additionalIndexes = [
            // Índices compostos para queries comuns
            'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status)',
            'CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires ON subscriptions(status, expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_audit_events_entity_action ON audit_events(entity_type, action)',
            'CREATE INDEX IF NOT EXISTS idx_webhook_events_type_status ON webhook_events(event_type, status)',
            
            // Índices para performance de data
            'CREATE INDEX IF NOT EXISTS idx_subscriptions_created_month ON subscriptions(date(created_at))',
            'CREATE INDEX IF NOT EXISTS idx_audit_events_created_day ON audit_events(date(created_at))',
            
            // Índices para auditoria
            'CREATE INDEX IF NOT EXISTS idx_audit_events_user_action ON audit_events(user_id, action)',
            'CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_date ON subscription_audit_logs(date(created_at))'
        ];
        
        try {
            for (const indexSQL of additionalIndexes) {
                await db.run(indexSQL);
            }
            
            console.log(`  ✓ ${additionalIndexes.length} índices de performance criados`);
            
        } catch (error) {
            console.warn(`  ⚠️  Erro ao criar alguns índices: ${error.message}`);
        }
    }

    /**
     * Obtém descrição para uma configuração
     */
    getSettingDescription(key) {
        const descriptions = {
            'webhook_retry_max_attempts': 'Máximo de tentativas para reprocessar webhooks',
            'webhook_retry_initial_delay': 'Delay inicial para retry de webhooks (ms)',
            'subscription_grace_period_days': 'Período de graça após expiração (dias)',
            'cache_ttl_seconds': 'TTL padrão do cache (segundos)',
            'audit_retention_days': 'Retenção de logs de auditoria (dias)',
            'system_version': 'Versão do sistema de assinaturas',
            'last_backup': 'Data do último backup realizado',
            'maintenance_mode': 'Modo de manutenção ativo'
        };
        
        return descriptions[key] || 'Configuração do sistema';
    }

    /**
     * Cria backup antes de modificar estrutura
     */
    async createBackup() {
        if (this.force) {
            console.log('💾 Criando backup de segurança...');
            
            const backupPath = path.join(
                __dirname,
                '../../../backups',
                `subscription-setup-backup-${Date.now()}.sqlite`
            );
            
            try {
                // Certificar que diretório existe
                const backupDir = path.dirname(backupPath);
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                
                // Copiar arquivo do banco
                const dbPath = process.env.DATABASE_PATH || './db.sqlite';
                fs.copyFileSync(dbPath, backupPath);
                
                console.log(`  ✓ Backup criado: ${backupPath}`);
                
            } catch (error) {
                console.warn(`  ⚠️  Erro ao criar backup: ${error.message}`);
            }
        }
    }

    /**
     * Executa testes de funcionamento
     */
    async runTests() {
        console.log('🧪 Executando testes de funcionamento...');
        
        try {
            // Teste 1: Criar assinatura de teste
            console.log('  🔄 Testando criação de assinatura...');
            
            const SubscriptionModel = require('../models/subscription');
            
            // Verificar se existe usuário de teste
            let testUser = await db.get('SELECT id FROM users WHERE email = ?', ['test@editaliza.com']);
            
            if (!testUser) {
                // Criar usuário de teste
                await db.run(
                    'INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)',
                    ['Test User', 'test@editaliza.com', 'test_password', new Date().toISOString()]
                );
                
                testUser = await db.get('SELECT id FROM users WHERE email = ?', ['test@editaliza.com']);
            }
            
            // Criar assinatura de teste
            const testSubscription = await SubscriptionModel.create({
                userId: testUser.id,
                kiwifyTransactionId: `test_txn_${Date.now()}`,
                kiwifyProductId: 'test_product',
                plan: 'premium',
                status: 'active',
                amount: 97.00,
                currency: 'BRL',
                paymentMethod: 'test',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                metadata: {
                    test: true,
                    setupTest: true
                }
            });
            
            console.log(`    ✓ Assinatura de teste criada: ${testSubscription.id}`);
            
            // Teste 2: Verificar busca de assinatura
            const foundSubscription = await SubscriptionModel.findById(testSubscription.id);
            if (!foundSubscription) {
                throw new Error('Falha ao buscar assinatura criada');
            }
            
            console.log('    ✓ Busca de assinatura funcionando');
            
            // Teste 3: Testar auditoria
            await AuditModel.logEvent({
                entityType: 'TEST',
                entityId: 'setup_test',
                action: 'FUNCTIONALITY_TEST',
                userId: testUser.id,
                details: {
                    testType: 'database_setup',
                    success: true
                },
                severity: 'INFO'
            });
            
            console.log('    ✓ Sistema de auditoria funcionando');
            
            // Limpar dados de teste
            await db.run('DELETE FROM subscriptions WHERE id = ?', [testSubscription.id]);
            await db.run('DELETE FROM users WHERE email = ?', ['test@editaliza.com']);
            await db.run('DELETE FROM audit_events WHERE entity_type = ?', ['TEST']);
            
            console.log('  ✓ Todos os testes passaram');
            
        } catch (error) {
            throw new Error(`Falha nos testes: ${error.message}`);
        }
    }

    /**
     * Gera relatório de setup
     */
    async generateReport() {
        console.log('📊 Gerando relatório de setup...');
        
        try {
            const tables = await db.all(
                "SELECT name, sql FROM sqlite_master WHERE type='table' AND name LIKE '%subscription%' OR name LIKE '%webhook%' OR name LIKE '%audit%'"
            );
            
            const indexes = await db.all(
                "SELECT name FROM sqlite_master WHERE type='index' AND (name LIKE '%subscription%' OR name LIKE '%webhook%' OR name LIKE '%audit%')"
            );
            
            const settings = await db.all('SELECT key, value FROM subscription_settings');
            
            const report = {
                timestamp: new Date().toISOString(),
                database: {
                    tables: tables.length,
                    indexes: indexes.length,
                    settings: settings.length
                },
                tables: tables.map(t => t.name),
                indexes: indexes.map(i => i.name),
                settings: settings.reduce((acc, s) => {
                    acc[s.key] = s.value;
                    return acc;
                }, {})
            };
            
            const reportPath = path.join(__dirname, '../../../logs', `setup-report-${Date.now()}.json`);
            
            // Certificar que diretório existe
            const reportDir = path.dirname(reportPath);
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
            
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            
            console.log(`  ✓ Relatório salvo: ${reportPath}`);
            
        } catch (error) {
            console.warn(`  ⚠️  Erro ao gerar relatório: ${error.message}`);
        }
    }
}

// Executar setup se chamado diretamente
if (require.main === module) {
    const setup = new DatabaseSetup();
    
    setup.setup()
        .then(() => {
            console.log('\n🎉 Setup concluído com sucesso!');
            console.log('\nPróximos passos:');
            console.log('1. Configure as variáveis de ambiente do Kiwify');
            console.log('2. Configure o Redis (opcional, mas recomendado)');
            console.log('3. Execute os testes: npm run test:subscription');
            console.log('4. Inicie o servidor: npm start');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Setup falhou:', error.message);
            process.exit(1);
        });
}

module.exports = DatabaseSetup;