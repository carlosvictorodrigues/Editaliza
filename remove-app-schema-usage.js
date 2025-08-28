// Script para remover todas as referências ao schema app e usar apenas public
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function removeAppSchemaUsage() {
    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d'
    });
    
    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL\n');
        
        // 1. Resetar search_path para usar APENAS public
        console.log('1️⃣ Resetando search_path para usar APENAS public...');
        
        // Para o usuário
        await client.query(`ALTER USER editaliza_user SET search_path = public`);
        console.log('✅ Search_path do usuário configurado para: public');
        
        // Para o database
        await client.query(`ALTER DATABASE editaliza_db SET search_path = public`);
        console.log('✅ Search_path do database configurado para: public\n');
        
        // 2. Verificar e mover tabelas restantes do schema app
        console.log('2️⃣ Verificando tabelas restantes no schema app...');
        
        const appTables = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'app'
            ORDER BY tablename
        `);
        
        if (appTables.rows.length > 0) {
            console.log(`   Encontradas ${appTables.rows.length} tabelas em app:\n`);
            
            for (const row of appTables.rows) {
                const tableName = row.tablename;
                console.log(`   Processando: ${tableName}`);
                
                // Verificar se existe em public
                const existsInPublic = await client.query(`
                    SELECT 1 FROM pg_tables 
                    WHERE schemaname = 'public' 
                    AND tablename = $1
                `, [tableName]);
                
                if (existsInPublic.rows.length > 0) {
                    // Se existe em ambos, precisamos decidir qual manter
                    const appData = await client.query(`SELECT COUNT(*) as count FROM app."${tableName}"`);
                    const publicData = await client.query(`SELECT COUNT(*) as count FROM public."${tableName}"`);
                    
                    console.log(`      - app.${tableName}: ${appData.rows[0].count} registros`);
                    console.log(`      - public.${tableName}: ${publicData.rows[0].count} registros`);
                    
                    // Remover a tabela vazia ou com menos dados
                    if (appData.rows[0].count === 0 || publicData.rows[0].count >= appData.rows[0].count) {
                        await client.query(`DROP TABLE app."${tableName}" CASCADE`);
                        console.log(`      ✅ Removida app.${tableName} (mantida public.${tableName})`);
                    } else {
                        // app tem mais dados, mover para public
                        await client.query(`DROP TABLE public."${tableName}" CASCADE`);
                        await client.query(`ALTER TABLE app."${tableName}" SET SCHEMA public`);
                        console.log(`      ✅ Movida app.${tableName} para public (substituindo versão antiga)`);
                    }
                } else {
                    // Não existe em public, simplesmente mover
                    await client.query(`ALTER TABLE app."${tableName}" SET SCHEMA public`);
                    console.log(`      ✅ Movida para public`);
                }
            }
        } else {
            console.log('   ✅ Schema app está vazio\n');
        }
        
        // 3. Remover schema app se estiver vazio
        console.log('3️⃣ Removendo schema app...');
        
        const checkEmpty = await client.query(`
            SELECT COUNT(*) as count FROM pg_tables 
            WHERE schemaname = 'app'
        `);
        
        if (checkEmpty.rows[0].count === 0) {
            await client.query(`DROP SCHEMA IF EXISTS app CASCADE`);
            console.log('✅ Schema app removido\n');
        } else {
            console.log(`⚠️  Schema app ainda tem ${checkEmpty.rows[0].count} tabelas\n`);
        }
        
        // 4. Verificar resultado final
        console.log('4️⃣ RESULTADO FINAL:');
        console.log('=' . repeat(60));
        
        // Verificar search_path atual
        const currentPath = await client.query('SHOW search_path');
        console.log(`\n🔍 Search path: ${currentPath.rows[0].search_path}`);
        
        // Listar tabelas em public
        const publicTables = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        console.log(`\n📋 Tabelas no schema PUBLIC: ${publicTables.rows.length}`);
        console.log('   Principais tabelas:');
        const mainTables = ['users', 'study_plans', 'subjects', 'topics', 'study_sessions', 
                           'user_gamification_stats', 'user_achievements', 'sessions'];
        
        for (const table of mainTables) {
            const exists = publicTables.rows.some(t => t.tablename === table);
            console.log(`   ${exists ? '✅' : '❌'} ${table}`);
        }
        
        // 5. Criar script de atualização para arquivos
        console.log('\n5️⃣ Gerando recomendações de atualização...\n');
        
        const filesToUpdate = [
            'analyze_distribution.js',
            'debug-topics-table.js',
            'fix_plan_25_schedule.js',
            'generate_schedule_plan25.js',
            'setup_plan_tjpe.js',
            'setup_plan_tjpe_completo.js',
            'test-fixes.js',
            'test-plans-final.js',
            'test-topic-creation.js'
        ];
        
        console.log('📝 Arquivos que precisam ser atualizados:');
        console.log('   (remover referências a "app." e "SET search_path TO app")\n');
        
        for (const file of filesToUpdate) {
            if (fs.existsSync(file)) {
                console.log(`   - ${file}`);
            }
        }
        
        console.log('\n✨ MIGRAÇÃO CONCLUÍDA!');
        console.log('\n⚠️  IMPORTANTE:');
        console.log('1. Reinicie o servidor para aplicar as mudanças');
        console.log('2. Atualize os arquivos listados acima se necessário');
        console.log('3. Todas as queries agora devem usar apenas o schema public');
        console.log('4. Não use mais "app." ou "SET search_path TO app" no código');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

removeAppSchemaUsage();