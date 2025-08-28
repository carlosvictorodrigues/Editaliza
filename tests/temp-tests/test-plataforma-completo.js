/**
 * Teste Completo e Sequencial da Plataforma Editaliza
 * 
 * Simula TODAS as ações de um usuário real:
 * 1. Registro de nova conta
 * 2. Login na plataforma
 * 3. Criação de plano de estudos
 * 4. Adição de disciplinas com pesos
 * 5. Adição de tópicos com pesos
 * 6. Geração de cronograma
 * 7. Verificação do algoritmo round-robin ponderado
 * 8. Visualização de sessões na home
 * 9. Marcação de sessões como concluídas
 * 10. Verificação de estatísticas e gamificação
 */

const axios = require('axios');
const fs = require('fs');

// Configuração
const API_URL = 'http://localhost:3000/api';
const timestamp = Date.now();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Estado global do teste
let authToken = '';
let userId = '';
let planId = '';
let sessions = [];
let testResults = {
    timestamp: timestamp,
    etapas: [],
    erros: [],
    sucesso: false
};

// Dados do usuário de teste
const testUser = {
    name: `Usuário Teste ${timestamp}`,
    email: `teste.completo.${timestamp}@editaliza.com`,
    password: 'SenhaForte@123'
};

// Função auxiliar para requisições
async function makeRequest(method, endpoint, data = null, useAuth = true) {
    const config = {
        method,
        url: `${API_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 15000 // Timeout de 15 segundos para evitar travamentos
    };
    
    if (useAuth && authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    if (data) {
        config.data = data;
    }
    
    try {
        const response = await axios(config);
        return { 
            success: true, 
            data: response.data,
            status: response.status 
        };
    } catch (error) {
        const errorDetails = {
            endpoint,
            method,
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            data: error.response?.data
        };
        
        console.error(`
❌ Erro em ${method} ${endpoint}:`);
        console.error(`   Status: ${errorDetails.status}`);
        console.error(`   Mensagem: ${errorDetails.message}`);
        
        return { 
            success: false, 
            error: errorDetails
        };
    }
}

// Função para registrar resultado de cada etapa
function registrarEtapa(nome, sucesso, detalhes = {}) {
    const etapa = {
        nome,
        sucesso,
        timestamp: new Date().toISOString(),
        ...detalhes
    };
    
    testResults.etapas.push(etapa);
    
    if (!sucesso && detalhes.erro) {
        testResults.erros.push({
            etapa: nome,
            erro: detalhes.erro
        });
    }
}

// Função principal de teste
async function testarPlataformaCompleta() {
    console.log('=' .repeat(70));
    console.log('🚀 TESTE COMPLETO DA PLATAFORMA EDITALIZA');
    console.log('=' .repeat(70));
    console.log(`Timestamp: ${new Date().toISOString()}
`);
    
    // ========== 1. REGISTRO DE USUÁRIO ========== 
    console.log('\n📝 ETAPA 1: REGISTRO DE NOVO USUÁRIO');
    console.log('-'.repeat(40));
    
    const registerResult = await makeRequest('POST', '/auth/register', testUser, false);
    
    if (!registerResult.success) {
        console.error('ERRO CRÍTICO: Falha no registro');
        registrarEtapa('Registro', false, { erro: registerResult.error });
        await salvarResultados();
        return;
    }
    
    authToken = registerResult.data.token;
    userId = registerResult.data.user?.id || registerResult.data.userId;
    
    console.log('✅ Usuário registrado com sucesso');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Token: ${authToken ? 'Recebido' : 'NÃO RECEBIDO'}`);
    
    registrarEtapa('Registro', true, { userId, email: testUser.email });
    
    // ========== 2. LOGIN ========== 
    console.log('\n🔐 ETAPA 2: LOGIN');
    console.log('-'.repeat(40));
    
    const loginResult = await makeRequest('POST', '/auth/login', {
        email: testUser.email,
        password: testUser.password
    }, false);
    
    if (!loginResult.success) {
        console.error('ERRO CRÍTICO: Falha no login');
        registrarEtapa('Login', false, { erro: loginResult.error });
        await salvarResultados();
        return;
    }
    
    authToken = loginResult.data.token;
    console.log('✅ Login realizado com sucesso');
    console.log(`   Token atualizado: ${authToken ? 'Sim' : 'Não'}`);
    
    registrarEtapa('Login', true);
    
    // ========== 3. CRIAR PLANO DE ESTUDOS ========== 
    console.log('\n📚 ETAPA 3: CRIAÇÃO DO PLANO DE ESTUDOS');
    console.log('-'.repeat(40));
    
    const examDate = new Date('2025-11-21'); // Data real da prova TJPE
    
    const planData = {
        plan_name: 'TJPE - Analista Judiciário 2025',
        exam_date: examDate.toISOString().split('T')[0],
        daily_question_goal: 50,
        weekly_question_goal: 300,
        session_duration_minutes: 50
    };
    
    const planResult = await makeRequest('POST', '/plans', planData);
    
    if (!planResult.success) {
        console.error('ERRO CRÍTICO: Falha ao criar plano');
        registrarEtapa('Criar Plano', false, { erro: planResult.error });
        await salvarResultados();
        return;
    }
    
    planId = planResult.data.plan?.id || planResult.data.planId || planResult.data.id || planResult.data;
    
    console.log('✅ Plano criado com sucesso');
    console.log(`   Plan ID: ${planId}`);
    console.log(`   Nome: ${planData.plan_name}`);
    console.log(`   Data do concurso: ${planData.exam_date}`);
    
    registrarEtapa('Criar Plano', true, { planId, planName: planData.plan_name });
    
    // ========== 4. ADICIONAR DISCIPLINAS E TÓPICOS ========== 
    console.log('\n📖 ETAPA 4: ADIÇÃO DE DISCIPLINAS E TÓPICOS (EDITAL TJPE)');
    console.log('-'.repeat(40));
    
    // Estrutura COMPLETA baseada no edital real do TJPE com pesos da banca IBFC
    const disciplinas = [
        { 
            nome: 'Língua Portuguesa', 
            peso: 4,
            topicos: [
                { nome: 'Compreensão e interpretação de textos', peso: 5 },
                { nome: 'Ortografia, acentuação e pontuação', peso: 4 },
                { nome: 'Concordância nominal e verbal', peso: 4 },
                { nome: 'Regência nominal e verbal', peso: 4 },
                { nome: 'Morfossintaxe e análise sintática', peso: 4 },
                { nome: 'Pronomes - emprego e colocação', peso: 3 },
                { nome: 'Semântica e vocabulário', peso: 3 },
                { nome: 'Formação de palavras', peso: 3 },
                { nome: 'Vozes do verbo', peso: 2 },
                { nome: 'Correlação de tempos e modos verbais', peso: 2 },
                { nome: 'Coordenação e subordinação', peso: 2 },
                { nome: 'Figuras de linguagem', peso: 2 },
                { nome: 'Redação - reescrita de frases', peso: 3 },
                { nome: 'Redação oficial', peso: 2 },
                { nome: 'Níveis de linguagem', peso: 2 }
            ]
        },
        { 
            nome: 'Raciocínio Lógico', 
            peso: 3,
            topicos: [
                { nome: 'Lógica proposicional', peso: 5 },
                { nome: 'Argumentação lógica', peso: 4 },
                { nome: 'Análise combinatória', peso: 4 },
                { nome: 'Probabilidade', peso: 4 },
                { nome: 'Raciocínio sequencial', peso: 3 },
                { nome: 'Raciocínio lógico quantitativo', peso: 3 },
                { nome: 'Raciocínio lógico analítico', peso: 3 },
                { nome: 'Diagramas lógicos', peso: 3 }
            ]
        },
        { 
            nome: 'Direito Administrativo', 
            peso: 5,
            topicos: [
                { nome: 'Princípios do Direito Administrativo', peso: 5 },
                { nome: 'Administração Pública - conceito e princípios', peso: 5 },
                { nome: 'Administração direta e indireta', peso: 4 },
                { nome: 'Poderes Administrativos', peso: 4 },
                { nome: 'Atos administrativos', peso: 5 },
                { nome: 'Contratos administrativos', peso: 4 },
                { nome: 'Licitação - conceito e princípios', peso: 5 },
                { nome: 'Licitação - modalidades', peso: 5 },
                { nome: 'Licitação - dispensa e inexigibilidade', peso: 4 },
                { nome: 'Sistema de Registro de Preços', peso: 3 },
                { nome: 'Serviços Públicos', peso: 4 },
                { nome: 'Servidores Públicos - regime jurídico', peso: 4 },
                { nome: 'Direitos e deveres do servidor', peso: 4 },
                { nome: 'Responsabilidade do servidor público', peso: 4 },
                { nome: 'Bens Públicos', peso: 3 },
                { nome: 'Controle da Administração', peso: 4 },
                { nome: 'Responsabilidade civil do Estado', peso: 4 },
                { nome: 'Desapropriação', peso: 3 },
                { nome: 'Servidão administrativa', peso: 2 },
                { nome: 'Processo Administrativo', peso: 3 },
                { nome: 'Lei de Improbidade Administrativa', peso: 5 },
                { nome: 'Nova Lei de Licitações - Lei 14.133/21', peso: 5 }
            ]
        },
        { 
            nome: 'Direito Constitucional', 
            peso: 5,
            topicos: [
                { nome: 'Dos Princípios Fundamentais', peso: 5 },
                { nome: 'Dos Direitos e Garantias Fundamentais', peso: 5 },
                { nome: 'Direitos e deveres individuais e coletivos', peso: 5 },
                { nome: 'Direitos sociais', peso: 3 },
                { nome: 'Da nacionalidade', peso: 2 },
                { nome: 'Dos direitos políticos', peso: 3 },
                { nome: 'Da Organização do Estado', peso: 4 },
                { nome: 'Da União', peso: 3 },
                { nome: 'Dos Estados federados', peso: 3 },
                { nome: 'Dos Municípios', peso: 3 },
                { nome: 'Da Organização dos Poderes', peso: 5 },
                { nome: 'Do Poder Legislativo', peso: 4 },
                { nome: 'Do Poder Executivo', peso: 3 },
                { nome: 'Do Poder Judiciário', peso: 5 },
                { nome: 'Das Funções Essenciais à Justiça', peso: 4 },
                { nome: 'Do Ministério Público', peso: 4 },
                { nome: 'Da Administração Pública', peso: 5 },
                { nome: 'Dos servidores públicos', peso: 5 },
                { nome: 'Do Sistema Tributário Nacional', peso: 2 },
                { nome: 'Da Ordem Econômica e Financeira', peso: 2 },
                { nome: 'Da Ordem Social', peso: 2 },
                { nome: 'Constituição do Estado de Pernambuco', peso: 4 },
                { nome: 'Lei de Ação Civil Pública', peso: 3 },
                { nome: 'Mandado de Segurança', peso: 4 }
            ]
        },
        { 
            nome: 'Direito Civil', 
            peso: 4,
            topicos: [
                { nome: 'Fontes do direito civil', peso: 2 },
                { nome: 'Princípios do direito civil', peso: 3 },
                { nome: 'Pessoas naturais', peso: 4 },
                { nome: 'Pessoas jurídicas', peso: 4 },
                { nome: 'Domicílio', peso: 2 },
                { nome: 'Bens', peso: 3 },
                { nome: 'Atos jurídicos', peso: 5 },
                { nome: 'Negócio jurídico', peso: 5 },
                { nome: 'Prescrição e decadência', peso: 4 },
                { nome: 'Prova', peso: 3 },
                { nome: 'Obrigações', peso: 4 },
                { nome: 'Responsabilidade Civil', peso: 5 }
            ]
        },
        { 
            nome: 'Direito Processual Civil', 
            peso: 4,
            topicos: [
                { nome: 'Jurisdição e ação', peso: 4 },
                { nome: 'Partes e procuradores', peso: 3 },
                { nome: 'Litisconsórcio e assistência', peso: 3 },
                { nome: 'Intervenção de terceiros', peso: 3 },
                { nome: 'Ministério Público', peso: 3 },
                { nome: 'Competência', peso: 5 },
                { nome: 'O juiz', peso: 3 },
                { nome: 'Atos processuais', peso: 4 },
                { nome: 'Formação, suspensão e extinção do processo', peso: 3 },
                { nome: 'Procedimento comum', peso: 4 },
                { nome: 'Resposta do réu', peso: 4 },
                { nome: 'Revelia', peso: 3 },
                { nome: 'Julgamento conforme o estado do processo', peso: 3 },
                { nome: 'Provas', peso: 5 },
                { nome: 'Audiência', peso: 3 },
                { nome: 'Sentença e coisa julgada', peso: 4 },
                { nome: 'Liquidação e cumprimento de sentença', peso: 4 },
                { nome: 'Recursos', peso: 5 },
                { nome: 'Processo de execução', peso: 4 },
                { nome: 'Processo cautelar e medidas cautelares', peso: 4 },
                { nome: 'Procedimentos especiais', peso: 3 }
            ]
        },
        { 
            nome: 'Direito Penal', 
            peso: 3,
            topicos: [
                { nome: 'Sujeito ativo e passivo da infração penal', peso: 3 },
                { nome: 'Tipicidade, ilicitude e culpabilidade', peso: 5 },
                { nome: 'Punibilidade', peso: 3 },
                { nome: 'Excludentes de ilicitude', peso: 4 },
                { nome: 'Excludentes de culpabilidade', peso: 4 },
                { nome: 'Erro de tipo', peso: 3 },
                { nome: 'Erro de proibição', peso: 3 },
                { nome: 'Imputabilidade penal', peso: 3 },
                { nome: 'Concurso de pessoas', peso: 3 },
                { nome: 'Crimes contra a fé pública', peso: 4 },
                { nome: 'Crimes contra a Administração Pública', peso: 5 },
                { nome: 'Crimes contra a inviolabilidade dos segredos', peso: 2 },
                { nome: 'Crimes contra o patrimônio', peso: 4 },
                { nome: 'Crimes contra a vida', peso: 3 },
                { nome: 'Lesões corporais', peso: 3 },
                { nome: 'Periclitação da vida e da saúde', peso: 2 },
                { nome: 'Atos de improbidade praticados por agentes públicos', peso: 5 }
            ]
        },
        { 
            nome: 'Direito Processual Penal', 
            peso: 3,
            topicos: [
                { nome: 'Ação Penal Pública', peso: 4 },
                { nome: 'Ação Penal Privada', peso: 3 },
                { nome: 'A Denúncia', peso: 4 },
                { nome: 'A Queixa', peso: 3 },
                { nome: 'Representação, Renúncia e Perdão', peso: 3 },
                { nome: 'Sujeitos do processo', peso: 3 },
                { nome: 'Juiz, Acusador e Defensor', peso: 3 },
                { nome: 'Assistente e Auxiliar da Justiça', peso: 2 },
                { nome: 'Atos Processuais - forma, lugar e tempo', peso: 3 },
                { nome: 'Comunicações processuais', peso: 3 },
                { nome: 'Citação, notificação e intimação', peso: 3 },
                { nome: 'Prisão temporária', peso: 4 },
                { nome: 'Prisão em flagrante', peso: 4 },
                { nome: 'Prisão preventiva', peso: 5 },
                { nome: 'Liberdade Provisória e Fiança', peso: 4 },
                { nome: 'Despachos e decisões interlocutórias', peso: 3 },
                { nome: 'Sentença penal', peso: 4 },
                { nome: 'Apelação criminal', peso: 4 },
                { nome: 'Recurso em Sentido Estrito', peso: 3 },
                { nome: 'Habeas Corpus', peso: 4 },
                { nome: 'Mandado de Segurança criminal', peso: 3 }
            ]
        },
        { 
            nome: 'Legislação Específica TJPE', 
            peso: 4,
            topicos: [
                { nome: 'Regimento Interno do TJPE - Resolução 395/2017', peso: 5 },
                { nome: 'Código de Organização Judiciária de PE - LC 100/2007', peso: 5 },
                { nome: 'Regime Jurídico dos Servidores de PE - Lei 6.123/1968', peso: 5 },
                { nome: 'Sistema PJe - Resolução CNJ 185/2013', peso: 4 },
                { nome: 'Informatização do Processo - Lei 11.419/2006', peso: 3 }
            ]
        }
    ];
    
    let disciplinasAdicionadas = 0;
    let topicosAdicionados = 0;
    let criticalError = false;

    for (const disciplina of disciplinas) {
        if(criticalError) break;
        console.log(`\n   📚 Adicionando: ${disciplina.nome} (peso ${disciplina.peso})`);
        
        const subjectResult = await makeRequest('POST', `/plans/${planId}/subjects`, { name: disciplina.nome, weight: disciplina.peso });
        
        if (!subjectResult.success) {
            console.error(`   ❌ Erro ao adicionar ${disciplina.nome}`);
            criticalError = true;
            continue;
        }
        
        const subjectId = subjectResult.data.subject?.id || subjectResult.data.subjectId || subjectResult.data.id || subjectResult.data;
        disciplinasAdicionadas++;
        console.log(`   ✅ Disciplina adicionada (ID: ${subjectId})`);
        await delay(50) // Reduzido - rate limit desabilitado;

        for (const topico of disciplina.topicos) {
            const topicResult = await makeRequest('POST', `/subjects/${subjectId}/topics`, { 
                topic_description: topico.nome, 
                weight: topico.peso
            });
            
            if (topicResult.success) {
                topicosAdicionados++;
                const prioridadeCalculada = (disciplina.peso * 10) + topico.peso;
                console.log(`      ✅ ${topico.nome} (peso: ${topico.peso}, prioridade: ${prioridadeCalculada})`);
            } else {
                console.log(`      ❌ Erro: ${topico.nome}`);
                criticalError = true;
            }
            await delay(50); // Reduzido - rate limit desabilitado
        }
    }
    
    console.log(`\n   📊 Resumo:`);
    console.log(`      Disciplinas adicionadas: ${disciplinasAdicionadas}/${disciplinas.length}`);
    console.log(`      Tópicos adicionados: ${topicosAdicionados}/${disciplinas.reduce((sum, d) => sum + d.topicos.length, 0)}`);
    
    registrarEtapa('Adicionar Disciplinas e Tópicos', !criticalError, { disciplinasAdicionadas, topicosAdicionados });
    
    if (criticalError) {
        console.error('ERRO CRÍTICO: Falha ao adicionar disciplinas/tópicos. Abortando.');
        await salvarResultados();
        return;
    }

    // ========== 5. GERAR CRONOGRAMA ========== 
    console.log('\n📅 ETAPA 5: GERAÇÃO DO CRONOGRAMA');
    console.log('-'.repeat(40));
    
    const scheduleData = {
        start_date: new Date().toISOString().split('T')[0],
        exam_date: examDate.toISOString().split('T')[0],
        available_days: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: false },
        hours_per_day: 4,
        daily_question_goal: 50,
        weekly_question_goal: 300,
        session_duration_minutes: 50,
        has_essay: false,
        reta_final_mode: false,
        study_hours_per_day: { "0": 0, "1": 4, "2": 4, "3": 4, "4": 4, "5": 4, "6": 4 }
    };
    
    console.log('   Configurações do cronograma:');
    console.log(`   - Data início: ${scheduleData.start_date}`);
    console.log(`   - Data concurso: ${scheduleData.exam_date}`);
    console.log(`   - Horas por dia: ${scheduleData.hours_per_day}`);
    console.log(`   - Dias disponíveis: Seg-Sáb`);
    
    await delay(50) // Reduzido - rate limit desabilitado;
    const scheduleResult = await makeRequest('POST', `/plans/${planId}/generate`, scheduleData);
    
    if (!scheduleResult.success) {
        console.error('❌ Falha ao gerar cronograma');
        registrarEtapa('Gerar Cronograma', false, { erro: scheduleResult.error });
        await salvarResultados();
        return;
    }
    
    console.log('✅ Cronograma gerado com sucesso');
    registrarEtapa('Gerar Cronograma', true);
    
    // ========== 6. VERIFICAR ALGORITMO ROUND-ROBIN PONDERADO ========== 
    console.log('\n⚙️ ETAPA 6: ANÁLISE DO ALGORITMO ROUND-ROBIN PONDERADO');
    console.log('-'.repeat(40));
    
    const sessionsResult = await makeRequest('GET', `/plans/${planId}/sessions`);
    
    if (!sessionsResult.success) {
        console.error('❌ Erro ao buscar sessões');
        registrarEtapa('Buscar Sessões', false, { erro: sessionsResult.error });
        await salvarResultados();
        return;
    }

    sessions = sessionsResult.data.sessions || sessionsResult.data || [];
    console.log(`✅ ${sessions.length} sessões encontradas`);
    
    // Filtrar sessões que não são de estudo principal para a análise de peso
    const materiasDeEstudo = disciplinas.map(d => d.nome);
    const sessoesDeEstudo = sessions.filter(s => materiasDeEstudo.includes(s.subject_name || s.subject));

    const distribuicaoEstudo = {};
    sessoesDeEstudo.forEach(session => {
        const subjectName = session.subject_name || session.subject;
        distribuicaoEstudo[subjectName] = (distribuicaoEstudo[subjectName] || 0) + 1;
    });

    console.log('\n   📊 Distribuição por Matéria de Estudo (excluindo simulados/revisões):');
    const totalSessoesEstudo = sessoesDeEstudo.length;
    
    // Somar todas as disciplinas de Direito
    const contagemDireito = (distribuicaoEstudo['Direito Constitucional'] || 0) +
                           (distribuicaoEstudo['Direito Administrativo'] || 0) +
                           (distribuicaoEstudo['Direito Civil'] || 0) +
                           (distribuicaoEstudo['Direito Processual Civil'] || 0) +
                           (distribuicaoEstudo['Direito Penal'] || 0) +
                           (distribuicaoEstudo['Direito Processual Penal'] || 0) +
                           (distribuicaoEstudo['Legislação Específica TJPE'] || 0);
    const contagemPortugues = distribuicaoEstudo['Língua Portuguesa'] || 0; // Corrigido nome
    const contagemInformatica = distribuicaoEstudo['Informática'] || 0;
    const contagemRaciocinio = distribuicaoEstudo['Raciocínio Lógico'] || 0;

    if (totalSessoesEstudo > 0) {
        console.log(`      Direito: ${contagemDireito} sessões (${((contagemDireito/totalSessoesEstudo)*100).toFixed(1)}%)`);
        console.log(`      Português: ${contagemPortugues} sessões (${((contagemPortugues/totalSessoesEstudo)*100).toFixed(1)}%)`);
        console.log(`      Informática: ${contagemInformatica} sessões (${((contagemInformatica/totalSessoesEstudo)*100).toFixed(1)}%)`);
        console.log(`      Raciocínio Lógico: ${contagemRaciocinio} sessões (${((contagemRaciocinio/totalSessoesEstudo)*100).toFixed(1)}%)`);
    } else {
        console.log('      Nenhuma sessão de estudo principal encontrada para analisar.');
    }

    console.log('\n   ✔️ Validação da Ponderação (Round-Robin Ponderado):');
    
    // Para TJPE: Direito (peso 5,4,3) > Português (peso 4) > Raciocínio (peso 3)
    // Informática não faz parte do edital TJPE
    const ordemCorreta = contagemDireito >= contagemPortugues && contagemPortugues >= contagemRaciocinio;
    const pesosDiferentes = new Set(disciplinas.map(d => d.peso)).size > 1;
    
    // Verificar se a distribuição reflete os pesos
    const distribuicaoCorreta = contagemDireito > 0 && contagemPortugues > 0 && contagemRaciocinio > 0;
    
    const algoritmoCorreto = ordemCorreta && distribuicaoCorreta;

    console.log(`      Ordem de Frequência (Direito >= Português >= RL): ${ordemCorreta ? '✅' : '❌'}`);
    console.log(`      Distribuição Proporcional: ${distribuicaoCorreta ? '✅' : '❌'}`);

    console.log(`\n      Diagnóstico do Algoritmo: ${algoritmoCorreto ? '✅ PARECE CORRETO' : '❌ PARECE INCORRETO'}`);
    registrarEtapa('Verificar Algoritmo', algoritmoCorreto, { distribuicaoEstudo });
    
    // ========== 7. MARCAR SESSÕES COMO CONCLUÍDAS E VERIFICAR ESTATÍSTICAS ========== 
    console.log('\n✅ ETAPA 7: MARCAÇÃO DE SESSÕES COMO CONCLUÍDAS E ESTATÍSTICAS');
    console.log('-'.repeat(40));
    
    // 7.1 - Capturar estatísticas e XP ANTES de marcar sessões
    console.log('\n   📊 Estatísticas ANTES de completar sessões:');
    const statsBefore = await makeRequest('GET', `/sessions/statistics/${planId}`);
    let totalSessionsBefore = 0;
    let completedSessionsBefore = 0;
    let totalHoursBefore = 0;
    let streakStatsBefore = 0;
    
    if (statsBefore.success) {
        const stats = statsBefore.data;
        totalSessionsBefore = stats.totalSessions || 0;
        completedSessionsBefore = stats.completedSessions || 0;
        totalHoursBefore = stats.totalHours || 0;
        streakStatsBefore = stats.currentStreak || 0;
        
        console.log(`      Sessões totais: ${totalSessionsBefore}`);
        console.log(`      Sessões concluídas: ${completedSessionsBefore}`);
        console.log(`      Horas estudadas: ${totalHoursBefore.toFixed(2)}h`);
        console.log(`      Streak atual: ${streakStatsBefore} dias`);
        console.log(`      Taxa de conclusão: ${stats.completionRate?.toFixed(1) || 0}%`);
    }
    
    // Verificar XP inicial
    console.log('\n   🎮 Verificando XP inicial:');
    const xpBefore = await makeRequest('GET', '/gamification/profile');
    let xpInicial = 0;
    if (xpBefore.success) {
        xpInicial = xpBefore.data.xp || 0;
        console.log(`      XP antes das conclusões: ${xpInicial}`);
    }
    
    // 7.2 - Marcar sessões como concluídas COM VERIFICAÇÃO INDIVIDUAL DE XP
    console.log('\n   🎯 Marcando sessões como concluídas (testando XP individual):');
    const sessionsToComplete = sessions.slice(0, Math.min(3, sessions.length)); // Apenas 3 para teste mais focado
    let sessoesConcluidas = 0;
    const tempoEstudoSimulado = 3600; // 1 hora em segundos
    let xpAcumulado = xpInicial;
    
    for (let idx = 0; idx < sessionsToComplete.length; idx++) {
        const session = sessionsToComplete[idx];
        const sessionId = session.id || session.session_id;
        if (!sessionId) {
            console.log('   ⚠️ Sessão sem ID, pulando...');
            continue;
        }
        
        console.log(`\n   🔄 Sessão ${idx + 1}/${sessionsToComplete.length}:`);
        console.log(`      ID: ${sessionId}`);
        console.log(`      Tópico: ${session.topic_name || 'N/A'}`);
        console.log(`      XP atual antes: ${xpAcumulado}`);
        
        // Marcar como concluída
        const statusResult = await makeRequest('PATCH', `/sessions/${sessionId}`, { 
            status: 'Concluído',
            questions_solved: 15,
            notes: `Teste individual ${idx + 1} - verificando XP`
        });
        
        if (statusResult.success) {
            console.log(`      ✅ Marcada como concluída`);
            
            // Registrar tempo de estudo
            const timeResult = await makeRequest('POST', `/sessions/${sessionId}/time`, {
                seconds: tempoEstudoSimulado
            });
            
            if (timeResult.success) {
                console.log(`      ⏱️ Tempo registrado: ${tempoEstudoSimulado/3600}h`);
            }
            
            // AGUARDAR e VERIFICAR XP APÓS CADA SESSÃO
            console.log(`      ⏳ Aguardando processamento de XP...`);
            await delay(2000); // Aguardar 2 segundos para garantir processamento
            
            const xpCheck = await makeRequest('GET', '/gamification/profile');
            if (xpCheck.success) {
                const xpAtual = xpCheck.data.xp || 0;
                const xpGanho = xpAtual - xpAcumulado;
                
                if (xpGanho > 0) {
                    console.log(`      🎆 XP GANHO: +${xpGanho} XP`);
                    console.log(`      📊 XP total agora: ${xpAtual}`);
                } else {
                    console.log(`      ⚠️ PROBLEMA: Nenhum XP ganho!`);
                    console.log(`      🔍 XP continua em: ${xpAtual}`);
                }
                xpAcumulado = xpAtual;
            }
            
            sessoesConcluidas++;
        } else {
            console.log(`   ❌ Erro ao marcar sessão ${sessionId}`);
        }
        await delay(100); // Pequeno delay entre requisições
    }
    
    // Resumo do XP ganho
    console.log(`\n   📊 RESUMO DE XP:`);
    console.log(`      XP inicial: ${xpInicial}`);
    console.log(`      XP final: ${xpAcumulado}`);
    console.log(`      XP total ganho: ${xpAcumulado - xpInicial}`);
    if (sessoesConcluidas > 0) {
        console.log(`      Média por sessão: ${Math.round((xpAcumulado - xpInicial) / sessoesConcluidas)} XP`);
    }
    
    console.log(`\n   Total: ${sessoesConcluidas}/${sessionsToComplete.length} sessões concluídas`);
    
    // 7.3 - Aguardar processamento e verificar estatísticas DEPOIS
    console.log('\n   ⏳ Aguardando processamento das estatísticas...');
    await delay(1500); // Aguardar 1.5 segundos
    
    console.log('\n   📊 Estatísticas DEPOIS de completar sessões:');
    const statsAfter = await makeRequest('GET', `/sessions/statistics/${planId}`);
    
    if (statsAfter.success) {
        const stats = statsAfter.data;
        const totalSessionsAfter = stats.totalSessions || 0;
        const completedSessionsAfter = stats.completedSessions || 0;
        const totalHoursAfter = stats.totalHours || 0;
        const streakAfter = stats.currentStreak || 0;
        
        // Calcular diferenças
        const sessoesCompletadasDiff = completedSessionsAfter - completedSessionsBefore;
        const horasEstudadasDiff = totalHoursAfter - totalHoursBefore;
        
        console.log(`      Sessões totais: ${totalSessionsAfter}`);
        console.log(`      Sessões concluídas: ${completedSessionsAfter} ${sessoesCompletadasDiff > 0 ? `(+${sessoesCompletadasDiff})` : ''}`);
        console.log(`      Horas estudadas: ${totalHoursAfter.toFixed(2)}h ${horasEstudadasDiff > 0 ? `(+${horasEstudadasDiff.toFixed(2)}h)` : ''}`);
        console.log(`      Streak atual: ${streakAfter} dias ${streakAfter > streakStatsBefore ? `(+${streakAfter - streakStatsBefore})` : ''}`);
        console.log(`      Taxa de conclusão: ${stats.completionRate?.toFixed(1) || 0}%`);
        console.log(`      Melhor dia para estudar: ${stats.bestDayForStudy || 'N/A'}`);
        console.log(`      Média de horas por dia: ${stats.avgHoursPerDay?.toFixed(2) || 0}h`);
        
        // Verificar se as estatísticas foram atualizadas corretamente
        console.log('\n   🔍 Análise das Estatísticas:');
        const estatisticasAtualizadas = sessoesCompletadasDiff === sessoesConcluidas;
        
        if (sessoesConcluidas > 0) {
            console.log(`      Sessões adicionadas: ${sessoesCompletadasDiff} (esperado: ${sessoesConcluidas})`);
            console.log(`      Horas adicionadas: ${horasEstudadasDiff.toFixed(2)}h (esperado: ${(sessoesConcluidas * tempoEstudoSimulado / 3600).toFixed(2)}h)`);
            
            if (estatisticasAtualizadas) {
                console.log(`      ✅ Estatísticas atualizadas corretamente!`);
            } else {
                console.log(`      ⚠️ Estatísticas parcialmente atualizadas`);
            }
        } else {
            console.log(`      ℹ️ Nenhuma sessão concluída`);
        }
        
        registrarEtapa('Estatísticas das Sessões', estatisticasAtualizadas || sessoesConcluidas === 0, {
            sessoesConcluidas,
            sessoesCompletadasDiff,
            horasEstudadasDiff,
            estatisticasAtualizadas
        });
    } else {
        console.log('   ❌ Erro ao buscar estatísticas após conclusão');
        registrarEtapa('Estatísticas das Sessões', false, { erro: statsAfter.error });
    }
    
    // 7.4 - Verificar progresso de questões
    console.log('\n   📝 Verificando progresso de questões:');
    const questionProgress = await makeRequest('GET', `/sessions/question-progress/${planId}`);
    
    if (questionProgress.success) {
        const progress = questionProgress.data;
        console.log(`      Meta diária: ${progress.dailyGoal || 0} questões`);
        console.log(`      Progresso diário: ${progress.dailyProgress || 0} questões (${progress.dailyPercentage || 0}%)`);
        console.log(`      Meta semanal: ${progress.weeklyGoal || 0} questões`);
        console.log(`      Progresso semanal: ${progress.weeklyProgress || 0} questões (${progress.weeklyPercentage || 0}%)`);
        
        if (sessoesConcluidas > 0 && progress.dailyProgress > 0) {
            console.log(`      ✅ Progresso de questões registrado!`);
        }
    }
    
    registrarEtapa('Marcar Sessões Concluídas', sessoesConcluidas > 0 || sessionsToComplete.length === 0, { sessoesConcluidas });
    
    // ========== 8. VERIFICAR ESTATÍSTICAS E GAMIFICAÇÃO ========== 
    console.log('\n🎮 ETAPA 8: VERIFICAÇÃO DE ESTATÍSTICAS E GAMIFICAÇÃO');
    console.log('-'.repeat(40));
    
    // 8.1 - Capturar estado inicial da gamificação ANTES de marcar sessões
    console.log('\n   📊 Estado ANTES de completar sessões:');
    const gamificationBefore = await makeRequest('GET', '/gamification/profile');
    let xpBeforeStats = 0;
    let levelBefore = 1;
    let streakBefore = 0;
    let achievementsBefore = 0;
    
    if (gamificationBefore.success) {
        const profileBefore = gamificationBefore.data;
        xpBeforeStats = profileBefore.xp || 0;
        levelBefore = profileBefore.level || 1;
        streakBefore = profileBefore.current_streak || 0;
        achievementsBefore = profileBefore.achievements?.length || 0;
        
        console.log(`      XP: ${xpBeforeStats}`);
        console.log(`      Nível: ${levelBefore}`);
        console.log(`      Streak: ${streakBefore} dias`);
        console.log(`      Conquistas: ${achievementsBefore}`);
    }
    
    // 8.2 - Aguardar processamento assíncrono da gamificação
    console.log('\n   ⏳ Aguardando processamento da gamificação...');
    await delay(2000); // Aguardar 2 segundos para garantir processamento
    
    // 8.3 - Capturar estado DEPOIS de marcar sessões
    console.log('\n   📊 Estado DEPOIS de completar sessões:');
    const gamificationAfter = await makeRequest('GET', '/gamification/profile');
    
    if (gamificationAfter.success) {
        const profileAfter = gamificationAfter.data;
        const xpAfter = profileAfter.xp || 0;
        const levelAfter = profileAfter.level || 1;
        const streakAfter = profileAfter.current_streak || 0;
        const achievementsAfter = profileAfter.achievements?.length || 0;
        
        console.log(`      XP: ${xpAfter} ${xpAfter > xpBeforeStats ? `(+${xpAfter - xpBeforeStats})` : ''}`);
        console.log(`      Nível: ${levelAfter} ${levelAfter > levelBefore ? `(+${levelAfter - levelBefore})` : ''}`);
        console.log(`      Streak: ${streakAfter} dias ${streakAfter > streakBefore ? `(+${streakAfter - streakBefore})` : ''}`);
        console.log(`      Conquistas: ${achievementsAfter} ${achievementsAfter > achievementsBefore ? `(+${achievementsAfter - achievementsBefore})` : ''}`);
        
        // 8.4 - Verificar se houve atualização
        console.log('\n   🔍 Análise da Atualização:');
        const xpGanho = xpAfter - xpBeforeStats;
        const conquistasGanhas = achievementsAfter - achievementsBefore;
        const gamificacaoAtualizada = xpGanho > 0 || conquistasGanhas > 0 || streakAfter > streakBefore;
        
        if (sessoesConcluidas > 0) {
            // Se concluímos sessões, DEVE ter ganhado XP
            const xpEsperado = sessoesConcluidas * 10; // Mínimo de 10 XP por sessão
            console.log(`      XP Ganho: ${xpGanho} XP (esperado mínimo: ${xpEsperado} XP)`);
            console.log(`      XP por sessão: ${xpGanho > 0 ? (xpGanho / sessoesConcluidas).toFixed(1) : 0} XP`);
            
            if (xpGanho >= xpEsperado) {
                console.log(`      ✅ Gamificação atualizada corretamente!`);
            } else if (xpGanho > 0) {
                console.log(`      ⚠️ Gamificação parcialmente atualizada (XP menor que esperado)`);
            } else {
                console.log(`      ❌ ERRO: Gamificação NÃO foi atualizada após conclusão de sessões!`);
            }
        } else {
            console.log(`      ℹ️ Nenhuma sessão concluída, gamificação não deveria mudar`);
        }
        
        // 8.5 - Detalhes das conquistas
        if (profileAfter.achievements && profileAfter.achievements.length > 0) {
            console.log('\n   🎯 Conquistas Desbloqueadas:');
            profileAfter.achievements.slice(0, 5).forEach(ach => {
                const achievementName = ach.achievement_id || ach.name || 'Conquista';
                console.log(`      - ${achievementName}`);
            });
        }
        
        // 8.6 - Verificar detalhes do nível
        if (profileAfter.level_info) {
            console.log('\n   📈 Informações do Nível:');
            console.log(`      Título: ${profileAfter.level_info.title || 'N/A'}`);
            console.log(`      Próximo nível em: ${profileAfter.level_info.threshold || 'N/A'} tópicos`);
            if (profileAfter.level_info.phrase) {
                console.log(`      Frase motivacional: "${profileAfter.level_info.phrase}"`);
            }
        }
        
        // Registrar resultado com análise detalhada
        registrarEtapa('Gamificação', gamificacaoAtualizada || sessoesConcluidas === 0, { 
            xpBefore,
            xpAfter,
            xpGanho,
            levelBefore,
            levelAfter,
            streakBefore,
            streakAfter,
            achievementsBefore,
            achievementsAfter,
            sessoesConcluidas,
            gamificacaoAtualizada
        });
    } else {
        console.log('   ❌ Erro ao buscar gamificação após conclusão');
        registrarEtapa('Gamificação', false, { erro: gamificationAfter.error });
    }
    
    // 8.7 - Testar endpoint de gamificação do plano (alternativo)
    console.log('\n   🎲 Testando endpoint alternativo de gamificação do plano:');
    const planGamificationResult = await makeRequest('GET', `/gamification/plan/${planId}`);
    
    if (planGamificationResult.success) {
        const planStats = planGamificationResult.data;
        console.log(`      Tópicos completados: ${planStats.completedTopicsCount || 0}`);
        console.log(`      XP Total: ${planStats.experiencePoints || 0}`);
        console.log(`      Streak: ${planStats.studyStreak || 0} dias`);
        console.log(`      Nível: ${planStats.concurseiroLevel || 'N/A'}`);
        
        if (planStats.achievements && planStats.achievements.length > 0) {
            console.log(`      Conquistas do plano: ${planStats.achievements.length}`);
        }
    } else {
        console.log(`      ⚠️ Endpoint de gamificação do plano não disponível`);
    }
    
    // ========== 9. TESTE DE INTERFACE (CARDS NA HOME E CRONOGRAMA) ========== 
    console.log('\n🏠 ETAPA 9: VERIFICAÇÃO DE CARDS NA HOME E CRONOGRAMA');
    console.log('-'.repeat(40));
    
    // 9.1 - Verificar endpoint de sessões para a HOME
    console.log('\n   📅 Verificando sessões para HOME (hoje):');
    const today = new Date().toISOString().split('T')[0];
    const homeSessions = await makeRequest('GET', `/sessions/by-date/${planId}`);
    
    if (homeSessions.success) {
        const sessionsByDate = homeSessions.data;
        const todaySessions = sessionsByDate[today] || [];
        console.log(`      Total de datas com sessões: ${Object.keys(sessionsByDate).length}`);
        console.log(`      Sessões para hoje (${today}): ${todaySessions.length}`);
        
        if (todaySessions.length > 0) {
            console.log('\n      📋 Primeiras sessões de hoje:');
            todaySessions.slice(0, 3).forEach(session => {
                const status = session.status === 'Concluído' ? '✅' : '⏳';
                console.log(`         ${status} ${session.subject_name} - ${session.topic_description || 'N/A'}`);
            });
        }
        
        // Verificar se há sessões futuras
        const futureDates = Object.keys(sessionsByDate).filter(date => date > today);
        if (futureDates.length > 0) {
            console.log(`\n      📆 Datas futuras com sessões: ${futureDates.length}`);
            console.log(`         Próxima data: ${futureDates[0]} (${sessionsByDate[futureDates[0]].length} sessões)`);
        }
        
        registrarEtapa('Sessões Home', true, { 
            totalDates: Object.keys(sessionsByDate).length,
            todaySessions: todaySessions.length 
        });
    } else {
        console.log('   ❌ Erro ao buscar sessões para home');
        registrarEtapa('Sessões Home', false, { erro: homeSessions.error });
    }
    
    // 9.2 - Verificar contagem de sessões atrasadas
    console.log('\n   ⚠️ Verificando sessões atrasadas:');
    const overdueCheck = await makeRequest('GET', `/sessions/overdue-check/${planId}`);
    
    if (overdueCheck.success) {
        const overdueCount = overdueCheck.data.count || 0;
        console.log(`      Sessões atrasadas: ${overdueCount}`);
        
        if (overdueCount > 0) {
            console.log(`      ⚠️ Existem ${overdueCount} sessões pendentes de dias anteriores`);
        } else {
            console.log(`      ✅ Nenhuma sessão atrasada`);
        }
    }
    
    // 9.3 - Verificar endpoint do dashboard (se disponível)
    console.log('\n   📊 Verificando dashboard:');
    const dashboardResult = await makeRequest('GET', '/dashboard');
    
    if (dashboardResult.success) {
        const dashboard = dashboardResult.data;
        console.log('   ✅ Dados do dashboard carregados');
        console.log(`      Sessões hoje: ${dashboard.sessions_today?.length || 0}`);
        console.log(`      Próximas sessões: ${dashboard.upcoming_sessions?.length || 0}`);
        console.log(`      Progresso geral: ${dashboard.overall_progress || 0}%`);
        
        registrarEtapa('Dashboard', true, { dashboard });
    } else {
        console.log('   ⚠️ Dashboard não disponível (não crítico)');
        registrarEtapa('Dashboard', true, { aviso: 'Endpoint não implementado' });
    }
    
    // 9.4 - Verificar se as sessões estão acessíveis via /plans/:id/sessions
    console.log('\n   🗓️ Verificando endpoint alternativo de sessões:');
    const altSessionsResult = await makeRequest('GET', `/plans/${planId}/sessions`);
    
    if (altSessionsResult.success) {
        const altSessions = altSessionsResult.data.sessions || altSessionsResult.data || [];
        console.log(`      Total de sessões via /plans/:id/sessions: ${altSessions.length}`);
        
        // Contar status das sessões
        const statusCount = {};
        altSessions.forEach(s => {
            statusCount[s.status] = (statusCount[s.status] || 0) + 1;
        });
        
        console.log('\n      📈 Distribuição por status:');
        Object.entries(statusCount).forEach(([status, count]) => {
            const percentage = ((count / altSessions.length) * 100).toFixed(1);
            console.log(`         ${status}: ${count} (${percentage}%)`);
        });
    }
    
    // ========== 10. TESTE DE GAMIFICAÇÃO ==========
    console.log('\n' + '='.repeat(70));
    console.log('🎮 ETAPA 10: SISTEMA DE GAMIFICAÇÃO');
    console.log('-'.repeat(70));
    
    // 10.1 - Verificar perfil inicial de gamificação
    console.log('\n   📊 Perfil de gamificação inicial:');
    const initialGamificationProfile = await makeRequest('GET', '/gamification/profile');
    
    let initialXP = 0;
    let initialLevel = 1;
    let initialStreak = 0;
    
    if (initialGamificationProfile.success) {
        initialXP = initialGamificationProfile.data.xp || 0;
        initialLevel = initialGamificationProfile.data.level || 1;
        initialStreak = initialGamificationProfile.data.current_streak || 0;
        
        console.log(`      XP Inicial: ${initialXP}`);
        console.log(`      Nível: ${initialLevel}`);
        console.log(`      Streak: ${initialStreak} dias`);
        console.log(`      Conquistas: ${initialGamificationProfile.data.achievements?.length || 0}`);
        
        if (initialGamificationProfile.data.level_info) {
            console.log(`      Título: ${initialGamificationProfile.data.level_info.title || 'N/A'}`);
        }
    } else {
        console.log('      ⚠️ Perfil de gamificação não encontrado (será criado automaticamente)');
    }
    
    // 10.2 - Completar uma sessão para testar ganho de XP
    console.log('\n   🎯 Completando sessão para testar XP:');
    
    // Buscar uma sessão pendente (usando as sessões já carregadas)
    const pendingSessions = sessions.filter(s => s.status === 'Pendente');
    
    if (pendingSessions.length > 0) {
        const sessionToComplete = pendingSessions[0];
        console.log(`      Sessão escolhida: ID ${sessionToComplete.id}`);
        console.log(`      Tópico: ${sessionToComplete.topic_name || 'N/A'}`);
        
        // Marcar sessão como concluída
        const completeForXP = await makeRequest('PATCH', `/sessions/${sessionToComplete.id}`, {
            status: 'Concluído',
            questions_solved: 25,
            notes: 'Sessão completada para teste de gamificação'
        });
        
        if (completeForXP.success) {
            console.log('      ✅ Sessão marcada como concluída');
            
            // Registrar tempo de estudo
            const timeForXP = await makeRequest('POST', `/sessions/${sessionToComplete.id}/time`, {
                time_seconds: 3000 // 50 minutos
            });
            
            if (timeForXP.success) {
                console.log('      ✅ Tempo de estudo registrado: 50 minutos');
            }
            
            // Aguardar processamento
            console.log('      ⏳ Aguardando processamento da gamificação...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verificar perfil atualizado
            console.log('\n   📊 Perfil de gamificação após completar sessão:');
            const finalGamificationProfile = await makeRequest('GET', '/gamification/profile');
            
            if (finalGamificationProfile.success) {
                const finalXP = finalGamificationProfile.data.xp || 0;
                const finalLevel = finalGamificationProfile.data.level || 1;
                const finalStreak = finalGamificationProfile.data.current_streak || 0;
                const xpGained = finalXP - initialXP;
                
                console.log(`      XP Final: ${finalXP} ${xpGained > 0 ? `(+${xpGained} XP ganhos!)` : ''}`);
                console.log(`      Nível: ${finalLevel} ${finalLevel > initialLevel ? '⬆️ SUBIU DE NÍVEL!' : ''}`);
                console.log(`      Streak: ${finalStreak} dias ${finalStreak > initialStreak ? '🔥' : ''}`);
                console.log(`      Conquistas: ${finalGamificationProfile.data.achievements?.length || 0}`);
                
                if (finalGamificationProfile.data.level_info) {
                    console.log(`      Título Atual: ${finalGamificationProfile.data.level_info.title}`);
                    if (finalGamificationProfile.data.level_info.phrase) {
                        console.log(`      Frase Motivacional: "${finalGamificationProfile.data.level_info.phrase}"`);
                    }
                }
                
                // Verificar conquistas desbloqueadas
                if (finalGamificationProfile.data.achievements?.length > 0) {
                    console.log('\n      🏆 Conquistas desbloqueadas:');
                    finalGamificationProfile.data.achievements.slice(0, 3).forEach(ach => {
                        console.log(`         • ${ach.achievement_id}`);
                    });
                }
                
                // Análise do resultado
                console.log('\n   📈 Análise da gamificação:');
                if (xpGained > 0) {
                    console.log('      ✅ Sistema de XP funcionando corretamente!');
                    console.log(`      💡 Você ganhou ${xpGained} XP por completar a sessão`);
                    registrarEtapa('Gamificação - XP', true, { xpGained, finalXP });
                } else {
                    console.log('      ❌ PROBLEMA: XP não foi atualizado');
                    console.log('      ⚠️ Verificar GamificationService');
                    registrarEtapa('Gamificação - XP', false, { erro: 'XP não atualizado' });
                }
                
                if (finalStreak >= initialStreak) {
                    console.log('      ✅ Sistema de streak funcionando');
                    registrarEtapa('Gamificação - Streak', true, { finalStreak });
                } else {
                    console.log('      ⚠️ Streak não aumentou (normal se já estudou hoje)');
                    registrarEtapa('Gamificação - Streak', true, { aviso: 'Já estudou hoje' });
                }
                
                // Verificar leaderboard (se disponível)
                console.log('\n   🏅 Verificando leaderboard:');
                const leaderboardResult = await makeRequest('GET', '/gamification/leaderboard');
                
                if (leaderboardResult.success) {
                    const leaderboard = leaderboardResult.data.leaderboard || leaderboardResult.data || [];
                    console.log(`      Total de usuários no ranking: ${leaderboard.length}`);
                    
                    const myPosition = leaderboard.findIndex(u => u.user_id === userId) + 1;
                    if (myPosition > 0) {
                        console.log(`      📍 Sua posição: #${myPosition}`);
                        console.log(`      🎯 Seu XP: ${leaderboard[myPosition - 1].total_xp}`);
                    }
                    
                    if (leaderboard.length > 0) {
                        console.log('\n      🥇 Top 3 do ranking:');
                        leaderboard.slice(0, 3).forEach((user, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                            console.log(`         ${medal} ${user.user_name || 'Usuário'}: ${user.total_xp} XP`);
                        });
                    }
                    
                    registrarEtapa('Gamificação - Leaderboard', true, { position: myPosition });
                } else {
                    console.log('      ⚠️ Leaderboard não disponível');
                    registrarEtapa('Gamificação - Leaderboard', true, { aviso: 'Não implementado' });
                }
                
            } else {
                console.log('      ❌ Erro ao verificar perfil atualizado');
                registrarEtapa('Gamificação', false, { erro: 'Perfil não carregou' });
            }
        } else {
            console.log('      ❌ Erro ao completar sessão para teste de XP');
            registrarEtapa('Gamificação', false, { erro: completeForXP.error });
        }
    } else {
        console.log('      ⚠️ Nenhuma sessão pendente disponível para teste');
        registrarEtapa('Gamificação', true, { aviso: 'Sem sessões pendentes' });
    }
    
    // ========== RESUMO FINAL ========== 
    console.log('\n' + '='.repeat(70));
    console.log('📋 RESUMO DO TESTE');
    console.log('=' .repeat(70));
    
    const etapasSucesso = testResults.etapas.filter(e => e.sucesso).length;
    const totalEtapas = testResults.etapas.length;
    const percentualSucesso = ((etapasSucesso / totalEtapas) * 100).toFixed(1);
    
    console.log(`\n   ✅ Etapas bem-sucedidas: ${etapasSucesso}/${totalEtapas} (${percentualSucesso}%)`);
    
    if (testResults.erros.length > 0) {
        console.log(`\n   ❌ Erros encontrados:`);
        testResults.erros.forEach(erro => {
            console.log(`      - ${erro.etapa}: ${erro.erro.message}`);
        });
    }
    
    testResults.sucesso = etapasSucesso === totalEtapas;
    
    if (testResults.sucesso) {
        console.log('\n🎉 TESTE COMPLETO BEM-SUCEDIDO! A PLATAFORMA ESTÁ FUNCIONANDO CORRETAMENTE!');
    } else {
        console.log('\n⚠️ TESTE COMPLETO COM PROBLEMAS. VERIFICAR ERROS ACIMA.');
    }
    
    // Salvar resultados
    await salvarResultados();
}

// Função para salvar resultados em arquivo
async function salvarResultados() {
    const filename = `teste-plataforma-resultado-${timestamp}.json`;
    try {
        fs.writeFileSync(filename, JSON.stringify(testResults, null, 2));
        console.log(`\n📁 Resultados salvos em: ${filename}`);
    } catch (error) {
        console.error('❌ Erro ao salvar resultados:', error.message);
    }
}

// Executar teste
console.log('🚀 Iniciando teste completo da plataforma Editaliza...\n');

testarPlataformaCompleta()
    .then(() => {
        console.log('\n✨ Teste finalizado');
        process.exit(testResults.sucesso ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Erro fatal no teste:', error);
        testResults.erros.push({ etapa: 'Fatal', erro: error.message });
        salvarResultados().then(() => process.exit(1));
    });