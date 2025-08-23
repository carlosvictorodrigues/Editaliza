// Script para atualizar arquivos HTML com nonces para CSP segura
const fs = require('fs');
const path = require('path');

// Lista de arquivos HTML para atualizar
const htmlFiles = [
    'login.html', 'register.html', 'home.html', 'dashboard.html', 
    'profile.html', 'cronograma.html', 'plan.html', 'notes.html'
];

console.log('🔒 Atualizando arquivos HTML para CSP segura...');

htmlFiles.forEach(filename => {
    const filePath = path.join(__dirname, filename);
    
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Adicionar nonce aos scripts inline
        content = content.replace(
            /<script(?![^>]*src=)([^>]*)>/gi, 
            '<script$1 nonce="<%= nonce %>">'
        );
        
        // Adicionar nonce aos styles inline
        content = content.replace(
            /<style([^>]*)>/gi, 
            '<style$1 nonce="<%= nonce %>">'
        );
        
        // Salvar arquivo atualizado
        fs.writeFileSync(filePath, content);
        console.log(`✅ ${filename} atualizado com nonce`);
    } else {
        console.log(`⚠️  ${filename} não encontrado`);
    }
});

console.log('🎯 Atualização de segurança HTML concluída!');
console.log('📝 NOTA: Para produção, considere usar template engine (EJS/Handlebars) para injetar nonces dinamicamente.');