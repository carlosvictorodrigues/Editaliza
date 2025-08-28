// Servidor mínimo para testar registro

const express = require('express');
const authController = require('./src/controllers/authController');

const app = express();

// Middleware mínimo
app.use(express.json());

// Rota de teste
app.get('/test', (req, res) => {
    res.json({ message: 'Server OK' });
});

// Rota de registro direto
app.post('/register', authController.register);

// Rota de login direto
app.post('/login', authController.login);

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor de teste rodando na porta ${PORT}`);
    console.log(`   Teste registro: curl -X POST http://localhost:${PORT}/register -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"Test123!@#","name":"Test"}'`);
});