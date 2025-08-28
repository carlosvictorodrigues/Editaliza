$env:PGPASSWORD = "1a2b3c4d"

Write-Host "Estrutura da tabela study_sessions:" -ForegroundColor Yellow
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U editaliza_user -d editaliza_db -c "\d study_sessions"