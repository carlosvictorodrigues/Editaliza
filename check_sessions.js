// Verificar detalhes das sessões
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

db.get(`SELECT id FROM users WHERE email = 'c@c.com'`, (err, user) => {
    if (!user) return;
    
    db.get(`SELECT id FROM study_plans WHERE user_id = ?`, [user.id], (err, plan) => {
        if (!plan) return;
        
        console.log('=== SESSÕES DE ESTUDO ===\n');
        
        // Buscar todas as sessões
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
            ORDER BY id ASC
        `, [plan.id], (err, sessions) => {
            
            let totalConcluido = 0;
            let totalPendente = 0;
            let sessoesCompletas = 0;
            let sessoesPendentes = 0;
            
            sessions.forEach((session, index) => {
                const hours = Math.floor((session.time_studied_seconds || 0) / 3600);
                const minutes = Math.floor(((session.time_studied_seconds || 0) % 3600) / 60);
                
                console.log(`${index + 1}ª Sessão (ID ${session.id}):`);
                console.log(`   Status: ${session.status}`);
                console.log(`   Tempo: ${hours}h ${minutes}m (${session.time_studied_seconds || 0}s)`);
                console.log(`   Tópico: ${(session.topic_description || '').substring(0, 50)}...`);
                console.log('');
                
                if (session.status === 'Concluído') {
                    totalConcluido += (session.time_studied_seconds || 0);
                    sessoesCompletas++;
                } else if (session.status === 'Pendente') {
                    totalPendente += (session.time_studied_seconds || 0);
                    sessoesPendentes++;
                }
            });
            
            const horasConcluidas = Math.floor(totalConcluido / 3600);
            const minutosConcluidos = Math.floor((totalConcluido % 3600) / 60);
            
            const horasPendentes = Math.floor(totalPendente / 3600);
            const minutosPendentes = Math.floor((totalPendente % 3600) / 60);
            
            const totalGeral = totalConcluido + totalPendente;
            const horasTotal = Math.floor(totalGeral / 3600);
            const minutosTotal = Math.floor((totalGeral % 3600) / 60);
            
            console.log('=== RESUMO ===');
            console.log(`✅ Sessões Concluídas: ${sessoesCompletas}`);
            console.log(`   Tempo: ${horasConcluidas}h ${minutosConcluidos}m`);
            console.log('');
            console.log(`⏳ Sessões Pendentes/Em Andamento: ${sessoesPendentes}`);
            console.log(`   Tempo: ${horasPendentes}h ${minutosPendentes}m`);
            console.log('');
            console.log(`📊 TOTAL GERAL: ${horasTotal}h ${minutosTotal}m`);
            
            db.close();
        });
    });
});