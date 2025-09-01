const db = require('./database-postgresql.js');

async function checkSession() {
    try {
        console.log('🔍 Verificando sessão 11910 no banco de dados...\n');
        
        // 1. Verificar se a sessão existe
        const session = await db.get(`
            SELECT ss.*, sp.user_id, sp.plan_name 
            FROM study_sessions ss
            LEFT JOIN study_plans sp ON ss.study_plan_id = sp.id
            WHERE ss.id = $1
        `, [11910]);
        
        if (session) {
            console.log('✅ Sessão encontrada:');
            console.log('ID:', session.id);
            console.log('Plan ID:', session.study_plan_id);
            console.log('User ID:', session.user_id);
            console.log('Status:', session.status);
            console.log('Subject:', session.subject_name);
            console.log('Topic:', session.topic_description);
            console.log('Session Type:', session.session_type);
            console.log('Date:', session.session_date);
        } else {
            console.log('❌ Sessão 11910 NÃO existe no banco');
            
            // Verificar se existem sessões para o usuário
            const userSessions = await db.all(`
                SELECT ss.id, ss.subject_name, ss.status, sp.user_id
                FROM study_sessions ss
                JOIN study_plans sp ON ss.study_plan_id = sp.id
                WHERE sp.user_id = 141
                ORDER BY ss.id DESC
                LIMIT 10
            `);
            
            if (userSessions.length > 0) {
                console.log('\n📋 Últimas 10 sessões do usuário 141:');
                userSessions.forEach(s => {
                    console.log(`  - ID ${s.id}: ${s.subject_name} (${s.status})`);
                });
            }
        }
        
        // 2. Verificar quantas sessões existem no total
        const totalSessions = await db.get('SELECT COUNT(*) as count FROM study_sessions');
        console.log('\n📊 Total de sessões no banco:', totalSessions.count);
        
        // 3. Verificar range de IDs
        const idRange = await db.get('SELECT MIN(id) as min_id, MAX(id) as max_id FROM study_sessions');
        console.log('📏 Range de IDs: de', idRange.min_id, 'até', idRange.max_id);
        
    } catch (error) {
        console.error('❌ Erro ao verificar sessão:', error);
    } finally {
        process.exit(0);
    }
}

checkSession();