#!/bin/bash

echo "🔧 Corrigindo HTML encoding no OAuth..."
echo "Data: $(date)"
echo ""

# Criar arquivo com a correção
cat > /tmp/fix_oauth_encoding.js << 'EOF'
const fs = require('fs');
const path = require('path');

const filePath = '/root/editaliza/src/services/googleOAuthService.js';
let content = fs.readFileSync(filePath, 'utf8');

// Adicionar função decodeHtmlEntities se não existir
if (!content.includes('decodeHtmlEntities')) {
    console.log('✅ Adicionando função decodeHtmlEntities...');
    
    // Encontrar onde inserir a função (antes de exchangeCodeForToken)
    const insertPoint = content.indexOf('    /**\n     * Troca código de autorização por token');
    
    if (insertPoint === -1) {
        console.error('❌ Não encontrou ponto de inserção');
        process.exit(1);
    }
    
    const newFunction = `    /**
     * Decodifica HTML entities em uma string
     * @param {string} str - String possivelmente com HTML entities
     */
    decodeHtmlEntities(str) {
        const entities = {
            '&#x2F;': '/',
            '&#x3D;': '=',
            '&#x2B;': '+',
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&#x27;': "'",
            '&#x60;': '\`'
        };
        
        let decoded = str;
        for (const [entity, char] of Object.entries(entities)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), char);
        }
        return decoded;
    }

`;
    
    // Inserir a função antes de exchangeCodeForToken
    content = content.substring(0, insertPoint) + newFunction + content.substring(insertPoint);
}

// Atualizar a função exchangeCodeForToken para usar decodeHtmlEntities
const oldCode = `        try {
            console.log('\\n🔄 INICIANDO TROCA DE CÓDIGO POR TOKEN');
            console.log(\`   Código recebido: \${code.substring(0, 10)}...\${code.substring(code.length - 10)} (length: \${code.length})\`);
            
            // Limpar código - remover possíveis espaços ou caracteres extras
            // IMPORTANTE: + pode ser convertido em espaço se o proxy não estiver configurado corretamente
            const cleanCode = code.trim().replace(/\\s+/g, '+'); // Restaurar + se foi convertido em espaço`;

const newCode = `        try {
            console.log('\\n🔄 INICIANDO TROCA DE CÓDIGO POR TOKEN');
            console.log(\`   Código recebido (raw): \${code.substring(0, 20)}...\${code.substring(code.length - 10)} (length: \${code.length})\`);
            
            // CORREÇÃO CRÍTICA: Decodificar HTML entities PRIMEIRO
            // O código pode vir HTML-encoded do callback (ex: &#x2F; ao invés de /)
            let cleanCode = this.decodeHtmlEntities(code);
            console.log(\`   Código após decode HTML: \${cleanCode.substring(0, 20)}...\${cleanCode.substring(cleanCode.length - 10)}\`);
            
            // Depois limpar espaços e restaurar + se necessário
            // IMPORTANTE: + pode ser convertido em espaço se o proxy não estiver configurado corretamente
            cleanCode = cleanCode.trim().replace(/\\s+/g, '+'); // Restaurar + se foi convertido em espaço`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    console.log('✅ Código de tratamento HTML encoding atualizado');
} else if (content.includes('Código recebido (raw)')) {
    console.log('⚠️ Correção já aplicada anteriormente');
} else {
    console.log('⚠️ Código não encontrado exatamente, tentando correção alternativa...');
    
    // Tentar uma correção mais robusta
    const regex = /console\.log\('\\n🔄 INICIANDO TROCA DE CÓDIGO POR TOKEN'\);[\s\S]*?const cleanCode = code\.trim\(\)\.replace\(\/\\s\+\/g, '\+'\);/;
    
    if (regex.test(content)) {
        content = content.replace(regex, newCode);
        console.log('✅ Correção aplicada com regex');
    } else {
        console.error('❌ Não foi possível aplicar a correção');
        process.exit(1);
    }
}

// Salvar arquivo
fs.writeFileSync(filePath, content);
console.log('✅ Arquivo atualizado com sucesso');
console.log('📝 Salvando backup...');
fs.writeFileSync(filePath + '.bak', fs.readFileSync(filePath));
EOF

echo "📝 Aplicando correção..."
cd /root/editaliza
node /tmp/fix_oauth_encoding.js

echo ""
echo "🔄 Reiniciando aplicação..."
pm2 restart editaliza-app

echo ""
echo "⏳ Aguardando aplicação iniciar..."
sleep 5

echo ""
echo "📊 Status da aplicação:"
pm2 status editaliza-app

echo ""
echo "📋 Verificando logs para confirmar mudança:"
pm2 logs editaliza-app --lines 10 --nostream | grep -E "OAUTH|decode HTML|Código"

echo ""
echo "✅ Correção aplicada!"
echo ""
echo "🧪 Para testar:"
echo "1. Acesse https://editaliza.com.br/login.html"
echo "2. Clique em 'Entrar com Google'"
echo "3. Complete o fluxo OAuth"
echo "4. Monitore logs: pm2 logs editaliza-app"
echo ""
echo "📝 Se ainda houver erro 'Malformed auth code', verifique:"
echo "- Google Console tem redirect_uri: https://editaliza.com.br/auth/google/callback"
echo "- Logs mostram 'Código após decode HTML' com / ao invés de &#x2F;"