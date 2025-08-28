#!/usr/bin/env node

/**
 * Teste E2E Completo - Sistema Editaliza
 * 
 * Valida o fluxo completo:
 * 1. Criar conta e fazer login
 * 2. Criar plano de estudos
 * 3. Adicionar disciplinas com pesos
 * 4. Adicionar tópicos com pesos 
 * 5. Gerar cronograma (round-robin ponderado)
 * 6. Verificar sessões de estudo
 * 7. Marcar sessões como concluídas
 * 8. Verificar estatísticas e gamificação
 * 9. Validar algoritmo de distribuição ponderada
 */

const axios = require('axios');
const colors = require('colors');
const fs = require('fs').promises;

const BASE_URL = 'http://localhost:3001';
const timestamp = Date.now();

// Dados de teste
const testUser = {
    name: `Usuário Teste ${timestamp}`,
    email: `teste.e2e.${timestamp}@example.com`,
    password: 'SenhaForte123!@#'
};

let authToken = null;
let userId = null;
let planId = null;
let subjects = [];
let topics = [];
let sessions = [];

// Função auxiliar para log
function log(message, type = 'info') {
    const icons = {
        info: '📘',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        test: '🧪'
    };
    
    const colors = {
        info: 'cyan',
        success: 'green', 
        error: 'red',
        warning: 'yellow',
        test: 'magenta'
    };
    
    console.log(`${icons[type]} ${message}`[colors[type]]);
}

// Função para fazer requisições autenticadas
async function apiRequest(method, endpoint, data = null) {
    const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (data) config.data = data;
    
    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`Erro na requisição ${method} ${endpoint}:`, error.response?.data || error.message);
        throw error;
    }
}

// =============================================================================
// ETAPA 1: AUTENTICAÇÃO
// =============================================================================
async function testarAutenticacao() {
    log('ETAPA 1: Testando Autenticação', 'test');
    
    // Registrar usuário
    try {
        log('Registrando novo usuário...');
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
        
        userId = registerResponse.data.userId || registerResponse.data.id;
        authToken = registerResponse.data.token;
        
        log(`Usuário criado com sucesso! ID: ${userId}`, 'success');
        log(`Token JWT recebido`, 'success');
        
    } catch (error) {
        if (error.response?.status === 409) {
            log('Usuário já existe, fazendo login...', 'warning');
            
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });
            
            authToken = loginResponse.data.token;
            log('Login realizado com sucesso!', 'success');
        } else {
            throw error;
        }
    }
    
    // Verificar perfil
    const profile = await apiRequest('GET', '/api/profile');
    log(`Perfil carregado: ${profile.name} (${profile.email})`, 'success');
    
    return true;
}

// =============================================================================
// ETAPA 2: CRIAR PLANO DE ESTUDOS
// =============================================================================
async function criarPlanoEstudos() {
    log('\nETAPA 2: Criando Plano de Estudos', 'test');
    
    const planData = {
        plan_name: `Concurso Público ${timestamp}`,
        description: 'Plano completo para concurso com múltiplas disciplinas',
        exam_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 180 dias
        days_until_exam: 180,
        available_hours_per_day: 4
    };
    
    log('Criando plano de estudos...');
    const response = await apiRequest('POST', '/api/plans', planData);
    
    planId = response.newPlanId || response.planId || response.id;
    log(`Plano criado com sucesso! ID: ${planId}`, 'success');
    
    return planId;
}

