// performance_benchmark.js - Script para testar performance da rota otimizada
const db = require('./database.js');

// Utilitários para benchmark
const dbGet = (sql, params) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
const dbRun = (sql, params) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this) }));

// Função para criar dados de teste
async function createTestData() {
    console.log('Criando dados de teste...');
    
    try {
        await dbRun('BEGIN TRANSACTION');
        
        // Criar usuário de teste
        const userResult = await dbRun('INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)', 
            ['test@benchmark.com', 'test_hash']);
        
        const userId = userResult.lastID || (await dbGet('SELECT id FROM users WHERE email = ?', ['test@benchmark.com'])).id;
        
        // Criar planos de teste com diferentes tamanhos
        const testCases = [
            { name: 'Plano Pequeno', subjects: 5, topicsPerSubject: 10 },
            { name: 'Plano Médio', subjects: 10, topicsPerSubject: 15 },
            { name: 'Plano Grande', subjects: 15, topicsPerSubject: 20 },
            { name: 'Plano Extra Grande', subjects: 20, topicsPerSubject: 25 }
        ];
        
        const planIds = [];
        
        for (const testCase of testCases) {
            // Criar plano
            const planResult = await dbRun(`
                INSERT INTO study_plans 
                (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, has_essay) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, 
                testCase.name,
                '2024-12-31', 
                '{"0": 0, "1": 4, "2": 4, "3": 4, "4": 4, "5": 4, "6": 2}',
                50, 300, 50, 'completo', 0, false
            ]);
            
            const planId = planResult.lastID;
            planIds.push({ id: planId, ...testCase });
            
            // Criar disciplinas
            for (let s = 1; s <= testCase.subjects; s++) {
                const subjectResult = await dbRun('INSERT INTO subjects (study_plan_id, subject_name, priority_weight) VALUES (?, ?, ?)', 
                    [planId, `Disciplina ${s}`, Math.floor(Math.random() * 3) + 1]);
                
                const subjectId = subjectResult.lastID;
                
                // Criar tópicos
                for (let t = 1; t <= testCase.topicsPerSubject; t++) {
                    await dbRun('INSERT INTO topics (subject_id, description, status) VALUES (?, ?, ?)', 
                        [subjectId, `Tópico ${t} da Disciplina ${s}`, 'Pendente']);
                }
            }
        }
        
        await dbRun('COMMIT');
        console.log(`Dados de teste criados. Plan IDs: ${planIds.map(p => p.id).join(', ')}`);
        return planIds;
        
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Erro ao criar dados de teste:', error);
        throw error;
    }
}

// Função para simular a lógica de geração (versão simplificada para benchmark)
async function benchmarkScheduleGeneration(planId, planInfo) {
    const startTime = Date.now();
    const memUsageBefore = process.memoryUsage();
    
    try {
        console.log(`\n🔄 Testando: ${planInfo.name} (${planInfo.subjects} disciplinas, ${planInfo.subjects * planInfo.topicsPerSubject} tópicos)`);
        
        await dbRun('BEGIN IMMEDIATE TRANSACTION');
        
        // Query otimizada (similar à implementada)
        const queryStart = Date.now();
        const allTopicsQuery = `
            SELECT 
                t.id, t.description, t.status, t.completion_date,
                s.subject_name, s.priority_weight as priority
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = ?
            ORDER BY s.priority_weight DESC, t.id ASC
        `;
        const allTopics = await dbAll(allTopicsQuery, [planId]);
        const queryTime = Date.now() - queryStart;
        
        // Simular processamento de cronograma (sem criar sessões reais)
        const processingStart = Date.now();
        
        // Simular algoritmo de distribuição
        const sessionDuration = 50;
        const examDate = new Date('2024-12-31T23:59:59');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const study_hours_per_day = {0: 0, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 2};
        
        // Cache de datas (otimização implementada)
        const availableDatesCache = new Map();
        const getAvailableDates = (startDate, endDate, weekdayOnly = false) => {
            const cacheKey = `${startDate.getTime()}-${endDate.getTime()}-${weekdayOnly}`;
            if (availableDatesCache.has(cacheKey)) {
                return availableDatesCache.get(cacheKey);
            }
            
            const dates = [];
            let currentDate = new Date(startDate);
            while (currentDate <= endDate && dates.length < 1000) { // Limitar para benchmark
                const dayOfWeek = currentDate.getDay();
                const shouldSkip = (dayOfWeek === 0) || (weekdayOnly && dayOfWeek === 6);
                
                if (!shouldSkip && (study_hours_per_day[dayOfWeek] || 0) > 0) {
                    dates.push({
                        date: new Date(currentDate),
                        dayOfWeek,
                        maxSessions: Math.floor((study_hours_per_day[dayOfWeek] * 60) / sessionDuration)
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            availableDatesCache.set(cacheKey, dates);
            return dates;
        };
        
        // Simular criação de agenda
        const agenda = new Map();
        const availableDates = getAvailableDates(today, examDate);
        
        // Simular distribuição de tópicos
        const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');
        let sessionsCount = 0;
        
        for (const topic of pendingTopics) {
            // Simular busca de slot (sem realmente criar)
            if (availableDates.length > sessionsCount % availableDates.length) {
                sessionsCount++;
            }
        }
        
        const processingTime = Date.now() - processingStart;
        
        await dbRun('ROLLBACK'); // Não commitamos os dados de teste
        
        const totalTime = Date.now() - startTime;
        const memUsageAfter = process.memoryUsage();
        const memDiff = {
            rss: (memUsageAfter.rss - memUsageBefore.rss) / 1024 / 1024,
            heapUsed: (memUsageAfter.heapUsed - memUsageBefore.heapUsed) / 1024 / 1024
        };
        
        const results = {
            planName: planInfo.name,
            subjects: planInfo.subjects,
            topics: allTopics.length,
            queryTime,
            processingTime,
            totalTime,
            memoryDelta: memDiff,
            sessionsSimulated: sessionsCount,
            cache_hits: availableDatesCache.size
        };
        
        console.log(`✅ ${planInfo.name}:`);
        console.log(`   📊 Tópicos processados: ${allTopics.length}`);
        console.log(`   ⚡ Tempo de query: ${queryTime}ms`);
        console.log(`   🔄 Tempo de processamento: ${processingTime}ms`);
        console.log(`   ⏱️  Tempo total: ${totalTime}ms`);
        console.log(`   💾 Memória (RSS): ${memDiff.rss.toFixed(2)}MB`);
        console.log(`   🎯 Sessões simuladas: ${sessionsCount}`);
        
        return results;
        
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error(`❌ Erro no benchmark para ${planInfo.name}:`, error.message);
        throw error;
    }
}

// Função principal de benchmark
async function runBenchmarks() {
    console.log('🚀 Iniciando benchmarks de performance...');
    console.log('='.repeat(60));
    
    try {
        // Criar dados de teste
        const testPlans = await createTestData();
        
        // Executar benchmarks
        const results = [];
        
        for (const plan of testPlans) {
            const result = await benchmarkScheduleGeneration(plan.id, plan);
            results.push(result);
            
            // Pausa entre testes para limpeza de memória
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Relatório final
        console.log('\n' + '='.repeat(60));
        console.log('📈 RELATÓRIO DE PERFORMANCE');
        console.log('='.repeat(60));
        
        console.log('\n📋 Resumo dos Testes:');
        results.forEach(result => {
            console.log(`${result.planName.padEnd(20)} | ${result.topics.toString().padStart(3)} tópicos | ${result.totalTime.toString().padStart(4)}ms | ${result.memoryDelta.rss.toFixed(1).padStart(5)}MB`);
        });
        
        // Análise de escalabilidade
        console.log('\n📊 Análise de Escalabilidade:');
        const smallPlan = results[0];
        const largePlan = results[results.length - 1];
        
        const scaleFactor = largePlan.topics / smallPlan.topics;
        const timeScale = largePlan.totalTime / smallPlan.totalTime;
        const memoryScale = largePlan.memoryDelta.rss / Math.max(smallPlan.memoryDelta.rss, 0.1);
        
        console.log(`Fator de escala (tópicos): ${scaleFactor.toFixed(1)}x`);
        console.log(`Fator de escala (tempo): ${timeScale.toFixed(1)}x`);
        console.log(`Fator de escala (memória): ${memoryScale.toFixed(1)}x`);
        
        // Recomendações
        console.log('\n💡 Recomendações:');
        if (timeScale < scaleFactor * 1.5) {
            console.log('✅ Escalabilidade de tempo: EXCELENTE');
        } else {
            console.log('⚠️  Escalabilidade de tempo: Considere otimizações adicionais');
        }
        
        if (memoryScale < scaleFactor * 2) {
            console.log('✅ Escalabilidade de memória: BOA');
        } else {
            console.log('⚠️  Escalabilidade de memória: Considere processamento em chunks');
        }
        
        // Limpar dados de teste
        await cleanupTestData();
        
        console.log('\n🎉 Benchmarks concluídos com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante benchmarks:', error);
        await cleanupTestData();
    }
}

// Função para limpar dados de teste
async function cleanupTestData() {
    try {
        console.log('\n🧹 Limpando dados de teste...');
        const testUser = await dbGet('SELECT id FROM users WHERE email = ?', ['test@benchmark.com']);
        
        if (testUser) {
            await dbRun('BEGIN TRANSACTION');
            
            // Buscar planos de teste
            const testPlans = await dbAll('SELECT id FROM study_plans WHERE user_id = ?', [testUser.id]);
            
            for (const plan of testPlans) {
                // Deletar sessões
                await dbRun('DELETE FROM study_sessions WHERE study_plan_id = ?', [plan.id]);
                
                // Deletar tópicos
                await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)', [plan.id]);
                
                // Deletar disciplinas
                await dbRun('DELETE FROM subjects WHERE study_plan_id = ?', [plan.id]);
                
                // Deletar plano
                await dbRun('DELETE FROM study_plans WHERE id = ?', [plan.id]);
            }
            
            // Deletar usuário de teste
            await dbRun('DELETE FROM users WHERE id = ?', [testUser.id]);
            
            await dbRun('COMMIT');
            console.log('✅ Dados de teste removidos com sucesso.');
        }
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('⚠️  Erro ao limpar dados de teste:', error.message);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runBenchmarks()
        .then(() => {
            console.log('\n👋 Benchmark finalizado. Use os resultados para otimizações futuras.');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Falha crítica no benchmark:', error);
            process.exit(1);
        });
}

module.exports = { runBenchmarks, benchmarkScheduleGeneration };