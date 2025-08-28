/**
 * Teste específico para criação de tópicos simulando o repository
 */

require('dotenv').config();
const db = require('./database-simple-postgres');
const { createRepositories } = require('./src/repositories');

async function testTopicCreation() {
    console.log('🧪 TESTANDO CRIAÇÃO DE TÓPICOS...\n');

    try {
        // Inicializar repositories
        const repos = createRepositories(db);
        console.log('✅ Repositories inicializados');

        // Buscar um plano existente
        const plan = await repos.plan.findById(1);
        console.log('📋 Plano encontrado:', plan ? plan.plan_name : 'Nenhum');

        if (!plan) {
            console.log('❌ Nenhum plano encontrado. Criando um plano de teste...');
            
            // Criar usuário de teste se necessário
            let userId = 1;
            try {
                const user = await db.get('SELECT id FROM app.users LIMIT 1');
                userId = user ? user.id : 1;
            } catch (e) {
                console.log('⚠️ Usando userId padrão: 1');
            }

            // Criar plano de teste
            const planData = {
                user_id: userId,
                plan_name: 'Plano de Teste Debug',
                exam_date: '2025-12-31'
            };

            try {
                const newPlanId = await repos.plan.createPlan(planData);
                console.log('✅ Plano de teste criado com ID:', newPlanId);
            } catch (createError) {
                console.log('❌ Erro ao criar plano:', createError.message);
                return;
            }
        }

        // Buscar um plano válido
        const validPlan = await db.get('SELECT id, user_id FROM app.study_plans LIMIT 1');
        if (!validPlan) {
            console.log('❌ Nenhum plano válido encontrado');
            return;
        }

        console.log(`📋 Usando plano ID: ${validPlan.id}, User ID: ${validPlan.user_id}`);

        // Criar disciplina de teste
        console.log('\n📚 CRIANDO DISCIPLINA DE TESTE...');
        
        const subjectData = {
            study_plan_id: validPlan.id,
            subject_name: 'Disciplina Debug Test',
            priority_weight: 3
        };

        let subjectId;
        try {
            subjectId = await repos.subject.createSubject(subjectData);
            console.log('✅ Disciplina criada com ID:', subjectId);
        } catch (subjectError) {
            console.log('❌ Erro ao criar disciplina:', subjectError.message);
            
            // Tentar buscar uma disciplina existente
            const existingSubject = await db.get('SELECT id FROM app.subjects WHERE study_plan_id = $1 LIMIT 1', [validPlan.id]);
            if (existingSubject) {
                subjectId = existingSubject.id;
                console.log('📋 Usando disciplina existente ID:', subjectId);
            } else {
                console.log('❌ Não foi possível obter disciplina válida');
                return;
            }
        }

        // Criar tópico de teste
        console.log('\n📝 CRIANDO TÓPICO DE TESTE...');
        
        const topicData = {
            subject_id: subjectId,
            topic_name: 'Tópico Debug Test',
            description: 'Descrição do tópico de teste',
            priority_weight: 3,
            difficulty: 2,
            estimated_hours: 2,
            status: 'pending'
        };

        try {
            const topicId = await repos.topic.createTopic(topicData);
            console.log('✅ Tópico criado com sucesso! ID:', topicId);
            
            // Verificar se foi realmente criado
            const createdTopic = await repos.topic.findById(topicId);
            console.log('📋 Tópico verificado:', createdTopic ? createdTopic.topic_name : 'Não encontrado');
            
            // Limpar o teste
            await db.run('DELETE FROM app.topics WHERE id = $1', [topicId]);
            console.log('🧹 Tópico de teste removido');
            
        } catch (topicError) {
            console.log('❌ Erro ao criar tópico:', topicError.message);
            console.log('Stack:', topicError.stack);
            
            // Vamos tentar uma inserção direta para ver qual é o problema
            console.log('\n🔍 TENTANDO INSERÇÃO DIRETA...');
            
            try {
                const directInsert = `
                    INSERT INTO app.topics (
                        subject_id, topic_name, description, priority_weight,
                        difficulty, estimated_hours, status,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    ) RETURNING id
                `;

                const directResult = await db.get(directInsert, [
                    subjectId,
                    'Tópico Direto Test',
                    'Descrição direta',
                    3,
                    2,
                    2,
                    'pending'
                ]);
                
                console.log('✅ Inserção direta bem-sucedida! ID:', directResult.id);
                
                // Limpar
                await db.run('DELETE FROM app.topics WHERE id = $1', [directResult.id]);
                console.log('🧹 Registro direto removido');
                
            } catch (directError) {
                console.log('❌ Erro na inserção direta:', directError.message);
            }
        }

        console.log('\n✅ TESTE CONCLUÍDO!');

    } catch (error) {
        console.error('❌ ERRO GERAL NO TESTE:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

// Executar teste
testTopicCreation();