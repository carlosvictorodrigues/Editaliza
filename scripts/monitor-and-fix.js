#!/usr/bin/env node

/**
 * Script de monitoramento com auto-correção
 * Detecta e corrige problemas comuns automaticamente
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { Client } = require('pg');

// Configuração
const PM2_APP_NAME = 'editaliza-app';
const MAX_RESTARTS_THRESHOLD = 5;
const MAX_MEMORY_MB = 400;

// Configuração do banco
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || 'Editaliza@2025#Secure'
};

const problems = [];
const fixes = [];

async function checkPM2Status() {
    console.log('\n🔍 Verificando status do PM2...');
    
    try {
        const { stdout } = await execAsync('pm2 jlist');
        const apps = JSON.parse(stdout);
        
        const app = apps.find(a => a.name === PM2_APP_NAME);
        
        if (!app) {
            problems.push('Aplicação não está rodando no PM2');
            
            // Auto-fix: Iniciar aplicação
            console.log('🔧 Iniciando aplicação...');
            await execAsync(`pm2 start ecosystem.config.js`);
            fixes.push('Aplicação iniciada no PM2');
            return;
        }
        
        // Verificar restarts excessivos
        if (app.pm2_env.restart_time > MAX_RESTARTS_THRESHOLD) {
            problems.push(`Restarts excessivos: ${app.pm2_env.restart_time}`);
            
            // Auto-fix: Reset restart counter e investigar logs
            console.log('🔧 Resetando contador de restarts...');
            await execAsync(`pm2 reset ${PM2_APP_NAME}`);
            fixes.push('Contador de restarts resetado');
            
            // Salvar últimos logs para análise
            const { stdout: logs } = await execAsync(`pm2 logs ${PM2_APP_NAME} --lines 100 --nostream --err`);
            require('fs').writeFileSync('logs/last-error-analysis.log', logs);
            fixes.push('Logs de erro salvos para análise');
        }
        
        // Verificar uso de memória
        const memoryMB = app.monit.memory / (1024 * 1024);
        if (memoryMB > MAX_MEMORY_MB) {
            problems.push(`Uso excessivo de memória: ${memoryMB.toFixed(2)}MB`);
            
            // Auto-fix: Restart graceful
            console.log('🔧 Reiniciando aplicação (memory leak)...');
            await execAsync(`pm2 restart ${PM2_APP_NAME}`);
            fixes.push('Aplicação reiniciada devido a memory leak');
        }
        
        // Verificar se está online
        if (app.pm2_env.status !== 'online') {
            problems.push(`Status anormal: ${app.pm2_env.status}`);
            
            // Auto-fix: Tentar reiniciar
            console.log('🔧 Tentando reiniciar aplicação...');
            await execAsync(`pm2 restart ${PM2_APP_NAME}`);
            fixes.push('Aplicação reiniciada');
        }
        
        console.log(`✅ PM2: ${app.pm2_env.status} | Restarts: ${app.pm2_env.restart_time} | Mem: ${memoryMB.toFixed(2)}MB`);
        
    } catch (error) {
        console.error('❌ Erro ao verificar PM2:', error.message);
        problems.push('PM2 não está acessível');
    }
}

async function checkDatabaseTables() {
    console.log('\n🔍 Verificando tabelas do banco...');
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        
        // Verificar e criar tabela sessions se não existir
        const sessionCheck = await client.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'sessions'
        `);
        
        if (sessionCheck.rows[0].count === '0') {
            problems.push('Tabela sessions não existe');
            
            // Auto-fix: Criar tabela
            console.log('🔧 Criando tabela sessions...');
            await client.query(`
                CREATE TABLE sessions (
                    sid VARCHAR NOT NULL PRIMARY KEY,
                    sess JSON NOT NULL,
                    expire TIMESTAMP(6) NOT NULL
                )
            `);
            await client.query(`
                CREATE INDEX IDX_session_expire ON sessions (expire)
            `);
            fixes.push('Tabela sessions criada');
        }
        
        // Limpar sessões expiradas (manutenção)
        const deleted = await client.query(`
            DELETE FROM sessions 
            WHERE expire < NOW() - INTERVAL '24 hours'
            RETURNING sid
        `);
        
        if (deleted.rowCount > 0) {
            console.log(`🧹 ${deleted.rowCount} sessões antigas removidas`);
            fixes.push(`${deleted.rowCount} sessões expiradas limpas`);
        }
        
        console.log('✅ Banco de dados OK');
        
    } catch (error) {
        console.error('❌ Erro no banco:', error.message);
        problems.push(`Erro no banco: ${error.message}`);
    } finally {
        await client.end();
    }
}

async function checkDiskSpace() {
    console.log('\n🔍 Verificando espaço em disco...');
    
    try {
        const { stdout } = await execAsync('df -h / | tail -1');
        const parts = stdout.trim().split(/\s+/);
        const usagePercent = parseInt(parts[4]);
        
        if (usagePercent > 80) {
            problems.push(`Disco quase cheio: ${usagePercent}%`);
            
            // Auto-fix: Limpar logs antigos
            console.log('🔧 Limpando logs antigos...');
            await execAsync('find /root/.pm2/logs -name "*.log" -mtime +7 -delete');
            await execAsync('pm2 flush');
            fixes.push('Logs antigos removidos');
        }
        
        console.log(`✅ Espaço em disco: ${usagePercent}% usado`);
        
    } catch (error) {
        console.error('❌ Erro ao verificar disco:', error.message);
    }
}

async function checkResponseTime() {
    console.log('\n🔍 Verificando tempo de resposta...');
    
    try {
        const start = Date.now();
        const fetch = require('node-fetch');
        const response = await fetch('https://app.editaliza.com.br/health', {
            timeout: 5000
        });
        const responseTime = Date.now() - start;
        
        if (responseTime > 3000) {
            problems.push(`Tempo de resposta alto: ${responseTime}ms`);
            
            // Auto-fix: Restart do nginx se necessário
            if (responseTime > 5000) {
                console.log('🔧 Reiniciando Nginx...');
                await execAsync('systemctl restart nginx');
                fixes.push('Nginx reiniciado');
            }
        }
        
        console.log(`✅ Tempo de resposta: ${responseTime}ms`);
        
    } catch (error) {
        console.error('❌ Servidor não respondeu:', error.message);
        problems.push('Servidor não está respondendo');
        
        // Auto-fix crítico: Tentar reiniciar tudo
        console.log('🔧 Tentando recuperação de emergência...');
        await execAsync(`pm2 restart ${PM2_APP_NAME}`);
        fixes.push('Tentativa de recuperação executada');
    }
}

async function generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO DE MONITORAMENTO');
    console.log('='.repeat(60));
    console.log(`Horário: ${new Date().toLocaleString('pt-BR')}`);
    
    if (problems.length === 0) {
        console.log('\n✅ Nenhum problema detectado!');
    } else {
        console.log('\n⚠️  Problemas detectados:');
        problems.forEach(p => console.log(`   - ${p}`));
    }
    
    if (fixes.length > 0) {
        console.log('\n🔧 Correções aplicadas:');
        fixes.forEach(f => console.log(`   - ${f}`));
    }
    
    // Salvar relatório
    const report = {
        timestamp: new Date().toISOString(),
        problems,
        fixes,
        status: problems.length === 0 ? 'healthy' : 'issues_found'
    };
    
    const fs = require('fs');
    const reportPath = `logs/monitor-report-${Date.now()}.json`;
    
    // Criar diretório logs se não existir
    if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Relatório salvo em: ${reportPath}`);
    
    return problems.length === 0;
}

async function runMonitoring() {
    console.log('🏥 MONITORAMENTO AUTOMÁTICO - EDITALIZA');
    console.log('Iniciado em:', new Date().toLocaleString('pt-BR'));
    
    await checkPM2Status();
    await checkDatabaseTables();
    await checkDiskSpace();
    await checkResponseTime();
    
    const isHealthy = await generateReport();
    
    // Se houver problemas críticos, notificar
    if (!isHealthy && problems.length > 2) {
        console.log('\n🚨 ALERTA: Múltiplos problemas detectados!');
        // Aqui você poderia adicionar notificação por email/telegram
    }
    
    process.exit(isHealthy ? 0 : 1);
}

// Executar se chamado diretamente
if (require.main === module) {
    runMonitoring();
}

module.exports = { runMonitoring };