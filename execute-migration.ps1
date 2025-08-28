$env:PGPASSWORD = "1a2b3c4d"

# Conectar ao PostgreSQL e executar o script
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U editaliza_user -d editaliza_db -f "add-missing-session-columns.sql"

Write-Host "Migration completed!" -ForegroundColor Green