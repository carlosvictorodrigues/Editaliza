# 🛠️ GUIA DE MANUTENÇÃO - EDITALIZA

## 🚨 PREVENÇÃO DE PROBLEMAS COMUNS

### 1. **Erro: "relation sessions does not exist"**
**Causa:** Tabela de sessões do Express não existe no PostgreSQL  
**Prevenção:**
```bash
# Execute após cada deploy ou migração
node scripts/init-database.js
```

### 2. **Erro: "Headers already sent"**
**Causa:** Múltiplas respostas enviadas em catch blocks  
**Prevenção:** 
- ✅ Sempre use `return` antes de `res.status().json()`
- ✅ Verificar `res.headersSent` antes de enviar resposta
- ✅ Já corrigido em `src/utils/error-handler.js`

### 3. **Restarts excessivos do PM2**
**Causa:** Erros não tratados, memory leaks, configuração inadequada  
**Prevenção:**
```bash
# Verificar status
pm2 status

# Se houver muitos restarts, executar:
node scripts/monitor-and-fix.js
```

---

## 📋 CHECKLIST DE DEPLOY

### Antes do Deploy:
```bash
# 1. Testar localmente
npm test

# 2. Verificar erros de lint
npm run lint

# 3. Testar login
node scripts/health-check.js
```

### Durante o Deploy:
```bash
# 1. Pull das mudanças
git pull origin main

# 2. Instalar dependências (se houver novas)
npm install --production

# 3. Inicializar banco de dados
node scripts/init-database.js

# 4. Restart com PM2
pm2 restart ecosystem.config.js
```

### Após o Deploy:
```bash
# 1. Verificar logs
pm2 logs editaliza-app --lines 50

# 2. Executar health check
node scripts/health-check.js

# 3. Monitorar por 5 minutos
pm2 monit
```

---

## 🔧 COMANDOS ÚTEIS

### Monitoramento:
```bash
# Status geral
pm2 status

# Logs em tempo real
pm2 logs editaliza-app

# Monitoramento de recursos
pm2 monit

# Health check completo
node scripts/health-check.js

# Monitoramento com auto-correção
node scripts/monitor-and-fix.js
```

### Manutenção do Banco:
```bash
# Inicializar/verificar tabelas
node scripts/init-database.js

# Limpar sessões expiradas
psql -U postgres -d editaliza_db -c "DELETE FROM sessions WHERE expire < NOW();"

# Backup do banco
pg_dump -U postgres editaliza_db > backup_$(date +%Y%m%d).sql
```

### Correção de Problemas:
```bash
# Resetar contador de restarts
pm2 reset editaliza-app

# Limpar logs
pm2 flush

# Reiniciar aplicação
pm2 restart editaliza-app

# Recarregar com novas configurações
pm2 reload ecosystem.config.js

# Parar e iniciar limpo
pm2 delete editaliza-app
pm2 start ecosystem.config.js
```

---

## 🤖 AUTOMAÇÃO

### Cron Jobs Recomendados:
```bash
# Adicionar ao crontab (crontab -e)

# Health check a cada 10 minutos
*/10 * * * * /usr/bin/node /root/editaliza/scripts/health-check.js >> /root/editaliza/logs/health.log 2>&1

# Monitoramento com auto-fix a cada hora
0 * * * * /usr/bin/node /root/editaliza/scripts/monitor-and-fix.js >> /root/editaliza/logs/monitor.log 2>&1

# Limpeza de sessões diariamente às 3AM
0 3 * * * /usr/bin/node /root/editaliza/scripts/init-database.js >> /root/editaliza/logs/db-init.log 2>&1

# Backup semanal (domingos às 2AM)
0 2 * * 0 pg_dump -U postgres editaliza_db > /root/backups/editaliza_$(date +\%Y\%m\%d).sql
```

---

## 📊 MÉTRICAS DE SAÚDE

### Indicadores Verdes (Sistema Saudável):
- ✅ Restarts < 5
- ✅ Memória < 400MB
- ✅ CPU < 80%
- ✅ Tempo de resposta < 1s
- ✅ Zero erros nos últimos 10min

### Indicadores Amarelos (Atenção):
- ⚠️ Restarts entre 5-10
- ⚠️ Memória entre 400-500MB
- ⚠️ CPU entre 80-90%
- ⚠️ Tempo de resposta 1-3s
- ⚠️ 1-5 erros nos últimos 10min

### Indicadores Vermelhos (Crítico):
- 🚨 Restarts > 10
- 🚨 Memória > 500MB
- 🚨 CPU > 90%
- 🚨 Tempo de resposta > 3s
- 🚨 Mais de 5 erros nos últimos 10min

---

## 🚑 RECUPERAÇÃO DE EMERGÊNCIA

### Se o sistema estiver completamente fora:
```bash
# 1. Conectar ao servidor
ssh editaliza

# 2. Verificar se o PostgreSQL está rodando
systemctl status postgresql
# Se não estiver: systemctl start postgresql

# 3. Verificar Nginx
systemctl status nginx
# Se não estiver: systemctl start nginx

# 4. Reiniciar PM2
pm2 kill
pm2 start ecosystem.config.js

# 5. Inicializar banco
node scripts/init-database.js

# 6. Verificar saúde
node scripts/health-check.js
```

### Se houver corrupção de dados:
```bash
# 1. Restaurar último backup
psql -U postgres -d editaliza_db < backup_YYYYMMDD.sql

# 2. Reinicializar tabelas
node scripts/init-database.js

# 3. Restart completo
pm2 restart editaliza-app
```

---

## 📞 CONTATOS DE EMERGÊNCIA

- **GitHub:** https://github.com/carlosvictorodrigues/Editaliza
- **Servidor:** 161.35.127.123 (DigitalOcean)
- **Domínio:** app.editaliza.com.br

---

## 📝 HISTÓRICO DE PROBLEMAS RESOLVIDOS

### 21/08/2025 - Sessões e Restarts
- **Problema:** Tabela sessions não existia, causando erros de login
- **Solução:** Criado script init-database.js
- **Prevenção:** Executar init-database após cada deploy

### 21/08/2025 - Headers Already Sent
- **Problema:** Múltiplas respostas em catch blocks
- **Solução:** Adicionado return em todos res.status
- **Prevenção:** Verificar headersSent no error-handler

### 21/08/2025 - 1154+ Restarts
- **Problema:** Memory leak e erros não tratados
- **Solução:** Configuração PM2 mais conservadora
- **Prevenção:** Monitor automático com auto-fix

---

**Última atualização:** 21/08/2025  
**Versão:** 1.0