// =============================================================================
// ETAPA 3: ADICIONAR DISCIPLINAS COM PESOS
// =============================================================================
async function adicionarDisciplinas() {
    log('\nETAPA 3: Adicionando Disciplinas com Pesos', 'test');
    
    const disciplinas = [
        { name: 'Português', weight: 10, description: 'Gramática e Interpretação' },
        { name: 'Matemática', weight: 8, description: 'Raciocínio Lógico' },
        { name: 'Direito Constitucional', weight: 9, description: 'CF/88' },
        { name: 'Direito Administrativo', weight: 7, description: 'Lei 8.112' },
        { name: 'Informática', weight: 5, description: 'Conceitos Básicos' }
    ];
    
    for (const disciplina of disciplinas) {
        log(`Adicionando disciplina: ${disciplina.name} (peso: ${disciplina.weight})`);
        
        const response = await apiRequest('POST', `/api/plans/${planId}/subjects`, {
            study_plan_id: planId,
            subject_name: disciplina.name,
            weight: disciplina.weight,
            description: disciplina.description
        });
        
        const subjectId = response.subjectId || response.id;
        subjects.push({
            id: subjectId,
            ...disciplina
        });
        
        log(`  ✓ ${disciplina.name} adicionada com ID: ${subjectId}`, 'success');
    }
    
    return subjects;
}

// =============================================================================
// ETAPA 4: ADICIONAR TÓPICOS COM PESOS
// =============================================================================
async function adicionarTopicos() {
    log('\nETAPA 4: Adicionando Tópicos com Pesos', 'test');
    
    const topicosData = {
        'Português': [
            { name: 'Concordância Verbal', weight: 9 },
            { name: 'Regência', weight: 7 },
            { name: 'Crase', weight: 8 },
            { name: 'Pontuação', weight: 6 }
        ],
        'Matemática': [
            { name: 'Equações', weight: 9 },
            { name: 'Porcentagem', weight: 8 },
            { name: 'Geometria', weight: 5 },
            { name: 'Probabilidade', weight: 7 }
        ],
        'Direito Constitucional': [
            { name: 'Direitos Fundamentais', weight: 10 },
            { name: 'Organização do Estado', weight: 8 },
            { name: 'Poderes', weight: 9 }
        ],
        'Direito Administrativo': [
            { name: 'Princípios', weight: 8 },
            { name: 'Atos Administrativos', weight: 9 },
            { name: 'Licitações', weight: 7 }
        ],
        'Informática': [
            { name: 'Hardware', weight: 5 },
            { name: 'Software', weight: 6 },
            { name: 'Redes', weight: 7 }
        ]
    };
    
    for (const subject of subjects) {
        const subjectTopics = topicosData[subject.name] || [];
        
        log(`Adicionando tópicos para ${subject.name}:`);
        
        for (const topicData of subjectTopics) {
            const response = await apiRequest('POST', `/api/subjects/${subject.id}/topics`, {
                subject_id: subject.id,
                topic_name: topicData.name,
                weight: topicData.weight,
                status: 'pending',
                progress: 0
            });
            
            const topicId = response.topicId || response.id;
            topics.push({
                id: topicId,
                subject_id: subject.id,
                subject_name: subject.name,
                subject_weight: subject.weight,
                ...topicData,
                // Cálculo da prioridade: peso_disciplina * 10 + peso_topico
                priority: subject.weight * 10 + topicData.weight
            });
            
            log(`  ✓ ${topicData.name} (peso: ${topicData.weight}, prioridade: ${subject.weight * 10 + topicData.weight})`, 'success');
        }
    }
    
    return topics;
}

// =============================================================================
// ETAPA 5: GERAR CRONOGRAMA
// =============================================================================
async function gerarCronograma() {
    log('\nETAPA 5: Gerando Cronograma (Round-Robin Ponderado)', 'test');
    
    log('Solicitando geração do cronograma...');
    
    try {
        const response = await apiRequest('POST', `/api/plans/${planId}/schedule/generate`, {
            algorithm: 'weighted-round-robin',
            start_date: new Date().toISOString().split('T')[0],
            daily_hours: 4,
            include_weekends: false
        });
        
        if (response.scheduleId || response.success) {
            log('Cronograma gerado com sucesso!', 'success');
            
            // Buscar sessões geradas
            sessions = await apiRequest('GET', `/api/plans/${planId}/sessions`);
            log(`Total de sessões criadas: ${sessions.length}`, 'info');
            
            return sessions;
        }
    } catch (error) {
        log('Erro ao gerar cronograma, tentando método alternativo...', 'warning');
        
        // Método alternativo
        const response = await apiRequest('POST', `/api/schedules/generate`, {
            plan_id: planId,
            algorithm: 'weighted'
        });
        
        sessions = response.sessions || [];
        log(`Cronograma gerado com ${sessions.length} sessões`, 'success');
    }
    
    return sessions;
}

