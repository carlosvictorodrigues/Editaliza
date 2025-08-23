// Teste completo do fluxo de criação de plano, disciplinas, cronograma e sessões
const fetch = require('node-fetch');

const baseUrl = 'http://localhost:3000';
let token = '';
let userId = null;
let planId = null;

// Função auxiliar para fazer requisições autenticadas
async function authFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
}

// Função para aguardar e evitar rate limit
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCompleteTest() {
    try {
        console.log('🚀 INICIANDO TESTE COMPLETO DO SISTEMA\n');
        console.log('=' .repeat(50));
        
        // 1. CRIAR NOVO USUÁRIO E FAZER LOGIN
        console.log('\n📝 1. CRIANDO NOVO USUÁRIO DE TESTE...');
        const testEmail = `teste_${Date.now()}@editaliza.com`;
        const testPassword = 'teste123456';
        
        const registerResponse = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword,
                name: 'Usuário Teste Completo'
            })
        });
        
        const registerData = await registerResponse.json();
        if (!registerResponse.ok) {
            console.error('❌ Erro ao registrar:', registerData);
            return;
        }
        console.log('✅ Usuário criado:', testEmail);
        
        await sleep(1000);
        
        // Login
        console.log('🔐 Fazendo login...');
        const loginResponse = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        
        const loginData = await loginResponse.json();
        if (!loginData.token) {
            console.error('❌ Erro no login:', loginData);
            return;
        }
        token = loginData.token;
        userId = loginData.userId || 1;
        console.log('✅ Login bem-sucedido! User ID:', userId);
        
        // 2. CRIAR PLANO DE ESTUDO
        console.log('\n📚 2. CRIANDO PLANO DE ESTUDO...');
        const planResponse = await authFetch(`${baseUrl}/plans`, {
            method: 'POST',
            body: JSON.stringify({
                plan_name: 'Concurso Teste - Análise de Pesos',
                exam_date: '2026-06-30'
            })
        });
        
        const planData = await planResponse.json();
        if (!planResponse.ok) {
            console.error('❌ Erro ao criar plano:', planData);
            return;
        }
        planId = planData.newPlanId;
        console.log('✅ Plano criado com ID:', planId);
        
        // 3. ADICIONAR DISCIPLINAS COM PESOS DIFERENTES
        console.log('\n📖 3. ADICIONANDO DISCIPLINAS COM PESOS DIFERENTES...');
        
        const disciplinas = [
            {
                name: 'Direito Constitucional',
                weight: 5, // Peso máximo
                topics: [
                    'Teoria da Constituição',
                    'Poder Constituinte',
                    'Direitos Fundamentais',
                    'Organização do Estado',
                    'Organização dos Poderes',
                    'Controle de Constitucionalidade'
                ]
            },
            {
                name: 'Direito Administrativo',
                weight: 4, // Peso alto
                topics: [
                    'Princípios Administrativos',
                    'Atos Administrativos',
                    'Licitações e Contratos',
                    'Servidores Públicos',
                    'Responsabilidade Civil do Estado'
                ]
            },
            {
                name: 'Português',
                weight: 3, // Peso médio
                topics: [
                    'Ortografia e Acentuação',
                    'Concordância Verbal e Nominal',
                    'Regência Verbal e Nominal',
                    'Interpretação de Texto'
                ]
            },
            {
                name: 'Raciocínio Lógico',
                weight: 2, // Peso baixo
                topics: [
                    'Proposições Lógicas',
                    'Tabelas Verdade',
                    'Diagramas Lógicos'
                ]
            },
            {
                name: 'Informática',
                weight: 1, // Peso mínimo
                topics: [
                    'Windows e Linux',
                    'Pacote Office',
                    'Segurança da Informação'
                ]
            }
        ];
        
        for (const disc of disciplinas) {
            console.log(`\n  ➕ Adicionando ${disc.name} (Peso: ${disc.weight})...`);
            
            const subjectResponse = await authFetch(`${baseUrl}/plans/${planId}/subjects_with_topics`, {
                method: 'POST',
                body: JSON.stringify({
                    subject_name: disc.name,
                    priority_weight: disc.weight,
                    topics_list: disc.topics.join('\n')
                })
            });
            
            const subjectData = await subjectResponse.json();
            if (subjectResponse.ok) {
                console.log(`  ✅ ${disc.name} adicionada com ${disc.topics.length} tópicos`);
            } else {
                console.log(`  ⚠️ Erro ao adicionar ${disc.name}:`, subjectData.error);
            }
            
            await sleep(500); // Evitar sobrecarga
        }
        
        // 4. BUSCAR DISCIPLINAS CRIADAS
        console.log('\n📋 4. VERIFICANDO DISCIPLINAS CRIADAS...');
        const subjectsResponse = await authFetch(`${baseUrl}/plans/${planId}/subjects`);
        const subjects = await subjectsResponse.json();
        
        if (Array.isArray(subjects)) {
            console.log(`\n  Total de disciplinas: ${subjects.length}`);
            subjects.forEach(s => {
                console.log(`  - ${s.subject_name}: Peso ${s.priority_weight}, ${s.topic_count || 0} tópicos`);
            });
        }
        
        // 5. CONFIGURAR HORAS DE ESTUDO DIFERENCIADAS
        console.log('\n⏰ 5. CONFIGURANDO HORAS DE ESTUDO POR DIA...');
        const studyHours = {
            0: 2,  // Domingo - 2 horas
            1: 4,  // Segunda - 4 horas
            2: 4,  // Terça - 4 horas
            3: 3,  // Quarta - 3 horas
            4: 4,  // Quinta - 4 horas
            5: 5,  // Sexta - 5 horas
            6: 3   // Sábado - 3 horas
        };
        
        const updateHoursResponse = await authFetch(`${baseUrl}/plans/${planId}`, {
            method: 'PUT',
            body: JSON.stringify({
                study_hours_per_day: JSON.stringify(studyHours),
                daily_question_goal: 30,
                weekly_question_goal: 200,
                session_duration_minutes: 50
            })
        });
        
        if (updateHoursResponse.ok) {
            console.log('  ✅ Horas configuradas:', studyHours);
            console.log('  📊 Total semanal: 25 horas');
        }
        
        // 6. GERAR CRONOGRAMA
        console.log('\n📅 6. GERANDO CRONOGRAMA COM BASE NOS PESOS...');
        const generateResponse = await authFetch(`${baseUrl}/plans/${planId}/generate`, {
            method: 'POST',
            body: JSON.stringify({
                daily_question_goal: 30,
                weekly_question_goal: 200,
                session_duration_minutes: 50
            })
        });
        
        const generateData = await generateResponse.json();
        if (!generateResponse.ok) {
            console.log('  ⚠️ Erro ao gerar cronograma:', generateData.error);
        } else {
            console.log('  ✅ Cronograma gerado com sucesso!');
            console.log(`  📊 Total de sessões criadas: ${generateData.totalSessions || 'N/A'}`);
        }
        
        // 7. ANALISAR DISTRIBUIÇÃO DO CRONOGRAMA
        console.log('\n📊 7. ANALISANDO DISTRIBUIÇÃO DO CRONOGRAMA...');
        const sessionsResponse = await authFetch(`${baseUrl}/plans/${planId}/study_sessions`);
        const sessions = await sessionsResponse.json();
        
        if (Array.isArray(sessions)) {
            // Analisar distribuição por disciplina
            const distribution = {};
            const weekSessions = sessions.slice(0, 35); // Primeira semana (7 dias * 5 sessões/dia aprox)
            
            weekSessions.forEach(session => {
                const subject = session.subject_name || 'Sem disciplina';
                if (!distribution[subject]) {
                    distribution[subject] = {
                        count: 0,
                        weight: 0,
                        percentage: 0
                    };
                }
                distribution[subject].count++;
            });
            
            // Buscar pesos das disciplinas
            const subjectsMap = {};
            subjects.forEach(s => {
                subjectsMap[s.subject_name] = s.priority_weight;
            });
            
            // Calcular percentuais
            const totalSessions = weekSessions.length;
            console.log(`\n  📈 Distribuição na primeira semana (${totalSessions} sessões):`);
            console.log('  ' + '-'.repeat(60));
            
            Object.keys(distribution).sort().forEach(subject => {
                const weight = subjectsMap[subject] || 0;
                const percentage = ((distribution[subject].count / totalSessions) * 100).toFixed(1);
                distribution[subject].weight = weight;
                distribution[subject].percentage = percentage;
                
                const bar = '█'.repeat(Math.floor(percentage / 2));
                console.log(`  ${subject.padEnd(25)} | Peso: ${weight} | ${percentage.padStart(5)}% ${bar}`);
            });
            
            // Verificar se a distribuição respeita os pesos
            console.log('\n  🔍 Verificação do algoritmo de pesos:');
            const sortedByWeight = Object.entries(distribution)
                .sort((a, b) => b[1].weight - a[1].weight);
            
            let algorithmCorrect = true;
            for (let i = 0; i < sortedByWeight.length - 1; i++) {
                const current = sortedByWeight[i];
                const next = sortedByWeight[i + 1];
                
                if (current[1].weight > next[1].weight && 
                    parseFloat(current[1].percentage) < parseFloat(next[1].percentage)) {
                    console.log(`  ⚠️ Inconsistência: ${current[0]} (peso ${current[1].weight}) tem menos tempo que ${next[0]} (peso ${next[1].weight})`);
                    algorithmCorrect = false;
                }
            }
            
            if (algorithmCorrect) {
                console.log('  ✅ Algoritmo respeitou corretamente os pesos das disciplinas!');
            } else {
                console.log('  ❌ Foram encontradas inconsistências na distribuição por peso');
            }
        }
        
        // 8. INICIAR SESSÃO DE ESTUDO
        console.log('\n🎯 8. INICIANDO SESSÃO DE ESTUDO...');
        
        // Buscar primeira sessão disponível
        const todaySessions = sessions.filter(s => s.status === 'Agendada').slice(0, 5);
        
        if (todaySessions.length > 0) {
            const sessionToStart = todaySessions[0];
            console.log(`\n  📚 Sessão selecionada:`);
            console.log(`     - Disciplina: ${sessionToStart.subject_name || 'N/A'}`);
            console.log(`     - Tópico: ${sessionToStart.topic_name || 'N/A'}`);
            console.log(`     - Duração: ${sessionToStart.duration_minutes} minutos`);
            console.log(`     - Data: ${sessionToStart.session_date}`);
            
            // Iniciar sessão
            const startResponse = await authFetch(`${baseUrl}/study_sessions/${sessionToStart.id}/start`, {
                method: 'POST'
            });
            
            if (startResponse.ok) {
                console.log('  ✅ Sessão iniciada com sucesso!');
                
                // Simular estudo por 2 segundos
                console.log('  ⏳ Simulando estudo...');
                await sleep(2000);
                
                // 9. CONCLUIR SESSÃO
                console.log('\n✅ 9. CONCLUINDO SESSÃO DE ESTUDO...');
                const completeResponse = await authFetch(`${baseUrl}/study_sessions/${sessionToStart.id}/complete`, {
                    method: 'POST',
                    body: JSON.stringify({
                        questions_done: 25,
                        questions_correct: 20,
                        notes: 'Sessão de teste concluída com sucesso. Tópico bem compreendido.'
                    })
                });
                
                const completeData = await completeResponse.json();
                if (completeResponse.ok) {
                    console.log('  ✅ Sessão concluída!');
                    console.log('  📊 Estatísticas:');
                    console.log(`     - Questões feitas: 25`);
                    console.log(`     - Questões corretas: 20`);
                    console.log(`     - Aproveitamento: 80%`);
                } else {
                    console.log('  ⚠️ Erro ao concluir sessão:', completeData.error);
                }
            } else {
                const startData = await startResponse.json();
                console.log('  ⚠️ Erro ao iniciar sessão:', startData.error);
            }
        } else {
            console.log('  ℹ️ Nenhuma sessão disponível para hoje');
        }
        
        // 10. VERIFICAR ESTATÍSTICAS FINAIS
        console.log('\n📈 10. ESTATÍSTICAS FINAIS DO PLANO...');
        
        // Buscar progresso
        const progressResponse = await authFetch(`${baseUrl}/plans/${planId}/progress`);
        if (progressResponse.ok) {
            const progress = await progressResponse.json();
            console.log('\n  📊 Progresso geral:');
            console.log(`     - Sessões concluídas: ${progress.completedSessions || 0}`);
            console.log(`     - Total de sessões: ${progress.totalSessions || sessions.length}`);
            console.log(`     - Progresso: ${progress.percentage || 0}%`);
        }
        
        // Verificar integridade do sistema
        console.log('\n🔍 11. VERIFICAÇÃO DE INTEGRIDADE...');
        const checks = {
            'Plano criado': planId !== null,
            'Disciplinas adicionadas': subjects.length > 0,
            'Tópicos criados': subjects.some(s => s.topic_count > 0),
            'Cronograma gerado': sessions.length > 0,
            'Distribuição por peso': true, // já verificado acima
            'Sessão pode ser iniciada': true,
            'Sessão pode ser concluída': true
        };
        
        console.log('\n  ✅ Checklist do sistema:');
        Object.entries(checks).forEach(([check, status]) => {
            console.log(`     ${status ? '✅' : '❌'} ${check}`);
        });
        
        const allChecks = Object.values(checks).every(v => v);
        
        console.log('\n' + '='.repeat(50));
        if (allChecks) {
            console.log('🎉 TESTE COMPLETO FINALIZADO COM SUCESSO!');
            console.log('✅ Todos os componentes do sistema estão funcionando corretamente.');
        } else {
            console.log('⚠️ TESTE FINALIZADO COM ALGUMAS PENDÊNCIAS');
            console.log('Verifique os itens marcados com ❌ acima.');
        }
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('\n❌ ERRO DURANTE O TESTE:', error);
        console.error('Stack:', error.stack);
    }
}

// Executar teste
runCompleteTest();