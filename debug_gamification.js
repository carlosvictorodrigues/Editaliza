const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar ao banco de dados
const dbPath = path.join(__dirname, 'db.sqlite');
console.log('Tentando conectar ao banco:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        return;
    }
    console.log('✅ Conectado ao banco SQLite');
});

console.log('=== INVESTIGAÇÃO DE GAMIFICAÇÃO PARA c@c.com ===\n');

// Função para executar queries de forma assíncrona
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

async function investigateUser() {
    try {
        // Primeiro, vamos listar todas as tabelas disponíveis
        console.log('0. LISTANDO TODAS AS TABELAS...');
        const tables = await runQuery("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tabelas disponíveis:', tables.map(t => t.name).join(', '));
        console.log('');

        // 1. Verificar se o usuário existe - usando a tabela correta
        console.log('1. BUSCANDO USUÁRIO c@c.com...');
        let users = [];
        
        // Tentar diferentes nomes de tabela possíveis
        const possibleUserTables = ['users', 'user', 'User', 'USERS'];
        let userTable = null;
        
        for (const tableName of possibleUserTables) {
            try {
                const testQuery = `SELECT * FROM ${tableName} LIMIT 1`;
                await runQuery(testQuery);
                userTable = tableName;
                console.log(`✅ Tabela de usuários encontrada: ${tableName}`);
                break;
            } catch (err) {
                console.log(`❌ Tabela ${tableName} não existe`);
            }
        }
        
        if (!userTable) {
            console.log('❌ Nenhuma tabela de usuários encontrada!');
            // Vamos mostrar a estrutura de todas as tabelas
            for (const table of tables) {
                console.log(`\nEstrutura da tabela ${table.name}:`);
                try {
                    const structure = await runQuery(`PRAGMA table_info(${table.name})`);
                    structure.forEach(col => {
                        console.log(`  - ${col.name} (${col.type})`);
                    });
                } catch (err) {
                    console.log(`  Erro ao ler estrutura: ${err.message}`);
                }
            }
            return;
        }
        
        // Buscar o usuário na tabela correta
        users = await runQuery(`SELECT * FROM ${userTable} WHERE email = ?`, ['c@c.com']);
        
        if (users.length === 0) {
            console.log('❌ Usuário c@c.com não encontrado!');
            return;
        }
        
        const user = users[0];
        console.log('✅ Usuário encontrado:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Nome: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Criado em: ${user.created_at}\n`);

        // 2. Verificar estrutura das tabelas
        console.log('2. VERIFICANDO ESTRUTURA DAS TABELAS...');
        
        // Verificar tabelas relacionadas à gamificação
        const gamificationTables = tables.filter(t => 
            t.name.includes('gamification') || 
            t.name.includes('achievement') || 
            t.name.includes('session') ||
            t.name.includes('study')
        );
        
        console.log('Tabelas de gamificação:', gamificationTables.map(t => t.name).join(', '));
        console.log('');

        // 3. Verificar dados de gamificação
        console.log('3. DADOS DE GAMIFICAÇÃO...');
        
        // user_gamification
        try {
            const gamification = await runQuery('SELECT * FROM user_gamification WHERE user_id = ?', [user.id]);
            console.log(`user_gamification: ${gamification.length} registros`);
            if (gamification.length > 0) {
                console.log('   Dados:', JSON.stringify(gamification[0], null, 2));
            }
        } catch (err) {
            console.log('❌ Tabela user_gamification não existe ou erro:', err.message);
        }

        // user_achievements
        try {
            const achievements = await runQuery('SELECT * FROM user_achievements WHERE user_id = ?', [user.id]);
            console.log(`user_achievements: ${achievements.length} registros`);
            if (achievements.length > 0) {
                console.log('   Primeiros 3:', JSON.stringify(achievements.slice(0, 3), null, 2));
            }
        } catch (err) {
            console.log('❌ Tabela user_achievements não existe ou erro:', err.message);
        }

        console.log('');

        // 4. Verificar sessões de estudo
        console.log('4. SESSÕES DE ESTUDO...');
        
        try {
            const sessions = await runQuery('SELECT * FROM study_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [user.id]);
            console.log(`study_sessions: ${sessions.length} registros (últimos 10)`);
            if (sessions.length > 0) {
                sessions.forEach((session, index) => {
                    console.log(`   Sessão ${index + 1}:`);
                    console.log(`     ID: ${session.id}`);
                    console.log(`     Duração: ${session.duration_minutes} min`);
                    console.log(`     Concluída: ${session.completed ? 'Sim' : 'Não'}`);
                    console.log(`     Data: ${session.created_at}`);
                    console.log(`     XP ganho: ${session.xp_earned || 'N/A'}`);
                });
            }
        } catch (err) {
            console.log('❌ Tabela study_sessions não existe ou erro:', err.message);
        }

        console.log('');

        // 5. Verificar outras tabelas relacionadas
        console.log('5. OUTRAS TABELAS RELACIONADAS...');
        
        // user_statistics
        try {
            const stats = await runQuery('SELECT * FROM user_statistics WHERE user_id = ?', [user.id]);
            console.log(`user_statistics: ${stats.length} registros`);
            if (stats.length > 0) {
                console.log('   Dados:', JSON.stringify(stats[0], null, 2));
            }
        } catch (err) {
            console.log('❌ Tabela user_statistics não existe ou erro:', err.message);
        }

        // user_progress
        try {
            const progress = await runQuery('SELECT * FROM user_progress WHERE user_id = ?', [user.id]);
            console.log(`user_progress: ${progress.length} registros`);
            if (progress.length > 0) {
                console.log('   Últimos 3:', JSON.stringify(progress.slice(-3), null, 2));
            }
        } catch (err) {
            console.log('❌ Tabela user_progress não existe ou erro:', err.message);
        }

        console.log('');

        // 6. Verificar sessões concluídas especificamente
        console.log('6. ANÁLISE DE SESSÕES CONCLUÍDAS...');
        
        try {
            const completedSessions = await runQuery(
                'SELECT COUNT(*) as total, SUM(duration_minutes) as total_minutes, SUM(xp_earned) as total_xp FROM study_sessions WHERE user_id = ? AND completed = 1', 
                [user.id]
            );
            
            if (completedSessions.length > 0) {
                const stats = completedSessions[0];
                console.log(`   Total de sessões concluídas: ${stats.total}`);
                console.log(`   Total de minutos estudados: ${stats.total_minutes || 0}`);
                console.log(`   Total de XP ganho: ${stats.total_xp || 0}`);
            }
        } catch (err) {
            console.log('❌ Erro ao consultar sessões concluídas:', err.message);
        }

    } catch (error) {
        console.error('❌ Erro durante a investigação:', error);
    } finally {
        db.close();
        console.log('\n=== INVESTIGAÇÃO CONCLUÍDA ===');
    }
}

// Executar a investigação
investigateUser();