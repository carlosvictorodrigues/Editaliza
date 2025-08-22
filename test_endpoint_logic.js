const sqlite3 = require('sqlite3').verbose();

// Conectar diretamente ao banco
const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Erro:', err.message);
        return;
    }
    console.log('Conectado ao banco');
});

// Definir as funções como no server.js
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

// Testar a lógica exata do endpoint
async function testEndpointLogic() {
    try {
        console.log('🔍 Testando lógica exata do endpoint schedule_preview...\n');
        
        const planId = 1;
        const userId = 4;
        
        // 1. Buscar dados do plano
        console.log('1. Buscando dados do plano...');
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }
        console.log('✅ Plano encontrado:', plan.plan_name);
        
        // 2. Buscar todos os tópicos do plano
        console.log('\n2. Buscando tópicos...');
        const allTopics = await dbAll(`
            SELECT t.*, s.subject_name 
            FROM topics t 
            JOIN subjects s ON t.subject_id = s.id 
            WHERE s.study_plan_id = ?
            ORDER BY t.id ASC
        `, [planId]);
        console.log(`✅ Tópicos encontrados: ${allTopics.length}`);
        
        // 3. Buscar sessões de estudo
        console.log('\n3. Buscando sessões...');
        const studySessions = await dbAll(`
            SELECT * FROM study_sessions 
            WHERE study_plan_id = ? 
            ORDER BY session_date ASC, id ASC
        `, [planId]);
        console.log(`✅ Sessões encontradas: ${studySessions.length}`);
        
        // 4. Calcular estatísticas reais
        console.log('\n4. Calculando estatísticas...');
        const totalTopics = allTopics.length;
        const completedTopics = allTopics.filter(t => t.status === 'Concluído').length;
        const pendingTopics = totalTopics - completedTopics;
        const currentProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
        console.log(`✅ Estatísticas: ${totalTopics} total, ${completedTopics} concluídos, ${pendingTopics} pendentes, ${currentProgress}% progresso`);
        
        // 5. Calcular cobertura real
        const scheduledTopics = studySessions.filter(s => s.session_type === 'Novo Tópico').length;
        const coveragePercentage = totalTopics > 0 ? Math.round((scheduledTopics / totalTopics) * 100) : 0;
        const unscheduledTopics = totalTopics - scheduledTopics;
        console.log(`✅ Cobertura: ${scheduledTopics} agendados, ${coveragePercentage}%, ${unscheduledTopics} não agendados`);
        
        // 6. Calcular simulados
        const totalSimulations = studySessions.filter(s => s.session_type.includes('Simulado')).length;
        const targetedSimulations = studySessions.filter(s => s.session_type.includes('direcionado')).length;
        const generalSimulations = studySessions.filter(s => s.session_type.includes('geral')).length;
        console.log(`✅ Simulados: ${totalSimulations} total, ${targetedSimulations} direcionados, ${generalSimulations} gerais`);
        
        // 7. Calcular revisões
        const revisionSessions = studySessions.filter(s => s.session_type.includes('Revisão')).length;
        const studySessionsCount = studySessions.filter(s => s.session_type === 'Novo Tópico').length;
        console.log(`✅ Revisões: ${revisionSessions} sessões de revisão, ${studySessionsCount} sessões de estudo`);
        
        // 8. Determinar fase atual
        let currentPhase = 'Fase de Aprendizado: Estudando novos tópicos';
        if (completedTopics === totalTopics && totalTopics > 0) {
            currentPhase = 'Fase de Consolidação: Revisões e simulados';
        } else if (completedTopics > 0 && completedTopics < totalTopics) {
            currentPhase = 'Fase de Aprendizado: Estudando novos tópicos';
        }
        console.log(`✅ Fase atual: ${currentPhase}`);
        
        // 9. Calcular estatísticas de revisão
        const revisionCycles = completedTopics > 0 ? Math.round(revisionSessions / completedTopics) : 0;
        const expectedRevisionsPerTopic = 3;
        const totalExpectedRevisions = completedTopics * expectedRevisionsPerTopic;
        const revisionProgress = totalExpectedRevisions > 0 ? Math.round((revisionSessions / totalExpectedRevisions) * 100) : 0;
        console.log(`✅ Revisões: ${revisionCycles} ciclos, ${totalExpectedRevisions} esperadas, ${revisionProgress}% progresso`);
        
        // 10. Preparar dados de resposta
        console.log('\n5. Preparando dados de resposta...');
        const scheduleData = {
            phases: {
                current: currentPhase,
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
            revisionCycles,
            totalRevisions: revisionSessions,
            totalStudySessions: studySessionsCount,
            unscheduledTopics,
            coveragePercentage,
            revisionProgress
        };
        
        console.log('✅ Dados preparados com sucesso!');
        console.log('\n🎯 RESULTADO FINAL:');
        console.log(JSON.stringify(scheduleData, null, 2));
        
        if (scheduleData.completedTopics === 2) {
            console.log('\n✅ SUCESSO! A lógica está funcionando corretamente!');
        } else {
            console.log('\n❌ Dados incorretos. Esperado: 2 tópicos concluídos');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Stack trace:', error.stack);
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

testEndpointLogic(); 