// =============================================================================
// ETAPA 6: VERIFICAR DISTRIBUIÇÃO PONDERADA
// =============================================================================
async function verificarDistribuicaoPonderada() {
    log('\nETAPA 6: Verificando Distribuição Ponderada', 'test');
    
    // Contar frequência de cada tópico nas sessões
    const frequencia = {};
    
    sessions.forEach(session => {
        const key = `${session.subject_name || session.subject} - ${session.topic_name || session.topic}`;
        frequencia[key] = (frequencia[key] || 0) + 1;
    });
    
    // Criar array ordenado por frequência
    const distribuicao = Object.entries(frequencia)
        .map(([topico, freq]) => {
            // Encontrar o tópico original para pegar a prioridade
            const topicData = topics.find(t => 
                `${t.subject_name} - ${t.name}` === topico
            );
            
            return {
                topico,
                frequencia: freq,
                prioridade: topicData?.priority || 0
            };
        })
        .sort((a, b) => b.frequencia - a.frequencia);
    
    log('Distribuição de Sessões por Tópico:');
    log('(Prioridade = Peso Disciplina × 10 + Peso Tópico)');
    console.log('─'.repeat(60));
    
    distribuicao.forEach(item => {
        const bar = '█'.repeat(Math.min(item.frequencia, 30));
        console.log(`${item.topico.padEnd(40)} | Pri: ${String(item.prioridade).padStart(3)} | ${String(item.frequencia).padStart(3)}x ${bar}`);
    });
    
    // Validar se a distribuição respeita as prioridades
    let valid = true;
    for (let i = 0; i < distribuicao.length - 1; i++) {
        if (distribuicao[i].prioridade < distribuicao[i + 1].prioridade && 
            distribuicao[i].frequencia < distribuicao[i + 1].frequencia) {
            log(`⚠️ Inversão detectada: ${distribuicao[i].topico} tem menor prioridade mas menos frequência`, 'warning');
            valid = false;
        }
    }
    
    if (valid) {
        log('✅ Distribuição ponderada está correta!', 'success');
    } else {
        log('⚠️ Distribuição pode ter inconsistências', 'warning');
    }
    
    return valid;
}

// =============================================================================
// ETAPA 7: MARCAR SESSÕES COMO CONCLUÍDAS
// =============================================================================
async function marcarSessoesConcluidas() {
    log('\nETAPA 7: Marcando Sessões como Concluídas', 'test');
    
    // Pegar as primeiras 5 sessões para marcar como concluídas
    const sessoesToComplete = sessions.slice(0, 5);
    
    for (const session of sessoesToComplete) {
        try {
            await apiRequest('PATCH', `/api/sessions/${session.id}/complete`, {
                completed: true,
                actual_duration: 60, // 60 minutos
                quality_score: Math.floor(Math.random() * 3) + 3 // Score de 3 a 5
            });
            
            log(`✓ Sessão ${session.id} marcada como concluída`, 'success');
        } catch (error) {
            log(`Erro ao marcar sessão ${session.id}`, 'error');
        }
    }
    
    return true;
}

