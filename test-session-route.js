const http = require('http');

// Configurar para testar a rota
const sessionId = 11910;
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTQxLCJlbWFpbCI6ImVkaXRhbGl6YUBvdXRsb29rLmNvbSIsIm5hbWUiOiJMdWNhcyIsInNlc3Npb25JZCI6ImdGcjNXVGdGSDNKbHhhaTJqMkZJViIsImlhdCI6MTcyNTAzODM5MSwiZXhwIjoxNzI1MTI0NzkxfQ.BSA-NQSyHZ5yZqo6DXG0nqJsP4fIlQJ8nLJ2SgJvJoQ'; // Substitua pelo token real

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/sessions/${sessionId}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('🔍 Testando rota GET /api/sessions/' + sessionId);
console.log('📍 URL completa: http://localhost:3000/api/sessions/' + sessionId);

const req = http.request(options, (res) => {
  console.log(`📊 Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📦 Resposta:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro na requisição:', error);
});

req.end();