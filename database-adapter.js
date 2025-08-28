/**
 * Database Adapter - Sistema unificado para PostgreSQL e Banco em Memória
 * 
 * Este adapter permite que a aplicação funcione com ou sem PostgreSQL,
 * fornecendo uma interface consistente para ambos os casos.
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Estado do banco
let isPostgresAvailable = false;
let pool = null;

// Banco em memória como fallback
const memoryDB = {
    users: [],
    study_plans: [],
    subjects: [],
    topics: [],
    study_sessions: [],
    user_gamification_stats: [],
    user_achievements: [],
    sessions: [],
    nextId: {
        users: 1,
        study_plans: 1,
        subjects: 1,
        topics: 1,
        study_sessions: 1,
        user_gamification_stats: 1,
        user_achievements: 1
    }
};

// Inicializar banco em memória com usuário de teste
async function initMemoryDB() {
    const hash = await bcrypt.hash('123456', 12);
    memoryDB.users.push({
        id: memoryDB.nextId.users++,
        email: 'c@c.com',
        password_hash: hash,
        name: 'Usuário C',
        created_at: new Date(),
        email_verified: true
    });
    console.log('✅ Banco em memória inicializado com usuário c@c.com');
}

// FORÇAR conexão com PostgreSQL (sem fallback para memória)
async function tryPostgresConnection() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d',
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000 // Aumentado para dar mais tempo
    };
    
    try {
        pool = new Pool(config);
        
        // Testar conexão
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        isPostgresAvailable = true;
        console.log('✅ [DATABASE-ADAPTER] PostgreSQL conectado com sucesso');
        console.log(`   Host: ${config.host}:${config.port}`);
        console.log(`   Database: ${config.database}`);
        return true;
    } catch (error) {
        console.error('❌ [DATABASE-ADAPTER] ERRO: PostgreSQL é obrigatório!');
        console.error('   Erro:', error.message);
        console.log('\n⚠️  CONFIGURAÇÃO NECESSÁRIA:');
        console.log('   1. Certifique-se que o PostgreSQL está rodando');
        console.log('   2. Execute: node test-postgres-connection.js');
        console.log('   3. Se necessário, execute: node setup-postgres-local.js');
        
        // NÃO inicializar banco em memória - forçar uso de PostgreSQL
        isPostgresAvailable = false;
        pool = null;
        
        // Tentar novamente em 5 segundos
        console.log('\n🔄 Tentando reconectar em 5 segundos...');
        setTimeout(() => tryPostgresConnection(), 5000);
        
        return false;
    }
}

// Simulação de queries para banco em memória
function executeMemoryQuery(sql, params = []) {
    const sqlLower = sql.toLowerCase();
    
    // SELECT queries
    if (sqlLower.includes('select')) {
        // Users
        if (sqlLower.includes('from users')) {
            if (sqlLower.includes('where email')) {
                const email = params[0];
                const user = memoryDB.users.find(u => u.email === email);
                return user ? [user] : [];
            }
            if (sqlLower.includes('where id')) {
                const id = params[0];
                const user = memoryDB.users.find(u => u.id === parseInt(id));
                return user ? [user] : [];
            }
            return memoryDB.users;
        }
        
        // Study Plans
        if (sqlLower.includes('from study_plans')) {
            if (sqlLower.includes('where user_id')) {
                const userId = params[0];
                return memoryDB.study_plans.filter(p => p.user_id === parseInt(userId));
            }
            if (sqlLower.includes('where id')) {
                const id = params[0];
                const plan = memoryDB.study_plans.find(p => p.id === parseInt(id));
                return plan ? [plan] : [];
            }
            return memoryDB.study_plans;
        }
        
        // Subjects
        if (sqlLower.includes('from subjects')) {
            if (sqlLower.includes('where study_plan_id')) {
                const planId = params[0];
                return memoryDB.subjects.filter(s => s.study_plan_id === parseInt(planId));
            }
            if (sqlLower.includes('where id')) {
                const id = params[0];
                const subject = memoryDB.subjects.find(s => s.id === parseInt(id));
                return subject ? [subject] : [];
            }
            return memoryDB.subjects;
        }
        
        // Topics
        if (sqlLower.includes('from topics')) {
            if (sqlLower.includes('where subject_id')) {
                const subjectId = params[0];
                return memoryDB.topics.filter(t => t.subject_id === parseInt(subjectId));
            }
            return memoryDB.topics;
        }
        
        // Study Sessions
        if (sqlLower.includes('from study_sessions')) {
            if (sqlLower.includes('where study_plan_id')) {
                const planId = params[0];
                return memoryDB.study_sessions.filter(s => s.study_plan_id === parseInt(planId));
            }
            if (sqlLower.includes('where id')) {
                const id = params[0];
                const session = memoryDB.study_sessions.find(s => s.id === parseInt(id));
                return session ? [session] : [];
            }
            return memoryDB.study_sessions;
        }
        
        // Gamification Stats
        if (sqlLower.includes('from user_gamification_stats')) {
            if (sqlLower.includes('where user_id')) {
                const userId = params[0];
                const stats = memoryDB.user_gamification_stats.find(s => s.user_id === parseInt(userId));
                return stats ? [stats] : [];
            }
            return memoryDB.user_gamification_stats;
        }
        
        // Achievements
        if (sqlLower.includes('from user_achievements')) {
            if (sqlLower.includes('where user_id')) {
                const userId = params[0];
                return memoryDB.user_achievements.filter(a => a.user_id === parseInt(userId));
            }
            return memoryDB.user_achievements;
        }
    }
    
    // INSERT queries
    if (sqlLower.includes('insert into')) {
        if (sqlLower.includes('users')) {
            // Detectar se é INSERT RETURNING id (PostgreSQL) ou INSERT simples
            const isReturning = sqlLower.includes('returning');
            
            const newUser = {
                id: memoryDB.nextId.users++,
                email: params[0],
                password_hash: params[1],
                name: params[2],
                created_at: new Date(),
                email_verified: false
            };
            memoryDB.users.push(newUser);
            
            // Se tem RETURNING, retornar o usuário com id
            if (isReturning) {
                return [{ id: newUser.id }];
            }
            // Senão, simular resposta de INSERT normal
            return [newUser];
        }
        
        if (sqlLower.includes('study_plans')) {
            const newPlan = {
                id: memoryDB.nextId.study_plans++,
                user_id: parseInt(params[0]),
                plan_name: params[1],
                exam_date: params[2],
                created_at: new Date(),
                is_active: true,
                study_days_per_week: 6,
                hours_per_day: 4.0
            };
            memoryDB.study_plans.push(newPlan);
            return [newPlan];
        }
        
        if (sqlLower.includes('subjects')) {
            const newSubject = {
                id: memoryDB.nextId.subjects++,
                study_plan_id: parseInt(params[0]),
                name: params[1],
                weight: parseInt(params[2]) || 5,
                created_at: new Date()
            };
            memoryDB.subjects.push(newSubject);
            return [newSubject];
        }
        
        if (sqlLower.includes('topics')) {
            const newTopic = {
                id: memoryDB.nextId.topics++,
                subject_id: parseInt(params[0]),
                topic_description: params[1],
                weight: parseInt(params[2]) || 5,
                created_at: new Date()
            };
            memoryDB.topics.push(newTopic);
            return [newTopic];
        }
        
        if (sqlLower.includes('study_sessions')) {
            const newSession = {
                id: memoryDB.nextId.study_sessions++,
                study_plan_id: parseInt(params[0]),
                topic_id: parseInt(params[1]) || null,
                subject_name: params[2],
                topic_description: params[3],
                session_date: params[4],
                session_type: params[5],
                status: 'Pendente',
                time_studied_seconds: 0,
                created_at: new Date()
            };
            memoryDB.study_sessions.push(newSession);
            return [newSession];
        }
        
        if (sqlLower.includes('user_gamification_stats')) {
            const newStats = {
                id: memoryDB.nextId.user_gamification_stats++,
                user_id: parseInt(params[0]),
                xp: 0,
                level: 1,
                current_streak: 0,
                longest_streak: 0,
                created_at: new Date()
            };
            memoryDB.user_gamification_stats.push(newStats);
            return [newStats];
        }
        
        if (sqlLower.includes('user_achievements')) {
            const newAchievement = {
                id: memoryDB.nextId.user_achievements++,
                user_id: parseInt(params[0]),
                achievement_id: params[1],
                unlocked_at: new Date()
            };
            memoryDB.user_achievements.push(newAchievement);
            return [newAchievement];
        }
    }
    
    // UPDATE queries
    if (sqlLower.includes('update')) {
        if (sqlLower.includes('study_sessions')) {
            const sessionId = params[params.length - 1];
            const session = memoryDB.study_sessions.find(s => s.id === parseInt(sessionId));
            if (session) {
                if (sqlLower.includes('set status')) {
                    session.status = params[0];
                    session.notes = params[1];
                    session.questions_solved = parseInt(params[2]);
                    session.updated_at = new Date();
                }
                return [session];
            }
        }
        
        if (sqlLower.includes('user_gamification_stats')) {
            const userId = params[params.length - 1];
            const stats = memoryDB.user_gamification_stats.find(s => s.user_id === parseInt(userId));
            if (stats) {
                stats.xp += parseInt(params[0]) || 0;
                stats.level = parseInt(params[1]) || stats.level;
                stats.current_streak = parseInt(params[2]) || stats.current_streak;
                stats.longest_streak = parseInt(params[3]) || stats.longest_streak;
                stats.updated_at = new Date();
                return [stats];
            }
        }
    }
    
    // DELETE queries
    if (sqlLower.includes('delete')) {
        if (sqlLower.includes('from study_sessions')) {
            const id = params[0];
            const index = memoryDB.study_sessions.findIndex(s => s.id === parseInt(id));
            if (index !== -1) {
                const deleted = memoryDB.study_sessions.splice(index, 1);
                return deleted;
            }
        }
    }
    
    // COUNT queries
    if (sqlLower.includes('count(')) {
        if (sqlLower.includes('from study_sessions')) {
            const planId = params[0];
            const sessions = memoryDB.study_sessions.filter(s => 
                s.study_plan_id === parseInt(planId) && s.status === 'Concluído'
            );
            return [{ count: sessions.length }];
        }
    }
    
    return [];
}

// Funções principais exportadas - FORÇANDO PostgreSQL
async function dbGet(sql, params = []) {
    if (!pool) {
        throw new Error('PostgreSQL não está conectado. Execute: node test-postgres-connection.js');
    }
    
    try {
        const result = await pool.query(sql, params);
        return result.rows[0] || null;
    } catch (error) {
        console.error('[DB_ADAPTER] Erro em dbGet:', error.message);
        console.error('[DB_ADAPTER] SQL:', sql);
        console.error('[DB_ADAPTER] Params:', params);
        throw error;
    }
}

async function dbAll(sql, params = []) {
    if (!pool) {
        throw new Error('PostgreSQL não está conectado. Execute: node test-postgres-connection.js');
    }
    
    try {
        const result = await pool.query(sql, params);
        return result.rows;
    } catch (error) {
        console.error('[DB_ADAPTER] Erro em dbAll:', error.message);
        console.error('[DB_ADAPTER] SQL:', sql);
        console.error('[DB_ADAPTER] Params:', params);
        throw error;
    }
}

async function dbRun(sql, params = []) {
    if (!pool) {
        throw new Error('PostgreSQL não está conectado. Execute: node test-postgres-connection.js');
    }
    
    try {
        const result = await pool.query(sql, params);
        return result;
    } catch (error) {
        console.error('[DB_ADAPTER] Erro em dbRun:', error.message);
        console.error('[DB_ADAPTER] SQL:', sql);
        console.error('[DB_ADAPTER] Params:', params);
        throw error;
    }
}

// Inicializar conexão
tryPostgresConnection();

module.exports = {
    dbGet,
    dbAll,
    dbRun,
    isPostgresAvailable: () => isPostgresAvailable,
    getMemoryDB: () => memoryDB, // Para debug
    
    // Compatibilidade com código legado
    get: dbGet,
    all: dbAll,
    run: dbRun,
    query: async (sql, params) => {
        if (!pool) {
            throw new Error('PostgreSQL não está conectado. Execute: node test-postgres-connection.js');
        }
        return await pool.query(sql, params);
    }
};