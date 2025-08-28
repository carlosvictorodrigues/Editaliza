$env:PGPASSWORD = "1a2b3c4d"

Write-Host "Verificando se as sessões existem..." -ForegroundColor Yellow

# Verificar sessões específicas
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U editaliza_user -d editaliza_db -c "SELECT id, plan_id, subject_name, status FROM study_sessions WHERE id IN (507, 508, 509, 510, 511);"

Write-Host "`nVerificando últimas 5 sessões criadas..." -ForegroundColor Yellow
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U editaliza_user -d editaliza_db -c "SELECT id, plan_id, subject_name, status FROM study_sessions ORDER BY id DESC LIMIT 5;"