#!/usr/bin/env node

/**
 * Análise do Algoritmo de Geração do Cronograma TJPE2025
 * 
 * Este script analisa se o algoritmo está respeitando corretamente os pesos das disciplinas
 * no plano TJPE2025 conforme especificado pelo usuário.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ScheduleWeightAnalyzer {
    constructor() {
        this.dbPath = path.join(__dirname, 'db.sqlite');
        this.db = null;
        this.planId = 1005; // TJPE Plan ID após restauração
        this.userId = 1000; // User 3@3.com
        
        // Pesos esperados conforme documentação TJPE2025
        this.expectedWeights = {
            'Direito Civil': 5,           // MAIOR PESO - 10 tópicos
            'Direito Administrativo': 4,  // 30 tópicos  
            'Direito Constitucional': 4,  // 15 tópicos
            'Direito Penal': 4,           // 12 tópicos
            'Direito Processual Civil': 4, // 21 tópicos
            'Direito Processual Penal': 4, // 11 tópicos
            'Legislação': 3,              // 7 tópicos
            'Língua Portuguesa': 2,       // 17 tópicos
            'Raciocínio Lógico': 1        // MENOR PESO - 8 tópicos
        };
        
        this.expectedCounts = {
            'Direito Civil': 10,
            'Direito Administrativo': 30,
            'Direito Constitucional': 15,
            'Direito Penal': 12,
            'Direito Processual Civil': 21,
            'Direito Processual Penal': 11,
            'Legislação': 7,
            'Língua Portuguesa': 17,
            'Raciocínio Lógico': 8
        };
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(new Error(`Falha ao conectar ao banco: ${err.message}`));
                    return;
                }
                console.log('🔌 Conectado ao banco de dados');
                resolve();
            });
        });
    }

    async close() {
        if (this.db) {
            await new Promise(resolve => {
                this.db.close((err) => {
                    if (err) console.error('Erro ao fechar banco:', err);
                    resolve();
                });
            });
            console.log('📴 Conexão com banco fechada');
        }
    }

    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getSubjectsData() {
        console.log('📊 Coletando dados das disciplinas...');
        
        const subjects = await this.query(`
            SELECT s.subject_name, s.priority_weight, COUNT(t.id) as topic_count
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = ?
            GROUP BY s.id, s.subject_name, s.priority_weight
            ORDER BY s.priority_weight DESC
        `, [this.planId]);

        return subjects;
    }

    async getScheduleFrequency() {
        console.log('📅 Analisando frequência no cronograma (próximas 3 semanas)...');
        
        const today = new Date();
        const threeWeeksLater = new Date();
        threeWeeksLater.setDate(today.getDate() + 21);
        
        const todayStr = today.toISOString().split('T')[0];
        const endDateStr = threeWeeksLater.toISOString().split('T')[0];
        
        const sessions = await this.query(`
            SELECT subject_name, COUNT(*) as session_count, session_type
            FROM study_sessions
            WHERE study_plan_id = ? 
            AND session_date BETWEEN ? AND ?
            GROUP BY subject_name, session_type
            ORDER BY session_count DESC
        `, [this.planId, todayStr, endDateStr]);

        // Agregrar por disciplina
        const frequency = {};
        sessions.forEach(session => {
            if (!frequency[session.subject_name]) {
                frequency[session.subject_name] = 0;
            }
            frequency[session.subject_name] += session.session_count;
        });

        return { detailed: sessions, aggregated: frequency };
    }

    async getAllScheduleData() {
        console.log('📈 Coletando todos os dados do cronograma...');
        
        const allSessions = await this.query(`
            SELECT subject_name, COUNT(*) as total_sessions, session_type
            FROM study_sessions
            WHERE study_plan_id = ?
            GROUP BY subject_name, session_type
        `, [this.planId]);

        const totalBySubject = {};
        allSessions.forEach(session => {
            if (!totalBySubject[session.subject_name]) {
                totalBySubject[session.subject_name] = 0;
            }
            totalBySubject[session.subject_name] += session.total_sessions;
        });

        return { detailed: allSessions, aggregated: totalBySubject };
    }

    calculateExpectedFrequency(subjects, totalSessions) {
        console.log('🧮 Calculando frequência esperada baseada nos pesos...');
        
        // Calcular peso total
        const totalWeight = subjects.reduce((sum, subj) => sum + subj.priority_weight, 0);
        
        // Calcular frequência esperada para cada disciplina
        const expectedFreq = {};
        subjects.forEach(subj => {
            const weightRatio = subj.priority_weight / totalWeight;
            expectedFreq[subj.subject_name] = Math.round(totalSessions * weightRatio);
        });
        
        return expectedFreq;
    }

    analyzeWeightCompliance(subjects, actualFreq, expectedFreq) {
        console.log('\n🔍 ANÁLISE DE CONFORMIDADE COM OS PESOS');
        console.log('='.repeat(50));
        
        const analysis = [];
        
        subjects.forEach(subj => {
            const actual = actualFreq[subj.subject_name] || 0;
            const expected = expectedFreq[subj.subject_name] || 0;
            const variance = expected > 0 ? ((actual - expected) / expected * 100) : 0;
            const configuredWeight = this.expectedWeights[subj.subject_name] || 0;
            const weightMatch = subj.priority_weight === configuredWeight;
            
            analysis.push({
                subject: subj.subject_name,
                configuredWeight: configuredWeight,
                dbWeight: subj.priority_weight,
                weightMatch: weightMatch,
                actualSessions: actual,
                expectedSessions: expected,
                variance: variance,
                topicCount: subj.topic_count
            });
        });
        
        // Ordenar por peso configurado (maior para menor)
        analysis.sort((a, b) => b.configuredWeight - a.configuredWeight);
        
        return analysis;
    }

    printDetailedAnalysis(analysis, actualFreq) {
        console.log('\n📊 ANÁLISE QUANTITATIVA DETALHADA');
        console.log('='.repeat(80));
        
        const totalActualSessions = Object.values(actualFreq).reduce((sum, count) => sum + count, 0);
        
        analysis.forEach((item, index) => {
            const percentage = totalActualSessions > 0 ? ((item.actualSessions / totalActualSessions) * 100) : 0;
            const status = item.weightMatch ? '✅' : '❌';
            const varianceStatus = Math.abs(item.variance) < 20 ? '✅' : (Math.abs(item.variance) < 40 ? '⚠️' : '❌');
            
            console.log(`\n${index + 1}. ${status} ${item.subject} (Peso: ${item.configuredWeight})`);
            console.log(`   📊 Peso no BD: ${item.dbWeight} ${item.weightMatch ? '✅' : '❌ Erro!'}`);
            console.log(`   📝 Tópicos: ${item.topicCount} (esperado: ${this.expectedCounts[item.subject] || 'N/A'})`);
            console.log(`   📅 Sessões: ${item.actualSessions} (${percentage.toFixed(1)}% do total)`);
            console.log(`   🎯 Esperado: ${item.expectedSessions} sessões`);
            console.log(`   📈 Variação: ${item.variance > 0 ? '+' : ''}${item.variance.toFixed(1)}% ${varianceStatus}`);
        });
    }

    printProblems(analysis) {
        console.log('\n⚠️ PROBLEMAS IDENTIFICADOS');
        console.log('='.repeat(50));
        
        const problems = [];
        
        // Verificar se Direito Civil (peso 5) tem a maior frequência
        const direitoCivil = analysis.find(a => a.subject === 'Direito Civil');
        const maxFreq = Math.max(...analysis.map(a => a.actualSessions));
        
        if (direitoCivil && direitoCivil.actualSessions !== maxFreq) {
            problems.push({
                type: 'PRIORIDADE_INCORRETA',
                message: `Direito Civil (peso ${direitoCivil.configuredWeight}) deveria ter a MAIOR frequência, mas tem apenas ${direitoCivil.actualSessions} sessões`,
                severity: 'CRÍTICO'
            });
        }
        
        // Verificar se Raciocínio Lógico (peso 1) tem a menor frequência  
        const raciocinioLogico = analysis.find(a => a.subject === 'Raciocínio Lógico');
        const minFreq = Math.min(...analysis.map(a => a.actualSessions));
        
        if (raciocinioLogico && raciocinioLogico.actualSessions !== minFreq) {
            problems.push({
                type: 'PRIORIDADE_INCORRETA',
                message: `Raciocínio Lógico (peso ${raciocinioLogico.configuredWeight}) deveria ter a MENOR frequência, mas tem ${raciocinioLogico.actualSessions} sessões`,
                severity: 'CRÍTICO'
            });
        }
        
        // Verificar pesos incorretos no banco
        analysis.forEach(item => {
            if (!item.weightMatch) {
                problems.push({
                    type: 'PESO_INCORRETO',
                    message: `${item.subject}: peso no BD é ${item.dbWeight}, deveria ser ${item.configuredWeight}`,
                    severity: 'ALTO'
                });
            }
        });
        
        // Verificar variações extremas
        analysis.forEach(item => {
            if (Math.abs(item.variance) > 40) {
                problems.push({
                    type: 'VARIACAO_EXTREMA',
                    message: `${item.subject}: variação de ${item.variance.toFixed(1)}% em relação ao esperado`,
                    severity: 'MÉDIO'
                });
            }
        });
        
        if (problems.length === 0) {
            console.log('✅ Nenhum problema crítico identificado!');
            return;
        }
        
        problems.forEach((problem, index) => {
            const icon = problem.severity === 'CRÍTICO' ? '🔴' : 
                        problem.severity === 'ALTO' ? '🟠' : '🟡';
            console.log(`${index + 1}. ${icon} ${problem.severity}: ${problem.message}`);
        });
        
        return problems;
    }

    printRecommendations(problems) {
        console.log('\n💡 RECOMENDAÇÕES DE CORREÇÃO');
        console.log('='.repeat(50));
        
        if (!problems || problems.length === 0) {
            console.log('✅ O algoritmo está funcionando corretamente!');
            console.log('   - Os pesos estão sendo respeitados na distribuição');
            console.log('   - A priorização está adequada');
            return;
        }
        
        console.log('🔧 AJUSTES NECESSÁRIOS NO ALGORITMO:');
        
        if (problems.some(p => p.type === 'PESO_INCORRETO')) {
            console.log('\n1. 📊 CORREÇÃO DOS PESOS NO BANCO DE DADOS:');
            console.log('   - Executar script de correção dos pesos das disciplinas');
            console.log('   - Verificar se os pesos estão sendo salvos corretamente');
        }
        
        if (problems.some(p => p.type === 'PRIORIDADE_INCORRETA')) {
            console.log('\n2. ⚖️ AJUSTE DO ALGORITMO DE DISTRIBUIÇÃO:');
            console.log('   - Revisar a fórmula de cálculo: combinedPriority = Math.max(1, t.subject_priority + t.topic_priority - 3)');
            console.log('   - Considerar usar multiplicação ao invés de soma para maior diferenciação');
            console.log('   - Exemplo: combinedPriority = t.subject_priority * t.topic_priority');
        }
        
        if (problems.some(p => p.type === 'VARIACAO_EXTREMA')) {
            console.log('\n3. 📈 BALANCEAMENTO DA DISTRIBUIÇÃO:');
            console.log('   - Implementar verificação de limites por disciplina');
            console.log('   - Adicionar lógica de rebalanceamento dinâmico');
        }
        
        console.log('\n🎯 PRÓXIMOS PASSOS:');
        console.log('   1. Corrigir os pesos no banco de dados');
        console.log('   2. Testar o algoritmo com os pesos corretos');
        console.log('   3. Ajustar a fórmula se necessário');
        console.log('   4. Re-gerar o cronograma para o usuário');
    }

    async generateFullReport() {
        console.log('🏛️ ANÁLISE DO ALGORITMO DE CRONOGRAMA - TJPE2025');
        console.log('=' .repeat(60));
        console.log(`📋 Plano: ${this.planId} | Usuário: ${this.userId} (3@3.com)`);
        console.log(`📅 Data da análise: ${new Date().toLocaleDateString('pt-BR')}`);
        
        try {
            // Coletar dados
            const subjects = await this.getSubjectsData();
            const scheduleFreq = await this.getScheduleFrequency();
            const allSchedule = await this.getAllScheduleData();
            
            // Análise próximas 3 semanas
            console.log('\n📊 DADOS DAS DISCIPLINAS E PESOS ATUAIS:');
            subjects.forEach(subj => {
                const expected = this.expectedWeights[subj.subject_name];
                const match = subj.priority_weight === expected ? '✅' : '❌';
                console.log(`   ${match} ${subj.subject_name}: Peso ${subj.priority_weight} (esperado: ${expected}) | ${subj.topic_count} tópicos`);
            });
            
            // Calcular frequência esperada
            const totalSessions = Object.values(scheduleFreq.aggregated).reduce((sum, count) => sum + count, 0);
            const expectedFreq = this.calculateExpectedFrequency(subjects, totalSessions);
            
            // Análise de conformidade
            const analysis = this.analyzeWeightCompliance(subjects, scheduleFreq.aggregated, expectedFreq);
            
            // Relatórios
            this.printDetailedAnalysis(analysis, scheduleFreq.aggregated);
            const problems = this.printProblems(analysis);
            this.printRecommendations(problems);
            
            console.log('\n📈 RESUMO EXECUTIVO:');
            console.log(`   📚 Total de disciplinas: ${subjects.length}`);
            console.log(`   📝 Total de tópicos: ${subjects.reduce((sum, s) => sum + s.topic_count, 0)}`);
            console.log(`   📅 Sessões próximas 3 semanas: ${totalSessions}`);
            console.log(`   ⚠️ Problemas identificados: ${problems ? problems.length : 0}`);
            
            // Conclusão
            const hasCriticalProblems = problems && problems.some(p => p.severity === 'CRÍTICO');
            if (hasCriticalProblems) {
                console.log('\n🔴 CONCLUSÃO: O algoritmo NÃO está respeitando corretamente os pesos!');
                console.log('   O usuário está sendo prejudicado pela má priorização das disciplinas.');
            } else {
                console.log('\n✅ CONCLUSÃO: O algoritmo está funcionando adequadamente!');
                console.log('   Os pesos estão sendo respeitados na geração do cronograma.');
            }
            
        } catch (error) {
            console.error('❌ Erro na análise:', error.message);
            throw error;
        }
    }
}

// Função removida - erro corrigido

/**
 * Execução principal
 */
async function main() {
    const analyzer = new ScheduleWeightAnalyzer();
    
    try {
        await analyzer.connect();
        await analyzer.generateFullReport();
        
        console.log('\n🎉 ANÁLISE CONCLUÍDA COM SUCESSO!');
        
    } catch (error) {
        console.error('\n💥 ERRO NA ANÁLISE:', error.message);
        console.error('\n🔧 Possíveis soluções:');
        console.error('   1. Verificar se o banco de dados existe');
        console.error('   2. Confirmar se o plano TJPE foi restaurado corretamente');
        console.error('   3. Verificar permissões do arquivo de banco');
        
        process.exit(1);
    } finally {
        await analyzer.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { ScheduleWeightAnalyzer };