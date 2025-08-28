/**
 * VERIFICAR ROTAS REGISTRADAS
 * Script para testar se todas as rotas foram carregadas corretamente
 */

const express = require('express');

// Função para listar todas as rotas registradas
function printRoutes(app) {
    const routes = [];
    
    function print(path, layer) {
        if (layer.route) {
            layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))));
        } else if (layer.name === 'router' && layer.handle.stack) {
            layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))));
        } else if (layer.name === 'bound dispatch') {
            routes.push({
                method: layer.route ? Object.keys(layer.route.methods)[0] : 'all',
                path: path.concat(split(layer.regexp)).filter(Boolean).join('')
            });
        }
    }

    function split(thing) {
        if (typeof thing === 'string') {
            return thing.split('/');
        } else if (thing.fast_slash) {
            return '';
        } else {
            const match = thing.toString()
                .replace('\\/?', '')
                .replace('(?=\\/|$)', '$')
                .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//);
            return match
                ? match[1].replace(/\\(.)/g, '$1').split('/')
                : '<complex:' + thing.toString() + '>';
        }
    }

    app._router.stack.forEach(print.bind(null, []));
    return routes;
}

async function checkServerRoutes() {
    console.log('🔍 VERIFICANDO CONFIGURAÇÃO DE ROTAS\n');
    
    try {
        // Testar importação das rotas
        console.log('=== TESTANDO IMPORTS ===');
        
        const gamificationRoutes = require('./src/routes/gamification.routes.js');
        console.log('✅ gamification.routes.js importado');
        
        const { configureRoutes } = require('./src/routes/index.js');
        console.log('✅ configureRoutes importado');
        
        // Criar app de teste
        const testApp = express();
        
        // Configurar rotas
        configureRoutes(testApp);
        console.log('✅ Rotas configuradas');
        
        // Listar rotas registradas
        console.log('\n=== ROTAS REGISTRADAS ===');
        const routes = printRoutes(testApp);
        
        const apiRoutes = routes.filter(route => route.path && route.path.startsWith('/api'));
        
        console.log('Rotas de API encontradas:');
        apiRoutes.forEach(route => {
            console.log(`  ${route.method.toUpperCase()} ${route.path}`);
        });
        
        // Verificar rotas específicas
        console.log('\n=== VERIFICAÇÃO DE ROTAS ESPECÍFICAS ===');
        const targetRoutes = [
            '/api/stats/user',
            '/api/progress',
            '/api/achievements', 
            '/api/statistics',
            '/api/plans/:planId/gamification'
        ];
        
        targetRoutes.forEach(target => {
            const found = routes.some(route => 
                route.path && (route.path === target || route.path.includes(target.replace(':planId', '')))
            );
            console.log(`${found ? '✅' : '❌'} ${target}`);
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar rotas:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Executar verificação
checkServerRoutes().catch(console.error);