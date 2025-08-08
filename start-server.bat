@echo off
echo �� Iniciando servidor Editaliza...
echo.
echo 📋 Verificando dependências...

REM Verificar se Node.js está disponível
node --version >NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Node.js encontrado
    echo.
    echo 🌐 Servidor rodando em: http://localhost:3000
    echo 🖼️ Teste de avatares: http://localhost:3000/test-server.html
    echo 👤 Página de perfil: http://localhost:3000/profile.html
    echo 📊 Dashboard: http://localhost:3000/dashboard.html
    echo.
    echo 🔧 Health check: http://localhost:3000/health
    echo.
    echo Para parar o servidor, pressione Ctrl+C
    echo.
    
    REM Verificar se as dependências estão instaladas
    if not exist "node_modules" (
        echo 📦 Instalando dependências...
        npm install
        echo.
    )
    
    echo 🎯 Iniciando servidor Express...
    node server.js
) else (
    echo ❌ Node.js não encontrado.
    echo.
    echo 📋 SOLUÇÕES POSSÍVEIS:
    echo 1. Instale Node.js: https://nodejs.org/downloads
    echo 2. Use uma extensão do VS Code como "Live Server"
    echo 3. Use outro servidor HTTP local de sua preferência
    echo.
    echo 💡 Comandos alternativos:
    echo • python -m http.server 3000 (se Python estiver instalado)
    echo • php -S localhost:3000 (se PHP estiver instalado)
    echo.
    pause
)