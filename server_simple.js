const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8000;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                console.log(`❌ Arquivo não encontrado: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <h1>404 - Arquivo não encontrado</h1>
                    <p>O arquivo <code>${req.url}</code> não foi encontrado.</p>
                    <p><a href="/">Voltar para a página inicial</a></p>
                `);
            } else {
                console.log(`❌ Erro do servidor: ${error.code}`);
                res.writeHead(500);
                res.end(`Erro do servidor: ${error.code}`);
            }
        } else {
            console.log(`✅ Servindo: ${filePath} (${mimeType})`);
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(port, () => {
    console.log(`🚀 Servidor HTTP rodando em http://localhost:${port}`);
    console.log(`📁 Servindo arquivos do diretório: ${process.cwd()}`);
    console.log(`⏱️  Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
    console.log('');
    console.log('📋 URLs disponíveis:');
    console.log(`   • Página principal: http://localhost:${port}/`);
    console.log(`   • Perfil: http://localhost:${port}/profile.html`);
    console.log(`   • Teste de avatares: http://localhost:${port}/test-server.html`);
    console.log('');
    console.log('Para parar o servidor, pressione Ctrl+C');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Parando servidor...');
    server.close(() => {
        console.log('✅ Servidor parado com sucesso!');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n👋 Parando servidor...');
    server.close(() => {
        console.log('✅ Servidor parado com sucesso!');
        process.exit(0);
    });
});