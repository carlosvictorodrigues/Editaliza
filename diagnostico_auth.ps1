# Script PowerShell para diagnosticar problemas de autenticação
# Execute no PowerShell como administrador

$SERVER = "root@161.35.127.123"

Write-Host "🔍 Diagnóstico do Sistema de Autenticação Editaliza" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Você precisará digitar a senha quando solicitado..." -ForegroundColor Yellow
Write-Host ""

# Criar script remoto
$remoteScript = @'
cd /opt/Editaliza-sv

echo "=== 1. Verificando Controller ==="
if [ -f src/controllers/authController.js ]; then
    echo "Controller existe. Verificando função register..."
    grep -A 30 "exports.register" src/controllers/authController.js | head -35
else
    echo "ERRO: Controller não encontrado!"
fi

echo ""
echo "=== 2. Testando banco de dados ==="
node -e "
const db = require('./database.js');
db.get('SELECT COUNT(*) as count FROM users')
  .then(r => console.log('✓ Banco OK. Usuários:', r.count))
  .catch(e => console.log('✗ Erro no banco:', e.message));
"

echo ""
echo "=== 3. Testando registro via curl ==="
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: https://editaliza.com.br" \
  -d '{"email":"test_ps@example.com","password":"Test123","name":"PowerShell Test"}' \
  -s -w "\nStatus: %{http_code}\n" \
  --max-time 5

echo ""
echo "=== 4. Verificando logs recentes ==="
pm2 logs editaliza-app --lines 5 --nostream | tail -10

echo ""
echo "=== 5. Status do sistema ==="
pm2 list | grep editaliza
'@

# Executar comando SSH
ssh $SERVER $remoteScript

Write-Host ""
Write-Host "✅ Diagnóstico concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "Se o registro está travando, possíveis causas:" -ForegroundColor Yellow
Write-Host "1. Função bcrypt.hash pode estar travando" -ForegroundColor White
Write-Host "2. Conexão com banco de dados com deadlock" -ForegroundColor White
Write-Host "3. Middleware de validação em loop" -ForegroundColor White
Write-Host ""
Read-Host "Pressione Enter para sair"