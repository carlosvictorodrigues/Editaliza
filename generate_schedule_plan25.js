const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d',
    searchPath: ['app', 'public']
});

async function generateSchedule() {
    console.log('🎯 Gerando cronograma para o Plano TJPE 2025 (ID: 25)');
    console.log('============================================================\n');
    
    try {
        // Verificar se o plano existe
        const planResult = await pool.query(
            'SELECT * FROM app.study_plans WHERE id = 25'
        );
        
        if (planResult.rows.length === 0) {
            console.error('❌ Plano 25 não encontrado!');
            process.exit(1);
        }
        
        const plan = planResult.rows[0];
        console.log('📋 Plano encontrado:', plan.name || 'TJPE 2025');
        console.log('📅 Data da prova:', new Date(plan.exam_date).toLocaleDateString('pt-BR'));
        console.log('⏰ Horas de estudo: ', plan.daily_study_hours_weekday || 8, 'h (seg-sex),', plan.daily_study_hours_weekend || 4, 'h (sáb-dom)');
        console.log('⏱️  Duração das sessões:', plan.study_session_duration_minutes || 70, 'minutos');
        console.log('🚀 Modo Reta Final:', plan.reta_final_mode ? 'ATIVADO' : 'Desativado');
        console.log('');
        
        // Chamar a API interna para gerar o cronograma
        const fetch = require('node-fetch');
        
        // Primeiro, fazer login para obter o token CSRF
        console.log('🔐 Fazendo login...');
        const loginResponse = await fetch('http://localhost:3000/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'gabriel@editaliza.com',
                password: '123456'
            })
        });
        
        if (!loginResponse.ok) {
            // Tentar via conexão direta ao banco
            console.log('📊 Gerando cronograma diretamente no banco...');
            
            // Buscar tópicos do plano
            const topicsResult = await pool.query(`
                SELECT t.*, s.priority_weight as subject_weight, s.subject_name
                FROM app.topics t
                JOIN app.subjects s ON t.subject_id = s.id
                WHERE s.study_plan_id = 25
                ORDER BY s.priority_weight DESC, t.priority DESC
            `);
            
            console.log(`📚 Total de tópicos encontrados: ${topicsResult.rows.length}`);
            
            // Calcular distribuição
            const startDate = new Date('2025-08-23');
            const examDate = new Date(plan.exam_date);
            const totalDays = Math.ceil((examDate - startDate) / (1000 * 60 * 60 * 24));
            
            console.log(`📅 Período de estudo: ${totalDays} dias`);
            
            // Limpar sessões antigas
            await pool.query('DELETE FROM app.study_sessions WHERE study_plan_id = 25');
            
            // Gerar sessões com round-robin ponderado
            console.log('\n🔄 Aplicando algoritmo Round-Robin Ponderado...\n');
            
            // Agrupar tópicos por disciplina
            const disciplineGroups = new Map();
            topicsResult.rows.forEach(topic => {
                const subjectName = topic.subject_name || `Subject_${topic.subject_id}`;
                if (!disciplineGroups.has(subjectName)) {
                    disciplineGroups.set(subjectName, {
                        topics: [],
                        weight: topic.subject_weight || 1,
                        priority: (topic.subject_weight || 1) * 10 + 3,
                        currentIndex: 0
                    });
                }
                disciplineGroups.get(subjectName).topics.push(topic);
            });
            
            // Calcular total de prioridades
            let totalPriority = 0;
            disciplineGroups.forEach(group => {
                totalPriority += group.priority;
            });
            
            console.log('📊 Distribuição esperada por disciplina:');
            disciplineGroups.forEach((group, name) => {
                const percentage = ((group.priority / totalPriority) * 100).toFixed(1);
                console.log(`   - ${name}: ${group.topics.length} tópicos, prioridade ${group.priority} (${percentage}% das sessões)`);
            });
            console.log('');
            
            // Criar filas para round-robin ponderado
            const disciplineQueues = [];
            disciplineGroups.forEach((group, name) => {
                disciplineQueues.push({
                    name: name,
                    topics: [...group.topics],
                    weight: group.priority,
                    credits: group.priority,
                    originalWeight: group.priority
                });
            });
            
            // Ordenar por peso
            disciplineQueues.sort((a, b) => b.weight - a.weight);
            
            // Distribuir tópicos
            const scheduledTopics = [];
            let totalDistributed = 0;
            
            while (totalDistributed < topicsResult.rows.length && disciplineQueues.some(q => q.topics.length > 0)) {
                let hasDistributed = false;
                
                for (const queue of disciplineQueues) {
                    if (queue.credits >= 1 && queue.topics.length > 0) {
                        const topic = queue.topics.shift();
                        scheduledTopics.push(topic);
                        queue.credits -= 1;
                        totalDistributed++;
                        hasDistributed = true;
                        
                        if (totalDistributed >= topicsResult.rows.length) break;
                    }
                }
                
                // Recarregar créditos
                if (!disciplineQueues.some(q => q.credits >= 1 && q.topics.length > 0)) {
                    disciplineQueues.forEach(queue => {
                        if (queue.topics.length > 0) {
                            queue.credits += queue.originalWeight;
                        }
                    });
                }
                
                if (!hasDistributed) break;
            }
            
            console.log(`✅ ${scheduledTopics.length} tópicos distribuídos com Round-Robin Ponderado\n`);
            
            // Criar sessões de estudo
            let currentDate = new Date(startDate);
            let sessionIndex = 0;
            const weekdayHours = plan.daily_study_hours_weekday || 8;
            const weekendHours = plan.daily_study_hours_weekend || 4;
            const sessionDuration = plan.study_session_duration_minutes || 70;
            const sessionsPerWeekday = Math.floor(weekdayHours * 60 / sessionDuration);
            const sessionsPerWeekend = Math.floor(weekendHours * 60 / sessionDuration);
            
            console.log('📅 Criando sessões de estudo...\n');
            
            for (const topic of scheduledTopics) {
                const dayOfWeek = currentDate.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const maxSessionsToday = isWeekend ? sessionsPerWeekend : sessionsPerWeekday;
                
                // Criar sessão
                const sessionDate = new Date(currentDate);
                sessionDate.setHours(8 + Math.floor(sessionIndex * 1.5), (sessionIndex % 2) * 30, 0, 0);
                
                await pool.query(`
                    INSERT INTO app.study_sessions (
                        study_plan_id, topic_id, subject_name, topic_description,
                        session_date, session_type, status, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                `, [
                    25,
                    topic.id,
                    topic.subject_name,
                    topic.description,
                    sessionDate,
                    'Novo Tópico',
                    'Pendente'
                ]);
                
                sessionIndex++;
                
                // Avançar para próximo dia se necessário
                if (sessionIndex >= maxSessionsToday) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    sessionIndex = 0;
                    
                    // Pular se passar da data da prova
                    if (currentDate > examDate) break;
                }
            }
            
            // Contar sessões criadas
            const sessionCount = await pool.query(
                'SELECT COUNT(*) FROM app.study_sessions WHERE study_plan_id = 25'
            );
            
            console.log("\n✅ CRONOGRAMA GERADO COM SUCESSO!");
            console.log(`📊 Total de sessões criadas: ${sessionCount.rows[0].count}`);
            
            // Verificar distribuição final
            const distributionResult = await pool.query(`
                SELECT 
                    sess.subject_name,
                    COUNT(sess.id) as session_count,
                    MAX(s.priority_weight) as weight
                FROM app.study_sessions sess
                JOIN app.topics t ON sess.topic_id = t.id
                JOIN app.subjects s ON t.subject_id = s.id
                WHERE sess.study_plan_id = 25
                GROUP BY sess.subject_name
                ORDER BY MAX(s.priority_weight) DESC, session_count DESC
            `);
            
            console.log('\n📈 Distribuição final das sessões:');
            let totalSessions = 0;
            distributionResult.rows.forEach(row => {
                totalSessions += parseInt(row.session_count);
            });
            
            distributionResult.rows.forEach(row => {
                const percentage = ((row.session_count / totalSessions) * 100).toFixed(1);
                console.log(`   - ${row.subject_name}: ${row.session_count} sessões (${percentage}%) - Peso: ${row.weight}`);
            });
            
            // Verificar primeiras sessões
            const firstSessions = await pool.query(`
                SELECT 
                    sess.session_date,
                    sess.topic_description as description,
                    sess.subject_name
                FROM app.study_sessions sess
                WHERE sess.study_plan_id = 25
                AND DATE(sess.session_date) = '2025-08-23'
                ORDER BY sess.session_date
                LIMIT 10
            `);
            
            console.log('\n📅 Sessões para hoje (23/08/2025):');
            if (firstSessions.rows.length > 0) {
                firstSessions.rows.forEach((session, index) => {
                    const time = new Date(session.session_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const desc = session.description ? session.description.substring(0, 50) : 'Sem descrição';
                    console.log(`   ${index + 1}. ${time} - ${session.subject_name}: ${desc}...`);
                });
            } else {
                console.log('   Nenhuma sessão agendada para hoje.');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao gerar cronograma:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

generateSchedule();