const sqlite3 = require('sqlite3').verbose();

// Conectar ao banco de dados
const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
        return;
    }
    console.log('Conectado ao banco de dados db.sqlite');
});

// Função para testar a query corrigida
function testSchedulePreviewQuery(planId) {
    console.log(`\n🔍 Testando query para plano ID: ${planId}\n`);
    
    const query = `
        SELECT t.*, s.subject_name 
        FROM topics t 
        JOIN subjects s ON t.subject_id = s.id 
        WHERE s.study_plan_id = ?
        ORDER BY t.priority DESC, t.id ASC
    `;
    
    db.all(query, [planId], (err, topics) => {
        if (err) {
            console.error('Erro na query:', err.message);
            return;
        }
        
        console.log(`✅ Total de tópicos encontrados: ${topics.length}`);
        
        if (topics.length === 0) {
            console.log('❌ Nenhum tópico encontrado');
            return;
        }
        
        // Agrupar por disciplina
        const subjects = {};
        let totalCompleted = 0;
        let totalPending = 0;
        
        topics.forEach(topic => {
            if (!subjects[topic.subject_name]) {
                subjects[topic.subject_name] = {
                    total: 0,
                    completed: 0,
                    pending: 0
                };
            }
            
            subjects[topic.subject_name].total++;
            
            if (topic.status === 'Concluído') {
                subjects[topic.subject_name].completed++;
                totalCompleted++;
            } else {
                subjects[topic.subject_name].pending++;
                totalPending++;
            }
        });
        
        console.log('\n📊 RESUMO POR DISCIPLINA:');
        Object.keys(subjects).forEach(subject => {
            const data = subjects[subject];
            console.log(`  📖 ${subject}:`);
            console.log(`    - Total: ${data.total}`);
            console.log(`    - Concluídos: ${data.completed}`);
            console.log(`    - Pendentes: ${data.pending}`);
        });
        
        console.log(`\n🎯 RESUMO GERAL:`);
        console.log(`  - Total de tópicos: ${topics.length}`);
        console.log(`  - Tópicos concluídos: ${totalCompleted}`);
        console.log(`  - Tópicos pendentes: ${totalPending}`);
        console.log(`  - Progresso: ${topics.length > 0 ? Math.round((totalCompleted / topics.length) * 100) : 0}%`);
    });
}

// Testar com o plano ID 1 (que é o plano do usuário 3@3.com)
testSchedulePreviewQuery(1);

// Fechar conexão após 3 segundos
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar banco:', err.message);
        } else {
            console.log('\n✅ Conexão com banco fechada');
        }
    });
}, 3000); 