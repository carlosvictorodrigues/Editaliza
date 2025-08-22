const bcrypt = require('bcryptjs');
const db = require('./database.js');

db.get('SELECT password_hash FROM users WHERE email = ?', ['c@c.com'], async (err, row) => {
    if (err) {
        console.error('Erro ao buscar usuário:', err);
        process.exit(1);
    }
    
    if (!row) {
        console.log('Usuário não encontrado');
        process.exit(1);
    }
    
    console.log('Hash encontrado:', row.password_hash);
    
    try {
        const match = await bcrypt.compare('123456', row.password_hash);
        console.log('Senha correta:', match);
        
        if (!match) {
            // Vamos tentar criar um novo hash para comparação
            const newHash = await bcrypt.hash('123456', 10);
            console.log('Novo hash para senha 123456:', newHash);
        }
    } catch (error) {
        console.error('Erro ao comparar senha:', error);
    }
    
    process.exit(0);
});
