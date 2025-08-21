/**
 * LIMPEZA COMPLETA DO SQLITE
 * Remove todos os vestígios do SQLite do sistema
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 LIMPEZA COMPLETA DO SQLITE');
console.log('=' .repeat(50));

const filesToRemove = [
    './db.sqlite',
    './db.sqlite-wal',
    './db.sqlite-shm',
    './sessions.db',
    './sessions.db-wal',
    './sessions.db-shm',
    './editaliza.db',
    './editaliza.db-wal',
    './editaliza.db-shm'
];

const directoriesToCheck = [
    './backups',
    './src/database',
    './database'
];

let removedCount = 0;

// Remover arquivos SQLite
console.log('\n1️⃣ Removendo arquivos SQLite...');
for (const file of filesToRemove) {
    try {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`   ✅ Removido: ${file}`);
            removedCount++;
        }
    } catch (error) {
        console.log(`   ⚠️  Erro ao remover ${file}: ${error.message}`);
    }
}

// Verificar diretórios de backup
console.log('\n2️⃣ Verificando diretórios de backup...');
for (const dir of directoriesToCheck) {
    try {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            const sqliteFiles = files.filter(file => 
                file.includes('.sqlite') || 
                file.includes('.db') ||
                file.includes('backup') && file.includes('sqlite')
            );
            
            if (sqliteFiles.length > 0) {
                console.log(`   📁 ${dir} contém ${sqliteFiles.length} arquivo(s) SQLite:`);
                sqliteFiles.forEach(file => {
                    console.log(`      - ${file}`);
                    try {
                        fs.unlinkSync(path.join(dir, file));
                        console.log(`      ✅ Removido: ${file}`);
                        removedCount++;
                    } catch (error) {
                        console.log(`      ⚠️  Erro: ${error.message}`);
                    }
                });
            } else {
                console.log(`   ✅ ${dir} - Nenhum arquivo SQLite encontrado`);
            }
        }
    } catch (error) {
        console.log(`   ⚠️  Erro ao verificar ${dir}: ${error.message}`);
    }
}

// Verificar node_modules sqlite
console.log('\n3️⃣ Verificando dependências SQLite...');
const nodeModulesPaths = [
    './node_modules/better-sqlite3',
    './node_modules/sqlite3',
    './node_modules/connect-sqlite3'
];

for (const modPath of nodeModulesPaths) {
    if (fs.existsSync(modPath)) {
        console.log(`   ⚠️  Dependência encontrada: ${modPath}`);
        console.log(`      Execute: npm uninstall ${path.basename(modPath)}`);
    } else {
        console.log(`   ✅ ${path.basename(modPath)} - Não instalado`);
    }
}

// Verificar package.json
console.log('\n4️⃣ Verificando package.json...');
try {
    const packagePath = './package.json';
    if (fs.existsSync(packagePath)) {
        const packageContent = fs.readFileSync(packagePath, 'utf8');
        const sqliteRefs = [
            'better-sqlite3',
            'sqlite3',
            'connect-sqlite3'
        ];
        
        const foundRefs = [];
        for (const ref of sqliteRefs) {
            if (packageContent.includes(ref)) {
                foundRefs.push(ref);
            }
        }
        
        if (foundRefs.length > 0) {
            console.log(`   ⚠️  Referências SQLite encontradas: ${foundRefs.join(', ')}`);
            console.log(`      Execute: npm uninstall ${foundRefs.join(' ')}`);
        } else {
            console.log(`   ✅ Nenhuma referência SQLite no package.json`);
        }
    }
} catch (error) {
    console.log(`   ⚠️  Erro ao verificar package.json: ${error.message}`);
}

// Resumo
console.log('\n' + '=' .repeat(50));
console.log(`✅ LIMPEZA CONCLUÍDA`);
console.log(`📊 Arquivos removidos: ${removedCount}`);
console.log(`\n🎯 Próximos passos:`);
console.log(`1. Remover dependências SQLite:`);
console.log(`   npm uninstall better-sqlite3 sqlite3 connect-sqlite3`);
console.log(`\n2. Testar conexão PostgreSQL:`);
console.log(`   npm run db:test-connection`);
console.log(`\n3. Iniciar servidor:`);
console.log(`   npm start`);
console.log(`\n4. Verificar logs:`);
console.log(`   Deve mostrar apenas "PostgreSQL" sem fallbacks`);

console.log(`\n🚀 Sistema agora usa APENAS PostgreSQL!`);