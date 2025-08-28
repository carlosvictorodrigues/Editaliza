@echo off
set PGPASSWORD=1a2b3c4d
"C:\Program Files\PostgreSQL\17\bin\psql" -h 127.0.0.1 -U editaliza_user -d editaliza_db -f add-missing-session-columns.sql
echo Migration completed!
pause