// Verificar tempo real da sessão atual
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('=== SESSÃO ATUAL (ID 4526) ===\n');

// Verificar o campo time_studied_seconds
db.get(`
    SELECT 
        id,
        status,
        time_studied_seconds,
        topic_description
    FROM study_sessions 
    WHERE id = 4526
`, (err, session) => {
    if (session) {
        const hours = Math.floor((session.time_studied_seconds || 0) / 3600);
        const minutes = Math.floor(((session.time_studied_seconds || 0) % 3600) / 60);
        const seconds = (session.time_studied_seconds || 0) % 60;
        
        console.log('📚 Dados da Sessão:');
        console.log(`   Status: ${session.status}`);
        console.log(`   Campo time_studied_seconds: ${session.time_studied_seconds}s`);
        console.log(`   Tempo formatado: ${hours}h ${minutes}m ${seconds}s`);
        console.log(`   Tópico: ${(session.topic_description || '').substring(0, 50)}...`);
        console.log('');
    }
    
    // Verificar os logs associados
    db.all(`
        SELECT 
            id,
            start_time,
            end_time,
            duration_seconds,
            created_at
        FROM study_time_logs 
        WHERE session_id = 4526
        ORDER BY created_at DESC
    `, (err, logs) => {
        if (logs && logs.length > 0) {
            console.log('⏱️ Time Logs para esta sessão:\n');
            let totalLogs = 0;
            
            logs.forEach((log, index) => {
                const hours = Math.floor((log.duration_seconds || 0) / 3600);
                const minutes = Math.floor(((log.duration_seconds || 0) % 3600) / 60);
                const seconds = (log.duration_seconds || 0) % 60;
                
                console.log(`   Log ${index + 1} (ID ${log.id}):`);
                console.log(`      Início: ${log.start_time}`);
                console.log(`      Fim: ${log.end_time}`);
                console.log(`      Duração: ${log.duration_seconds}s (${hours}h ${minutes}m ${seconds}s)`);
                console.log(`      Criado em: ${log.created_at}`);
                console.log('');
                
                totalLogs += (log.duration_seconds || 0);
            });
            
            const totalHours = Math.floor(totalLogs / 3600);
            const totalMinutes = Math.floor((totalLogs % 3600) / 60);
            const totalSeconds = totalLogs % 60;
            
            console.log(`📊 Total dos Time Logs: ${totalLogs}s (${totalHours}h ${totalMinutes}m ${totalSeconds}s)`);
            console.log('');
            
            // Verificar timer atual no localStorage (simulação)
            console.log('💡 Nota: O tempo real atual deve estar no timer do navegador (localStorage)');
            console.log('   Se o timer mostra 56min, então esse é o tempo real.');
            console.log('   O banco pode estar desatualizado se o timer não salvou ainda.');
        } else {
            console.log('❌ Nenhum time log encontrado para esta sessão');
        }
        
        // Verificar última atualização
        db.get(`
            SELECT 
                MAX(created_at) as ultima_atualizacao
            FROM study_time_logs 
            WHERE session_id = 4526
        `, (err, result) => {
            if (result && result.ultima_atualizacao) {
                console.log(`\n⏰ Última atualização no banco: ${result.ultima_atualizacao}`);
                
                const lastUpdate = new Date(result.ultima_atualizacao);
                const now = new Date();
                const diffMinutes = Math.floor((now - lastUpdate) / 1000 / 60);
                
                console.log(`   (há ${diffMinutes} minutos atrás)`);
            }
            
            db.close();
        });
    });
});