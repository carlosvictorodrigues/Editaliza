const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Erro:', err.message);
        return;
    }
    console.log('Conectado ao banco');
});

// Verificar usuário 3@3.com
db.get('SELECT id, email, password_hash FROM users WHERE email = ?', ['3@3.com'], (err, user) => {
    if (err) {
        console.error('Erro:', err.message);
    } else if (user) {
        console.log('Usuário encontrado:');
        console.log('  ID:', user.id);
        console.log('  Email:', user.email);
        console.log('  Password hash:', user.password_hash);
        
        // Tentar algumas senhas comuns
        const testPasswords = ['3', '333', '123', '123456', 'password', '3@3.com'];
        
        console.log('\n🔍 Testando senhas comuns...');
        testPasswords.forEach(password => {
            // Aqui você pode implementar a verificação com bcrypt se necessário
            console.log(`  - ${password}: ${password.length} caracteres`);
        });
        
    } else {
        console.log('Usuário não encontrado');
    }
    
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar:', err.message);
        } else {
            console.log('Conexão fechada');
        }
    });
}); 