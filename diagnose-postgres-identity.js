/**
 * Diagnóstico completo de identidade do PostgreSQL
 * Baseado nas recomendações do ChatGPT
 */

const db = require('./database-postgres-direct');

async function diagnosePostgresIdentity() {
    try {
        console.log('🔍 DIAGNÓSTICO DE IDENTIDADE DO POSTGRESQL\n');
        console.log('=' .repeat(60));
        
        // 1. Identidade da instância
        console.log('\n1️⃣ IDENTIDADE DA INSTÂNCIA:');
        const identity = await db.get(`
            SELECT
                current_database()          AS db,
                current_user                AS user,
                session_user                AS session_user,
                inet_server_addr()::text    AS srv_addr,
                inet_server_port()          AS srv_port,
                current_setting('server_version') AS ver,
                current_setting('search_path')    AS search_path
        `);
        
        console.log('  Database:', identity.db);
        console.log('  User:', identity.user);
        console.log('  Session User:', identity.session_user);
        console.log('  Server:', identity.srv_addr || 'localhost', ':', identity.srv_port);
        console.log('  Version:', identity.ver);
        console.log('  Search Path:', identity.search_path);
        
        // 2. Resolução do nome da tabela
        console.log('\n2️⃣ RESOLUÇÃO DE NOMES:');
        const resolution = await db.get(`
            SELECT
                to_regclass('study_sessions')          AS resolved_default,
                to_regclass('public.study_sessions')   AS resolved_public,
                to_regclass('app.study_sessions')      AS resolved_app
        `);
        
        console.log('  study_sessions resolve para:', resolution.resolved_default);
        console.log('  public.study_sessions:', resolution.resolved_public);
        console.log('  app.study_sessions:', resolution.resolved_app);
        
        // 3. Onde está a coluna?
        console.log('\n3️⃣ LOCALIZAÇÃO DA COLUNA time_studied_seconds:');
        const columns = await db.all(`
            SELECT n.nspname AS schema, c.relname AS rel, a.attname AS col
            FROM   pg_class c
            JOIN   pg_namespace n ON n.oid = c.relnamespace
            JOIN   pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
            WHERE  c.relname = 'study_sessions'
              AND  a.attname = 'time_studied_seconds'
        `);
        
        if (columns.length > 0) {
            columns.forEach(c => {
                console.log(`  ✅ Encontrada em: ${c.schema}.${c.rel}.${c.col}`);
            });
        } else {
            console.log('  ❌ COLUNA NÃO ENCONTRADA EM NENHUM SCHEMA!');
        }
        
        // 4. Backend PID e config file
        console.log('\n4️⃣ PROCESSO E CONFIGURAÇÃO:');
        const backend = await db.get(`
            SELECT
                pg_backend_pid() as pid,
                current_setting('config_file') as config_file,
                current_setting('port') as port
        `);
        
        console.log('  PID Backend:', backend.pid);
        console.log('  Config File:', backend.config_file);
        console.log('  Port:', backend.port);
        
        // 5. Views suspeitas
        console.log('\n5️⃣ PROCURANDO VIEWS COM SINTAXE SQLITE:');
        const views = await db.all(`
            SELECT schemaname, viewname
            FROM pg_views
            WHERE viewname ILIKE '%session%' 
               OR viewname ILIKE '%stat%' 
               OR viewname ILIKE '%gamif%'
        `);
        
        if (views.length > 0) {
            console.log('  Views encontradas:');
            for (const view of views) {
                console.log(`    - ${view.schemaname}.${view.viewname}`);
                
                // Check view definition for SQLite syntax
                const viewDef = await db.get(`
                    SELECT pg_get_viewdef((quote_ident($1)||'.'||quote_ident($2))::regclass, true) AS def
                `, [view.schemaname, view.viewname]);
                
                if (viewDef && viewDef.def) {
                    const hasSQLite = viewDef.def.includes('date(') || 
                                     viewDef.def.includes('datetime(') || 
                                     viewDef.def.includes('strftime(');
                    if (hasSQLite) {
                        console.log(`      ⚠️ CONTÉM SINTAXE SQLITE!`);
                    }
                }
            }
        } else {
            console.log('  Nenhuma view suspeita encontrada');
        }
        
        // 6. Functions suspeitas
        console.log('\n6️⃣ PROCURANDO FUNCTIONS COM SINTAXE SQLITE:');
        const functions = await db.all(`
            SELECT n.nspname, p.proname
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE (p.proname ILIKE '%session%' 
                OR p.proname ILIKE '%stat%' 
                OR p.proname ILIKE '%gamif%')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        `);
        
        if (functions.length > 0) {
            console.log('  Functions encontradas:');
            functions.forEach(f => {
                console.log(`    - ${f.nspname}.${f.proname}`);
            });
        } else {
            console.log('  Nenhuma function suspeita encontrada');
        }
        
        // 7. Teste direto da query problemática
        console.log('\n7️⃣ TESTE DIRETO DA QUERY PROBLEMÁTICA:');
        try {
            const test = await db.get(`
                SELECT 
                    COALESCE(SUM(time_studied_seconds) / 3600.0, 0) as total_hours,
                    COUNT(CASE WHEN time_studied_seconds > 0 OR status = 'Concluído' THEN 1 END) as completed_sessions
                FROM study_sessions
                WHERE study_plan_id = 1
            `);
            console.log('  ✅ Query funcionou! Resultado:', test);
        } catch (error) {
            console.log('  ❌ Query falhou:', error.message);
        }
        
        // 8. Salvar resultado para comparação
        console.log('\n📋 SALVANDO RESULTADO PARA COMPARAÇÃO...');
        const fs = require('fs');
        const result = {
            timestamp: new Date().toISOString(),
            identity,
            resolution,
            columns,
            backend,
            views: views.length,
            functions: functions.length
        };
        
        fs.writeFileSync('postgres-identity-direct.json', JSON.stringify(result, null, 2));
        console.log('  Salvo em: postgres-identity-direct.json');
        
    } catch (error) {
        console.error('\n❌ ERRO NO DIAGNÓSTICO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await db.close();
    }
}

diagnosePostgresIdentity();