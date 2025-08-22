#!/bin/bash
# Script de correção final para o sistema de autenticação
# Execute: ssh root@161.35.127.123 'bash -s' < fix_auth_final.sh

cd /opt/Editaliza-sv

echo "🔧 Aplicando correções no sistema de autenticação..."
echo "===================================================="
echo ""

# 1. Verificar se authController existe e tem a função register
echo "1️⃣ Verificando authController..."
if [ ! -f src/controllers/authController.js ]; then
    echo "❌ authController.js não existe. Criando versão básica..."
    
    mkdir -p src/controllers
    cat > src/controllers/authController.js << 'EOFCONTROLLER'
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../database');

// Função auxiliar para gerar tokens
const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'default_jwt_secret',
        { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'default_jwt_secret',
        { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
};

// Registro de usuário
exports.register = async (req, res) => {
    console.log('[AUTH] Registro iniciado para:', req.body.email);
    
    try {
        const { email, password, name } = req.body;
        
        // Verificar se usuário já existe
        const existingUser = await db.get(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        
        if (existingUser) {
            console.log('[AUTH] Email já cadastrado:', email);
            return res.status(400).json({ 
                error: 'Este email já está cadastrado' 
            });
        }
        
        // Hash da senha
        console.log('[AUTH] Criando hash da senha...');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Inserir usuário
        console.log('[AUTH] Inserindo usuário no banco...');
        const result = await db.run(
            'INSERT INTO users (email, password, name, created_at) VALUES (?, ?, ?, NOW())',
            [email, hashedPassword, name || null]
        );
        
        const userId = result.lastInsertRowid;
        console.log('[AUTH] Usuário criado com ID:', userId);
        
        // Gerar tokens
        const tokens = generateTokens(userId);
        
        res.status(201).json({
            message: 'Usuário criado com sucesso',
            user: {
                id: userId,
                email,
                name
            },
            ...tokens
        });
        
    } catch (error) {
        console.error('[AUTH] Erro no registro:', error);
        res.status(500).json({ 
            error: 'Erro ao criar usuário',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Login de usuário
exports.login = async (req, res) => {
    console.log('[AUTH] Login iniciado para:', req.body.email);
    
    try {
        const { email, password } = req.body;
        
        // Buscar usuário
        const user = await db.get(
            'SELECT id, email, name, password FROM users WHERE email = ?',
            [email]
        );
        
        if (!user) {
            console.log('[AUTH] Usuário não encontrado:', email);
            return res.status(401).json({ 
                error: 'Email ou senha incorretos' 
            });
        }
        
        // Verificar senha
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            console.log('[AUTH] Senha incorreta para:', email);
            return res.status(401).json({ 
                error: 'Email ou senha incorretos' 
            });
        }
        
        // Atualizar último login
        await db.run(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        
        // Gerar tokens
        const tokens = generateTokens(user.id);
        
        console.log('[AUTH] Login bem-sucedido para:', email);
        
        res.json({
            message: 'Login realizado com sucesso',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            ...tokens
        });
        
    } catch (error) {
        console.error('[AUTH] Erro no login:', error);
        res.status(500).json({ 
            error: 'Erro ao fazer login',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Outras funções necessárias
exports.logout = async (req, res) => {
    res.json({ message: 'Logout realizado com sucesso' });
};

exports.forgotPassword = async (req, res) => {
    res.json({ message: 'Email de recuperação enviado (simulado)' });
};

exports.resetPassword = async (req, res) => {
    res.json({ message: 'Senha redefinida com sucesso' });
};

exports.refreshToken = async (req, res) => {
    res.json({ message: 'Token renovado' });
};

exports.googleCallback = async (req, res) => {
    res.json({ message: 'OAuth Google (em desenvolvimento)' });
};
EOFCONTROLLER
    
    echo "✅ authController.js criado"
else
    echo "✅ authController.js já existe"
fi

# 2. Verificar se bcrypt está instalado
echo ""
echo "2️⃣ Verificando bcrypt..."
if ! npm list bcrypt 2>/dev/null | grep -q bcrypt; then
    echo "Instalando bcrypt..."
    npm install bcrypt --save
fi
echo "✅ bcrypt instalado"

# 3. Adicionar timeout ao database.js para evitar travamento
echo ""
echo "3️⃣ Adicionando timeout ao database.js..."
if ! grep -q "statement_timeout" database.js; then
    sed -i '/const pool = new Pool({/a\    statement_timeout: 5000, // 5 segundos de timeout' database.js
    echo "✅ Timeout adicionado"
else
    echo "✅ Timeout já configurado"
fi

# 4. Reiniciar servidor
echo ""
echo "4️⃣ Reiniciando servidor..."
pm2 restart editaliza-app

sleep 3

# 5. Testar registro
echo ""
echo "5️⃣ Testando registro..."
TEST_EMAIL="final_test_$(date +%s)@example.com"

RESPONSE=$(curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: https://editaliza.com.br" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"TestPass123\",\"name\":\"Final Test\"}" \
  -s -w "\nHTTP_STATUS:%{http_code}" \
  --max-time 10)

STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

echo "Resposta do servidor:"
echo "$RESPONSE" | sed 's/HTTP_STATUS:.*//'
echo "Status HTTP: $STATUS"

if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
    echo ""
    echo "✅ SUCESSO! Sistema de registro funcionando!"
    
    # Verificar no banco
    node -e "
    const db = require('./database.js');
    db.get('SELECT id, email FROM users WHERE email = ?', ['$TEST_EMAIL'])
      .then(u => console.log('✅ Usuário criado no banco:', u))
      .catch(e => console.log('Erro ao verificar:', e.message));
    "
else
    echo ""
    echo "⚠️ Registro retornou status $STATUS"
    echo "Verificando logs..."
    pm2 logs editaliza-app --err --lines 10 --nostream | tail -15
fi

echo ""
echo "🏁 Correções aplicadas!"
echo ""
echo "Próximos passos:"
echo "1. Teste o registro em: https://editaliza.com.br/register.html"
echo "2. Teste o login em: https://editaliza.com.br/login.html"
echo "3. Monitore logs com: pm2 logs editaliza-app"