const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configurar o caminho do banco
const dbPath = path.join(__dirname, 'db.sqlite');
console.log('Conectando ao banco:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar:', err.message);
        return;
    }
    console.log('Conectado ao banco de dados.');
});

// Testar para o usuário 3@3.com (ID 4)
const userId = 4;
const planId = 1005; // Plano TJPE 2025 (Restored)

console.log(`\nTestando tarefas atrasadas para usuário ${userId}, plano ${planId}:`);

const today = new Date().toISOString().split('T')[0];
console.log(`Data de hoje: ${today}`);

// 1. Verificar sessões do usuário
db.get(`
    SELECT COUNT(*) as total 
    FROM study_sessions s 
    JOIN study_plans p ON s.plan_id = p.id 
    WHERE p.user_id = ?
`, [userId], (err, row) => {
    if (err) {
        console.error('Erro ao consultar sessões:', err);
        return;
    }
    console.log(`Total de sessões do usuário: ${row.total}`);
});

// 2. Verificar sessões atrasadas (usando study_sessions)
const overdueQuery = `
    SELECT COUNT(*) as count
    FROM study_sessions s
    JOIN study_plans p ON s.plan_id = p.id
    WHERE p.id = ? 
    AND p.user_id = ?
    AND DATE(s.session_date) < DATE(?)
    AND (s.completed_at IS NULL OR s.completed_at = '')
    AND (s.status IS NULL OR s.status != 'completed')
`;

db.get(overdueQuery, [planId, userId, today], (err, row) => {
    if (err) {
        console.error('Erro ao verificar tarefas atrasadas:', err);
        return;
    }
    console.log(`Tarefas atrasadas encontradas: ${row.count}`);
    
    // 3. Listar algumas sessões atrasadas
    if (row.count > 0) {
        const overdueSessionsQuery = `
            SELECT s.id, s.session_date, s.topic_id, s.session_type, s.completed_at, s.status
            FROM study_sessions s
            JOIN study_plans p ON s.plan_id = p.id
            WHERE p.id = ? 
            AND p.user_id = ?
            AND DATE(s.session_date) < DATE(?)
            AND (s.completed_at IS NULL OR s.completed_at = '')
            AND (s.status IS NULL OR s.status != 'completed')
            LIMIT 5
        `;
        
        db.all(overdueSessionsQuery, [planId, userId, today], (err, rows) => {
            if (err) {
                console.error('Erro ao listar sessões atrasadas:', err);
                return;
            }
            console.log('\nExemplos de sessões atrasadas:');
            rows.forEach((session, index) => {
                console.log(`${index + 1}. ID: ${session.id}, Data: ${session.session_date}, Tópico ID: ${session.topic_id}`);
                console.log(`   Tipo: ${session.session_type}, Completed: ${session.completed_at}, Status: ${session.status}`);
            });
            
            // Fechar conexão após todas as consultas
            db.close((err) => {
                if (err) {
                    console.error('Erro ao fechar conexão:', err.message);
                } else {
                    console.log('\nConexão com o banco fechada.');
                }
            });
        });
    } else {
        // Fechar conexão se não há tarefas atrasadas
        db.close((err) => {
            if (err) {
                console.error('Erro ao fechar conexão:', err.message);
            } else {
                console.log('\nConexão com o banco fechada.');
            }
        });
    }
});

// 4. Verificar sessões para hoje
db.get(`
    SELECT COUNT(*) as count
    FROM study_sessions s
    JOIN study_plans p ON s.plan_id = p.id
    WHERE p.id = ? 
    AND p.user_id = ?
    AND DATE(s.session_date) = DATE(?)
`, [planId, userId, today], (err, row) => {
    if (err) {
        console.error('Erro ao verificar sessões de hoje:', err);
        return;
    }
    console.log(`Sessões para hoje: ${row.count}`);
});