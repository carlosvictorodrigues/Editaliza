const fetch = require('node-fetch');

async function generateScheduleViaAPI() {
    console.log('🎯 Gerando cronograma via API para Plano 25');
    console.log('============================================================\n');
    
    try {
        // 1. Fazer login
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
            console.error('❌ Erro no login:', await loginResponse.text());
            return;
        }
        
        const cookies = loginResponse.headers.get('set-cookie');
        console.log('✅ Login realizado com sucesso');
        
        // 2. Obter token CSRF
        console.log('\n🔑 Obtendo token CSRF...');
        const csrfResponse = await fetch('http://localhost:3000/api/csrf-token', {
            headers: {
                'Cookie': cookies
            }
        });
        
        if (!csrfResponse.ok) {
            console.error('❌ Erro ao obter CSRF token');
            return;
        }
        
        const { token } = await csrfResponse.json();
        console.log('✅ Token CSRF obtido');
        
        // 3. Gerar cronograma
        console.log('\n📅 Gerando cronograma...');
        const generateResponse = await fetch('http://localhost:3000/api/generate-schedule/25', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies,
                'X-CSRF-Token': token
            }
        });
        
        if (!generateResponse.ok) {
            const error = await generateResponse.text();
            console.error('❌ Erro ao gerar cronograma:', error);
            return;
        }
        
        const result = await generateResponse.json();
        console.log('✅ Cronograma gerado com sucesso!');
        console.log('📊 Resultado:', result);
        
        // 4. Buscar informações do cronograma
        console.log('\n📊 Buscando informações do cronograma...');
        const scheduleResponse = await fetch('http://localhost:3000/api/study-sessions?planId=25', {
            headers: {
                'Cookie': cookies
            }
        });
        
        if (scheduleResponse.ok) {
            const sessions = await scheduleResponse.json();
            console.log(`\n📅 Total de sessões criadas: ${sessions.length}`);
            
            // Agrupar por data
            const sessionsByDate = {};
            sessions.forEach(session => {
                const date = new Date(session.session_date).toLocaleDateString('pt-BR');
                if (!sessionsByDate[date]) {
                    sessionsByDate[date] = 0;
                }
                sessionsByDate[date]++;
            });
            
            // Mostrar sessões para hoje
            const today = new Date('2025-08-23').toLocaleDateString('pt-BR');
            if (sessionsByDate[today]) {
                console.log(`\n📅 Sessões para hoje (${today}): ${sessionsByDate[today]}`);
                
                // Mostrar primeiras sessões
                const todaySessions = sessions.filter(s => {
                    const date = new Date(s.session_date).toLocaleDateString('pt-BR');
                    return date === today;
                }).slice(0, 5);
                
                todaySessions.forEach((session, index) => {
                    const time = new Date(session.session_date).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    console.log(`   ${index + 1}. ${time} - ${session.subject_name}: ${session.topic_description?.substring(0, 40)}...`);
                });
            }
            
            // Agrupar por matéria
            const sessionsBySubject = {};
            sessions.forEach(session => {
                if (!sessionsBySubject[session.subject_name]) {
                    sessionsBySubject[session.subject_name] = 0;
                }
                sessionsBySubject[session.subject_name]++;
            });
            
            console.log('\n📈 Distribuição por matéria:');
            Object.entries(sessionsBySubject)
                .sort((a, b) => b[1] - a[1])
                .forEach(([subject, count]) => {
                    const percentage = ((count / sessions.length) * 100).toFixed(1);
                    console.log(`   - ${subject}: ${count} sessões (${percentage}%)`);
                });
        }
        
        console.log('\n✅ PROCESSO CONCLUÍDO COM SUCESSO!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

generateScheduleViaAPI();