// Script para criar primeiro usuário admin
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Função para verificar estrutura da tabela
const checkTableStructure = () => {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(users)", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Função para verificar se já existe admin
const checkExistingAdmin = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE role = 'admin' LIMIT 1", (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Função para criar usuário admin
const createAdminUser = async () => {
    try {
        console.log('🔍 Verificando estrutura da tabela users...');
        const tableStructure = await checkTableStructure();
        console.log('📋 Estrutura atual da tabela:', tableStructure.map(col => `${col.name} (${col.type})`).join(', '));

        console.log('\n🔍 Verificando se já existe usuário admin...');
        const existingAdmin = await checkExistingAdmin();
        
        if (existingAdmin) {
            console.log('✅ Usuário admin já existe:');
            console.log(`   ID: ${existingAdmin.id}`);
            console.log(`   Email: ${existingAdmin.email}`);
            console.log(`   Role: ${existingAdmin.role}`);
            console.log(`   Provedor: ${existingAdmin.auth_provider || 'local'}`);
            return;
        }

        console.log('\n🔐 Criando primeiro usuário admin...');
        
        // Dados do admin
        const adminData = {
            email: 'admin@editaliza.com',
            password: 'admin123456', // Senha temporária - DEVE SER ALTERADA
            name: 'Administrador do Sistema',
            role: 'admin'
        };

        // Hash da senha
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(adminData.password, saltRounds);

        // Primeiro, adicionar coluna role se não existir
        const addRoleColumn = () => {
            return new Promise((resolve) => {
                db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", (err) => {
                    // Ignorar erro se coluna já existir
                    console.log(err ? `⚠️ Coluna role: ${err.message}` : '✅ Coluna role adicionada');
                    resolve();
                });
            });
        };

        await addRoleColumn();

        // Inserir admin no banco
        const insertAdmin = () => {
            return new Promise((resolve, reject) => {
                const sql = `INSERT INTO users (
                    email, password_hash, name, role, auth_provider, created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))`;
                
                db.run(sql, [
                    adminData.email,
                    passwordHash,
                    adminData.name,
                    adminData.role,
                    'local'
                ], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        };

        const adminId = await insertAdmin();
        
        console.log('✅ Usuário admin criado com sucesso!');
        console.log(`   ID: ${adminId}`);
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Senha temporária: ${adminData.password}`);
        console.log(`   Role: ${adminData.role}`);
        
        console.log('\n⚠️  IMPORTANTE:');
        console.log('   1. Altere a senha padrão após primeiro login');
        console.log('   2. Este usuário tem acesso total ao sistema');
        console.log('   3. Use apenas para administração inicial');

        // Verificar se foi criado corretamente
        const verification = await checkExistingAdmin();
        if (verification) {
            console.log('✅ Verificação: Admin criado e confirmado no banco');
        }

    } catch (error) {
        console.error('❌ Erro ao criar usuário admin:', error.message);
        if (error.message.includes('UNIQUE constraint failed')) {
            console.log('💡 Usuário com este email já existe. Verificando...');
            const existing = await new Promise((resolve, reject) => {
                db.get("SELECT * FROM users WHERE email = 'admin@editaliza.com'", (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            if (existing) {
                console.log(`📧 Email já cadastrado - ID: ${existing.id}, Role: ${existing.role || 'user'}`);
                if (existing.role !== 'admin') {
                    console.log('🔄 Atualizando role para admin...');
                    db.run("UPDATE users SET role = 'admin' WHERE email = 'admin@editaliza.com'", (err) => {
                        if (err) console.error('❌ Erro ao atualizar role:', err);
                        else console.log('✅ Role atualizada para admin');
                    });
                }
            }
        }
    } finally {
        db.close();
    }
};

// Executar
createAdminUser();