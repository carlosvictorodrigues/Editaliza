// Script para analisar detalhadamente o tempo de estudo
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('=== ANÁLISE DETALHADA DO TEMPO DE ESTUDO - c@c.com ===\n');

// 1. Buscar usuário
db.get(`SELECT id, email, name FROM users WHERE email = 'c@c.com'`, (err, user) => {
    if (err || !user) {
        console.error('Erro ou usuário não encontrado');
        db.close();
        return;
    }
    
    console.log('👤 Usuário:', user.name, '(ID:', user.id, ')\n');
    
    // 2. Buscar planos
    db.get(`SELECT id, plan_name FROM study_plans WHERE user_id = ?`, [user.id], (err, plan) => {
        if (err || !plan) {
            console.error('Erro ou plano não encontrado');
            db.close();
            return;
        }
        
        console.log('📋 Plano:', plan.plan_name, '(ID:', plan.id, ')\n');
        
        // 3. Analisar study_sessions
        console.log('📚 ANÁLISE DE STUDY_SESSIONS:');
        console.log('================================');
        
        db.all(`
            SELECT 
                id,
                session_date,
                session_type,
                status,
                time_studied_seconds,
                topic_description
            FROM study_sessions 
            WHERE study_plan_id = ?
            ORDER BY session_date DESC
        `, [plan.id], (err, sessions) => {
            if (!err && sessions) {
                let totalFromSessions = 0;
                sessions.forEach(session => {
                    if (session.time_studied_seconds) {
                        totalFromSessions += session.time_studied_seconds;
                        const hours = Math.floor(session.time_studied_seconds / 3600);
                        const minutes = Math.floor((session.time_studied_seconds % 3600) / 60);
                        console.log(`  Sessão ${session.id}: ${session.session_date}`);
                        console.log(`    Status: ${session.status}`);
                        console.log(`    Tempo: ${session.time_studied_seconds}s (${hours}h ${minutes}m)`);
                        console.log(`    Tópico: ${session.topic_description?.substring(0, 50)}...`);
                        console.log('');
                    }
                });
                
                const totalHours = Math.floor(totalFromSessions / 3600);
                const totalMinutes = Math.floor((totalFromSessions % 3600) / 60);
                console.log(`📊 TOTAL DE STUDY_SESSIONS: ${totalFromSessions}s (${totalHours}h ${totalMinutes}m)\n`);
            }
            
            // 4. Analisar study_time_logs
            console.log('⏱️ ANÁLISE DE STUDY_TIME_LOGS:');
            console.log('================================');
            
            db.all(`
                SELECT 
                    stl.id,
                    stl.session_id,
                    stl.start_time,
                    stl.end_time,
                    stl.duration_seconds,
                    stl.created_at
                FROM study_time_logs stl
                JOIN study_sessions ss ON stl.session_id = ss.id
                WHERE ss.study_plan_id = ?
                ORDER BY stl.created_at DESC
            `, [plan.id], (err, logs) => {
                if (!err && logs) {
                    let totalFromLogs = 0;
                    logs.forEach(log => {
                        if (log.duration_seconds) {
                            totalFromLogs += log.duration_seconds;
                            const hours = Math.floor(log.duration_seconds / 3600);
                            const minutes = Math.floor((log.duration_seconds % 3600) / 60);
                            console.log(`  Log ${log.id} (Sessão ${log.session_id}):`);
                            console.log(`    Período: ${log.start_time} até ${log.end_time}`);
                            console.log(`    Duração: ${log.duration_seconds}s (${hours}h ${minutes}m)`);
                            console.log('');
                        }
                    });
                    
                    const totalHours = Math.floor(totalFromLogs / 3600);
                    const totalMinutes = Math.floor((totalFromLogs % 3600) / 60);
                    console.log(`📊 TOTAL DE TIME_LOGS: ${totalFromLogs}s (${totalHours}h ${totalMinutes}m)\n`);
                    
                    // 5. Verificar se há duplicação
                    console.log('🔍 ANÁLISE DE POSSÍVEL DUPLICAÇÃO:');
                    console.log('====================================');
                    
                    db.all(`
                        SELECT 
                            ss.id as session_id,
                            ss.time_studied_seconds,
                            COUNT(stl.id) as log_count,
                            SUM(stl.duration_seconds) as total_log_time
                        FROM study_sessions ss
                        LEFT JOIN study_time_logs stl ON stl.session_id = ss.id
                        WHERE ss.study_plan_id = ?
                        GROUP BY ss.id
                        HAVING ss.time_studied_seconds IS NOT NULL OR COUNT(stl.id) > 0
                    `, [plan.id], (err, analysis) => {
                        if (!err && analysis) {
                            analysis.forEach(item => {
                                if (item.time_studied_seconds && item.total_log_time) {
                                    console.log(`  ⚠️ Sessão ${item.session_id}:`);
                                    console.log(`     - Tempo em study_sessions: ${item.time_studied_seconds}s`);
                                    console.log(`     - Tempo em time_logs: ${item.total_log_time}s`);
                                    console.log(`     - Logs associados: ${item.log_count}`);
                                    console.log(`     → Possível duplicação!`);
                                    console.log('');
                                }
                            });
                        }
                        
                        db.close();
                    });
                }
            });
        });
    });
});