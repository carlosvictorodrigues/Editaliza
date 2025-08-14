const db = require('./database.js');

const createTestPlan = async () => {
    try {
        console.log('📋 Criando plano de teste...');
        
        // Primeiro, verificar se usuário debug@test.com existe
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE email = ?', ['debug@test.com'], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!user) {
            console.error('❌ Usuário debug@test.com não encontrado');
            process.exit(1);
        }
        
        console.log('✅ Usuário encontrado:', user.id);
        
        // Criar plano de estudo simples
        const planId = await new Promise((resolve, reject) => {
            db.run(`INSERT INTO study_plans 
                (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, reta_final_mode) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [
                    user.id,
                    'DEBUG_PLAN',
                    '2025-12-31',
                    '{"0":4,"1":8,"2":8,"3":8,"4":8,"5":8,"6":4}',
                    50,
                    300,
                    90,
                    'Revisões Espaçadas',
                    0,
                    0
                ], 
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        
        console.log('✅ Plano criado com ID:', planId);
        
        // Criar uma disciplina simples
        const subjectId = await new Promise((resolve, reject) => {
            db.run('INSERT INTO subjects (study_plan_id, subject_name, priority_weight) VALUES (?, ?, ?)', 
                [planId, 'Matemática', 3], 
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        
        console.log('✅ Disciplina criada com ID:', subjectId);
        
        // Criar alguns tópicos simples
        const topics = [
            'Álgebra Linear',
            'Geometria Analítica', 
            'Cálculo Diferencial'
        ];
        
        for (let i = 0; i < topics.length; i++) {
            const topicId = await new Promise((resolve, reject) => {
                db.run('INSERT INTO topics (subject_id, description, status) VALUES (?, ?, ?)', 
                    [subjectId, topics[i], 'Pendente'], 
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
            console.log(`✅ Tópico criado: ${topics[i]} (ID: ${topicId})`);
        }
        
        console.log('🎉 Plano de teste criado com sucesso!');
        console.log('📋 Plan ID para teste:', planId);
        
    } catch (error) {
        console.error('❌ Erro ao criar plano de teste:', error);
    }
    
    process.exit(0);
};

createTestPlan();