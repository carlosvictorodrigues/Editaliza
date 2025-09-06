# run-orchestrator.ps1
# Script para executar o orquestrador de produção com configuração completa

param(
    [switch]$TestOnly,
    [switch]$Deploy,
    [switch]$Monitor,
    [int]$MaxIterations = 10
)

$ErrorActionPreference = "Stop"
$ProjectDir = Get-Location
$ConfigFile = "agents.json"
$LogDir = "orchestrator-logs"

# Criar diretório de logs
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

# Função de log
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage -ForegroundColor $(if ($Level -eq "ERROR") {"Red"} elseif ($Level -eq "WARN") {"Yellow"} else {"Green"})
    Add-Content -Path "$LogDir\orchestrator-$(Get-Date -Format 'yyyy-MM-dd').log" -Value $logMessage
}

# Verificar configuração
if (-not (Test-Path $ConfigFile)) {
    Write-Log "Arquivo de configuração $ConfigFile não encontrado!" "ERROR"
    exit 1
}

Write-Log "========================================="
Write-Log "🎯 ORQUESTRADOR DE PRODUÇÃO EDITALIZA"
Write-Log "========================================="
Write-Log "Configuração: $ConfigFile"
Write-Log "Máximo de iterações: $MaxIterations"
Write-Log "Modo: $(if ($TestOnly) {'TESTE APENAS'} elseif ($Deploy) {'DEPLOY AUTOMÁTICO'} else {'MONITORAMENTO'})"

# Teste de conectividade
Write-Log "Testando conectividade com produção..."
$testResult = node ../tests/check-http.mjs https://app.editaliza.com.br --expect 200,302 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Log "✅ Servidor de produção acessível"
} else {
    Write-Log "❌ Servidor de produção inacessível!" "ERROR"
    exit 1
}

# Teste inicial completo
Write-Log "Executando teste completo de produção..."
$testOutput = node test-production.mjs 2>&1
$testExitCode = $LASTEXITCODE

if ($testExitCode -eq 0) {
    Write-Log "✅ TODOS OS TESTES PASSARAM! Sistema 100% funcional."
    if ($Monitor) {
        Write-Log "Entrando em modo monitoramento..."
        while ($true) {
            Start-Sleep -Seconds 300
            $monitorResult = node test-production.mjs 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Log "⚠️ Problema detectado no monitoramento!" "WARN"
                break
            }
            Write-Log "✅ Monitoramento OK"
        }
    }
    exit 0
}

Write-Log "❌ Problemas detectados. Iniciando processo de correção..." "WARN"

if ($TestOnly) {
    Write-Log "Modo teste apenas. Não serão feitas correções."
    exit 1
}

# Loop de correção
for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Log "========================================="
    Write-Log "📊 ITERAÇÃO $i/$MaxIterations"
    Write-Log "========================================="
    
    # Chamar o orchestrator Node.js
    Write-Log "Executando orchestrator..."
    $orchestratorResult = node orchestrator-production.mjs 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "✅ Orchestrator completou com sucesso"
    } else {
        Write-Log "⚠️ Orchestrator reportou problemas" "WARN"
    }
    
    # Se modo deploy, fazer deploy automático
    if ($Deploy) {
        Write-Log "Iniciando deploy automático..."
        
        # Git add, commit e push
        git add . 2>&1 | Out-Null
        git commit -m "fix: auto-correção by orchestrator - iteração $i" 2>&1 | Out-Null
        git push origin main 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ Push para GitHub concluído"
        } else {
            Write-Log "⚠️ Falha no push para GitHub" "WARN"
        }
        
        # Deploy no servidor
        Write-Log "Fazendo deploy no servidor..."
        ssh root@161.35.127.123 'cd /root/editaliza; git pull; npm install --production; pm2 restart editaliza-app' 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ Deploy no servidor concluído"
        } else {
            Write-Log "❌ Falha no deploy" "ERROR"
        }
        
        # Aguardar servidor reiniciar
        Write-Log "Aguardando servidor reiniciar (30s)..."
        Start-Sleep -Seconds 30
    }
    
    # Testar novamente
    Write-Log "Testando produção novamente..."
    $retestOutput = node test-production.mjs 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "========================================="
        Write-Log "🎉 SUCESSO! TODOS OS TESTES PASSARAM!"
        Write-Log "Sistema 100% funcional após $i iterações"
        Write-Log "========================================="
        exit 0
    }
    
    Write-Log "Ainda há problemas. Continuando..." "WARN"
    
    # Aguardar antes da próxima iteração
    if ($i -lt $MaxIterations) {
        Write-Log "Aguardando 60 segundos antes da próxima iteração..."
        Start-Sleep -Seconds 60
    }
}

Write-Log ("=" * 41)
Write-Log "LIMITE DE ITERACOES ATINGIDO" "WARN"
Write-Log "Sistema ainda com problemas apos $MaxIterations tentativas"
Write-Log "Verifique os logs em: $LogDir"
Write-Log ("=" * 41)
exit 1