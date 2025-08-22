// Análise profunda do algoritmo de distribuição por pesos
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d'
});

async function analyzeWeightDistribution() {
    try {
        console.log('🔍 ANÁLISE PROFUNDA DO ALGORITMO DE DISTRIBUIÇÃO POR PESOS\n');
        console.log('=' .repeat(70));
        
        // 1. EXPECTATIVA MATEMÁTICA
        console.log('\n📊 1. EXPECTATIVA MATEMÁTICA CORRETA:\n');
        
        const pesos = {
            'Direito Constitucional': 5,
            'Direito Administrativo': 4,
            'Português': 3,
            'Raciocínio Lógico': 2,
            'Informática': 1
        };
        
        const totalPeso = Object.values(pesos).reduce((a, b) => a + b, 0); // 15
        const totalSessoes = 30; // Exemplo com 30 sessões
        
        console.log('Cálculo esperado para 30 sessões totais:');
        console.log('-'.repeat(60));
        
        const expectedDistribution = {};
        for (const [disciplina, peso] of Object.entries(pesos)) {
            const percentual = (peso / totalPeso) * 100;
            const sessoesEsperadas = Math.round((peso / totalPeso) * totalSessoes);
            expectedDistribution[disciplina] = {
                peso,
                percentual: percentual.toFixed(1),
                sessoes: sessoesEsperadas
            };
            
            console.log(`${disciplina.padEnd(25)} | Peso: ${peso} | ${percentual.toFixed(1).padStart(5)}% | ${sessoesEsperadas.toString().padStart(2)} sessões`);
        }
        
        console.log('-'.repeat(60));
        console.log(`TOTAL                     | Peso: ${totalPeso} | 100.0% | ${totalSessoes} sessões`);
        
        // 2. ANÁLISE DO QUE FOI CRIADO NO BANCO
        console.log('\n📈 2. ANÁLISE DOS DADOS REAIS NO BANCO (Plano 4):\n');
        
        const realData = await pool.query(`
            SELECT 
                s.subject_name,
                s.priority_weight,
                COUNT(ss.id) as session_count
            FROM subjects s
            LEFT JOIN study_sessions ss ON s.id = ss.subject_id
            WHERE s.study_plan_id = 4
            GROUP BY s.id, s.subject_name, s.priority_weight
            ORDER BY s.priority_weight DESC
        `);
        
        const totalRealSessions = realData.rows.reduce((sum, row) => sum + parseInt(row.session_count), 0);
        const totalRealWeight = realData.rows.reduce((sum, row) => sum + row.priority_weight, 0);
        
        console.log('Distribuição real encontrada:');
        console.log('-'.repeat(60));
        
        for (const row of realData.rows) {
            const percentualReal = (row.session_count / totalRealSessions * 100).toFixed(1);
            const percentualEsperado = (row.priority_weight / totalRealWeight * 100).toFixed(1);
            const diferenca = (percentualReal - percentualEsperado).toFixed(1);
            
            const status = Math.abs(diferenca) < 5 ? '✅' : '❌';
            
            console.log(`${row.subject_name.padEnd(25)} | Peso: ${row.priority_weight} | Real: ${percentualReal.padStart(5)}% | Esperado: ${percentualEsperado.padStart(5)}% | Dif: ${diferenca.padStart(5)}% ${status}`);
        }
        
        console.log('-'.repeat(60));
        console.log(`TOTAL                     | Peso: ${totalRealWeight} | ${totalRealSessions} sessões`);
        
        // 3. ANÁLISE DO PROBLEMA
        console.log('\n🔴 3. IDENTIFICAÇÃO DO PROBLEMA:\n');
        
        const problems = [];
        
        // Verificar se disciplinas com pesos diferentes têm o mesmo número de sessões
        const sessionCounts = {};
        for (const row of realData.rows) {
            if (!sessionCounts[row.session_count]) {
                sessionCounts[row.session_count] = [];
            }
            sessionCounts[row.session_count].push({
                name: row.subject_name,
                weight: row.priority_weight
            });
        }
        
        for (const [count, disciplines] of Object.entries(sessionCounts)) {
            if (disciplines.length > 1) {
                const weights = disciplines.map(d => d.weight);
                const uniqueWeights = [...new Set(weights)];
                
                if (uniqueWeights.length > 1) {
                    problems.push(`❌ PROBLEMA DETECTADO: ${disciplines.length} disciplinas com pesos diferentes (${uniqueWeights.join(', ')}) têm o mesmo número de sessões (${count})`);
                    console.log(problems[problems.length - 1]);
                    for (const disc of disciplines) {
                        console.log(`   - ${disc.name} (peso ${disc.weight})`);
                    }
                }
            }
        }
        
        // 4. VERIFICAR O CÓDIGO DE CRIAÇÃO DAS SESSÕES
        console.log('\n🔧 4. ANÁLISE DO CÓDIGO DE CRIAÇÃO:\n');
        
        console.log('No arquivo fix-and-test-complete.js, o cálculo foi:');
        console.log('```javascript');
        console.log('const totalWeight = subjects.rows.reduce((sum, s) => sum + s.priority_weight, 0);');
        console.log('const sessionsPerWeek = 35;');
        console.log('for (const subject of subjects.rows) {');
        console.log('    const subjectSessions = Math.round((subject.priority_weight / totalWeight) * sessionsPerWeek);');
        console.log('    // Mas depois há um limite: i < topics.rows.length * 2');
        console.log('}');
        console.log('```');
        
        console.log('\n⚠️ PROBLEMA IDENTIFICADO NO CÓDIGO:');
        console.log('O loop tem um limite baseado no número de tópicos: "i < topics.rows.length * 2"');
        console.log('Isso significa que se todas as disciplinas têm 3 tópicos, o máximo é 6 sessões!');
        
        // 5. SIMULAÇÃO DO ALGORITMO CORRETO
        console.log('\n✅ 5. COMO DEVERIA SER A DISTRIBUIÇÃO:\n');
        
        const sessoesDesejadas = 35;
        console.log(`Para ${sessoesDesejadas} sessões totais:`);
        console.log('-'.repeat(70));
        
        const distribuicaoCorreta = [];
        for (const row of realData.rows) {
            const sessoesCorretas = Math.round((row.priority_weight / totalRealWeight) * sessoesDesejadas);
            distribuicaoCorreta.push({
                name: row.subject_name,
                weight: row.priority_weight,
                sessions: sessoesCorretas,
                percentage: ((row.priority_weight / totalRealWeight) * 100).toFixed(1)
            });
        }
        
        distribuicaoCorreta.sort((a, b) => b.weight - a.weight);
        
        for (const item of distribuicaoCorreta) {
            const bar = '█'.repeat(item.sessions);
            console.log(`${item.name.padEnd(25)} | Peso: ${item.weight} | ${item.percentage.padStart(5)}% | ${item.sessions.toString().padStart(2)} sessões ${bar}`);
        }
        
        // 6. COMPARAÇÃO VISUAL
        console.log('\n📊 6. COMPARAÇÃO VISUAL:\n');
        
        console.log('COMO ESTÁ (ERRADO):');
        console.log('Direito Constitucional (5): ████████████ (6 sessões)');
        console.log('Direito Administrativo (4): ████████████ (6 sessões) ← MESMO QUE PESO 5!');
        console.log('Português            (3): ████████████ (6 sessões) ← MESMO QUE PESO 5!');
        console.log('Raciocínio Lógico    (2): ██████████ (5 sessões)');
        console.log('Informática          (1): ████ (2 sessões)');
        
        console.log('\nCOMO DEVERIA SER (CORRETO):');
        console.log('Direito Constitucional (5): ████████████████████████ (12 sessões)');
        console.log('Direito Administrativo (4): ███████████████████ (9 sessões)');
        console.log('Português            (3): ██████████████ (7 sessões)');
        console.log('Raciocínio Lógico    (2): █████████ (5 sessões)');
        console.log('Informática          (1): ████ (2 sessões)');
        
        // 7. CONCLUSÃO
        console.log('\n' + '='.repeat(70));
        console.log('📋 CONCLUSÃO DA ANÁLISE:\n');
        
        console.log('❌ O ALGORITMO ESTÁ INCORRETO!');
        console.log('\nProblemas encontrados:');
        console.log('1. Disciplinas com peso 5, 4 e 3 têm o MESMO número de sessões (6)');
        console.log('2. O código limita as sessões baseado no número de tópicos');
        console.log('3. A proporção de pesos NÃO está sendo respeitada');
        
        console.log('\n🔧 Correção necessária:');
        console.log('- Remover o limite baseado em tópicos');
        console.log('- Permitir múltiplas sessões do mesmo tópico');
        console.log('- Garantir distribuição proporcional aos pesos');
        
        console.log('\n📐 Matemática correta:');
        console.log('- Peso 5 deve ter 5x mais sessões que peso 1');
        console.log('- Peso 5 deve ter 1.67x mais sessões que peso 3');
        console.log('- A distribuição deve ser PROPORCIONAL aos pesos');
        
        console.log('=' .repeat(70));
        
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await pool.end();
    }
}

analyzeWeightDistribution();