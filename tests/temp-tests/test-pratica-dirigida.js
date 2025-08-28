const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testPraticaDirigida() {
    console.log('==== TESTE DE PRÁTICA DIRIGIDA PONDERADA ====\n');
    
    try {
        // 1. Login
        console.log('1. Fazendo login...');
        const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'test@example.com',
            password: 'Test123!'
        });
        
        const token = loginResponse.data.token;
        const userId = loginResponse.data.userId;
        const headers = { 'Authorization': `Bearer ${token}` };
        
        console.log('✅ Login bem-sucedido!\n');
        
        // 2. Criar plano de estudo
        console.log('2. Criando plano de estudo...');
        const planResponse = await axios.post(`${API_URL}/api/plans`, {
            exam_name: 'Teste Prática Dirigida',
            exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
            study_hours_per_day: {
                '0': 2, // Domingo
                '1': 3, // Segunda
                '2': 3, // Terça
                '3': 3, // Quarta
                '4': 3, // Quinta
                '5': 3, // Sexta
                '6': 4  // Sábado
            },
            session_duration_minutes: 60
        }, { headers });
        
        const planId = planResponse.data.id;
        console.log(`✅ Plano criado com ID: ${planId}\n`);
        
        // 3. Adicionar disciplinas com diferentes pesos
        console.log('3. Adicionando disciplinas com pesos diferentes...');
        
        const subjects = [
            { name: 'Direito Constitucional', weight: 5 },
            { name: 'Direito Administrativo', weight: 4 },
            { name: 'Português', weight: 3 },
            { name: 'Raciocínio Lógico', weight: 2 },
            { name: 'Informática', weight: 1 }
        ];
        
        const subjectIds = [];
        
        for (const subject of subjects) {
            const subjectResponse = await axios.post(`${API_URL}/api/plans/${planId}/subjects`, {
                subject_name: subject.name,
                priority_weight: subject.weight
            }, { headers });
            
            subjectIds.push(subjectResponse.data.id);
            console.log(`  - ${subject.name} (peso ${subject.weight}) - ID: ${subjectResponse.data.id}`);
        }
        
        console.log('✅ Disciplinas adicionadas!\n');
        
        // 4. Adicionar alguns tópicos para cada disciplina
        console.log('4. Adicionando tópicos...');
        
        const topicsPerSubject = 3; // Menos tópicos para testar a lógica de prática
        
        for (let i = 0; i < subjectIds.length; i++) {
            const subjectId = subjectIds[i];
            const subjectName = subjects[i].name;
            
            for (let j = 1; j <= topicsPerSubject; j++) {
                await axios.post(`${API_URL}/api/subjects/${subjectId}/topics`, {
                    topic_name: `${subjectName} - Tópico ${j}`,
                    priority_weight: 3 // Peso padrão por enquanto
                }, { headers });
            }
            console.log(`  - ${topicsPerSubject} tópicos adicionados para ${subjectName}`);
        }
        
        console.log('✅ Tópicos adicionados!\n');
        
        // 5. Gerar cronograma
        console.log('5. Gerando cronograma com nova lógica de Prática Dirigida...');
        
        const generateResponse = await axios.post(`${API_URL}/api/plans/${planId}/generate`, {}, { headers });
        
        console.log('✅ Cronograma gerado:', generateResponse.data.message);
        console.log('\n');
        
        // 6. Buscar e analisar as sessões geradas
        console.log('6. Analisando distribuição das sessões...\n');
        
        const sessionsResponse = await axios.get(`${API_URL}/api/plans/${planId}/sessions`, { headers });
        const sessions = sessionsResponse.data;
        
        // Contar tipos de sessões
        const sessionStats = {
            'Novo Tópico': 0,
            'Prática Dirigida': 0,
            'Revisão Consolidada': 0
        };
        
        const practiceBySubject = {};
        
        sessions.forEach(session => {
            sessionStats[session.session_type] = (sessionStats[session.session_type] || 0) + 1;
            
            if (session.session_type === 'Prática Dirigida') {
                const subjectName = session.subject_name.replace('Prática: ', '');
                practiceBySubject[subjectName] = (practiceBySubject[subjectName] || 0) + 1;
            }
        });
        
        console.log('📊 ESTATÍSTICAS DO CRONOGRAMA:');
        console.log('================================');
        console.log(`Total de sessões: ${sessions.length}`);
        console.log('\nDistribuição por tipo:');
        Object.entries(sessionStats).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count} sessões`);
        });
        
        console.log('\n📈 DISTRIBUIÇÃO DE PRÁTICAS DIRIGIDAS POR DISCIPLINA:');
        console.log('(Deveria ser proporcional aos pesos: 5:4:3:2:1)');
        console.log('-----------------------------------------------------');
        
        const totalPractices = Object.values(practiceBySubject).reduce((a, b) => a + b, 0);
        
        subjects.forEach(subject => {
            const count = practiceBySubject[subject.name] || 0;
            const percentage = totalPractices > 0 ? ((count / totalPractices) * 100).toFixed(1) : 0;
            const expectedPercentage = ((subject.weight / 15) * 100).toFixed(1); // 15 é a soma dos pesos
            const bar = '█'.repeat(Math.round(count));
            
            console.log(`${subject.name.padEnd(25)} Peso: ${subject.weight} | Práticas: ${String(count).padStart(2)} (${percentage}%) | Esperado: ${expectedPercentage}%`);
            console.log(`${''.padEnd(25)} ${bar}`);
        });
        
        console.log('\n✅ Teste concluído com sucesso!');
        
        // Mostrar primeiras 10 sessões como exemplo
        console.log('\n📅 PRIMEIRAS 10 SESSÕES DO CRONOGRAMA:');
        console.log('==========================================');
        sessions.slice(0, 10).forEach((session, index) => {
            console.log(`${index + 1}. ${session.session_date.split('T')[0]} - ${session.session_type}: ${session.subject_name}`);
            if (session.session_type === 'Prática Dirigida') {
                console.log(`   ${session.topic_description.split('\n')[0]}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error.response?.data || error.message);
        process.exit(1);
    }
}

// Executar teste
testPraticaDirigida().catch(console.error);