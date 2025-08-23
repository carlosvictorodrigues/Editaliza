// Script simples para adicionar coluna role
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.info('🔧 Adicionando coluna role à tabela users...');

db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT \'user\'', function(err) {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.info('✅ Coluna role já existe');
        } else {
            console.error('❌ Erro ao adicionar coluna:', err.message);
        }
    } else {
        console.info('✅ Coluna role adicionada com sucesso');
    }
    
    // Verificar estrutura atualizada
    db.all('PRAGMA table_info(users)', (err, rows) => {
        if (!err) {
            const hasRole = rows.find(col => col.name === 'role');
            console.info(hasRole ? '✅ Coluna role confirmada na tabela' : '❌ Coluna role não encontrada');
        }
        db.close();
    });
});