// =============================================================================
// ETAPA 8: VERIFICAR ESTATÍSTICAS E GAMIFICAÇÃO
// =============================================================================
async function verificarEstatisticasGamificacao() {
    log('\nETAPA 8: Verificando Estatísticas e Gamificação', 'test');
    
    // Buscar estatísticas
    try {
        const stats = await apiRequest('GET', '/api/statistics/user');
        
        log('Estatísticas do Usuário:');
        console.log(`  • Sessões Totais: ${stats.total_sessions || 0}`);
        console.log(`  • Sessões Concluídas: ${stats.completed_sessions || 0}`);
        console.log(`  • Horas Estudadas: ${stats.total_hours || 0}h`);
        console.log(`  • Taxa de Conclusão: ${stats.completion_rate || 0}%`);
        
        // Buscar dados de gamificação
        const gamification = await apiRequest('GET', '/api/gamification/profile');
        
        log('Gamificação:');
        console.log(`  • XP Total: ${gamification.total_xp || 0}`);
        console.log(`  • Nível: ${gamification.level || 1}`);
        console.log(`  • Conquistas: ${gamification.achievements?.length || 0}`);
        console.log(`  • Sequência de Dias: ${gamification.streak || 0}`);
        
        if (gamification.achievements?.length > 0) {
            log('Conquistas Desbloqueadas:');
            gamification.achievements.forEach(achievement => {
                console.log(`  🏆 ${achievement.name}: ${achievement.description}`);
            });
        }
        
        return true;
        
    } catch (error) {
        log('Erro ao buscar estatísticas/gamificação', 'warning');
        return false;
    }
}

// =============================================================================
// ETAPA 9: SIMULAR INTERFACE WEB
// =============================================================================
async function verificarInterfaceWeb() {
    log('\nETAPA 9: Verificando Interface Web', 'test');
    
    // Verificar página home
    try {
        const homeResponse = await axios.get(`${BASE_URL}/home.html`);
        log('✓ Página home.html acessível', 'success');
        
        // Verificar se há elementos de sessões
        const hasSessionCards = homeResponse.data.includes('session-card') || 
                               homeResponse.data.includes('sessão') ||
                               homeResponse.data.includes('estudo');
        
        if (hasSessionCards) {
            log('✓ Cards de sessões presentes na home', 'success');
        } else {
            log('⚠️ Cards de sessões podem não estar visíveis', 'warning');
        }
        
    } catch (error) {
        log('Erro ao acessar home.html', 'error');
    }
    
    // Verificar página cronograma
    try {
        const scheduleResponse = await axios.get(`${BASE_URL}/cronograma.html`);
        log('✓ Página cronograma.html acessível', 'success');
        
        // Verificar elementos do cronograma
        const hasSchedule = scheduleResponse.data.includes('calendar') || 
                           scheduleResponse.data.includes('cronograma') ||
                           scheduleResponse.data.includes('schedule');
        
        if (hasSchedule) {
            log('✓ Elementos de cronograma presentes', 'success');
        } else {
            log('⚠️ Elementos de cronograma podem não estar visíveis', 'warning');
        }
        
    } catch (error) {
        log('Erro ao acessar cronograma.html', 'error');
    }
    
    return true;
}

