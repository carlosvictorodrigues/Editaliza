// Debug definitivo do problema dos planos
require('dotenv').config();
const db = require('./database-simple-postgres');

async function testPlansFinal() {
    console.log('\n🔍 TESTE DEFINITIVO DOS PLANOS\n');
    
    try {
        // 1. Testar conexão
        console.log('1️⃣ Testando conexão com banco...');
        const testConn = await new Promise((resolve, reject) => {
            db.all('SELECT 1 as test', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log('✅ Conexão OK:', testConn);
        
        // 2. Verificar estrutura da tabela plans
        console.log('\n2️⃣ Verificando estrutura da tabela plans...');
        const tableInfo = await new Promise((resolve, reject) => {
            db.all(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'plans'
                AND table_schema = 'app'
                ORDER BY ordinal_position
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        if (tableInfo.length === 0) {
            console.log('⚠️ Tabela plans não encontrada no schema app!');
            // Verificar em outros schemas
            const allTables = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT table_schema, table_name 
                    FROM information_schema.tables 
                    WHERE table_name = 'plans'
                `, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            console.log('Tabela plans encontrada em:', allTables);
        } else {
            console.log('Colunas da tabela plans:');
            tableInfo.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
            });
        }
        
        // 3. Testar query direta
        console.log('\n3️⃣ Testando query direta de planos...');
        const userId = 1; // usuário de teste
        
        // Query simples primeiro - sem especificar schema
        try {
            const simpleQuery = await new Promise((resolve, reject) => {
                db.all('SELECT COUNT(*) as total FROM plans', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            console.log(`Total de planos no banco: ${simpleQuery[0].total}`);
        } catch (error) {
            console.error('Erro ao contar planos:', error.message);
            
            // Tentar com schema explícito
            console.log('Tentando com schema explícito...');
            const simpleQuery2 = await new Promise((resolve, reject) => {
                db.all('SELECT COUNT(*) as total FROM app.plans', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            console.log(`Total de planos em app.plans: ${simpleQuery2[0].total}`);
        }
        
        // Query com WHERE user_id
        console.log(`\n4️⃣ Buscando planos do usuário ${userId}...`);
        try {
            const userPlans = await new Promise((resolve, reject) => {
                db.all('SELECT * FROM plans WHERE user_id = ?', [userId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            console.log(`Planos encontrados: ${userPlans.length}`);
            if (userPlans.length > 0) {
                console.log('Primeiro plano:', userPlans[0]);
            }
        } catch (error) {
            console.error('Erro ao buscar planos do usuário:', error.message);
        }
        
        // 5. Verificar problema específico com timeout
        console.log('\n5️⃣ Testando problema de timeout...');
        
        // Criar promise com timeout
        const queryWithTimeout = (query, params, timeout = 5000) => {
            return Promise.race([
                new Promise((resolve, reject) => {
                    db.all(query, params, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Query timeout')), timeout)
                )
            ]);
        };
        
        try {
            console.log('Executando query com timeout de 5 segundos...');
            const result = await queryWithTimeout('SELECT * FROM plans WHERE user_id = ?', [userId]);
            console.log('✅ Query executada com sucesso:', result.length, 'resultados');
        } catch (error) {
            console.error('❌ Query com timeout falhou:', error.message);
        }
        
    } catch (error) {
        console.error('❌ ERRO GERAL:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        console.log('\n✅ Teste concluído');
        process.exit(0);
    }
}

// Executar teste
testPlansFinal();