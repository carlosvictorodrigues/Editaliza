const express = require('express');
const cors = require('cors');
const app = express();

// Configuração CORS básica
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());

// Rota de teste
app.get('/test', (req, res) => {
    res.json({ message: 'Servidor funcionando!' });
});

// Rota de login de teste
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    console.log('Tentativa de login:', { email, password });
    
    if (email === 'test@test.com' && password === 'test123') {
        res.json({ 
            message: 'Login bem-sucedido!', 
            token: 'test-token-123' 
        });
    } else {
        res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor de teste rodando na porta ${PORT}`);
    console.log(`Teste: http://localhost:${PORT}/test`);
}); 