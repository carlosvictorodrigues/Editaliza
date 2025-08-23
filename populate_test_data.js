/**
 * Script para popular dados de teste no banco
 */

const db = require('./database-simple-postgres');

async function populateTestData() {
    console.log('🔧 POPULANDO DADOS DE TESTE\n');
    
    try {
        // 1. Buscar usuário e plano
        const user = await db.get('SELECT id FROM users WHERE email = ?', ['c@c.com']);
        if (!user) {
            console.log('❌ Usuário c@c.com não encontrado');
            return;
        }
        
        const plan = await db.get(
            'SELECT id FROM study_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [user.id]
        );
        if (!plan) {
            console.log('❌ Nenhum plano encontrado');
            return;
        }
        
        console.log(`✅ Usando plano ID: ${plan.id}\n`);
        
        // 2. Criar disciplinas se não existirem
        console.log('2️⃣ Criando disciplinas...');
        
        const subjects = [
            { name: 'Português', weight: 1.5 },
            { name: 'Matemática', weight: 1.0 },
            { name: 'Direito Constitucional', weight: 2.0 },
            { name: 'Direito Administrativo', weight: 2.0 },
            { name: 'Informática', weight: 1.0 }
        ];
        
        const subjectIds = [];
        for (const subject of subjects) {
            // Verificar se já existe
            const existing = await db.get(
                'SELECT id FROM subjects WHERE study_plan_id = ? AND subject_name = ?',
                [plan.id, subject.name]
            );
            
            if (existing) {
                subjectIds.push(existing.id);
                console.log(`   ✓ ${subject.name} já existe (ID: ${existing.id})`);
            } else {
                const result = await db.run(
                    'INSERT INTO subjects (study_plan_id, subject_name) VALUES (?, ?)',
                    [plan.id, subject.name]
                );
                subjectIds.push(result.lastID);
                console.log(`   ✓ ${subject.name} criada (ID: ${result.lastID})`);
            }
        }
        console.log('');
        
        // 3. Criar tópicos para cada disciplina
        console.log('3️⃣ Criando tópicos...');
        
        const topicsPerSubject = [
            { subjectIndex: 0, topics: ['Concordância Verbal', 'Concordância Nominal', 'Regência', 'Crase', 'Pontuação'] },
            { subjectIndex: 1, topics: ['Equações', 'Porcentagem', 'Razão e Proporção', 'Probabilidade', 'Estatística'] },
            { subjectIndex: 2, topics: ['Princípios Fundamentais', 'Direitos e Garantias', 'Organização do Estado', 'Poderes', 'Controle de Constitucionalidade'] },
            { subjectIndex: 3, topics: ['Atos Administrativos', 'Licitações', 'Contratos', 'Servidores Públicos', 'Improbidade'] },
            { subjectIndex: 4, topics: ['Excel', 'Word', 'Segurança', 'Redes', 'Hardware'] }
        ];
        
        const topicIds = [];
        for (const subjectTopics of topicsPerSubject) {
            const subjectId = subjectIds[subjectTopics.subjectIndex];
            const subjectName = subjects[subjectTopics.subjectIndex].name;
            
            for (const topicName of subjectTopics.topics) {
                // Verificar se já existe
                const existing = await db.get(
                    'SELECT id FROM topics WHERE subject_id = ? AND description = ?',
                    [subjectId, topicName]
                );
                
                if (existing) {
                    topicIds.push(existing.id);
                    console.log(`   ✓ ${subjectName} - ${topicName} já existe`);
                } else {
                    const result = await db.run(
                        'INSERT INTO topics (subject_id, description, priority_weight) VALUES (?, ?, ?)',
                        [subjectId, topicName, Math.floor(Math.random() * 3) + 1]
                    );
                    topicIds.push(result.lastID);
                    console.log(`   ✓ ${subjectName} - ${topicName} criado`);
                }
            }
        }
        console.log(`   Total de tópicos: ${topicIds.length}\n`);
        
        // 4. Criar algumas sessões de estudo
        console.log('4️⃣ Criando sessões de estudo...');
        
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 10; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        let sessionsCreated = 0;
        
        // Criar sessões de novos tópicos (algumas concluídas)
        for (let i = 0; i < Math.min(10, topicIds.length); i++) {
            const date = dates[Math.floor(i / 2)]; // 2 sessões por dia
            const status = i < 5 ? 'Concluído' : 'Pendente'; // Primeiras 5 concluídas
            
            const existing = await db.get(
                'SELECT id FROM study_sessions WHERE study_plan_id = ? AND topic_id = ? AND session_type = ?',
                [plan.id, topicIds[i], 'Novo Tópico']
            );
            
            if (!existing) {
                await db.run(
                    `INSERT INTO study_sessions 
                    (study_plan_id, topic_id, session_date, session_type, status, subject_name, topic_description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [plan.id, topicIds[i], date, 'Novo Tópico', status, subjects[Math.floor(i / 5)].name, `Tópico ${i+1}`]
                );
                sessionsCreated++;
                console.log(`   ✓ Sessão criada: ${date} - Tópico ${i+1} - ${status}`);
            }
        }
        
        // Criar algumas revisões
        for (let i = 0; i < 3; i++) {
            const date = dates[i];
            const topicId = topicIds[i];
            
            const existing = await db.get(
                'SELECT id FROM study_sessions WHERE study_plan_id = ? AND topic_id = ? AND session_type = ?',
                [plan.id, topicId, 'Revisão']
            );
            
            if (!existing) {
                await db.run(
                    `INSERT INTO study_sessions 
                    (study_plan_id, topic_id, session_date, session_type, status, subject_name, topic_description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [plan.id, topicId, date, 'Revisão', 'Concluído', subjects[0].name, `Revisão ${i+1}`]
                );
                sessionsCreated++;
                console.log(`   ✓ Revisão criada: ${date} - Tópico ${i+1}`);
            }
        }
        
        console.log(`   Total de sessões criadas: ${sessionsCreated}\n`);
        
        // 5. Verificar dados
        console.log('5️⃣ Verificando dados criados...');
        
        const totalTopics = await db.get(
            'SELECT COUNT(*) as count FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?',
            [plan.id]
        );
        console.log(`   Total de tópicos no plano: ${totalTopics.count}`);
        
        const completedTopics = await db.get(
            `SELECT COUNT(DISTINCT topic_id) as count 
            FROM study_sessions 
            WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL`,
            [plan.id]
        );
        console.log(`   Tópicos concluídos: ${completedTopics.count}`);
        
        const totalSessions = await db.get(
            'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ?',
            [plan.id]
        );
        console.log(`   Total de sessões: ${totalSessions.count}`);
        
        const completedSessions = await db.get(
            'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND status = ?',
            [plan.id, 'Concluído']
        );
        console.log(`   Sessões concluídas: ${completedSessions.count}`);
        
        console.log('\n✅ DADOS DE TESTE CRIADOS COM SUCESSO!');
        console.log('   Agora os cards da página plan.html devem mostrar estatísticas!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

populateTestData();