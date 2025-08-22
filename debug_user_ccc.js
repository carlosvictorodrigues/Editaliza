const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('=== ANÁLISE COMPLETA PARA USUÁRIO c@c.com ===\n');

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

async function analyzeUser() {
    try {
        const userEmail = 'c@c.com';
        
        // 1. Dados do usuário
        console.log('1. DADOS DO USUÁRIO');
        console.log('─'.repeat(40));
        const user = await runQuery('SELECT * FROM users WHERE email = ?', [userEmail]);
        if (user.length === 0) {
            console.log('❌ Usuário não encontrado!');
            return;
        }
        
        const userData = user[0];
        console.log(`ID: ${userData.id}`);
        console.log(`Nome: ${userData.name || 'N/A'}`);
        console.log(`Email: ${userData.email}`);
        console.log(`Criado em: ${userData.created_at || 'N/A'}`);
        
        // 2. Planos de estudo
        console.log('\n2. PLANOS DE ESTUDO');
        console.log('─'.repeat(40));
        const plans = await runQuery('SELECT * FROM study_plans WHERE user_id = ?', [userData.id]);
        console.log(`Total de planos: ${plans.length}`);
        
        if (plans.length === 0) {
            console.log('❌ Nenhum plano de estudo encontrado!');
            return;
        }
        
        for (const plan of plans) {
            console.log(`\n📋 Plano ID: ${plan.id}`);
            console.log(`   Nome: ${plan.plan_name || 'N/A'}`);
            console.log(`   Data do exame: ${plan.exam_date || 'N/A'}`);
            console.log(`   Horas por dia: ${plan.study_hours_per_day || 'N/A'}`);
            console.log(`   Duração da sessão: ${plan.session_duration_minutes || 'N/A'} min`);
        }
        
        const mainPlan = plans[0]; // Usar o primeiro plano
        
        // 3. Sessões de estudo
        console.log('\n3. SESSÕES DE ESTUDO');
        console.log('─'.repeat(40));
        const sessions = await runQuery(`
            SELECT * FROM study_sessions 
            WHERE study_plan_id = ? 
            ORDER BY session_date DESC
        `, [mainPlan.id]);
        
        console.log(`Total de sessões: ${sessions.length}`);
        
        if (sessions.length > 0) {
            // Estatísticas das sessões
            const completedSessions = sessions.filter(s => s.status === 'Concluída');
            const pendingSessions = sessions.filter(s => s.status === 'Pendente');
            const inProgressSessions = sessions.filter(s => s.status === 'Em Progresso');
            
            console.log(`   ✅ Concluídas: ${completedSessions.length}`);
            console.log(`   ⏳ Pendentes: ${pendingSessions.length}`);
            console.log(`   🟡 Em progresso: ${inProgressSessions.length}`);
            
            // Tempo total estudado
            const totalTimeStudied = sessions.reduce((total, s) => total + (s.time_studied_seconds || 0), 0);
            const totalHours = Math.floor(totalTimeStudied / 3600);
            const totalMinutes = Math.floor((totalTimeStudied % 3600) / 60);
            console.log(`   ⏰ Tempo total estudado: ${totalHours}h ${totalMinutes}m`);
            
            // Mostrar algumas sessões concluídas
            if (completedSessions.length > 0) {
                console.log(`\n   📚 Últimas 3 sessões concluídas:`);
                completedSessions.slice(0, 3).forEach((session, index) => {
                    console.log(`   ${index + 1}. ${session.subject_name || 'N/A'} - ${session.topic_description || 'N/A'}`);
                    console.log(`      Data: ${session.session_date || 'N/A'}`);
                    console.log(`      Tempo: ${session.time_studied_seconds ? Math.floor(session.time_studied_seconds / 60) : 0} min`);
                });
            }
        }
        
        // 4. Tópicos completados
        console.log('\n4. PROGRESSO NOS TÓPICOS');
        console.log('─'.repeat(40));
        const completedTopics = await runQuery(`
            SELECT t.*, s.subject_name 
            FROM topics t 
            JOIN subjects s ON t.subject_id = s.id 
            WHERE s.study_plan_id = ? AND t.status = 'Concluído'
            ORDER BY t.completion_date DESC
        `, [mainPlan.id]);
        
        console.log(`Total de tópicos concluídos: ${completedTopics.length}`);
        
        if (completedTopics.length > 0) {
            console.log(`\n   📖 Últimos 5 tópicos concluídos:`);
            completedTopics.slice(0, 5).forEach((topic, index) => {
                console.log(`   ${index + 1}. [${topic.subject_name}] ${topic.description}`);
                console.log(`      Concluído em: ${topic.completion_date || 'N/A'}`);
            });
        }
        
        // 5. Log de tempo de estudo
        console.log('\n5. LOGS DE TEMPO DE ESTUDO');
        console.log('─'.repeat(40));
        const timeLogs = await runQuery(`
            SELECT * FROM study_time_logs 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [userData.id]);
        
        console.log(`Total de logs: ${timeLogs.length}`);
        
        if (timeLogs.length > 0) {
            const totalLoggedTime = timeLogs.reduce((total, log) => total + (log.duration_seconds || 0), 0);
            const loggedHours = Math.floor(totalLoggedTime / 3600);
            const loggedMinutes = Math.floor((totalLoggedTime % 3600) / 60);
            console.log(`   ⏰ Tempo total registrado: ${loggedHours}h ${loggedMinutes}m`);
            
            console.log(`\n   📝 Últimos 3 logs:`);
            timeLogs.slice(0, 3).forEach((log, index) => {
                console.log(`   ${index + 1}. Sessão ${log.session_id}: ${Math.floor(log.duration_seconds / 60)} min`);
                console.log(`      Data: ${log.created_at}`);
            });
        }
        
        // 6. Análise para gamificação
        console.log('\n6. DADOS PARA GAMIFICAÇÃO');
        console.log('─'.repeat(40));
        
        // Calcular XP baseado nas sessões concluídas
        const completedSessions = sessions.filter(s => s.status === 'Concluída');
        const totalXP = completedSessions.length * 10 + Math.floor(completedSessions.reduce((total, s) => total + (s.time_studied_seconds || 0), 0) / 60 * 0.5);
        
        console.log(`XP estimado: ${totalXP}`);
        console.log(`Sessões concluídas: ${completedSessions.length}`);
        console.log(`Tópicos concluídos: ${completedTopics.length}`);
        
        // Verificar se há datas inválidas que possam causar o erro
        console.log('\n7. VERIFICAÇÃO DE DATAS INVÁLIDAS');
        console.log('─'.repeat(40));
        
        const invalidDateSessions = completedSessions.filter(s => {
            if (s.session_date) {
                const date = new Date(s.session_date);
                return isNaN(date.getTime());
            }
            return true; // Sem data também é problema
        });
        
        const invalidCompletionTopics = completedTopics.filter(t => {
            if (t.completion_date) {
                const date = new Date(t.completion_date);
                return isNaN(date.getTime());
            }
            return true;
        });
        
        console.log(`Sessões com datas inválidas: ${invalidDateSessions.length}`);
        console.log(`Tópicos com datas de conclusão inválidas: ${invalidCompletionTopics.length}`);
        
        if (invalidDateSessions.length > 0) {
            console.log('\n   ❌ Sessões com datas problemáticas:');
            invalidDateSessions.slice(0, 3).forEach((session, index) => {
                console.log(`   ${index + 1}. ID ${session.id}: "${session.session_date}"`);
            });
        }
        
        if (invalidCompletionTopics.length > 0) {
            console.log('\n   ❌ Tópicos com datas problemáticas:');
            invalidCompletionTopics.slice(0, 3).forEach((topic, index) => {
                console.log(`   ${index + 1}. ID ${topic.id}: "${topic.completion_date}"`);
            });
        }
        
    } catch (error) {
        console.error('❌ Erro durante a análise:', error);
    } finally {
        db.close();
        console.log('\n=== ANÁLISE CONCLUÍDA ===');
    }
}

analyzeUser();