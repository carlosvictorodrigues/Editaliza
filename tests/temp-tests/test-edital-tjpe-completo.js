const axios = require('axios');

const API_URL = 'http://localhost:3000';

// Estrutura completa do edital TJPE baseada no conteúdo programático
const EDITAL_TJPE = {
    'Língua Portuguesa': {
        weight: 4, // Peso alto pois é fundamental
        topics: [
            { name: 'Interpretação de textos', weight: 5 },
            { name: 'Ortografia e Acentuação', weight: 4 },
            { name: 'Pontuação', weight: 4 },
            { name: 'Concordância nominal e verbal', weight: 4 },
            { name: 'Regência nominal e verbal', weight: 4 },
            { name: 'Morfossintaxe e Sintaxe', weight: 4 },
            { name: 'Morfologia - formação de palavras', weight: 3 },
            { name: 'Semântica e Vocabulário', weight: 3 },
            { name: 'Colocação Pronominal', weight: 3 },
            { name: 'Vozes verbais', weight: 2 },
            { name: 'Correlação de tempos e modos verbais', weight: 2 },
            { name: 'Coordenação e Subordinação', weight: 2 },
            { name: 'Figuras de linguagem', weight: 2 },
            { name: 'Redação - reescrita de frases', weight: 3 },
            { name: 'Redação oficial', weight: 2 }
        ]
    },
    'Raciocínio Lógico': {
        weight: 3,
        topics: [
            { name: 'Lógica Proposicional', weight: 5 },
            { name: 'Argumentação Lógica', weight: 4 },
            { name: 'Análise Combinatória', weight: 4 },
            { name: 'Probabilidade', weight: 4 },
            { name: 'Raciocínio Sequencial', weight: 3 },
            { name: 'Raciocínio Lógico Quantitativo', weight: 3 },
            { name: 'Raciocínio Lógico Analítico', weight: 3 },
            { name: 'Diagramas Lógicos', weight: 3 }
        ]
    },
    'Direito Administrativo': {
        weight: 5, // Peso máximo - matéria principal
        topics: [
            { name: 'Princípios do Direito Administrativo', weight: 5 },
            { name: 'Administração Pública - conceitos e princípios', weight: 5 },
            { name: 'Atos administrativos', weight: 5 },
            { name: 'Contratos administrativos', weight: 4 },
            { name: 'Licitação - modalidades e procedimento', weight: 5 },
            { name: 'Sistema de Registro de Preços', weight: 3 },
            { name: 'Serviços Públicos', weight: 4 },
            { name: 'Servidores Públicos - regime jurídico', weight: 4 },
            { name: 'Responsabilidade do servidor público', weight: 4 },
            { name: 'Bens Públicos', weight: 3 },
            { name: 'Controle da Administração', weight: 4 },
            { name: 'Responsabilidade civil do Estado', weight: 4 },
            { name: 'Desapropriação', weight: 3 },
            { name: 'Processo Administrativo', weight: 3 },
            { name: 'Lei de Improbidade Administrativa', weight: 5 },
            { name: 'Nova Lei de Licitações (14.133/21)', weight: 5 }
        ]
    },
    'Direito Constitucional': {
        weight: 5, // Peso máximo - matéria principal
        topics: [
            { name: 'Princípios Fundamentais', weight: 5 },
            { name: 'Direitos e Garantias Fundamentais', weight: 5 },
            { name: 'Organização do Estado', weight: 4 },
            { name: 'Organização dos Poderes', weight: 5 },
            { name: 'Funções Essenciais à Justiça', weight: 4 },
            { name: 'Da Administração Pública', weight: 5 },
            { name: 'Sistema Tributário Nacional', weight: 2 },
            { name: 'Ordem Econômica e Financeira', weight: 2 },
            { name: 'Ordem Social', weight: 2 },
            { name: 'Constituição de Pernambuco', weight: 4 },
            { name: 'Ação Civil Pública', weight: 3 },
            { name: 'Mandado de Segurança', weight: 4 }
        ]
    },
    'Direito Civil': {
        weight: 4,
        topics: [
            { name: 'Pessoas naturais e jurídicas', weight: 4 },
            { name: 'Domicílio', weight: 2 },
            { name: 'Bens', weight: 3 },
            { name: 'Atos e Negócios jurídicos', weight: 5 },
            { name: 'Prescrição e decadência', weight: 4 },
            { name: 'Prova', weight: 3 },
            { name: 'Obrigações', weight: 4 },
            { name: 'Responsabilidade Civil', weight: 5 }
        ]
    },
    'Direito Processual Civil': {
        weight: 4,
        topics: [
            { name: 'Jurisdição e ação', weight: 4 },
            { name: 'Partes e procuradores', weight: 3 },
            { name: 'Competência', weight: 5 },
            { name: 'Atos processuais', weight: 4 },
            { name: 'Formação, suspensão e extinção do processo', weight: 3 },
            { name: 'Procedimento comum', weight: 4 },
            { name: 'Provas', weight: 5 },
            { name: 'Sentença e coisa julgada', weight: 4 },
            { name: 'Recursos', weight: 5 },
            { name: 'Execução', weight: 4 },
            { name: 'Tutela provisória', weight: 4 },
            { name: 'Procedimentos especiais', weight: 3 }
        ]
    },
    'Direito Penal': {
        weight: 3,
        topics: [
            { name: 'Tipicidade, ilicitude e culpabilidade', weight: 5 },
            { name: 'Excludentes de ilicitude e culpabilidade', weight: 4 },
            { name: 'Erro de tipo e erro de proibição', weight: 3 },
            { name: 'Imputabilidade penal', weight: 3 },
            { name: 'Concurso de pessoas', weight: 3 },
            { name: 'Crimes contra a Administração Pública', weight: 5 },
            { name: 'Crimes contra a fé pública', weight: 4 },
            { name: 'Crimes contra o patrimônio', weight: 4 },
            { name: 'Crimes contra a pessoa', weight: 3 }
        ]
    },
    'Direito Processual Penal': {
        weight: 3,
        topics: [
            { name: 'Ação Penal Pública e Privada', weight: 4 },
            { name: 'Denúncia e Queixa', weight: 4 },
            { name: 'Sujeitos do processo', weight: 3 },
            { name: 'Atos Processuais', weight: 3 },
            { name: 'Prisão e Liberdade Provisória', weight: 5 },
            { name: 'Sentença penal', weight: 4 },
            { name: 'Recursos criminais', weight: 4 },
            { name: 'Habeas Corpus', weight: 4 }
        ]
    },
    'Legislação Específica TJPE': {
        weight: 4,
        topics: [
            { name: 'Regimento Interno do TJPE', weight: 5 },
            { name: 'Código de Organização Judiciária de PE', weight: 5 },
            { name: 'Regime Jurídico dos Servidores de PE', weight: 5 },
            { name: 'Sistema PJe - Processo Eletrônico', weight: 4 },
            { name: 'Lei de Informatização do Processo', weight: 3 }
        ]
    }
};

