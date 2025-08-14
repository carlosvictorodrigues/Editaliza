const sqlite3 = require('sqlite3').verbose();
const util = require('util');

// Conectar ao banco de dados
const db = new sqlite3.Database('./db.sqlite', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco de dados para teste');
});

// Promisificar métodos do banco
const dbGet = util.promisify(db.get.bind(db));
const dbAll = util.promisify(db.all.bind(db));

async function testCronogramaDebug() {
    try {
        console.log('\n🔍 === TESTE DE DEBUG DO CRONOGRAMA ===\n');
        
        const planId = 1017; // Plano que estava falhando
        
        // 1. VERIFICAR SE O PLANO EXISTE
        console.log(`1️⃣ Verificando plano ${planId}...`);
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ?', [planId]);
        
        if (!plan) {
            console.error(`❌ Plano ${planId} não encontrado!`);
            return;
        }
        
        console.log(`✅ Plano encontrado: ${plan.plan_name}`);
        console.log(`   - Usuario ID: ${plan.user_id}`);
        console.log(`   - Data do exame: ${plan.exam_date}`);
        console.log(`   - Modo reta final: ${plan.reta_final_mode}`);
        
        // 2. VERIFICAR DISCIPLINAS DO PLANO
        console.log(`\n2️⃣ Verificando disciplinas do plano ${planId}...`);
        const subjects = await dbAll('SELECT * FROM subjects WHERE study_plan_id = ?', [planId]);
        
        console.log(`   - Total de disciplinas: ${subjects.length}`);
        subjects.forEach(subject => {
            console.log(`   - ${subject.subject_name} (peso: ${subject.priority_weight})`);
        });
        
        if (subjects.length === 0) {
            console.error(`❌ Nenhuma disciplina encontrada para o plano ${planId}!`);
            return;
        }
        
        // 3. VERIFICAR TÓPICOS E VALIDAR IDS
        console.log(`\n3️⃣ Verificando tópicos das disciplinas...`);
        
        const allTopicsQuery = `
            SELECT 
                t.id, t.description, t.status, t.completion_date,
                s.subject_name, s.priority_weight as subject_priority,
                COALESCE(t.priority_weight, 3) as topic_priority
            FROM subjects s
            INNER JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = ?
            ORDER BY s.priority_weight DESC, COALESCE(t.priority_weight, 3) DESC, t.id ASC
        `;
        
        const allTopics = await dbAll(allTopicsQuery, [planId]);
        console.log(`   - Total de tópicos: ${allTopics.length}`);
        
        if (allTopics.length === 0) {
            console.error(`❌ Nenhum tópico encontrado para o plano ${planId}!`);
            return;
        }
        
        // 4. ANÁLISE DETALHADA DOS TÓPICOS
        console.log(`\n4️⃣ Análise detalhada dos tópicos:`);
        
        const topicsByStatus = {};
        const topicIds = [];
        const invalidTopics = [];
        
        allTopics.forEach(topic => {
            // Verificar se o tópico tem dados válidos
            if (!topic.id || !topic.subject_name || !topic.description) {
                invalidTopics.push(topic);
                return;
            }
            
            topicIds.push(topic.id);
            
            if (!topicsByStatus[topic.status]) {
                topicsByStatus[topic.status] = [];
            }
            topicsByStatus[topic.status].push(topic);
        });
        
        console.log(`   - Tópicos por status:`);
        Object.keys(topicsByStatus).forEach(status => {
            console.log(`     * ${status}: ${topicsByStatus[status].length} tópicos`);
        });
        
        if (invalidTopics.length > 0) {
            console.error(`❌ Encontrados ${invalidTopics.length} tópicos inválidos:`);
            invalidTopics.forEach(topic => {
                console.error(`     - ID: ${topic.id}, Disciplina: ${topic.subject_name}, Descrição: ${topic.description}`);
            });
        }
        
        // 5. VERIFICAR INTEGRIDADE DOS TOPIC_IDS
        console.log(`\n5️⃣ Verificando integridade dos topic_ids...`);
        
        if (topicIds.length > 0) {
            const placeholders = topicIds.map(() => '?').join(',');
            const existingTopics = await dbAll(`SELECT id FROM topics WHERE id IN (${placeholders})`, topicIds);
            const existingIds = new Set(existingTopics.map(t => t.id));
            
            console.log(`   - Topic IDs esperados: ${topicIds.length}`);
            console.log(`   - Topic IDs existentes: ${existingIds.size}`);
            
            const missingIds = topicIds.filter(id => !existingIds.has(id));
            if (missingIds.length > 0) {
                console.error(`❌ Topic IDs ausentes na tabela topics: ${missingIds.join(', ')}`);
            } else {
                console.log(`✅ Todos os topic_ids são válidos`);
            }
        }
        
        // 6. SIMULAR ALGORITMO DE DISTRIBUIÇÃO
        console.log(`\n6️⃣ Simulando algoritmo de distribuição...`);
        
        const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');
        console.log(`   - Tópicos pendentes: ${pendingTopics.length}`);
        
        if (pendingTopics.length === 0) {
            console.log(`   ⚠️ Nenhum tópico pendente encontrado`);
        } else {
            // Testar agrupamento por disciplina
            const disciplineGroups = new Map();
            const seenTopics = new Set();
            
            pendingTopics.forEach(topic => {
                if (!topic || !topic.subject_name || !topic.id) {
                    console.error(`   ❌ Tópico inválido durante agrupamento:`, topic);
                    return;
                }
                
                if (!disciplineGroups.has(topic.subject_name)) {
                    disciplineGroups.set(topic.subject_name, []);
                }
                disciplineGroups.get(topic.subject_name).push(topic);
            });
            
            console.log(`   - Disciplinas com tópicos pendentes: ${disciplineGroups.size}`);
            
            for (const [disciplineName, topics] of disciplineGroups.entries()) {
                console.log(`     * ${disciplineName}: ${topics.length} tópicos`);
            }
            
            // Testar round-robin
            const uniquePendingTopicsInOrder = [];
            const disciplineNames = [...disciplineGroups.keys()];
            const disciplineTopicsArrays = [...disciplineGroups.values()];
            
            if (disciplineTopicsArrays.length > 0) {
                const maxTopicsInAnyDiscipline = Math.max(...disciplineTopicsArrays.map(topics => topics.length));
                
                console.log(`   - Máximo de tópicos em qualquer disciplina: ${maxTopicsInAnyDiscipline}`);
                
                for (let round = 0; round < maxTopicsInAnyDiscipline; round++) {
                    for (const disciplineName of disciplineNames) {
                        const disciplineTopics = disciplineGroups.get(disciplineName);
                        if (disciplineTopics && round < disciplineTopics.length) {
                            const topic = disciplineTopics[round];
                            
                            if (topic && topic.id && !seenTopics.has(topic.id)) {
                                uniquePendingTopicsInOrder.push(topic);
                                seenTopics.add(topic.id);
                            }
                        }
                    }
                }
                
                console.log(`   ✅ Distribuição final: ${uniquePendingTopicsInOrder.length} tópicos ordenados`);
            }
        }
        
        // 7. VERIFICAR SESSÕES EXISTENTES
        console.log(`\n7️⃣ Verificando sessões existentes...`);
        
        const existingSessions = await dbAll('SELECT * FROM study_sessions WHERE study_plan_id = ?', [planId]);
        console.log(`   - Total de sessões existentes: ${existingSessions.length}`);
        
        const sessionsByType = {};
        const sessionsWithInvalidTopicId = [];
        
        existingSessions.forEach(session => {
            if (!sessionsByType[session.session_type]) {
                sessionsByType[session.session_type] = [];
            }
            sessionsByType[session.session_type].push(session);
            
            if (session.topic_id && !topicIds.includes(session.topic_id)) {
                sessionsWithInvalidTopicId.push(session);
            }
        });
        
        console.log(`   - Sessões por tipo:`);
        Object.keys(sessionsByType).forEach(type => {
            console.log(`     * ${type}: ${sessionsByType[type].length} sessões`);
        });
        
        if (sessionsWithInvalidTopicId.length > 0) {
            console.error(`❌ Encontradas ${sessionsWithInvalidTopicId.length} sessões com topic_id inválido:`);
            sessionsWithInvalidTopicId.forEach(session => {
                console.error(`     - Sessão ID: ${session.id}, Topic ID: ${session.topic_id}`);
            });
        }
        
        console.log(`\n✅ === TESTE DE DEBUG CONCLUÍDO ===`);
        
    } catch (error) {
        console.error('\n❌ ERRO DURANTE O TESTE:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Erro ao fechar banco:', err.message);
            } else {
                console.log('\n🔚 Conexão com banco fechada');
            }
        });
    }
}

// Executar teste
testCronogramaDebug();