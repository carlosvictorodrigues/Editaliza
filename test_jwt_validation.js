const jwt = require('jsonwebtoken');

function testJWTValidation() {
    console.log('🔐 === TESTE DE VALIDAÇÃO JWT ===\n');
    
    const jwtSecret = 'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N';
    
    // 1. Criar token igual ao sistema
    console.log('1️⃣ Criando token igual ao sistema...');
    const tokenPayload = {
        id: 1006,
        email: 'c@c.com',
        name: 'Test User'
    };
    
    const token = jwt.sign(
        tokenPayload,
        jwtSecret,
        { 
            expiresIn: '24h',
            issuer: 'editaliza' 
        }
    );
    
    console.log(`Token criado: ${token.substring(0, 50)}...`);
    
    // 2. Verificar token
    console.log('\n2️⃣ Verificando token...');
    try {
        const decoded = jwt.verify(token, jwtSecret);
        console.log('✅ Token válido! Dados decodificados:');
        console.log(JSON.stringify(decoded, null, 2));
    } catch (error) {
        console.error('❌ Erro ao verificar token:', error.message);
    }
    
    // 3. Verificar sem issuer 
    console.log('\n3️⃣ Testando token sem issuer...');
    const tokenSemIssuer = jwt.sign(
        tokenPayload,
        jwtSecret,
        { expiresIn: '24h' }
    );
    
    try {
        const decoded2 = jwt.verify(tokenSemIssuer, jwtSecret);
        console.log('✅ Token sem issuer também é válido:');
        console.log(JSON.stringify(decoded2, null, 2));
    } catch (error) {
        console.error('❌ Erro ao verificar token sem issuer:', error.message);
    }
    
    // 4. Testar com middleware simulado
    console.log('\n4️⃣ Simulando middleware authenticateToken...');
    
    function simulateMiddleware(token) {
        try {
            const user = jwt.verify(token, jwtSecret);
            
            // Verificar se o token tem as informações necessárias
            if (!user.id || !user.email) {
                throw new Error('Token malformado');
            }
            
            console.log('✅ Token aceito pelo middleware simulado');
            console.log('Dados do usuário:', { id: user.id, email: user.email, name: user.name });
            return true;
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                console.error('❌ Token expirado');
            } else {
                console.error('❌ Token inválido:', err.message);
            }
            return false;
        }
    }
    
    console.log('Testando token com issuer:');
    simulateMiddleware(token);
    
    console.log('\nTestando token sem issuer:');
    simulateMiddleware(tokenSemIssuer);
}

testJWTValidation();