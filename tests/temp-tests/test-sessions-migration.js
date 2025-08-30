// 🧪 TEST SCRIPT - SESSIONS MIGRATION PHASE 5
// Execute: node test-sessions-migration.js

const http = require('http');

// Configuração
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
    email: 'p@p.com',
    password: '123456'
};

let authToken = null;
let csrfToken = null;
let planId = null;
let sessionId = null;

// 🛠️ Utilitários
const makeRequest = (path, method = 'GET', data = null) => {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (authToken) {
            options.headers['Cookie'] = `connect.sid=${authToken}`;
        }
        if (csrfToken && method !== 'GET') {
            options.headers['X-CSRF-Token'] = csrfToken;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.headers['set-cookie']) {
                    const cookies = res.headers['set-cookie'];
                    const sessionCookie = cookies.find(c => c.startsWith('connect.sid='));
                    if (sessionCookie) {
                        authToken = sessionCookie.split('=')[1].split(';')[0];
                    }
                }
                
                try {
                    const response = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, data: response });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
};

// 🧪 TESTES
const tests = {
    // 1. Autenticação
    async authenticate() {
        console.log('\n🔐 1. AUTENTICAÇÃO');
        
        // Obter CSRF token
        const csrfRes = await makeRequest('/api/auth/csrf-token');
        csrfToken = csrfRes.data.csrfToken;
        console.log('   ✅ CSRF Token obtido');

        // Login
        const loginRes = await makeRequest('/api/auth/login', 'POST', TEST_USER);
        if (loginRes.status === 200) {
            console.log('   ✅ Login bem-sucedido');
            
            // Obter plano ativo
            const profileRes = await makeRequest('/api/users/profile');
            if (profileRes.data.user?.active_plan_id) {
                planId = profileRes.data.user.active_plan_id;
                console.log(`   ✅ Plano ativo encontrado: ${planId}`);
            }
            return true;
        }
        console.log('   ❌ Falha no login:', loginRes.data);
        return false;
    },

    // 2. Listar sessões por data
    async getSessionsByDate() {
        console.log('\n📅 2. LISTAR SESSÕES POR DATA');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/sessions/by-date/${planId}`);
        if (res.status === 200) {
            const dates = Object.keys(res.data.scheduleByDate || {});
            console.log(`   ✅ Sessões obtidas para ${dates.length} datas`);
            
            // Pegar primeira sessão para testes
            if (dates.length > 0) {
                const firstDate = dates[0];
                const sessions = res.data.scheduleByDate[firstDate];
                if (sessions && sessions.length > 0) {
                    sessionId = sessions[0].id;
                    console.log(`   ✅ ID da primeira sessão: ${sessionId}`);
                }
            }
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 3. Verificar sessões atrasadas
    async checkOverdueSessions() {
        console.log('\n⏰ 3. VERIFICAR SESSÕES ATRASADAS');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/sessions/overdue-check/${planId}`);
        if (res.status === 200) {
            console.log("✅ Verificação concluída");
            console.log(`      - Tem atrasadas: ${res.data.hasOverdue}`);
            console.log(`      - Total atrasadas: ${res.data.overdueCount}`);
            if (res.data.overdueCount > 0) {
                console.log(`      - Primeira atrasada: ${res.data.firstOverdueDate}`);
            }
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 4. Atualizar sessão individual
    async updateSession() {
        console.log('\n✏️ 4. ATUALIZAR SESSÃO INDIVIDUAL');
        
        if (!sessionId) {
            console.log('   ⚠️ Sem sessão para testar');
            return false;
        }

        const updateData = {
            status: 'in_progress',
            notes: 'Teste de migração - Fase 5'
        };

        const res = await makeRequest(`/api/sessions/${sessionId}`, 'PATCH', updateData);
        if (res.status === 200) {
            console.log('   ✅ Sessão atualizada com sucesso');
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 5. Adicionar tempo de estudo
    async addStudyTime() {
        console.log('\n⏱️ 5. ADICIONAR TEMPO DE ESTUDO');
        
        if (!sessionId) {
            console.log('   ⚠️ Sem sessão para testar');
            return false;
        }

        const timeData = {
            seconds: 300 // 5 minutos
        };

        const res = await makeRequest(`/api/sessions/${sessionId}/time`, 'POST', timeData);
        if (res.status === 200) {
            console.log('   ✅ Tempo adicionado:', res.data.totalSeconds, 'segundos');
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 6. Atualização em lote
    async batchUpdateStatus() {
        console.log('\n📦 6. ATUALIZAÇÃO EM LOTE DE STATUS');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        // Primeiro, obter algumas sessões
        const sessionsRes = await makeRequest(`/api/sessions/by-date/${planId}`);
        if (sessionsRes.status !== 200) {
            console.log('   ⚠️ Não foi possível obter sessões');
            return false;
        }

        const allSessions = [];
        Object.values(sessionsRes.data.scheduleByDate || {}).forEach(dateSessions => {
            allSessions.push(...dateSessions);
        });

        if (allSessions.length < 2) {
            console.log('   ⚠️ Poucas sessões para teste em lote');
            return false;
        }

        // Pegar 2 sessões para teste
        const testSessions = allSessions.slice(0, 2);
        const updateData = {
            updates: testSessions.map(s => ({
                sessionId: s.id,
                status: 'pending',
                seconds: 0
            }))
        };

        const res = await makeRequest('/api/sessions/batch-update-status', 'PATCH', updateData);
        if (res.status === 200) {
            console.log(`   ✅ ${res.data.updated} sessões atualizadas em lote`);
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 7. Estatísticas de sessões
    async getSessionStatistics() {
        console.log('\n📊 7. ESTATÍSTICAS DE SESSÕES');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/sessions/statistics/${planId}`);
        if (res.status === 200) {
            console.log('   ✅ Estatísticas obtidas:');
            console.log(`      - Total: ${res.data.total}`);
            console.log(`      - Completadas: ${res.data.completed}`);
            console.log(`      - Em progresso: ${res.data.inProgress}`);
            console.log(`      - Pendentes: ${res.data.pending}`);
            console.log(`      - Tempo total: ${res.data.totalSeconds}s`);
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 8. Progresso de questões
    async getQuestionProgress() {
        console.log('\n❓ 8. PROGRESSO DE QUESTÕES');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/sessions/question-progress/${planId}`);
        if (res.status === 200) {
            console.log('   ✅ Progresso obtido:');
            console.log(`      - Questões resolvidas: ${res.data.totalQuestions}`);
            console.log(`      - Questões corretas: ${res.data.correctQuestions}`);
            console.log(`      - Taxa de acerto: ${res.data.successRate}%`);
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    }
};

// 🚀 EXECUTAR TESTES
async function runTests() {
    console.log('🧪 TESTE DE MIGRAÇÃO - FASE 5: SESSÕES DE ESTUDO');
    console.log('================================================');
    console.log('📅 Data/Hora: ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    console.log('🌍 Timezone: America/Sao_Paulo (CRÍTICO!)');
    
    const results = [];
    let passed = 0;
    let failed = 0;

    // Executar testes em sequência
    for (const [name, test] of Object.entries(tests)) {
        try {
            const result = await test();
            results.push({ name, success: result });
            if (result) passed++;
            else failed++;
        } catch (error) {
            console.log(`   ❌ Erro não tratado: ${error.message}`);
            results.push({ name, success: false });
            failed++;
        }
    }

    // Resumo
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(50));
    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`📈 Taxa de sucesso: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    // Detalhes
    console.log('\n📋 DETALHES:');
    results.forEach(r => {
        console.log(`   ${r.success ? '✅' : '❌'} ${r.name}`);
    });

    // Notas importantes
    console.log('\n⚠️ NOTAS IMPORTANTES:');
    console.log('1. Timezone brasileiro (America/Sao_Paulo) é CRÍTICO');
    console.log('2. Cálculos de streak devem considerar fuso horário');
    console.log('3. Operações em lote devem ser atômicas');
    console.log('4. Validação de ownership em todas as operações');
    console.log('5. Tempo de estudo é aditivo (soma com existente)');

    if (failed === 0) {
        console.log('\n🎉 FASE 5 - MIGRAÇÃO DE SESSÕES: SUCESSO TOTAL!');
    } else {
        console.log('\n⚠️ ALGUNS TESTES FALHARAM - REVISAR IMPLEMENTAÇÃO');
    }
}

// Executar
runTests().catch(console.error);