async function testCronogramaTJPE() {
    console.log('==================================================');
    console.log('    TESTE COMPLETO - EDITAL TJPE COM IBFC');
    console.log('==================================================\n');
    
    try {
        // 1. Login
        console.log('📝 ETAPA 1: Autenticação');
        console.log('------------------------');
        const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'test@example.com',
            password: 'Test123!'
        });
        
        const token = loginResponse.data.token;
        const userId = loginResponse.data.userId;
        const headers = { 'Authorization': `Bearer ${token}` };
        
        console.log('✅ Login realizado com sucesso');
        console.log(`   User ID: ${userId}\n`);
        
        // 2. Criar plano de estudo para o TJPE
        console.log('📚 ETAPA 2: Criação do Plano de Estudos');
        console.log('----------------------------------------');
        console.log('Concurso: TJPE - Analista Judiciário');
        console.log('Banca: IBFC');
        console.log('Prazo: 60 dias (simulando data de prova)');
        
        const examDate = new Date();
        examDate.setDate(examDate.getDate() + 60); // 60 dias para a prova
        
        const planResponse = await axios.post(`${API_URL}/api/plans`, {
            exam_name: 'TJPE - Analista Judiciário',
            exam_date: examDate.toISOString(),
            study_hours_per_day: {
                '0': 4, // Domingo - mais tempo
                '1': 3, // Segunda
                '2': 3, // Terça
                '3': 3, // Quarta
                '4': 3, // Quinta
                '5': 3, // Sexta
                '6': 5  // Sábado - mais tempo
            },
            session_duration_minutes: 50 // Sessões de 50 minutos com 10 min de intervalo
        }, { headers });
        
        const planId = planResponse.data.id;
        console.log(`✅ Plano criado - ID: ${planId}\n`);
        
        // 3. Adicionar todas as disciplinas com seus pesos
        console.log('📖 ETAPA 3: Adicionando Disciplinas do Edital');
        console.log('----------------------------------------------');
        
        const subjectMap = {};
        let totalTopics = 0;
        
        for (const [subjectName, subjectData] of Object.entries(EDITAL_TJPE)) {
            const subjectResponse = await axios.post(`${API_URL}/api/plans/${planId}/subjects`, {
                subject_name: subjectName,
                priority_weight: subjectData.weight
            }, { headers });
            
            subjectMap[subjectName] = subjectResponse.data.id;
            console.log(`✅ ${subjectName.padEnd(30)} - Peso: ${subjectData.weight} - ID: ${subjectResponse.data.id}`);
        }
        
        console.log('\n');
        
        // 4. Adicionar todos os tópicos com seus pesos
        console.log('📝 ETAPA 4: Adicionando Tópicos/Assuntos');
        console.log('-----------------------------------------');
        
        for (const [subjectName, subjectData] of Object.entries(EDITAL_TJPE)) {
            const subjectId = subjectMap[subjectName];
            console.log(`\n${subjectName}:`);
            
            for (const topic of subjectData.topics) {
                await axios.post(`${API_URL}/api/subjects/${subjectId}/topics`, {
                    topic_name: topic.name,
                    priority_weight: topic.weight // Por enquanto não usamos, mas já enviamos
                }, { headers });
                
                totalTopics++;
                const priorityIndicator = '★'.repeat(topic.weight);
                console.log(`  ✅ ${topic.name.padEnd(45)} ${priorityIndicator}`);
            }
        }
        
        console.log(`\n📊 Total de tópicos cadastrados: ${totalTopics}\n`);
        
        // 5. Gerar cronograma
        console.log('🗓️ ETAPA 5: Gerando Cronograma Otimizado');
        console.log('------------------------------------------');
        console.log('Aplicando algoritmo de Prática Dirigida Ponderada...');
        
        const generateResponse = await axios.post(`${API_URL}/api/plans/${planId}/generate`, {}, { headers });
        
        console.log(`✅ ${generateResponse.data.message}\n`);
        
        // 6. Analisar as sessões geradas
        console.log('📊 ETAPA 6: Análise do Cronograma Gerado');
        console.log('-----------------------------------------');
        
        const sessionsResponse = await axios.get(`${API_URL}/api/plans/${planId}/sessions`, { headers });
        const sessions = sessionsResponse.data;
        
        // Estatísticas gerais
        const stats = {
            total: sessions.length,
            byType: {},
            bySubject: {},
            practiceBySubject: {},
            topicsBySubject: {}
        };
        
        sessions.forEach(session => {
            // Contar por tipo
            stats.byType[session.session_type] = (stats.byType[session.session_type] || 0) + 1;
            
            // Contar por matéria
            if (session.session_type === 'Novo Tópico') {
                stats.topicsBySubject[session.subject_name] = (stats.topicsBySubject[session.subject_name] || 0) + 1;
            } else if (session.session_type === 'Prática Dirigida') {
                const subjectName = session.subject_name.replace('Prática: ', '');
                stats.practiceBySubject[subjectName] = (stats.practiceBySubject[subjectName] || 0) + 1;
            }
        });
        
        console.log('📈 RESUMO GERAL:');
        console.log('----------------');
        console.log(`Total de sessões de estudo: ${stats.total}`);
        console.log(`Dias de estudo: ${Math.ceil(stats.total / 3)} (aproximadamente)`);
        console.log('\nDistribuição por tipo:');
        Object.entries(stats.byType).forEach(([type, count]) => {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            console.log(`  • ${type.padEnd(25)}: ${String(count).padStart(3)} sessões (${percentage}%)`);
        });
        
        console.log('\n📚 COBERTURA DE TÓPICOS POR DISCIPLINA:');
        console.log('------------------------------------------');
        
        for (const [subjectName, subjectData] of Object.entries(EDITAL_TJPE)) {
            const topicCount = stats.topicsBySubject[subjectName] || 0;
            const totalSubjectTopics = subjectData.topics.length;
            const coverage = ((topicCount / totalSubjectTopics) * 100).toFixed(0);
            
            console.log(`${subjectName.padEnd(30)} ${String(topicCount).padStart(2)}/${totalSubjectTopics} tópicos (${coverage}% cobertura)`);
        }
        
        console.log('\n🎯 DISTRIBUIÇÃO DE PRÁTICAS DIRIGIDAS:');
        console.log('---------------------------------------');
        console.log('(Deve refletir os pesos das disciplinas)\n');
        
        // Calcular proporções esperadas
        const totalWeight = Object.values(EDITAL_TJPE).reduce((sum, s) => sum + s.weight, 0);
        const totalPractices = Object.values(stats.practiceBySubject).reduce((sum, count) => sum + count, 0);
        
        console.log('Disciplina                     Peso  Práticas  Real%  Esperado%  Status');
        console.log('------------------------------------------------------------------------');
        
        for (const [subjectName, subjectData] of Object.entries(EDITAL_TJPE)) {
            const practiceCount = stats.practiceBySubject[subjectName] || 0;
            const realPercentage = totalPractices > 0 ? ((practiceCount / totalPractices) * 100).toFixed(1) : '0.0';
            const expectedPercentage = ((subjectData.weight / totalWeight) * 100).toFixed(1);
            const difference = Math.abs(parseFloat(realPercentage) - parseFloat(expectedPercentage));
            
            let status = '✅';
            if (difference > 5) status = '⚠️';
            if (difference > 10) status = '❌';
            
            const bar = '█'.repeat(Math.round(practiceCount / 2));
            
            console.log(
                `${subjectName.padEnd(30)} ${String(subjectData.weight).padStart(4)}  ` +
                `${String(practiceCount).padStart(8)}  ${realPercentage.padStart(5)}%  ` +
                `${expectedPercentage.padStart(8)}%  ${status}`
            );
            console.log(`${''.padEnd(30)} ${bar}`);
        }
        
        console.log('\n📅 AMOSTRA DO CRONOGRAMA (Primeiras 20 sessões):');
        console.log('--------------------------------------------------');
        
        sessions.slice(0, 20).forEach((session, index) => {
            const date = new Date(session.session_date);
            const dateStr = date.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit',
                weekday: 'short'
            });
            
            let description = '';
            if (session.session_type === 'Novo Tópico') {
                description = `${session.subject_name}: ${session.topic_description}`;
            } else if (session.session_type === 'Prática Dirigida') {
                description = session.subject_name;
            } else {
                description = session.subject_name;
            }
            
            console.log(`${String(index + 1).padStart(3)}. ${dateStr} - ${session.session_type.padEnd(20)} | ${description}`);
        });
        
        console.log('\n');
        console.log('==================================================');
        console.log('           TESTE CONCLUÍDO COM SUCESSO!');
        console.log('==================================================');
        console.log('\n💡 OBSERVAÇÕES IMPORTANTES:');
        console.log('----------------------------');
        console.log('1. O cronograma distribui os tópicos usando Weighted Round-Robin');
        console.log('2. Após cobrir todos os tópicos, preenche com Práticas Dirigidas');
        console.log('3. As Práticas seguem a proporção dos pesos das disciplinas');
        console.log('4. Direito Admin e Constitucional (peso 5) devem ter mais práticas');
        console.log('5. Raciocínio Lógico e Dir. Penal (peso 3) devem ter menos práticas');
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error.response?.data || error.message);
        if (error.response?.data?.details) {
            console.error('Detalhes:', error.response.data.details);
        }
        process.exit(1);
    }
}

// Executar teste
testCronogramaTJPE().catch(console.error);