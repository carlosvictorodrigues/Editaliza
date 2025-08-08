#!/usr/bin/env node

/**
 * Test Data Seeding Script for Testing Fortress
 * 
 * This script populates the database with realistic test data
 * to enable comprehensive validation of Plan endpoints
 * 
 * Usage:
 *   node scripts/seed-test-data.js
 *   npm run seed-test-data
 */

const { seedTestData, validateSeededData, cleanTestData } = require('../tests/helpers/test-data-seeder');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'seed';

const showUsage = () => {
    console.log(`
🌱 TEST DATA SEEDER PARA TESTING FORTRESS

Uso:
    node scripts/seed-test-data.js [command]

Comandos:
    seed        Criar todos os dados de teste (padrão)
    clean       Limpar apenas dados de teste
    validate    Validar dados existentes
    help        Mostrar esta ajuda

Exemplos:
    node scripts/seed-test-data.js
    node scripts/seed-test-data.js clean
    node scripts/seed-test-data.js validate
    `);
};

const main = async () => {
    console.log('🚀 TESTING FORTRESS - DATA SEEDER');
    console.log('==================================');
    
    try {
        switch (command) {
            case 'seed':
                console.log('📦 Iniciando criação de dados de teste...\n');
                const result = await seedTestData();
                
                if (result.success) {
                    console.log('\n🎯 DADOS DE TESTE PRONTOS PARA USO!');
                    console.log('\n📝 Próximos passos:');
                    console.log('   1. Execute: npm test para rodar testes');
                    console.log('   2. Teste endpoints de Plans com os dados criados');
                    console.log('   3. Use as credenciais exibidas acima para login');
                    console.log('\n⚡ Testing Fortress está ativo!');
                }
                break;
                
            case 'clean':
                console.log('🧹 Limpando dados de teste...\n');
                await cleanTestData();
                console.log('✅ Dados de teste removidos com sucesso!');
                break;
                
            case 'validate':
                console.log('🔍 Validando dados de teste...\n');
                await validateSeededData();
                console.log('✅ Validação concluída com sucesso!');
                break;
                
            case 'help':
            case '-h':
            case '--help':
                showUsage();
                break;
                
            default:
                console.error(`❌ Comando desconhecido: ${command}`);
                showUsage();
                process.exit(1);
        }
        
    } catch (error) {
        console.error('\n💥 ERRO NO SEEDING:', error.message);
        console.error('\n🔧 Possíveis soluções:');
        console.error('   1. Verifique se o banco de dados existe e está acessível');
        console.error('   2. Execute: npm start para inicializar o banco');
        console.error('   3. Verifique permissões de escrita no diretório');
        
        if (error.code === 'SQLITE_CANTOPEN') {
            console.error('   4. Erro de abertura do SQLite - verifique o arquivo db.sqlite');
        }
        
        process.exit(1);
    }
};

// Handle process signals gracefully
process.on('SIGINT', () => {
    console.log('\n⏹️ Interrompido pelo usuário');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️ Terminado');
    process.exit(0);
});

// Run the main function
if (require.main === module) {
    main();
}

module.exports = { main };