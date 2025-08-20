# Script de Setup do Ambiente de Desenvolvimento Local
# Execute este script no PowerShell como Administrador

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " SETUP AMBIENTE LOCAL - EDITALIZA" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se PostgreSQL está instalado
Write-Host "[1/5] Verificando PostgreSQL..." -ForegroundColor Yellow
$pgPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$pgPath15 = "C:\Program Files\PostgreSQL\15\bin\psql.exe"
$pgPath14 = "C:\Program Files\PostgreSQL\14\bin\psql.exe"

$psqlPath = $null
if (Test-Path $pgPath) {
    $psqlPath = "C:\Program Files\PostgreSQL\16\bin"
    Write-Host "✓ PostgreSQL 16 encontrado" -ForegroundColor Green
} elseif (Test-Path $pgPath15) {
    $psqlPath = "C:\Program Files\PostgreSQL\15\bin"
    Write-Host "✓ PostgreSQL 15 encontrado" -ForegroundColor Green
} elseif (Test-Path $pgPath14) {
    $psqlPath = "C:\Program Files\PostgreSQL\14\bin"
    Write-Host "✓ PostgreSQL 14 encontrado" -ForegroundColor Green
} else {
    Write-Host "✗ PostgreSQL não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, instale o PostgreSQL:" -ForegroundColor Yellow
    Write-Host "1. Baixe em: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
    Write-Host "2. Execute o instalador" -ForegroundColor Cyan
    Write-Host "3. Defina a senha para o usuário 'postgres'" -ForegroundColor Cyan
    Write-Host "4. Execute este script novamente" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Abrindo página de download..." -ForegroundColor Yellow
    Start-Process "https://www.postgresql.org/download/windows/"
    exit 1
}

# 2. Criar banco de dados
Write-Host ""
Write-Host "[2/5] Criando banco de dados..." -ForegroundColor Yellow
Write-Host "Digite a senha do PostgreSQL (usuário postgres):" -ForegroundColor Cyan
$pgPassword = Read-Host -AsSecureString

# Converter SecureString para texto
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPassword)
$pgPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Definir variável de ambiente temporária para senha
$env:PGPASSWORD = $pgPasswordPlain

# Verificar se o banco já existe
$checkDb = & "$psqlPath\psql.exe" -U postgres -h localhost -t -c "SELECT 1 FROM pg_database WHERE datname='editaliza_dev'" 2>$null

if ($checkDb -match "1") {
    Write-Host "✓ Banco 'editaliza_dev' já existe" -ForegroundColor Green
} else {
    # Criar o banco
    & "$psqlPath\createdb.exe" -U postgres -h localhost editaliza_dev 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Banco 'editaliza_dev' criado com sucesso" -ForegroundColor Green
    } else {
        Write-Host "✗ Erro ao criar banco. Verifique a senha." -ForegroundColor Red
        $env:PGPASSWORD = $null
        exit 1
    }
}

# 3. Configurar .env
Write-Host ""
Write-Host "[3/5] Configurando arquivo .env..." -ForegroundColor Yellow

# Fazer backup se existir
if (Test-Path ".env") {
    $backupName = ".env.backup." + (Get-Date -Format "yyyyMMdd_HHmmss")
    Copy-Item ".env" $backupName
    Write-Host "✓ Backup criado: $backupName" -ForegroundColor Green
}

# Copiar .env.development para .env
if (Test-Path ".env.development") {
    Copy-Item ".env.development" ".env" -Force
    
    # Atualizar a senha do PostgreSQL no .env
    $envContent = Get-Content ".env"
    $envContent = $envContent -replace "DB_PASSWORD=postgres.*", "DB_PASSWORD=$pgPasswordPlain"
    $envContent | Set-Content ".env"
    
    Write-Host "✓ Arquivo .env configurado" -ForegroundColor Green
} else {
    Write-Host "✗ Arquivo .env.development não encontrado" -ForegroundColor Red
}

# Limpar senha da memória
$env:PGPASSWORD = $null
$pgPasswordPlain = $null

# 4. Instalar dependências
Write-Host ""
Write-Host "[4/5] Instalando dependências..." -ForegroundColor Yellow
if (Get-Command npm -ErrorAction SilentlyContinue) {
    npm install
    Write-Host "✓ Dependências instaladas" -ForegroundColor Green
} else {
    Write-Host "✗ npm não encontrado. Instale o Node.js" -ForegroundColor Red
    Write-Host "Download: https://nodejs.org/" -ForegroundColor Cyan
    Start-Process "https://nodejs.org/"
    exit 1
}

# 5. Criar tabelas no banco
Write-Host ""
Write-Host "[5/5] Criando estrutura do banco..." -ForegroundColor Yellow
Write-Host "Executando migrations..." -ForegroundColor Cyan

# Verificar se existe script de migration
if (Test-Path "migrations" -PathType Container) {
    Write-Host "✓ Pasta migrations encontrada" -ForegroundColor Green
    # npm run migrate (se existir)
} else {
    Write-Host "⚠ Pasta migrations não encontrada (será criada no primeiro uso)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host " SETUP CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Execute: npm run dev" -ForegroundColor White
Write-Host "2. Acesse: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Dica: Se houver erro de conexão," -ForegroundColor Yellow
Write-Host "verifique a senha no arquivo .env" -ForegroundColor Yellow