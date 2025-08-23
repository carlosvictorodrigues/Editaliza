const { Pool } = require('pg');
const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'editaliza_db',
    user: 'editaliza_user',
    password: '1a2b3c4d'
});

async function analyzeDistribution() {
    const client = await pool.connect();
    try {
        await client.query('SET search_path TO app, public');
        
        console.log('📊 ANÁLISE DA DISTRIBUIÇÃO DO CRONOGRAMA\n');
        console.log('='.repeat(60));
        
        // 1. Verificar pesos configurados
        console.log('\n1️⃣ PESOS CONFIGURADOS DAS MATÉRIAS:');
        const subjects = await client.query(
            'SELECT subject_name, priority_weight FROM subjects WHERE study_plan_id = 24 ORDER BY priority_weight DESC'
        );
        
        let totalWeight = 0;
        subjects.rows.forEach(s => {
            console.log('   ' + s.subject_name + ': peso ' + s.priority_weight);
            totalWeight += parseInt(s.priority_weight);
        });
        console.log('   Total dos pesos: ' + totalWeight);
        
        // 2. Contar sessões por matéria
        console.log('\n2️⃣ DISTRIBUIÇÃO REAL DAS SESSÕES:');
        const distribution = await client.query(
            'SELECT subject_name, COUNT(*) as total_sessions ' +
            'FROM study_sessions ' +
            'WHERE study_plan_id = 24 ' +
            'GROUP BY subject_name ' +
            'ORDER BY total_sessions DESC'
        );
        
        const totalSessions = 192;
        console.log('   Total de sessões: ' + totalSessions);
        console.log('');
        
        distribution.rows.forEach(d => {
            const percentage = ((d.total_sessions / totalSessions) * 100).toFixed(1);
            console.log('   ' + d.subject_name + ': ' + d.total_sessions + ' sessões (' + percentage + '%)');
        });
        
        // 3. Calcular distribuição esperada vs real
        console.log('\n3️⃣ COMPARAÇÃO: ESPERADO vs REAL');
        console.log('');
        console.log('   Matéria                    | Peso | Esperado | Real | Diferença');
        console.log('   ' + '-'.repeat(65));
        
        for (const subject of subjects.rows) {
            const weight = parseInt(subject.priority_weight);
            const expectedPercentage = (weight / totalWeight) * 100;
            const expectedSessions = Math.round((weight / totalWeight) * totalSessions);
            
            const realData = distribution.rows.find(d => d.subject_name === subject.subject_name);
            const realSessions = realData ? parseInt(realData.total_sessions) : 0;
            const realPercentage = (realSessions / totalSessions) * 100;
            
            const difference = realSessions - expectedSessions;
            const diffSymbol = difference > 0 ? '+' : '';
            
            console.log(
                '   ' + subject.subject_name.padEnd(25) + 
                ' |  ' + weight + '   | ' + 
                expectedSessions.toString().padStart(3) + ' (' + expectedPercentage.toFixed(0) + '%) | ' +
                realSessions.toString().padStart(3) + ' (' + realPercentage.toFixed(0) + '%) | ' +
                diffSymbol + difference
            );
        }
        
        // 5. Análise de conformidade
        console.log('\n5️⃣ ANÁLISE DE CONFORMIDADE:');
        console.log('');
        
        let isCompliant = true;
        let problemAreas = [];
        
        for (const subject of subjects.rows) {
            const weight = parseInt(subject.priority_weight);
            const expectedSessions = Math.round((weight / totalWeight) * totalSessions);
            const realData = distribution.rows.find(d => d.subject_name === subject.subject_name);
            const realSessions = realData ? parseInt(realData.total_sessions) : 0;
            const deviation = Math.abs(realSessions - expectedSessions);
            const deviationPercentage = (deviation / expectedSessions) * 100;
            
            if (deviationPercentage > 10) {
                problemAreas.push({
                    subject: subject.subject_name,
                    deviation: deviationPercentage.toFixed(0),
                    expected: expectedSessions,
                    real: realSessions
                });
                isCompliant = false;
            }
        }
        
        if (isCompliant) {
            console.log('   ✅ Distribuição está adequada aos pesos configurados!');
        } else {
            console.log('   ❌ A distribuição NÃO está seguindo adequadamente os pesos:');
            problemAreas.forEach(p => {
                console.log(`      ⚠️ ${p.subject}: esperado ${p.expected}, obtido ${p.real} (desvio de ${p.deviation}%)`);
            });
            console.log('\n   💡 O cronograma parece estar distribuindo igualmente entre as matérias,');
            console.log('      ignorando os pesos configurados.');
        }
        
    } finally {
        client.release();
        pool.end();
    }
}

analyzeDistribution();