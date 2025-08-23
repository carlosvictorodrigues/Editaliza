const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Erro:', err.message);
        return;
    }
    console.log('Conectado ao banco');
});

async function testAllQueries() {
    try {
        console.log('🔍 Testando todas as queries do endpoint schedule_preview...\n');
        
        // 1. Testar busca do plano
        console.log('1. Testando busca do plano...');
        const plan = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [1, 4], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        console.log('✅ Plano encontrado:', plan ? 'Sim' : 'Não');
        
        // 2. Testar busca de tópicos
        console.log('\n2. Testando busca de tópicos...');
        const allTopics = await new Promise((resolve, reject) => {
            db.all(`
                SELECT t.*, s.subject_name 
                FROM topics t 
                JOIN subjects s ON t.subject_id = s.id 
                WHERE s.study_plan_id = ?
                ORDER BY t.id ASC
            `, [1], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log(`✅ Tópicos encontrados: ${allTopics.length}`);
        
        // 3. Testar busca de sessões de estudo
        console.log('\n3. Testando busca de sessões de estudo...');
        const studySessions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM study_sessions 
                WHERE study_plan_id = ? 
                ORDER BY session_date ASC, id ASC
            `, [1], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log(`✅ Sessões encontradas: ${studySessions.length}`);
        
        // 4. Calcular estatísticas
        console.log('\n4. Calculando estatísticas...');
        const totalTopics = allTopics.length;
        const completedTopics = allTopics.filter(t => t.status === 'Concluído').length;
        const pendingTopics = totalTopics - completedTopics;
        const currentProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
        
        console.log(`✅ Estatísticas calculadas:`);
        console.log(`  - Total de tópicos: ${totalTopics}`);
        console.log(`  - Tópicos concluídos: ${completedTopics}`);
        console.log(`  - Tópicos pendentes: ${pendingTopics}`);
        console.log(`  - Progresso: ${currentProgress}%`);
        
        // 5. Calcular cobertura
        const scheduledTopics = studySessions.filter(s => s.session_type === 'Novo Tópico').length;
        const coveragePercentage = totalTopics > 0 ? Math.round((scheduledTopics / totalTopics) * 100) : 0;
        const unscheduledTopics = totalTopics - scheduledTopics;
        
        console.log(`\n✅ Cobertura calculada:`);
        console.log(`  - Tópicos agendados: ${scheduledTopics}`);
        console.log(`  - Cobertura: ${coveragePercentage}%`);
        console.log(`  - Tópicos não agendados: ${unscheduledTopics}`);
        
        // 6. Calcular simulados
        const totalSimulations = studySessions.filter(s => s.session_type.includes('Simulado')).length;
        const targetedSimulations = studySessions.filter(s => s.session_type.includes('direcionado')).length;
        const generalSimulations = studySessions.filter(s => s.session_type.includes('geral')).length;
        
        console.log(`\n✅ Simulados calculados:`);
        console.log(`  - Total de simulados: ${totalSimulations}`);
        console.log(`  - Simulados direcionados: ${targetedSimulations}`);
        console.log(`  - Simulados gerais: ${generalSimulations}`);
        
        // 7. Calcular revisões
        const revisionSessions = studySessions.filter(s => s.session_type.includes('Revisão')).length;
        const studySessionsCount = studySessions.filter(s => s.session_type === 'Novo Tópico').length;
        
        console.log(`\n✅ Revisões calculadas:`);
        console.log(`  - Sessões de revisão: ${revisionSessions}`);
        console.log(`  - Sessões de estudo: ${studySessionsCount}`);
        
        console.log('\n🎯 TODAS AS QUERIES FUNCIONARAM CORRETAMENTE!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Erro ao fechar:', err.message);
            } else {
                console.log('\n✅ Conexão fechada');
            }
        });
    }
}

testAllQueries(); 