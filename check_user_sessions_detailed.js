const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('db.sqlite');

console.log('=== VERIFICAÇÃO DETALHADA DAS SESSÕES DO USUÁRIO c@c.com ===\n');

const planId = 1016; // Plano do usuário c@c.com

// Query similar à que está sendo usada no serviço
const query = `
    SELECT COUNT(DISTINCT topic_id) as count 
    FROM study_sessions 
    WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL
`;

db.get(query, [planId], (err, result) => {
    if (err) {
        console.error('Erro na query:', err);
        return;
    }
    
    console.log('Resultado da query de tópicos concluídos:', result);
    console.log(`Contagem: ${result.count}`);
    
    // Vamos verificar todas as sessões deste plano
    db.all(`
        SELECT id, session_type, status, topic_id, subject_name, session_date
        FROM study_sessions 
        WHERE study_plan_id = ? 
        ORDER BY session_date
        LIMIT 20
    `, [planId], (err, sessions) => {
        if (err) {
            console.error('Erro ao buscar sessões:', err);
            return;
        }
        
        console.log('\nPrimeiras 20 sessões do plano:');
        sessions.forEach((session, index) => {
            console.log(`${index + 1}. ID: ${session.id}, Tipo: ${session.session_type}, Status: ${session.status}, Tópico ID: ${session.topic_id}`);
            console.log(`    Matéria: ${session.subject_name}, Data: ${session.session_date}`);
        });
        
        // Verificar se há sessões com status 'Concluído'
        db.all(`
            SELECT COUNT(*) as count, session_type, status
            FROM study_sessions 
            WHERE study_plan_id = ? 
            GROUP BY session_type, status
        `, [planId], (err, grouped) => {
            if (err) {
                console.error('Erro ao agrupar:', err);
                return;
            }
            
            console.log('\nSessões agrupadas por tipo e status:');
            grouped.forEach(group => {
                console.log(`  ${group.session_type} + ${group.status}: ${group.count} sessões`);
            });
            
            db.close();
        });
    });
});