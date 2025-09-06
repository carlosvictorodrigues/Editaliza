# Configuração de Auto-Deploy via Cron

## Quando conseguir acesso ao servidor, execute:

### 1. Copiar script de deploy
```bash
# No servidor
cd /root/editaliza
mkdir -p deploy
# Copie o conteúdo de auto-deploy.sh para este arquivo
nano deploy/auto-deploy.sh
chmod +x deploy/auto-deploy.sh
```

### 2. Configurar Cron para executar a cada 5 minutos
```bash
# Editar crontab
crontab -e

# Adicionar linha:
*/5 * * * * /root/editaliza/deploy/auto-deploy.sh > /dev/null 2>&1
```

### 3. Criar log rotation
```bash
# Criar arquivo de configuração
cat > /etc/logrotate.d/editaliza-deploy << EOF
/var/log/editaliza-deploy.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF
```

### 4. Testar o script
```bash
# Executar manualmente primeira vez
/root/editaliza/deploy/auto-deploy.sh

# Verificar log
tail -f /var/log/editaliza-deploy.log
```

## Alternativa: Usar systemd timer (mais moderno que cron)

### 1. Criar serviço
```bash
cat > /etc/systemd/system/editaliza-deploy.service << EOF
[Unit]
Description=Editaliza Auto Deploy
After=network.target

[Service]
Type=oneshot
ExecStart=/root/editaliza/deploy/auto-deploy.sh
User=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

### 2. Criar timer
```bash
cat > /etc/systemd/system/editaliza-deploy.timer << EOF
[Unit]
Description=Run Editaliza Auto Deploy every 5 minutes
Requires=editaliza-deploy.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

### 3. Ativar timer
```bash
systemctl daemon-reload
systemctl enable editaliza-deploy.timer
systemctl start editaliza-deploy.timer

# Verificar status
systemctl status editaliza-deploy.timer
systemctl list-timers
```

## Verificação

Para verificar se o auto-deploy está funcionando:

```bash
# Ver últimas execuções
journalctl -u editaliza-deploy.service -n 50

# Ver próximas execuções agendadas
systemctl list-timers --all

# Forçar execução manual
systemctl start editaliza-deploy.service
```

## Segurança

1. **Limitar permissões do script:**
```bash
chmod 700 /root/editaliza/deploy/auto-deploy.sh
chown root:root /root/editaliza/deploy/auto-deploy.sh
```

2. **Adicionar verificação de integridade (opcional):**
```bash
# No script, verificar assinatura dos commits
git verify-commit HEAD || exit 1
```

3. **Notificações de deploy:**
O script já inclui logs. Para notificações por email, adicione:
```bash
echo "Deploy realizado: $(git log -1 --oneline)" | mail -s "Editaliza Deploy" admin@editaliza.com.br
```