const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Erro:', err.message);
        return;
    }
    console.log('Conectado ao banco');
});

// Testar query simples
const query = `
    SELECT COUNT(*) as total, 
           COUNT(CASE WHEN t.status = 'Concluído' THEN 1 END) as completed
    FROM topics t 
    JOIN subjects s ON t.subject_id = s.id 
    WHERE s.study_plan_id = 1
`;

db.get(query, (err, result) => {
    if (err) {
        console.error('Erro:', err.message);
    } else {
        console.log('Resultado:', result);
    }
    
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar:', err.message);
        } else {
            console.log('Conexão fechada');
        }
    });
}); 