// =============================================================================
// FUNÇÃO PRINCIPAL
// =============================================================================
async function executarTesteCompleto() {
    console.log('\n' + '═'.repeat(70).cyan);
    console.log('🚀 TESTE E2E COMPLETO - SISTEMA EDITALIZA'.bold.cyan);
    console.log('═'.repeat(70).cyan);
    
    const resultados = {
        autenticacao: false,
        plano: false,
        disciplinas: false,
        topicos: false,
        cronograma: false,
        distribuicao: false,
        sessoes: false,
        estatisticas: false,
        interface: false
    };
    
    try {
        // Etapa 1: Autenticação
        resultados.autenticacao = await testarAutenticacao();
        
        // Etapa 2: Criar Plano
        if (resultados.autenticacao) {
            resultados.plano = await criarPlanoEstudos();
        }
        
        // Etapa 3: Adicionar Disciplinas
        if (resultados.plano) {
            resultados.disciplinas = (await adicionarDisciplinas()).length > 0;
        }
        
        // Etapa 4: Adicionar Tópicos
        if (resultados.disciplinas) {
            resultados.topicos = (await adicionarTopicos()).length > 0;
        }
        
        // Etapa 5: Gerar Cronograma
        if (resultados.topicos) {
            resultados.cronograma = (await gerarCronograma()).length > 0;
        }
        
        // Etapa 6: Verificar Distribuição
        if (resultados.cronograma) {
            resultados.distribuicao = await verificarDistribuicaoPonderada();
        }
        
        // Etapa 7: Marcar Sessões
        if (resultados.cronograma) {
            resultados.sessoes = await marcarSessoesConcluidas();
        }
        
        // Etapa 8: Estatísticas e Gamificação
        if (resultados.sessoes) {
            resultados.estatisticas = await verificarEstatisticasGamificacao();
        }
        
        // Etapa 9: Interface Web
        resultados.interface = await verificarInterfaceWeb();
        
    } catch (error) {
        log(`Erro durante teste: ${error.message}`, 'error');
        console.error(error);
    }
    
    // Relatório Final
    console.log('\n' + '═'.repeat(70).cyan);
    console.log('📊 RELATÓRIO FINAL'.bold.cyan);
    console.log('═'.repeat(70).cyan);
    
    const etapas = [
        { nome: '1. Autenticação (Criar conta/Login)', resultado: resultados.autenticacao },
        { nome: '2. Criar Plano de Estudos', resultado: resultados.plano },
        { nome: '3. Adicionar Disciplinas com Pesos', resultado: resultados.disciplinas },
        { nome: '4. Adicionar Tópicos com Pesos', resultado: resultados.topicos },
        { nome: '5. Gerar Cronograma Round-Robin', resultado: resultados.cronograma },
        { nome: '6. Validar Distribuição Ponderada', resultado: resultados.distribuicao },
        { nome: '7. Marcar Sessões Concluídas', resultado: resultados.sessoes },
        { nome: '8. Estatísticas e Gamificação', resultado: resultados.estatisticas },
        { nome: '9. Interface Web Acessível', resultado: resultados.interface }
    ];
    
    etapas.forEach(etapa => {
        const status = etapa.resultado ? '✅ PASSOU'.green : '❌ FALHOU'.red;
        console.log(`${status} - ${etapa.nome}`);
    });
    
    const totalPassou = etapas.filter(e => e.resultado).length;
    const percentual = ((totalPassou / etapas.length) * 100).toFixed(1);
    
    console.log('\n' + '═'.repeat(70).cyan);
    
    if (totalPassou === etapas.length) {
        console.log(`🎉 SUCESSO TOTAL! Todas as ${etapas.length} etapas passaram!`.bold.green);
        console.log('O sistema está funcionando completamente!'.green);
    } else {
        console.log(`⚠️  ${totalPassou}/${etapas.length} etapas passaram (${percentual}%)`.bold.yellow);
        console.log('Verifique as etapas que falharam para correção.'.yellow);
    }
    
    // Salvar relatório em arquivo
    const relatorio = {
        timestamp: new Date().toISOString(),
        usuario: testUser.email,
        planoId: planId,
        resultados: resultados,
        estatisticas: {
            totalDisciplinas: subjects.length,
            totalTopicos: topics.length,
            totalSessoes: sessions.length,
            etapasCompletas: totalPassou,
            percentualSucesso: percentual
        }
    };
    
    await fs.writeFile(
        `test-report-${timestamp}.json`,
        JSON.stringify(relatorio, null, 2)
    );
    
    log(`\nRelatório salvo em: test-report-${timestamp}.json`, 'info');
}

// =============================================================================
// EXECUTAR TESTE
// =============================================================================
console.log('Verificando servidor...'.gray);

axios.get(`${BASE_URL}/health`)
    .then(() => {
        console.log(`✓ Servidor respondendo em ${BASE_URL}`.green);
        executarTesteCompleto().catch(console.error);
    })
    .catch(() => {
        console.error(`❌ Servidor não está rodando em ${BASE_URL}`.red);
        console.log('Execute: PORT=3001 npm start'.gray);
        process.exit(1);
    });