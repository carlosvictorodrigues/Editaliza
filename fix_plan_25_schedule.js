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

async function fixPlan25() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🔧 Corrigindo Plano 25 - TJPE 2025');
        console.log('============================================================\n');
        
        // Verificar se o plano existe
        const planCheck = await client.query(
            'SELECT * FROM app.study_plans WHERE id = 25'
        );
        
        if (planCheck.rows.length === 0) {
            console.log('❌ Plano 25 não encontrado. Criando...');
            
            // Criar o plano se não existir
            await client.query(`
                INSERT INTO app.study_plans (
                    id, name, exam_date, 
                    daily_study_hours_weekday, daily_study_hours_weekend,
                    study_session_duration_minutes, reta_final_mode,
                    created_at, updated_at
                ) VALUES (
                    25, 'TJPE 2025', '2025-09-21',
                    8, 4, 70, true,
                    NOW(), NOW()
                )
            `);
            console.log('✅ Plano criado com sucesso!');
        } else {
            console.log('✅ Plano 25 encontrado');
            
            // Atualizar configurações do plano
            await client.query(`
                UPDATE app.study_plans 
                SET 
                    daily_study_hours_weekday = 8,
                    daily_study_hours_weekend = 4,
                    study_session_duration_minutes = 70,
                    reta_final_mode = true,
                    exam_date = '2025-09-21'
                WHERE id = 25
            `);
            console.log('✅ Configurações do plano atualizadas');
        }
        
        // Buscar todas as matérias e tópicos
        const topicsResult = await client.query(`
            SELECT 
                t.*,
                s.priority_weight as subject_weight,
                s.subject_name,
                s.id as subject_id
            FROM app.topics t
            JOIN app.subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = 25
            ORDER BY s.priority_weight DESC, t.priority DESC
        `);
        
        console.log(`\n📚 Total de tópicos: ${topicsResult.rows.length}`);
        
        if (topicsResult.rows.length === 0) {
            console.log('❌ Nenhum tópico encontrado. Execute primeiro o setup_plan_tjpe_completo.js');
            await client.query('ROLLBACK');
            return;
        }
        
        // Limpar sessões antigas
        await client.query('DELETE FROM app.study_sessions WHERE study_plan_id = 25');
        console.log('🗑️  Sessões antigas removidas');
        
        // Implementar Round-Robin Ponderado
        console.log('\n🔄 Aplicando Round-Robin Ponderado...\n');
        
        // Agrupar tópicos por disciplina
        const disciplineGroups = new Map();
        topicsResult.rows.forEach(topic => {
            if (!disciplineGroups.has(topic.subject_name)) {
                disciplineGroups.set(topic.subject_name, {
                    topics: [],
                    weight: topic.subject_weight || 1,
                    priority: (topic.subject_weight || 1) * 10 + 3
                });
            }
            disciplineGroups.get(topic.subject_name).topics.push(topic);
        });
        
        // Criar filas para round-robin ponderado
        const disciplineQueues = [];
        let totalPriority = 0;
        
        disciplineGroups.forEach((group, name) => {
            totalPriority += group.priority;
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
        
        console.log('📊 Distribuição por disciplina:');
        disciplineQueues.forEach(queue => {
            const percentage = ((queue.weight / totalPriority) * 100).toFixed(1);
            console.log(`   - ${queue.name}: ${queue.topics.length} tópicos (${percentage}% esperado)`);
        });
        
        // Distribuir tópicos usando round-robin ponderado
        const scheduledTopics = [];
        let totalDistributed = 0;
        const maxTopics = topicsResult.rows.length;
        
        while (totalDistributed < maxTopics && disciplineQueues.some(q => q.topics.length > 0)) {
            let hasDistributed = false;
            
            for (const queue of disciplineQueues) {
                if (queue.credits >= 1 && queue.topics.length > 0) {
                    const topic = queue.topics.shift();
                    scheduledTopics.push(topic);
                    queue.credits -= 1;
                    totalDistributed++;
                    hasDistributed = true;
                    
                    if (totalDistributed >= maxTopics) break;
                }
            }
            
            // Recarregar créditos quando necessário
            if (!disciplineQueues.some(q => q.credits >= 1 && q.topics.length > 0)) {
                disciplineQueues.forEach(queue => {
                    if (queue.topics.length > 0) {
                        queue.credits += queue.originalWeight;
                    }
                });
            }
            
            if (!hasDistributed) break;
        }
        
        console.log(`\n✅ ${scheduledTopics.length} tópicos distribuídos\n`);
        
        // Criar sessões de estudo
        console.log('📅 Criando sessões de estudo...\n');
        
        const startDate = new Date('2025-08-23');
        const examDate = new Date('2025-09-21');
        let currentDate = new Date(startDate);
        let sessionIndex = 0;
        let totalSessions = 0;
        
        // Configurações
        const weekdayHours = 8;
        const weekendHours = 4;
        const sessionDuration = 70;
        const sessionsPerWeekday = Math.floor(weekdayHours * 60 / sessionDuration);
        const sessionsPerWeekend = Math.floor(weekendHours * 60 / sessionDuration);
        
        for (const topic of scheduledTopics) {
            const dayOfWeek = currentDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const maxSessionsToday = isWeekend ? sessionsPerWeekend : sessionsPerWeekday;
            
            // Calcular horário da sessão
            const sessionDate = new Date(currentDate);
            const startHour = 8; // Começar às 8h
            const hoursOffset = Math.floor(sessionIndex * (sessionDuration + 10) / 60);
            const minutesOffset = (sessionIndex * (sessionDuration + 10)) % 60;
            sessionDate.setHours(startHour + hoursOffset, minutesOffset, 0, 0);
            
            // Inserir sessão
            await client.query(`
                INSERT INTO app.study_sessions (
                    study_plan_id, topic_id, subject_name, topic_description,
                    session_date, session_type, status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            `, [
                25,
                topic.id,
                topic.subject_name,
                topic.description || 'Tópico sem descrição',
                sessionDate,
                'Novo Tópico',
                'Pendente'
            ]);
            
            totalSessions++;
            sessionIndex++;
            
            // Avançar para próximo dia se necessário
            if (sessionIndex >= maxSessionsToday) {
                currentDate.setDate(currentDate.getDate() + 1);
                sessionIndex = 0;
                
                // Parar se passar da data da prova
                if (currentDate > examDate) {
                    console.log('⚠️  Alcançada a data da prova, parando geração de sessões');
                    break;
                }
            }
        }
        
        console.log(`✅ ${totalSessions} sessões criadas com sucesso!\n`);
        
        // Verificar distribuição final
        const distribution = await client.query(`
            SELECT 
                subject_name,
                COUNT(*) as count
            FROM app.study_sessions
            WHERE study_plan_id = 25
            GROUP BY subject_name
            ORDER BY count DESC
        `);
        
        console.log('📈 Distribuição final das sessões:');
        distribution.rows.forEach(row => {
            const percentage = ((row.count / totalSessions) * 100).toFixed(1);
            console.log(`   - ${row.subject_name}: ${row.count} sessões (${percentage}%)`);
        });
        
        // Verificar sessões para hoje
        const todaySessions = await client.query(`
            SELECT 
                session_date,
                subject_name,
                topic_description
            FROM app.study_sessions
            WHERE study_plan_id = 25
            AND DATE(session_date) = '2025-08-23'
            ORDER BY session_date
        `);
        
        console.log(`\n📅 Sessões para hoje (23/08/2025): ${todaySessions.rows.length}`);
        if (todaySessions.rows.length > 0) {
            todaySessions.rows.slice(0, 5).forEach((session, index) => {
                const time = new Date(session.session_date).toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                const desc = session.topic_description ? 
                    session.topic_description.substring(0, 40) : 
                    'Sem descrição';
                console.log(`   ${index + 1}. ${time} - ${session.subject_name}: ${desc}...`);
            });
            if (todaySessions.rows.length > 5) {
                console.log(`   ... e mais ${todaySessions.rows.length - 5} sessões`);
            }
        }
        
        await client.query('COMMIT');
        console.log('\n✅ PLANO 25 CORRIGIDO E CRONOGRAMA GERADO COM SUCESSO!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixPlan25();