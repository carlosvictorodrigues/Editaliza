const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar:', err.message);
        return;
    }
    console.log('Conectado ao banco de dados.');
});

// Testar para o usuário 3@3.com (ID 4)
const userId = 4;
const today = new Date().toISOString().split('T')[0];

console.log(`\n🔍 Testando tarefas atrasadas para usuário ${userId}:`);
console.log(`📅 Data de hoje: ${today}`);

// 1. Primeiro, verificar se existe plano para este usuário
db.get(`
    SELECT id, plan_name, exam_date 
    FROM study_plans 
    WHERE user_id = ? 
    LIMIT 1
`, [userId], (err, plan) => {
    if (err) {
        console.error('❌ Erro ao buscar plano:', err);
        db.close();
        return;
    }
    
    if (!plan) {
        console.log('❌ Nenhum plano encontrado para este usuário');
        db.close();
        return;
    }
    
    console.log(`📋 Plano encontrado: ${plan.plan_name} (ID: ${plan.id})`);
    console.log(`🎯 Data da prova: ${plan.exam_date}`);
    
    const planId = plan.id;
    
    // 2. Verificar total de sessões do usuário
    db.get(`
        SELECT COUNT(*) as total 
        FROM study_sessions s 
        WHERE s.study_plan_id = ?
    `, [planId], (err, row) => {
        if (err) {
            console.error('❌ Erro ao consultar sessões:', err);
        } else {
            console.log(`📊 Total de sessões do plano: ${row.total}`);
        }
    });
    
    // 3. Verificar sessões atrasadas (status Pendente e data anterior a hoje)
    const overdueQuery = `
        SELECT COUNT(*) as count
        FROM study_sessions s
        WHERE s.study_plan_id = ?
        AND DATE(s.session_date) < DATE(?)
        AND s.status = 'Pendente'
    `;
    
    db.get(overdueQuery, [planId, today], (err, row) => {
        if (err) {
            console.error('❌ Erro ao verificar tarefas atrasadas:', err);
        } else {
            console.log(`\n⚠️  Tarefas atrasadas encontradas: ${row.count}`);
            
            // 4. Listar algumas sessões atrasadas para debug
            if (row.count > 0) {
                const overdueSessionsQuery = `
                    SELECT s.id, s.session_date, s.subject_name, s.topic_description, s.session_type, s.status
                    FROM study_sessions s
                    WHERE s.study_plan_id = ?
                    AND DATE(s.session_date) < DATE(?)
                    AND s.status = 'Pendente'
                    ORDER BY s.session_date DESC
                    LIMIT 5
                `;
                
                db.all(overdueSessionsQuery, [planId, today], (err, rows) => {
                    if (err) {
                        console.error('❌ Erro ao listar sessões atrasadas:', err);
                    } else {
                        console.log('\n📝 Exemplos de sessões atrasadas:');
                        rows.forEach((session, index) => {
                            console.log(`${index + 1}. ID: ${session.id} | Data: ${session.session_date}`);
                            console.log(`   📚 ${session.subject_name}: ${session.topic_description}`);
                            console.log(`   📖 Tipo: ${session.session_type} | Status: ${session.status}\n`);
                        });
                    }
                    
                    // 5. Verificar sessões para hoje
                    checkTodaySessions(planId, today);
                });
            } else {
                console.log('✅ Nenhuma tarefa atrasada encontrada!');
                checkTodaySessions(planId, today);
            }
        }
    });
});

function checkTodaySessions(planId, today) {
    db.get(`
        SELECT COUNT(*) as count
        FROM study_sessions s
        WHERE s.study_plan_id = ?
        AND DATE(s.session_date) = DATE(?)
    `, [planId, today], (err, row) => {
        if (err) {
            console.error('❌ Erro ao verificar sessões de hoje:', err);
        } else {
            console.log(`📅 Sessões programadas para hoje: ${row.count}`);
            
            if (row.count > 0) {
                // Mostrar as sessões de hoje
                db.all(`
                    SELECT s.id, s.subject_name, s.topic_description, s.session_type, s.status
                    FROM study_sessions s
                    WHERE s.study_plan_id = ?
                    AND DATE(s.session_date) = DATE(?)
                    ORDER BY s.id
                `, [planId, today], (err, todayRows) => {
                    if (err) {
                        console.error('❌ Erro ao listar sessões de hoje:', err);
                    } else {
                        console.log('\n📖 Sessões de hoje:');
                        todayRows.forEach((session, index) => {
                            console.log(`${index + 1}. ${session.subject_name}: ${session.topic_description}`);
                            console.log(`   Tipo: ${session.session_type} | Status: ${session.status}`);
                        });
                    }
                    
                    db.close(() => console.log('\n✅ Teste concluído.'));
                });
            } else {
                db.close(() => console.log('\n✅ Teste concluído.'));
            }
        }
    });
}