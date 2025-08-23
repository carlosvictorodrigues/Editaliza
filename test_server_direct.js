const sqlite3 = require('sqlite3').verbose();

// Conectar diretamente ao banco
const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Erro:', err.message);
        return;
    }
    console.log('Conectado ao banco');
});

// Testar todas as queries do endpoint
async function testEndpointQueries() {
    try {
        console.log('🔍 Testando queries do endpoint schedule_preview...\n');
        
        const planId = 1;
        const userId = 4;
        
        // 1. Testar busca do plano
        console.log('1. Testando busca do plano...');
        const plan = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        console.log('✅ Plano encontrado:', plan ? plan.plan_name : 'Não');
        
        // 2. Testar busca de tópicos
        console.log('\n2. Testando busca de tópicos...');
        const allTopics = await new Promise((resolve, reject) => {
            db.all(`
                SELECT t.*, s.subject_name 
                FROM topics t 
                JOIN subjects s ON t.subject_id = s.id 
                WHERE s.study_plan_id = ?
                ORDER BY t.id ASC
            `, [planId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log(`✅ Tópicos encontrados: ${allTopics.length}`);
        
        // 3. Testar busca de sessões
        console.log('\n3. Testando busca de sessões...');
        const studySessions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM study_sessions 
                WHERE study_plan_id = ? 
                ORDER BY session_date ASC, id ASC
            `, [planId], (err, rows) => {
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
        
        console.log(`✅ Estatísticas:`);
        console.log(`  - Total: ${totalTopics}`);
        console.log(`  - Concluídos: ${completedTopics}`);
        console.log(`  - Pendentes: ${pendingTopics}`);
        console.log(`  - Progresso: ${currentProgress}%`);
        
        // 5. Calcular cobertura
        const scheduledTopics = studySessions.filter(s => s.session_type === 'Novo Tópico').length;
        const coveragePercentage = totalTopics > 0 ? Math.round((scheduledTopics / totalTopics) * 100) : 0;
        const unscheduledTopics = totalTopics - scheduledTopics;
        
        console.log(`\n✅ Cobertura:`);
        console.log(`  - Agendados: ${scheduledTopics}`);
        console.log(`  - Cobertura: ${coveragePercentage}%`);
        console.log(`  - Não agendados: ${unscheduledTopics}`);
        
        // 6. Calcular simulados
        const totalSimulations = studySessions.filter(s => s.session_type.includes('Simulado')).length;
        const targetedSimulations = studySessions.filter(s => s.session_type.includes('direcionado')).length;
        const generalSimulations = studySessions.filter(s => s.session_type.includes('geral')).length;
        
        console.log(`\n✅ Simulados:`);
        console.log(`  - Total: ${totalSimulations}`);
        console.log(`  - Direcionados: ${targetedSimulations}`);
        console.log(`  - Gerais: ${generalSimulations}`);
        
        // 7. Calcular revisões
        const revisionSessions = studySessions.filter(s => s.session_type.includes('Revisão')).length;
        const studySessionsCount = studySessions.filter(s => s.session_type === 'Novo Tópico').length;
        
        console.log(`\n✅ Revisões:`);
        console.log(`  - Sessões de revisão: ${revisionSessions}`);
        console.log(`  - Sessões de estudo: ${studySessionsCount}`);
        
        // 8. Preparar dados de resposta
        console.log('\n5. Preparando dados de resposta...');
        const scheduleData = {
            phases: {
                current: completedTopics === totalTopics && totalTopics > 0 ? 
                    'Fase de Consolidação: Revisões e simulados' : 
                    'Fase de Aprendizado: Estudando novos tópicos',
                explanation: coveragePercentage >= 95 ? 
                    'Cronograma otimizado: priorizou os tópicos mais relevantes para maximizar suas chances de aprovação' :
                    'Cronograma em desenvolvimento: alguns tópicos podem não ter sido incluídos devido a limitações de tempo'
            },
            status: {
                coverageText: `Cronograma cobre ${coveragePercentage}% do edital (${scheduledTopics} de ${totalTopics} tópicos)`,
                progressText: `Você já estudou ${completedTopics} tópicos (${currentProgress}% concluído)`,
                remainingText: `Restam ${pendingTopics} tópicos agendados para estudar (${100 - currentProgress}%)`,
                unscheduledText: unscheduledTopics > 0 ? `${unscheduledTopics} tópicos não foram incluídos no cronograma (falta de tempo/priorização)` : ''
            },
            completedTopics,
            totalTopics,
            pendingTopics,
            currentProgress,
            remainingScheduled: 100 - currentProgress,
            totalSimulations,
            targetedSimulations,
            generalSimulations,
            revisionCycles: completedTopics > 0 ? Math.round(revisionSessions / completedTopics) : 0,
            totalRevisions: revisionSessions,
            totalStudySessions: studySessionsCount,
            unscheduledTopics,
            coveragePercentage,
            revisionProgress: completedTopics > 0 ? Math.round((revisionSessions / (completedTopics * 3)) * 100) : 0
        };
        
        console.log('✅ Dados preparados com sucesso!');
        console.log('\n🎯 RESULTADO FINAL:');
        console.log(JSON.stringify(scheduleData, null, 2));
        
        if (scheduleData.completedTopics === 2) {
            console.log('\n✅ SUCESSO! Os dados estão corretos!');
        } else {
            console.log('\n❌ Dados incorretos. Esperado: 2 tópicos concluídos');
        }
        
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

testEndpointQueries(); 