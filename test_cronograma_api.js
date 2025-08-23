const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const jwt = require('jsonwebtoken');

// Configurar aplicação express mínima para teste
const app = express();
app.use(express.json());

// Conectar ao banco
const db = new sqlite3.Database('./db.sqlite');
const dbGet = util.promisify(db.get.bind(db));
const dbAll = util.promisify(db.all.bind(db));
const dbRun = util.promisify(db.run.bind(db));

// Token mock para debug@test.com (user_id: 1006)
const mockToken = jwt.sign(
    { id: 1006, email: 'debug@test.com' },
    process.env.JWT_SECRET || 'fallback_secret_key',
    { expiresIn: '1h' }
);

async function testCronogramaGeneration() {
    try {
        console.log('🧪 === TESTE DIRETO DA GERAÇÃO DE CRONOGRAMA ===\n');
        
        const planId = 1017;
        const userId = 1006;
        
        console.log('1️⃣ Preparando dados para teste...');
        
        // Parâmetros do cronograma
        const params = {
            daily_question_goal: 50,
            weekly_question_goal: 350,
            session_duration_minutes: 50,
            study_hours_per_day: { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 },
            has_essay: true,
            reta_final_mode: true
        };
        
        console.log('Parâmetros:', params);
        
        // SIMULAÇÃO DIRETA DO ALGORITMO
        console.log('\n2️⃣ Executando algoritmo diretamente...');
        
        await dbRun('BEGIN IMMEDIATE TRANSACTION');
        console.log('✅ Transação iniciada');
        
        try {
            // Atualizar plano com parâmetros
            const hoursJson = JSON.stringify(params.study_hours_per_day);
            await dbRun(
                'UPDATE study_plans SET daily_question_goal = ?, weekly_question_goal = ?, session_duration_minutes = ?, study_hours_per_day = ?, has_essay = ?, reta_final_mode = ? WHERE id = ? AND user_id = ?',
                [
                    params.daily_question_goal,
                    params.weekly_question_goal,
                    params.session_duration_minutes,
                    hoursJson,
                    params.has_essay,
                    params.reta_final_mode ? 1 : 0,
                    planId,
                    userId
                ]
            );
            console.log('✅ Plano atualizado');
            
            // Verificar plano
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ?', [planId]);
            if (!plan) {
                throw new Error('Plano não encontrado');
            }
            console.log('✅ Plano verificado');
            
            // Limpar sessões antigas
            await dbRun("DELETE FROM study_sessions WHERE study_plan_id = ?", [planId]);
            console.log('✅ Sessões antigas removidas');
            
            // Buscar todos os tópicos
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
            console.log(`✅ ${allTopics.length} tópicos carregados`);
            
            // Filtrar tópicos pendentes
            const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');
            console.log(`✅ ${pendingTopics.length} tópicos pendentes`);
            
            // TESTE CRÍTICO: Algoritmo de distribuição
            console.log('\n3️⃣ Testando algoritmo de distribuição...');
            
            const disciplineGroups = new Map();
            
            pendingTopics.forEach(topic => {
                if (!topic || !topic.subject_name || !topic.id) {
                    console.error('❌ Tópico inválido:', topic);
                    throw new Error(`Tópico inválido encontrado: ${JSON.stringify(topic)}`);
                }
                
                if (!disciplineGroups.has(topic.subject_name)) {
                    disciplineGroups.set(topic.subject_name, []);
                }
                disciplineGroups.get(topic.subject_name).push(topic);
            });
            
            console.log(`✅ Tópicos agrupados em ${disciplineGroups.size} disciplinas`);
            
            // Round-robin entre disciplinas
            const disciplineNames = [...disciplineGroups.keys()];
            const uniquePendingTopicsInOrder = [];
            const seenTopics = new Set();
            
            if (disciplineGroups.size === 0) {
                throw new Error('Nenhuma disciplina válida encontrada após agrupamento');
            }
            
            const disciplineTopicsArrays = [...disciplineGroups.values()];
            const maxTopicsInAnyDiscipline = Math.max(...disciplineTopicsArrays.map(topics => topics.length));
            
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
            
            console.log(`✅ Distribuição final: ${uniquePendingTopicsInOrder.length} tópicos ordenados`);
            
            // TESTE CRÍTICO: Preparação para inserção
            console.log('\n4️⃣ Testando preparação de sessões...');
            
            const sessionsToCreate = [];
            const today = new Date();
            
            // Criar algumas sessões de teste
            for (let i = 0; i < Math.min(5, uniquePendingTopicsInOrder.length); i++) {
                const topic = uniquePendingTopicsInOrder[i];
                const sessionDate = new Date(today);
                sessionDate.setDate(today.getDate() + i);
                
                sessionsToCreate.push({
                    topicId: topic.id,
                    subjectName: topic.subject_name,
                    topicDescription: topic.description,
                    session_date: sessionDate.toISOString().split('T')[0],
                    sessionType: 'Novo Tópico'
                });
            }
            
            console.log(`✅ ${sessionsToCreate.length} sessões preparadas para teste`);
            
            // TESTE CRÍTICO: Validação de topic_ids
            console.log('\n5️⃣ Testando validação de topic_ids...');
            
            const uniqueTopicIds = [...new Set(
                sessionsToCreate
                    .map(s => s.topicId)
                    .filter(id => id !== null && id !== undefined)
            )];
            
            console.log(`Topic IDs para validar: ${uniqueTopicIds.length}`);
            
            if (uniqueTopicIds.length > 0) {
                const placeholders = uniqueTopicIds.map(() => '?').join(',');
                const existingTopics = await dbAll(`SELECT id FROM topics WHERE id IN (${placeholders})`, uniqueTopicIds);
                const validTopicIds = new Set(existingTopics.map(topic => topic.id));
                
                console.log(`Topic IDs válidos: ${validTopicIds.size}/${uniqueTopicIds.length}`);
                
                const invalidIds = uniqueTopicIds.filter(id => !validTopicIds.has(id));
                if (invalidIds.length > 0) {
                    throw new Error(`Topic IDs inválidos encontrados: ${invalidIds.join(', ')}`);
                }
            }
            
            // TESTE CRÍTICO: Inserção das sessões
            console.log('\n6️⃣ Testando inserção das sessões...');
            
            const insertSql = 'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
            const stmt = db.prepare(insertSql);
            
            for (const sessionData of sessionsToCreate) {
                try {
                    stmt.run(
                        planId,
                        sessionData.topicId,
                        sessionData.subjectName,
                        sessionData.topicDescription,
                        sessionData.session_date,
                        sessionData.sessionType,
                        'Pendente'
                    );
                    console.log(`✅ Sessão inserida: ${sessionData.subjectName} - ${sessionData.topicDescription.substring(0, 30)}...`);
                } catch (sessionError) {
                    console.error(`❌ ERRO na inserção de sessão:`, {
                        planId,
                        topicId: sessionData.topicId,
                        subjectName: sessionData.subjectName,
                        error: sessionError.message
                    });
                    throw sessionError;
                }
            }
            
            await new Promise((resolve, reject) => {
                stmt.finalize(err => err ? reject(err) : resolve());
            });
            
            console.log('✅ Todas as sessões inseridas com sucesso');
            
            await dbRun('COMMIT');
            console.log('✅ Transação commitada');
            
            console.log('\n🎉 === TESTE CONCLUÍDO COM SUCESSO ===');
            
        } catch (algorithmError) {
            await dbRun('ROLLBACK');
            console.error('\n❌ === ERRO NO ALGORITMO ===');
            console.error('Tipo:', algorithmError.name);
            console.error('Mensagem:', algorithmError.message);
            console.error('Stack:', algorithmError.stack);
            throw algorithmError;
        }
        
    } catch (error) {
        console.error('\n💥 === ERRO CRÍTICO ===');
        console.error('Tipo:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Código:', error.code);
        console.error('Stack:', error.stack);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Erro ao fechar banco:', err.message);
            } else {
                console.log('\n🔚 Conexão com banco fechada');
                process.exit(0);
            }
        });
    }
}

// Executar teste
testCronogramaGeneration();