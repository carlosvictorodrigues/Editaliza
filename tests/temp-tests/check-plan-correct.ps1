$env:PGPASSWORD = "1a2b3c4d"

Write-Host "Verificando dono do plano 32..." -ForegroundColor Yellow
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U editaliza_user -d editaliza_db -c "SELECT id, user_id, plan_name FROM study_plans WHERE id = 32;"