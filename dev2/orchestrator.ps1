# orchestrator.ps1 - Script simplificado de orquestracao
param(
    [switch]$TestOnly,
    [switch]$Deploy
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "ORQUESTRADOR DE PRODUCAO EDITALIZA" -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan
Write-Host ""

# Teste de conectividade
Write-Host "Testando conectividade..." -ForegroundColor Yellow
$test = node ../tests/check-http.mjs https://app.editaliza.com.br --expect 200,302 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: Servidor de producao acessivel" -ForegroundColor Green
} else {
    Write-Host "ERRO: Servidor de producao inacessivel!" -ForegroundColor Red
    exit 1
}

# Teste completo
Write-Host ""
Write-Host "Executando teste completo..." -ForegroundColor Yellow
$result = node test-production.mjs 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCESSO! Todos os testes passaram!" -ForegroundColor Green
    Write-Host "Sistema 100% funcional" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Problemas detectados!" -ForegroundColor Red

if ($TestOnly) {
    Write-Host "Modo teste apenas. Nao serao feitas correcoes." -ForegroundColor Yellow
    exit 1
}

# Executar orchestrator
Write-Host ""
Write-Host "Executando correcoes..." -ForegroundColor Yellow
$fix = node orchestrator-production.mjs 2>&1

if ($Deploy) {
    Write-Host ""
    Write-Host "Fazendo deploy..." -ForegroundColor Yellow
    
    git add . 2>&1 | Out-Null
    git commit -m "fix: auto-correcao by orchestrator" 2>&1 | Out-Null
    git push origin main 2>&1 | Out-Null
    
    Write-Host "Deploy concluido!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Processo finalizado." -ForegroundColor Cyan