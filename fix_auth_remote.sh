#!/bin/bash
# Script para diagnosticar e corrigir problemas de autenticação no servidor
# Execute este script e digite a senha quando solicitado

SERVER="root@161.35.127.123"

echo "🔍 Diagnóstico do Sistema de Autenticação Editaliza"
echo "=================================================="
echo ""
echo "Digite a senha do servidor quando solicitado..."
echo ""

ssh $SERVER << 'EOFSCRIPT'
cd /opt/Editaliza-sv

echo "1️⃣ Verificando estrutura de rotas..."
echo "-----------------------------------"
if [ -f src/controllers/authController.js ]; then
    echo "✅ authController.js existe"
    echo "Funções exportadas:"
    grep "exports\." src/controllers/authController.js | grep -o "exports\.[a-zA-Z]*" | sort | uniq
else
    echo "❌ authController.js não encontrado!"
fi

echo ""
echo "2️⃣ Verificando função de registro no controller..."
echo "-----------------------------------"
if [ -f src/controllers/authController.js ]; then
    echo "Buscando função register:"
    sed -n '/exports\.register/,/^exports\./p' src/controllers/authController.js | head -30
fi

echo ""
echo "3️⃣ Testando conexão com banco de dados..."
echo "-----------------------------------"
cat > test_db.js << 'EOF'
const db = require('./database.js');

async function testDB() {
    try {
        // Testar conexão
        const result = await db.get("SELECT COUNT(*) as count FROM users");
        console.log("✅ Conexão com banco OK. Usuários:", result.count);
        
        // Testar inserção
        const testEmail = `test_${Date.now()}@example.com`;
        await db.run(
            "INSERT INTO users (email, password, name, created_at) VALUES (?, ?, ?, NOW())",
            [testEmail, "hashed_password", "Test User"]
        );
        console.log("✅ Inserção funcionando");
        
        // Limpar teste
        await db.run("DELETE FROM users WHERE email = ?", [testEmail]);
        console.log("✅ Delete funcionando");
        
    } catch (err) {
        console.log("❌ Erro no banco:", err.message);
    }
    process.exit(0);
}

testDB();
EOF

node test_db.js

echo ""
echo "4️⃣ Verificando problemas de dependências..."
echo "-----------------------------------"
# Verificar se bcrypt está instalado
if npm list bcrypt 2>/dev/null | grep -q bcrypt; then
    echo "✅ bcrypt instalado"
else
    echo "❌ bcrypt não está instalado!"
    echo "Instalando bcrypt..."
    npm install bcrypt
fi

echo ""
echo "5️⃣ Criando teste de registro direto..."
echo "-----------------------------------"
cat > test_register_direct.js << 'EOF'
const bcrypt = require('bcrypt');
const db = require('./database.js');

async function testRegister() {
    const testUser = {
        email: `direct_test_${Date.now()}@example.com`,
        password: "TestPassword123",
        name: "Direct Test User"
    };
    
    console.log("Testando registro direto no banco...");
    console.log("Email:", testUser.email);
    
    try {
        // Hash da senha
        const hashedPassword = await bcrypt.hash(testUser.password, 10);
        console.log("✅ Senha hasheada");
        
        // Inserir usuário
        const result = await db.run(
            "INSERT INTO users (email, password, name, created_at) VALUES (?, ?, ?, NOW())",
            [testUser.email, hashedPassword, testUser.name]
        );
        console.log("✅ Usuário inserido! ID:", result.lastInsertRowid);
        
        // Verificar
        const user = await db.get(
            "SELECT id, email, name FROM users WHERE email = ?",
            [testUser.email]
        );
        console.log("✅ Usuário encontrado:", user);
        
        // Limpar
        await db.run("DELETE FROM users WHERE email = ?", [testUser.email]);
        console.log("✅ Teste limpo");
        
    } catch (err) {
        console.log("❌ Erro:", err.message);
        console.log("Stack:", err.stack);
    }
    
    process.exit(0);
}

testRegister();
EOF

node test_register_direct.js

echo ""
echo "6️⃣ Testando endpoint de registro via HTTP..."
echo "-----------------------------------"
TEST_EMAIL="http_test_$(date +%s)@example.com"
echo "Testando com email: $TEST_EMAIL"

# Fazer requisição e capturar resposta
RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: https://editaliza.com.br" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"TestPass123\",\"name\":\"HTTP Test\"}" \
  -w "\n===STATUS===%{http_code}===\n" \
  2>&1)

# Extrair status code
STATUS=$(echo "$RESPONSE" | grep -o "===STATUS===[0-9]*===" | grep -o "[0-9]*")

echo "Status HTTP: $STATUS"
echo "Resposta:"
echo "$RESPONSE" | sed 's/===STATUS===.*===//g'

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    echo "✅ Registro funcionando!"
else
    echo "❌ Problema no registro. Verificando logs..."
    pm2 logs editaliza-app --err --lines 10 --nostream | tail -15
fi

echo ""
echo "7️⃣ Resumo do diagnóstico:"
echo "-----------------------------------"
echo "- Rotas modulares: $([ -f src/routes/authRoutes.js ] && echo '✅ OK' || echo '❌ Faltando')"
echo "- Controller: $([ -f src/controllers/authController.js ] && echo '✅ OK' || echo '❌ Faltando')"
echo "- Banco de dados: $(node -e "require('./database.js').get('SELECT 1').then(() => console.log('✅ OK')).catch(() => console.log('❌ Erro'))" 2>/dev/null)"
echo "- PM2 Status: $(pm2 list | grep editaliza-app | grep online > /dev/null && echo '✅ Online' || echo '❌ Offline')"

echo ""
echo "🏁 Diagnóstico completo!"
EOFSCRIPT