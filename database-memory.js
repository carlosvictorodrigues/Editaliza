// database-memory.js - Banco de dados em memória para desenvolvimento local
const bcrypt = require('bcrypt');

// Simular banco de dados em memória
const memoryDB = {
    users: [],
    study_plans: [],
    sessions: []
};

// Criar usuário de teste c@c.com
(async () => {
    const hash = await bcrypt.hash('123456', 12);
    memoryDB.users.push({
        id: 1,
        email: 'c@c.com',
        password_hash: hash,
        name: 'Usuário C',
        created_at: new Date()
    });
    console.log('✅ Usuário c@c.com criado em memória');
})();

// Funções de banco de dados
const query = async (sql, params = []) => {
    // Simular queries básicas
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('select') && sqlLower.includes('from users')) {
        if (sqlLower.includes('where email')) {
            const email = params[0];
            const user = memoryDB.users.find(u => u.email === email);
            return { rows: user ? [user] : [] };
        }
        if (sqlLower.includes('where id')) {
            const id = params[0];
            const user = memoryDB.users.find(u => u.id === id);
            return { rows: user ? [user] : [] };
        }
    }
    
    if (sqlLower.includes('select') && sqlLower.includes('from study_plans')) {
        const userId = params[0];
        const plans = memoryDB.study_plans.filter(p => p.user_id === userId);
        return { rows: plans };
    }
    
    if (sqlLower.includes('insert into users')) {
        const newUser = {
            id: memoryDB.users.length + 1,
            email: params[0],
            password_hash: params[1],
            name: params[2],
            created_at: new Date()
        };
        memoryDB.users.push(newUser);
        return { rows: [newUser] };
    }
    
    if (sqlLower.includes('insert into study_plans')) {
        const newPlan = {
            id: memoryDB.study_plans.length + 1,
            user_id: params[0],
            plan_name: params[1],
            exam_date: params[2],
            created_at: new Date()
        };
        memoryDB.study_plans.push(newPlan);
        return { rows: [newPlan] };
    }
    
    // Retorno padrão
    return { rows: [] };
};

const get = async (sql, params = []) => {
    const result = await query(sql, params);
    return result.rows[0] || null;
};

const all = async (sql, params = []) => {
    const result = await query(sql, params);
    return result.rows;
};

const run = async (sql, params = []) => {
    return await query(sql, params);
};

module.exports = {
    query,
    get,
    all,
    run,
    isConnected: () => true,
    close: async () => {},
    memoryDB // Exportar para debug
};