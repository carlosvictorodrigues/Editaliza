#!/bin/bash

echo "🛠️ Script de Manutenção - Editaliza"
echo ""

while true; do
    echo "Escolha uma opção:"
    echo "1. 🔍 Verificar saúde do sistema"
    echo "2. 🧹 Limpar sessões"
    echo "3. 💾 Fazer backup do banco"
    echo "4. 📊 Verificar logs"
    echo "5. 🔄 Reiniciar servidor"
    echo "6. ❌ Sair"
    echo ""
    read -p "Digite sua escolha (1-6): " choice

    case $choice in
        1)
            echo ""
            echo "🔍 Verificando saúde do sistema..."
            if curl -s http://localhost:3000/health > /dev/null 2>&1; then
                echo "✅ Servidor está rodando"
            else
                echo "❌ Servidor não está rodando"
            fi
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        2)
            echo ""
            echo "🧹 Limpando sessões..."
            if [ -f "sessions.db" ]; then
                rm "sessions.db"
                echo "✅ Sessões limpas"
            else
                echo "ℹ️ Nenhuma sessão para limpar"
            fi
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        3)
            echo ""
            echo "💾 Fazendo backup do banco..."
            if [ -f "db.sqlite" ]; then
                date=$(date +%Y-%m-%d)
                cp "db.sqlite" "db_backup_$date.sqlite"
                echo "✅ Backup criado: db_backup_$date.sqlite"
            else
                echo "❌ Banco de dados não encontrado"
            fi
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        4)
            echo ""
            echo "📊 Verificando logs..."
            if ls *.log > /dev/null 2>&1; then
                ls -la *.log
            else
                echo "ℹ️ Nenhum arquivo de log encontrado"
            fi
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        5)
            echo ""
            echo "🔄 Reiniciando servidor..."
            pkill -f "node server.js" > /dev/null 2>&1
            sleep 2
            nohup node server.js > server.log 2>&1 &
            echo "✅ Servidor reiniciado"
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        6)
            echo ""
            echo "👋 Até logo!"
            exit 0
            ;;
        *)
            echo "❌ Opção inválida"
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
    esac
done 