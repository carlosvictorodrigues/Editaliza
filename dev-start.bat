@echo off
echo 🚀 Iniciando servidor Editaliza em modo desenvolvimento...
echo.

REM Verificar se Node.js está disponível
node --version >NUL 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js não encontrado. Instale em: https://nodejs.org/downloads
    pause
    exit /b 1
)

REM Verificar se nodemon está instalado
npx nodemon --version >NUL 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 📦 Instalando nodemon...
    npm install -g nodemon
)

echo ✅ Dependências verificadas
echo.
echo 🌐 Servidor rodando em: http://localhost:3000
echo 🔧 Health check: http://localhost:3000/health
echo 📊 Dashboard: http://localhost:3000/dashboard.html
echo.
echo 🎯 Modo desenvolvimento ativo
echo 📝 Alterações serão recarregadas automaticamente
echo.
echo Para parar o servidor, pressione Ctrl+C
echo.

REM Iniciar em modo desenvolvimento
npx nodemon server.js --ignore "*.test.js" --ignore "tests/*" 