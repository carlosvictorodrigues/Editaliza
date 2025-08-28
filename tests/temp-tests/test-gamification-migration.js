// 🎮 TEST SCRIPT - GAMIFICATION MIGRATION PHASE 7
// Execute: node test-gamification-migration.js

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

// 🎮 TESTES DE GAMIFICAÇÃO
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

    // 2. Obter dados completos de gamificação
    async getGamificationData() {
        console.log('\n🎮 2. DADOS COMPLETOS DE GAMIFICAÇÃO');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/plans/${planId}/gamification`);
        if (res.status === 200) {
            console.log('   ✅ Dados de gamificação obtidos:');
            
            // XP e Nível
            console.log('\n   📊 EXPERIÊNCIA E NÍVEL:');
            console.log(`      - XP Total: ${res.data.xp.total}`);
            console.log(`      - Nível Atual: ${res.data.level.name}`);
            console.log(`      - Progresso: ${res.data.level.progress}%`);
            console.log(`      - XP para próximo: ${res.data.level.xpToNext}`);
            
            // Conquistas
            console.log('\n   🏆 CONQUISTAS:');
            console.log(`      - Total desbloqueadas: ${res.data.achievements.unlocked}`);
            console.log(`      - Total disponíveis: ${res.data.achievements.total}`);
            
            if (res.data.achievements.list && res.data.achievements.list.length > 0) {
                console.log('      - Últimas conquistas:');
                res.data.achievements.list.slice(0, 3).forEach(a => {
                    console.log(`        • ${a.icon} ${a.name} (${a.progress}%)`);
                });
            }
            
            // Estatísticas
            console.log('\n   📈 ESTATÍSTICAS GAMIFICADAS:');
            console.log(`      - Sessões completadas: ${res.data.stats.sessionsCompleted}`);
            console.log(`      - Tópicos concluídos: ${res.data.stats.topicsCompleted}`);
            console.log(`      - Streak atual: ${res.data.stats.currentStreak} dias`);
            console.log(`      - Melhor streak: ${res.data.stats.bestStreak} dias`);
            
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 3. Verificar sistema de níveis
    async checkLevelSystem() {
        console.log('\n📊 3. SISTEMA DE NÍVEIS');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/plans/${planId}/gamification`);
        if (res.status === 200) {
            const levels = [
                { min: 0, max: 100, name: 'Aspirante a Servidor(a) 🌱' },
                { min: 100, max: 250, name: 'Concurseiro(a) Iniciante 📚' },
                { min: 250, max: 500, name: 'Estudante Dedicado(a) 💪' },
                { min: 500, max: 1000, name: 'Focado(a) na Missão 🎯' },
                { min: 1000, max: 2000, name: 'Quase lá! 🔥' },
                { min: 2000, max: 3500, name: 'Aprovado(a) em Potencial 🌟' },
                { min: 3500, max: 5000, name: 'Servidor(a) Público(a) 🏛️' },
                { min: 5000, max: Infinity, name: 'Lenda Viva ✨' }
            ];
            
            const xp = res.data.xp.total;
            const currentLevel = levels.find(l => xp >= l.min && xp < l.max);
            
            console.log('   ✅ Sistema de níveis funcionando:');
            console.log(`      - XP atual: ${xp}`);
            console.log(`      - Nível calculado: ${currentLevel?.name || 'Erro'}`);
            console.log(`      - Nível retornado: ${res.data.level.name}`);
            
            if (currentLevel?.name === res.data.level.name) {
                console.log('      ✅ Cálculo de nível correto!');
                return true;
            } else {
                console.log('      ❌ Discrepância no cálculo de nível');
                return false;
            }
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 4. Verificar conquistas por categoria
    async checkAchievementCategories() {
        console.log('\n🏆 4. CONQUISTAS POR CATEGORIA');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/plans/${planId}/gamification`);
        if (res.status === 200) {
            const achievements = res.data.achievements.list || [];
            
            // Categorizar conquistas
            const categories = {
                topics: achievements.filter(a => a.category === 'topics'),
                streaks: achievements.filter(a => a.category === 'streaks'),
                sessions: achievements.filter(a => a.category === 'sessions')
            };
            
            console.log('   ✅ Conquistas categorizadas:');
            console.log(`      📚 Tópicos: ${categories.topics.length} conquistas`);
            console.log(`      🔥 Streaks: ${categories.streaks.length} conquistas`);
            console.log(`      ⏱️ Sessões: ${categories.sessions.length} conquistas`);
            
            // Verificar estrutura de conquistas
            const sampleAchievement = achievements[0];
            if (sampleAchievement) {
                console.log('\n   📋 Estrutura de conquista validada:');
                console.log(`      - ID: ${sampleAchievement.id ? '✅' : '❌'}`);
                console.log(`      - Nome: ${sampleAchievement.name ? '✅' : '❌'}`);
                console.log(`      - Descrição: ${sampleAchievement.description ? '✅' : '❌'}`);
                console.log(`      - Ícone: ${sampleAchievement.icon ? '✅' : '❌'}`);
                console.log(`      - Progresso: ${sampleAchievement.progress !== undefined ? '✅' : '❌'}`);
                console.log(`      - Desbloqueada: ${sampleAchievement.unlocked !== undefined ? '✅' : '❌'}`);
            }
            
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 5. Verificar cálculo de XP
    async verifyXPCalculation() {
        console.log('\n💎 5. VERIFICAÇÃO DE CÁLCULO DE XP');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/plans/${planId}/gamification`);
        if (res.status === 200) {
            const stats = res.data.stats;
            const xpBreakdown = res.data.xp.breakdown;
            
            // Fórmula: (sessões × 10) + (tópicos × 50)
            const expectedXP = (stats.sessionsCompleted * 10) + (stats.topicsCompleted * 50);
            const actualXP = res.data.xp.total;
            
            console.log('   📊 Cálculo de XP:');
            console.log(`      - Sessões: ${stats.sessionsCompleted} × 10 = ${stats.sessionsCompleted * 10} XP`);
            console.log(`      - Tópicos: ${stats.topicsCompleted} × 50 = ${stats.topicsCompleted * 50} XP`);
            console.log(`      - XP esperado: ${expectedXP}`);
            console.log(`      - XP retornado: ${actualXP}`);
            
            if (xpBreakdown) {
                console.log('\n   📋 Breakdown de XP:');
                console.log(`      - Por sessões: ${xpBreakdown.fromSessions} XP`);
                console.log(`      - Por tópicos: ${xpBreakdown.fromTopics} XP`);
            }
            
            if (Math.abs(expectedXP - actualXP) <= 1) { // Tolerância de 1 XP
                console.log('      ✅ Cálculo de XP correto!');
                return true;
            } else {
                console.log('      ❌ Discrepância no cálculo de XP');
                return false;
            }
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    },

    // 6. Verificar sistema de streaks
    async checkStreakSystem() {
        console.log('\n🔥 6. SISTEMA DE STREAKS');
        
        if (!planId) {
            console.log('   ⚠️ Sem plano ativo para testar');
            return false;
        }

        const res = await makeRequest(`/api/plans/${planId}/gamification`);
        if (res.status === 200) {
            const stats = res.data.stats;
            
            console.log('   ✅ Dados de streak:');
            console.log(`      - Streak atual: ${stats.currentStreak} dias`);
            console.log(`      - Melhor streak: ${stats.bestStreak} dias`);
            console.log(`      - Última atividade: ${stats.lastActivityDate || 'N/A'}`);
            
            // Verificar conquistas de streak
            const streakAchievements = res.data.achievements.list?.filter(a => 
                a.category === 'streaks'
            ) || [];
            
            if (streakAchievements.length > 0) {
                console.log('\n   🏆 Conquistas de streak:');
                streakAchievements.forEach(a => {
                    const status = a.unlocked ? '✅' : '⏳';
                    console.log(`      ${status} ${a.icon} ${a.name} (${a.progress}%)`);
                });
            }
            
            return true;
        }
        console.log('   ❌ Erro:', res.data);
        return false;
    }
};

// 🚀 EXECUTAR TESTES
async function runTests() {
    console.log('🎮 TESTE DE MIGRAÇÃO - FASE 7: GAMIFICAÇÃO');
    console.log('===========================================');
    console.log('📅 Data/Hora: ' + new Date().toLocaleString('pt-BR'));
    
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

    // Validações críticas
    console.log('\n⚠️ VALIDAÇÕES CRÍTICAS:');
    console.log('1. Fórmula XP: (sessões × 10) + (tópicos × 50)');
    console.log('2. 8 níveis com thresholds específicos');
    console.log('3. 33 conquistas em 3 categorias');
    console.log('4. Cálculo de streak com dias consecutivos');
    console.log('5. Progressão não-linear de níveis');

    if (failed === 0) {
        console.log('\n🎉 FASE 7 - MIGRAÇÃO DE GAMIFICAÇÃO: SUCESSO TOTAL!');
    } else {
        console.log('\n⚠️ ALGUNS TESTES FALHARAM - REVISAR IMPLEMENTAÇÃO');
    }
}

// Executar
runTests().catch(console.error);