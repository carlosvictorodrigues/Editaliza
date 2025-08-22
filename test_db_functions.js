const db = require('./database.js');

// Definir as funções como no server.js
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

async function testDbFunctions() {
    try {
        console.log('🔍 Testando funções dbGet e dbAll...\n');
        
        // 1. Testar dbGet
        console.log('1. Testando dbGet...');
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [1, 4]);
        console.log('✅ dbGet funcionando:', plan ? plan.plan_name : 'Não encontrado');
        
        // 2. Testar dbAll com tópicos
        console.log('\n2. Testando dbAll com tópicos...');
        const allTopics = await dbAll(`
            SELECT t.*, s.subject_name 
            FROM topics t 
            JOIN subjects s ON t.subject_id = s.id 
            WHERE s.study_plan_id = ?
            ORDER BY t.id ASC
        `, [1]);
        console.log(`✅ dbAll funcionando: ${allTopics.length} tópicos encontrados`);
        
        // 3. Testar dbAll com sessões
        console.log('\n3. Testando dbAll com sessões...');
        const studySessions = await dbAll(`
            SELECT * FROM study_sessions 
            WHERE study_plan_id = ? 
            ORDER BY session_date ASC, id ASC
        `, [1]);
        console.log(`✅ dbAll funcionando: ${studySessions.length} sessões encontradas`);
        
        // 4. Calcular estatísticas
        console.log('\n4. Calculando estatísticas...');
        const totalTopics = allTopics.length;
        const completedTopics = allTopics.filter(t => t.status === 'Concluído').length;
        const pendingTopics = totalTopics - completedTopics;
        const currentProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
        
        console.log(`✅ Estatísticas calculadas:`);
        console.log(`  - Total: ${totalTopics}`);
        console.log(`  - Concluídos: ${completedTopics}`);
        console.log(`  - Pendentes: ${pendingTopics}`);
        console.log(`  - Progresso: ${currentProgress}%`);
        
        if (completedTopics === 2) {
            console.log('\n✅ SUCESSO! Todas as funções estão funcionando corretamente!');
        } else {
            console.log('\n❌ Dados incorretos. Esperado: 2 tópicos concluídos');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        // Fechar conexão
        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error('Erro ao fechar:', err.message);
                } else {
                    console.log('\n✅ Conexão fechada');
                }
            });
        }, 1000);
    }
}

testDbFunctions(); 