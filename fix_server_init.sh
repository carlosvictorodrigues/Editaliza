#!/bin/bash

echo "=== Corrigindo problema de inicialização do servidor ==="

# Fazer backup
ssh editaliza "cd /root/editaliza && cp server.js server.js.backup-memory-fix"

# Criar versão simplificada do server.js para debug
ssh editaliza "cd /root/editaliza && cat > server_minimal.js" << 'EOF'
// Versão mínima do servidor para identificar o problema
console.log('Iniciando servidor mínimo...');

// Carregar apenas o essencial
require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Rota básica de teste
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor mínimo rodando na porta ${PORT}`);
});
EOF

# Testar servidor mínimo
echo "Testando servidor mínimo..."
ssh editaliza "cd /root/editaliza && timeout 5 node server_minimal.js"

if [ $? -eq 0 ] || [ $? -eq 124 ]; then
    echo "✓ Servidor mínimo funciona!"
    echo ""
    echo "Agora vamos adicionar módulos um por um para identificar o problema..."
    
    # Teste 1: Adicionar configuração de ambiente
    ssh editaliza "cd /root/editaliza && cat > test_env.js" << 'EOF'
console.log('Teste 1: Carregando configuração de ambiente...');
require('dotenv').config();
const config = require('./src/config/environment');
console.log('✓ Configuração carregada com sucesso');
EOF
    
    ssh editaliza "cd /root/editaliza && timeout 2 node test_env.js"
    
    # Teste 2: Adicionar passport
    ssh editaliza "cd /root/editaliza && cat > test_passport.js" << 'EOF'
console.log('Teste 2: Carregando passport...');
require('dotenv').config();
const passport = require('./src/config/passport');
console.log('✓ Passport carregado com sucesso');
EOF
    
    ssh editaliza "cd /root/editaliza && timeout 2 node test_passport.js"
    
else
    echo "✗ Até o servidor mínimo está falhando!"
fi

echo ""
echo "Verificando se há algum processo Node rodando..."
ssh editaliza "ps aux | grep node | grep -v grep"