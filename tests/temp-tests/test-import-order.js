/**
 * Verificar ordem de importação e criação de pools
 */

console.log('🔍 INICIANDO ANÁLISE DE IMPORTAÇÃO\n');

// Simular o que acontece no servidor
console.log('1. Importando database-postgresql.js...');
const db1 = require('./database-postgresql.js');

console.log('\n2. Verificando métodos disponíveis:');
console.log('   - db1.get:', typeof db1.get);
console.log('   - db1.run:', typeof db1.run);
console.log('   - db1.all:', typeof db1.all);
console.log('   - db1.pool:', typeof db1.pool);

console.log('\n3. Testando search_path atual:');
db1.get('SHOW search_path').then(result => {
    console.log('   Search path via db1:', result.search_path);
});

console.log('\n4. Importando database-simple-postgres.js...');
const db2 = require('./database-simple-postgres.js');

console.log('\n5. Comparando instâncias:');
console.log('   db1 === db2:', db1 === db2);
console.log('   db1.pool === db2.pool:', db1.pool === db2.pool);

console.log('\n6. Testando search_path via db2:');
db2.get('SHOW search_path').then(result => {
    console.log('   Search path via db2:', result.search_path);
});

// Aguardar um pouco e encerrar
setTimeout(() => {
    console.log('\n7. Encerrando pools...');
    if (db1.close) db1.close();
    if (db2.close && db2 !== db1) db2.close();
    process.exit(0);
}, 2000);