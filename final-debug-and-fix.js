/**
 * DEBUGGING FINAL E SOLUÇÃO DEFINITIVA
 * Este script vai:
 * 1. Verificar exatamente qual secret o servidor está usando
 * 2. Testar com esse secret específico
 * 3. Debugar o problema da rota de timeout
 * 4. Aplicar correção final
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

console.log('🔧 DEBUGGING FINAL: Identificando e resolvendo problemas');
console.log('=' .repeat(60));

async function debuggingFinal() {
    
    console.log('\n1. 🔍 Verificando configuração JWT no servidor...');
    
    // Verificar qual secret está sendo usado
    const jwtFromEnv = process.env.JWT_SECRET;
    const sessionFromEnv = process.env.SESSION_SECRET;
    
    console.log('   JWT_SECRET existe:', !!jwtFromEnv);
    console.log('   SESSION_SECRET existe:', !!sessionFromEnv);
    console.log('   JWT_SECRET preview:', jwtFromEnv?.substring(0, 15) + '...');
    
    console.log('\n2. 🧪 Testando múltiplas variações de token...');
    
    const basePayload = {
        id: 1,
        email: 'c@c.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60)
    };
    
    const secrets = [
        jwtFromEnv,
        sessionFromEnv,
        'default-dev-secret',
        'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N'
    ];
    
    for (let i = 0; i < secrets.length; i++) {
        const secret = secrets[i];
        if (!secret) continue;
        
        console.log(`   🔐 Testando secret #${i + 1} (${secret.substring(0, 10)}...):`);
        
        try {
            const token = jwt.sign(basePayload, secret);
            
            // Testar auth endpoint
            const response = await axios.get('http://localhost:3000/api/plans/20/subjects', {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 3000,
                validateStatus: () => true
            });
            
            console.log(`      Status: ${response.status}`);
            if (response.status === 200) {
                console.log('      ✅ SECRET CORRETO ENCONTRADO!');
                console.log(`      Dados: ${JSON.stringify(response.data).substring(0, 100)}...`);
                
                // Agora testar a rota com timeout
                console.log('\n   🧪 Testando rota subjects_with_topics...');
                try {
                    const response2 = await axios.get('http://localhost:3000/api/plans/20/subjects_with_topics', {
                        headers: { 'Authorization': `Bearer ${token}` },
                        timeout: 12000 // timeout maior
                    });
                    console.log(`      ✅ subjects_with_topics funcionou! Status: ${response2.status}`);
                    console.log(`      Dados: ${JSON.stringify(response2.data).substring(0, 200)}...`);
                } catch (error2) {
                    console.log(`      ❌ subjects_with_topics error: ${error2.message}`);
                    if (error2.response) {
                        console.log(`      Status: ${error2.response.status}`);
                        console.log(`      Error: ${JSON.stringify(error2.response.data)}`);
                    }
                }
                break;
            } else if (response.status === 401) {
                console.log(`      ❌ Token rejeitado: ${response.data.error}`);
            } else {
                console.log(`      ⚠️ Resposta inesperada: ${JSON.stringify(response.data)}`);
            }
            
        } catch (error) {
            console.log(`      ❌ Erro no teste: ${error.message}`);
        }
        
        // Aguardar um pouco entre testes
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('\n3. 🔍 Verificando se há problema no middleware CSRF...');
    
    // Verificar se o middleware CSRF está interferindo
    const csrfBypassHeaders = {
        'Authorization': `Bearer ${jwt.sign(basePayload, jwtFromEnv)}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
    };
    
    try {
        const response = await axios.get('http://localhost:3000/api/plans/20/subjects', {
            headers: csrfBypassHeaders,
            timeout: 5000,
            validateStatus: () => true
        });
        
        console.log('   Com headers CSRF bypass:', response.status);
        if (response.status === 200) {
            console.log('   ✅ CSRF era o problema!');
        }
    } catch (error) {
        console.log('   ❌ Ainda com erro:', error.message);
    }
    
    console.log('\n4. 🔍 Verificando logs do servidor diretamente...');
    
    // Fazer request e ver logs
    try {
        const token = jwt.sign(basePayload, jwtFromEnv);
        console.log('   📝 Token para debug:', token.substring(0, 50) + '...');
        
        // Fazer request de forma simples
        const response = await axios({
            method: 'GET',
            url: 'http://localhost:3000/api/plans/20/subjects',
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'DebugScript/1.0'
            },
            timeout: 5000,
            validateStatus: () => true
        });
        
        console.log(`   📊 Response final: ${response.status} - ${JSON.stringify(response.data)}`);
        
    } catch (error) {
        console.log('   ❌ Request final falhou:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('   💡 Servidor não está respondendo na porta 3000');
        }
    }
    
    console.log('\n5. 🔧 Aplicando correção no middleware auth se necessário...');
    
    // Verificar se precisa aplicar correção final no middleware
    const authMiddlewarePath = path.join(__dirname, 'src', 'middleware', 'auth.middleware.js');
    let authContent = fs.readFileSync(authMiddlewarePath, 'utf8');
    
    // Adicionar debug logging
    if (!authContent.includes('console.log(\`[AUTH_DEBUG] Token validation with secret:')) {
        console.log('   🔧 Adicionando debug logging ao middleware...');
        
        authContent = authContent.replace(
            'try {\n                decoded = await validateToken(token);',
            `try {
                console.log('[AUTH_DEBUG] Token validation with secret:', secret?.substring(0, 10) + '...');
                console.log('[AUTH_DEBUG] Token preview:', token?.substring(0, 50) + '...');
                decoded = await validateToken(token);
                console.log('[AUTH_DEBUG] Token decoded successfully, user ID:', decoded?.id);`
        );
        
        authContent = authContent.replace(
            '} catch (error) {\n                if (logFailures) {',
            `} catch (error) {
                console.log('[AUTH_DEBUG] Token validation failed:', error.message);
                if (logFailures) {`
        );
        
        fs.writeFileSync(authMiddlewarePath, authContent, 'utf8');
        console.log('   ✅ Debug logging adicionado');
    }
    
    console.log('\n6. 🔍 Verificando porta do servidor...');
    
    // Verificar se o servidor está rodando na porta correta
    const ports = [3000, 3001, 8000, 5000];
    
    for (const port of ports) {
        try {
            const response = await axios.get(`http://localhost:${port}/health`, {
                timeout: 2000,
                validateStatus: () => true
            });
            
            if (response.status === 200) {
                console.log(`   ✅ Servidor encontrado na porta ${port}!`);
                console.log(`      Health: ${JSON.stringify(response.data)}`);
                
                if (port !== 3000) {
                    console.log(`   ⚠️ Servidor não está na porta padrão 3000!`);
                }
                break;
            }
        } catch (error) {
            console.log(`   ❌ Porta ${port}: ${error.code || error.message}`);
        }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('🏁 Debugging final concluído!');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Verifique os logs do servidor para debug adicional');
    console.log('   2. Se o server não estiver na porta 3000, ajuste o BASE_URL');
    console.log('   3. Reinicie o servidor se foram feitas mudanças no middleware');
    console.log('   4. Teste novamente com curl para validar');
}

// Executar debugging
if (require.main === module) {
    debuggingFinal().then(() => {
        console.log('\n✅ Debugging finalizado');
        process.exit(0);
    }).catch(console.error);
}

module.exports = { debuggingFinal };