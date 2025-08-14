const bcrypt = require('bcryptjs');
const db = require('./database.js');

const createTestUser = async () => {
    try {
        const email = 'debug@test.com';
        const password = 'test123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Verificar se usuário já existe
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (existingUser) {
            console.log('✅ Usuário de teste já existe:', existingUser.id);
            process.exit(0);
        }
        
        // Criar usuário de teste
        const result = await new Promise((resolve, reject) => {
            db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hashedPassword], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        console.log('✅ Usuário de teste criado com ID:', result);
        console.log('📧 Email:', email);
        console.log('🔑 Senha:', password);
        
    } catch (error) {
        console.error('❌ Erro ao criar usuário de teste:', error);
    }
    
    process.exit(0);
};

createTestUser();