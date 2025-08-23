const db = require('./database.js');

console.log('🔍 Testando importação do banco de dados...');

// Testar se o db está funcionando
db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
        console.error('❌ Erro ao testar banco:', err.message);
    } else {
        console.log('✅ Banco de dados funcionando!');
        console.log('Usuários no banco:', row.count);
        
        // Testar a query específica
        db.all(`
            SELECT t.*, s.subject_name 
            FROM topics t 
            JOIN subjects s ON t.subject_id = s.id 
            WHERE s.study_plan_id = ?
            ORDER BY t.id ASC
        `, [1], (err, rows) => {
            if (err) {
                console.error('❌ Erro na query específica:', err.message);
            } else {
                console.log('✅ Query específica funcionando!');
                console.log('Tópicos encontrados:', rows.length);
                
                const completed = rows.filter(t => t.status === 'Concluído').length;
                console.log('Tópicos concluídos:', completed);
            }
            
            // Fechar conexão
            db.close((err) => {
                if (err) {
                    console.error('Erro ao fechar:', err.message);
                } else {
                    console.log('✅ Conexão fechada');
                }
            });
        });
    }
}); 