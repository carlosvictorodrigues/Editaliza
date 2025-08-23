const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('db.sqlite');

console.log('=== VERIFICAÇÃO DOS STATUS DAS SESSÕES ===\n');

// Verificar status únicos
db.all('SELECT DISTINCT status FROM study_sessions', (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    
    console.log('Status únicos encontrados na tabela study_sessions:');
    rows.forEach(row => {
        console.log(`  - '${row.status}'`);
    });
    
    // Contar por status
    db.all('SELECT status, COUNT(*) as count FROM study_sessions GROUP BY status', (err, counts) => {
        if (err) {
            console.error('Erro ao contar:', err);
            return;
        }
        
        console.log('\nQuantidade por status:');
        counts.forEach(count => {
            console.log(`  - '${count.status}': ${count.count} sessões`);
        });
        
        // Verificar status dos tópicos também
        db.all('SELECT DISTINCT status FROM topics', (err, topicStatuses) => {
            if (err) {
                console.error('Erro nos tópicos:', err);
                return;
            }
            
            console.log('\nStatus únicos dos tópicos:');
            topicStatuses.forEach(row => {
                console.log(`  - '${row.status}'`);
            });
            
            db.close();
        });
    });
});