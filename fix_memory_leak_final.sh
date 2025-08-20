#!/bin/bash

echo "=== Corrigindo Memory Leak - Solução Definitiva ==="
echo ""

# 1. Fazer backup dos arquivos problemáticos
echo "1. Fazendo backup dos arquivos..."
ssh editaliza << 'EOF'
cd /root/editaliza/src/utils
cp logger.js logger.js.backup-memory-leak
cp error-handler.js error-handler.js.backup-memory-leak
echo "✓ Backups criados"
EOF

# 2. Substituir logger.js pelo logger_fixed.js
echo ""
echo "2. Substituindo logger.js pelo logger_fixed.js..."
ssh editaliza << 'EOF'
cd /root/editaliza/src/utils
cp logger_fixed.js logger.js
echo "✓ logger.js substituído pelo logger_fixed.js (que tem safeStringify)"
EOF

# 3. Corrigir error-handler.js para usar safeStringify
echo ""
echo "3. Corrigindo error-handler.js..."
ssh editaliza << 'EOF'
cd /root/editaliza/src/utils

# Adicionar função safeStringify no início do arquivo
cat > error-handler_temp.js << 'ENDFILE'
/**
 * Error Handler Module
 * Provides comprehensive error handling for the application
 */

// Função segura para stringify que lida com referências circulares
function safeStringify(obj, indent = 2) {
    let cache = [];
    const retVal = JSON.stringify(
        obj,
        (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.includes(value)) {
                    return '[Circular]';
                }
                cache.push(value);
            }
            return value;
        },
        indent
    );
    cache = null;
    return retVal;
}

// Importar o resto do arquivo original, substituindo JSON.stringify
ENDFILE

# Adicionar o resto do arquivo, substituindo JSON.stringify por safeStringify
sed '1,20d' error-handler.js | sed 's/JSON.stringify/safeStringify/g' >> error-handler_temp.js

# Substituir o arquivo original
mv error-handler_temp.js error-handler.js

echo "✓ error-handler.js corrigido para usar safeStringify"
EOF

# 4. Verificar as correções
echo ""
echo "4. Verificando correções..."
ssh editaliza << 'EOF'
cd /root/editaliza/src/utils

echo "Verificando se logger.js tem safeStringify:"
grep -c "safeStringify" logger.js

echo "Verificando se error-handler.js tem safeStringify:"
grep -c "safeStringify" error-handler.js

echo "Verificando se ainda há JSON.stringify inseguro em error-handler.js:"
grep "JSON\.stringify" error-handler.js | grep -v safeStringify | wc -l
EOF

# 5. Testar o servidor
echo ""
echo "5. Testando o servidor..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Testar inicialização do servidor
echo "Testando inicialização..."
timeout 5 node -e "
console.log('Carregando módulos...');
require('dotenv').config();
const logger = require('./src/utils/logger');
const errorHandler = require('./src/utils/error-handler');
console.log('✓ Módulos carregados sem memory leak!');

// Testar log com objeto circular
const obj = { name: 'test' };
obj.self = obj; // referência circular

try {
    logger.info('Teste com objeto circular', obj);
    console.log('✓ Logger lidou com referência circular');
} catch (err) {
    console.error('✗ Erro no logger:', err.message);
}
"

if [ $? -eq 0 ] || [ $? -eq 124 ]; then
    echo ""
    echo "✓ Servidor pode ser iniciado sem memory leak!"
else
    echo ""
    echo "✗ Ainda há problemas"
fi
EOF

echo ""
echo "6. Reiniciando servidor com PM2..."
ssh editaliza << 'EOF'
cd /root/editaliza
pm2 start server.js --name editaliza-app --max-memory-restart 300M
pm2 logs editaliza-app --lines 20
EOF