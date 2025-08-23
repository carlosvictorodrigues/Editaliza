const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Erro:', err.message);
        return;
    }
    console.log('Conectado ao banco');
});

// Testar a query que está causando erro
const query = `
    SELECT t.*, s.subject_name 
    FROM topics t 
    JOIN subjects s ON t.subject_id = s.id 
    WHERE s.study_plan_id = ?
    ORDER BY t.id ASC
`;

console.log('🔍 Testando query...');
console.log('Query:', query);

db.all(query, [1], (err, results) => {
    if (err) {
        console.error('❌ Erro na query:', err.message);
    } else {
        console.log(`✅ Query executada com sucesso!`);
        console.log(`📊 Resultados encontrados: ${results.length}`);
        
        if (results.length > 0) {
            let completed = 0;
            let pending = 0;
            
            results.forEach(topic => {
                if (topic.status === 'Concluído') {
                    completed++;
                } else {
                    pending++;
                }
            });
            
            console.log(`\n🎯 RESUMO:`);
            console.log(`  - Total: ${results.length}`);
            console.log(`  - Concluídos: ${completed}`);
            console.log(`  - Pendentes: ${pending}`);
            console.log(`  - Progresso: ${Math.round((completed / results.length) * 100)}%`);
        }
    }
    
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar:', err.message);
        } else {
            console.log('Conexão fechada');
        }
    });
}); 