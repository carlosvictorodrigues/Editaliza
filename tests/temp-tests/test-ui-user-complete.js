const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testUIUserFeatures() {
    console.log('🧪 Testando funcionalidades completas com ui@ui.com...\n');
    
    try {
        // 1. Login
        console.log('1️⃣ Fazendo login com ui@ui.com...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'ui@ui.com',
            password: '123456'
        }, {
            validateStatus: () => true
        });
        
        if (loginResponse.status !== 200) {
            console.log('   ❌ Falha no login:', loginResponse.data);
            return;
        }
        
        console.log('   ✅ Login bem-sucedido!');
        const token = loginResponse.data.token;
        const userId = loginResponse.data.user?.id;
        console.log('   User ID:', userId);
        
        const authHeaders = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        // 2. Verificar planos existentes
        console.log('\n2️⃣ Verificando planos do usuário...');
        const plansResponse = await axios.get(`${BASE_URL}/api/plans`, {
            headers: authHeaders,
            validateStatus: () => true
        });
        
        if (plansResponse.status === 200) {
            console.log('   ✅ Planos encontrados:', plansResponse.data.length);
            if (plansResponse.data.length > 0) {
                console.log('   Primeiro plano:', plansResponse.data[0].title);
            }
        } else {
            console.log('   ⚠️ Erro ao buscar planos:', plansResponse.status);
        }
        
        // 3. Criar novo plano
        console.log('\n3️⃣ Criando novo plano de estudos...');
        const newPlanResponse = await axios.post(`${BASE_URL}/api/plans`, {
            title: 'Plano de Teste Automatizado',
            description: 'Plano criado via teste automatizado',
            exam_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 dias
            daily_hours: 4,
            total_weight: 100
        }, {
            headers: authHeaders,
            validateStatus: () => true
        });
        
        if (newPlanResponse.status === 201 || newPlanResponse.status === 200) {
            console.log('   ✅ Plano criado com sucesso!');
            const planId = newPlanResponse.data.id;
            console.log('   Plan ID:', planId);
            
            // 4. Adicionar disciplinas ao plano
            console.log('\n4️⃣ Adicionando disciplinas ao plano...');
            const subjects = [
                { name: 'Matemática', weight: 30, difficulty: 3 },
                { name: 'Português', weight: 30, difficulty: 2 },
                { name: 'História', weight: 20, difficulty: 2 },
                { name: 'Geografia', weight: 20, difficulty: 1 }
            ];
            
            for (const subject of subjects) {
                const subjectResponse = await axios.post(`${BASE_URL}/api/plans/${planId}/subjects`, subject, {
                    headers: authHeaders,
                    validateStatus: () => true
                });
                
                if (subjectResponse.status === 201 || subjectResponse.status === 200) {
                    console.log(`   ✅ ${subject.name} adicionada`);
                } else {
                    console.log(`   ❌ Erro ao adicionar ${subject.name}:`, subjectResponse.status);
                }
            }
        } else {
            console.log('   ❌ Erro ao criar plano:', newPlanResponse.data);
        }
        
        // 5. Verificar sessões de estudo
        console.log('\n5️⃣ Verificando sessões de estudo...');
        const sessionsResponse = await axios.get(`${BASE_URL}/api/study-sessions`, {
            headers: authHeaders,
            validateStatus: () => true
        });
        
        if (sessionsResponse.status === 200) {
            console.log('   ✅ Sessões encontradas:', sessionsResponse.data.length || 0);
            if (sessionsResponse.data.length > 0) {
                console.log('   Primeira sessão:', sessionsResponse.data[0].subject_name);
            }
        } else {
            console.log('   ⚠️ Endpoint de sessões:', sessionsResponse.status);
        }
        
        // 6. Marcar sessão como concluída
        console.log('\n6️⃣ Marcando sessão como concluída...');
        if (sessionsResponse.data && sessionsResponse.data.length > 0) {
            const sessionId = sessionsResponse.data[0].id;
            const completeResponse = await axios.put(`${BASE_URL}/api/study-sessions/${sessionId}/complete`, {
                completed: true
            }, {
                headers: authHeaders,
                validateStatus: () => true
            });
            
            if (completeResponse.status === 200) {
                console.log('   ✅ Sessão marcada como concluída!');
            } else {
                console.log('   ⚠️ Status:', completeResponse.status);
            }
        }
        
        // 7. Verificar gamificação
        console.log('\n7️⃣ Verificando sistema de gamificação...');
        const gamificationResponse = await axios.get(`${BASE_URL}/api/gamification/stats`, {
            headers: authHeaders,
            validateStatus: () => true
        });
        
        if (gamificationResponse.status === 200) {
            console.log('   ✅ Gamificação ativa!');
            console.log('   - Pontos:', gamificationResponse.data.points || 0);
            console.log('   - Nível:', gamificationResponse.data.level || 1);
            console.log('   - Streak:', gamificationResponse.data.streak || 0);
        } else {
            console.log('   ⚠️ Status gamificação:', gamificationResponse.status);
        }
        
        // 8. Verificar estatísticas
        console.log('\n8️⃣ Verificando estatísticas...');
        const statsResponse = await axios.get(`${BASE_URL}/api/statistics`, {
            headers: authHeaders,
            validateStatus: () => true
        });
        
        if (statsResponse.status === 200) {
            console.log('   ✅ Estatísticas disponíveis!');
            console.log('   - Horas estudadas:', statsResponse.data.total_hours || 0);
            console.log('   - Sessões concluídas:', statsResponse.data.completed_sessions || 0);
        } else {
            console.log('   ⚠️ Status estatísticas:', statsResponse.status);
        }
        
        // 9. Verificar notificações
        console.log('\n9️⃣ Verificando notificações inteligentes...');
        const notificationsResponse = await axios.get(`${BASE_URL}/api/notifications`, {
            headers: authHeaders,
            validateStatus: () => true
        });
        
        if (notificationsResponse.status === 200) {
            console.log('   ✅ Sistema de notificações ativo!');
            console.log('   - Total notificações:', notificationsResponse.data.length || 0);
            if (notificationsResponse.data.length > 0) {
                console.log('   - Última:', notificationsResponse.data[0].message);
            }
        } else {
            console.log('   ⚠️ Status notificações:', notificationsResponse.status);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DOS TESTES:');
        console.log('✅ Login funcionando');
        console.log(`${plansResponse.status === 200 ? '✅' : '⚠️'} Planos`);
        console.log(`${newPlanResponse.status === 201 || newPlanResponse.status === 200 ? '✅' : '⚠️'} Criar plano`);
        console.log(`${sessionsResponse.status === 200 ? '✅' : '⚠️'} Sessões de estudo`);
        console.log(`${gamificationResponse.status === 200 ? '✅' : '⚠️'} Gamificação`);
        console.log(`${statsResponse.status === 200 ? '✅' : '⚠️'} Estatísticas`);
        console.log(`${notificationsResponse.status === 200 ? '✅' : '⚠️'} Notificações`);
        
    } catch (error) {
        console.error('❌ Erro durante teste:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
    
    console.log('\n✅ Teste concluído!');
}

// Execute test
testUIUserFeatures();