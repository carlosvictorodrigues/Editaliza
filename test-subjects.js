const fetch = require('node-fetch');

async function testSubjects() {
    const baseUrl = 'http://localhost:3000';
    
    try {
        // 1. Fazer login
        console.log('🔐 Fazendo login...');
        const loginResponse = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'teste@editaliza.com',
                password: 'teste123'
            })
        });
        
        const loginData = await loginResponse.json();
        
        if (!loginData.token) {
            console.error('❌ Erro no login:', loginData);
            return;
        }
        
        console.log('✅ Login bem-sucedido!');
        const token = loginData.token;
        
        // 2. Buscar planos
        console.log('\n📚 Buscando planos...');
        const plansResponse = await fetch(`${baseUrl}/plans`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const plans = await plansResponse.json();
        console.log('Planos encontrados:', plans.length);
        
        if (plans.length > 0) {
            const planId = plans[0].id;
            console.log(`\n📖 Testando disciplinas do plano ${planId}...`);
            
            // 3. Buscar disciplinas do plano
            const subjectsResponse = await fetch(`${baseUrl}/plans/${planId}/subjects`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const subjectsData = await subjectsResponse.json();
            
            if (subjectsResponse.ok) {
                console.log('✅ Disciplinas carregadas:', subjectsData);
            } else {
                console.log('❌ Erro ao carregar disciplinas:', subjectsData);
            }
            
            // 4. Adicionar uma disciplina de teste
            console.log('\n➕ Adicionando disciplina de teste...');
            const addSubjectResponse = await fetch(`${baseUrl}/plans/${planId}/subjects_with_topics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subject_name: 'Direito Constitucional',
                    priority_weight: 5,
                    topics_list: 'Princípios Fundamentais\nDireitos e Garantias\nOrganização do Estado'
                })
            });
            
            const addSubjectData = await addSubjectResponse.json();
            
            if (addSubjectResponse.ok) {
                console.log('✅ Disciplina adicionada:', addSubjectData);
                
                // 5. Buscar disciplinas novamente
                const subjectsResponse2 = await fetch(`${baseUrl}/plans/${planId}/subjects`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const subjectsData2 = await subjectsResponse2.json();
                console.log('\n📋 Disciplinas após adicionar:', subjectsData2);
            } else {
                console.log('❌ Erro ao adicionar disciplina:', addSubjectData);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testSubjects();