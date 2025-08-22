# 🤝 GUIA DE ACESSO PARA PARCEIRO - EDITALIZA

## 🎯 **RESUMO DO QUE FOI IMPLEMENTADO**

Foi criado um **Dashboard Administrativo Profissional** completo para monitoramento do negócio, totalmente funcional e seguro.

---

## 🌐 **ACESSOS DISPONÍVEIS**

### **🔗 SITE PRINCIPAL (USUÁRIOS)**
- **URL:** https://app.editaliza.com.br
- **Status:** ✅ Online e funcionando normalmente
- **Tecnologia:** Node.js + PostgreSQL

### **📊 DASHBOARD ADMINISTRATIVO (EXECUTIVO)**  
- **URL:** https://admin.editaliza.com.br
- **Senha:** `Edital@2301`
- **Status:** ✅ Online e operacional
- **Funcionalidades:**
  - Monitoramento de usuários em tempo real
  - Métricas de negócio (conversão, crescimento)
  - Sistema de auditoria completo
  - Apenas leitura (não modifica dados)

---

## 🔧 **ACESSO TÉCNICO AO SERVIDOR**

### **SSH para DigitalOcean:**
```bash
ssh root@161.35.127.123
```

### **Estrutura do Servidor:**
```
/root/editaliza/                    # Código principal
├── server.js                       # Aplicação principal (porta 3000)
├── admin-dashboard-production.js   # Dashboard admin (porta 3001)
├── database-postgresql.js          # Conexão com banco
├── .env                            # Variáveis de ambiente
└── logs/                           # Logs do sistema
    ├── admin-audit.log             # Auditoria do dashboard
    └── pm2 logs                    # Logs das aplicações
```

### **Processos Rodando (PM2):**
```bash
pm2 status          # Ver status de todos os processos
pm2 logs            # Ver logs em tempo real
pm2 restart all     # Reiniciar tudo se necessário
pm2 monit          # Monitor interativo
```

---

## 🚀 **DESENVOLVIMENTO LOCAL**

### **Clonar Repositório:**
```bash
git clone https://github.com/carlosvictorodrigues/Editaliza.git
cd Editaliza
npm install
```

### **Configurar Ambiente Local:**
```bash
cp .env.example .env
# Editar .env com suas configurações locais
npm run dev
```

### **Testar Dashboard Localmente:**
```bash
node admin-dashboard-safe.js
# Acessar: http://localhost:3002
# Senha: Edital@2301
```

---

## 📊 **MONITORAMENTO E MÉTRICAS**

### **Dashboard Executivo - O que você pode ver:**

#### **📈 Visão Geral**
- Total de usuários cadastrados
- Usuários ativos nos últimos 30 dias  
- Taxa de conversão free → premium
- Crescimento mensal do negócio

#### **👥 Gestão de Usuários**
- Lista completa de usuários
- Busca por email/nome/ID
- Status: Premium, Ativo, Novo
- Último acesso de cada usuário

#### **💰 Métricas de Negócio** 
- Receita mensal estimada
- Crescimento de assinaturas
- Taxa de cancelamento
- Valor por usuário (LTV)

#### **⚙️ Sistema Técnico**
- Status do servidor e banco
- Uptime da aplicação
- Performance em tempo real
- Logs de auditoria

---

## 🛡️ **SEGURANÇA IMPLEMENTADA**

### **Dashboard Administrativo:**
- ✅ HTTPS obrigatório com SSL válido
- ✅ Autenticação por senha segura
- ✅ Auditoria completa de acessos
- ✅ Sessões com timeout automático
- ✅ Rate limiting anti-brute force
- ✅ Apenas leitura (zero risco para produção)

### **Servidor:**
- ✅ Firewall configurado
- ✅ SSL certificates auto-renováveis
- ✅ Backup automático de configurações
- ✅ Logs de segurança ativos

---

## 🔄 **FLUXO DE TRABALHO RECOMENDADO**

### **Para Desenvolvimento:**
1. Trabalhar sempre em branch separada
2. Testar localmente antes de deploy
3. Fazer commit com mensagens descritivas
4. Deploy via SSH para produção

### **Para Deploy Seguro:**
```bash
# 1. No seu ambiente local
git pull origin master
git checkout -b nova-feature
# ... desenvolver ...
git add .
git commit -m "feat: descrição da mudança"
git push origin nova-feature

# 2. No servidor (após merge)
ssh root@161.35.127.123
cd /root/editaliza
git pull origin master
pm2 restart all
```

---

## 📞 **COMANDOS ÚTEIS PARA EMERGÊNCIA**

### **Se site principal parar:**
```bash
ssh root@161.35.127.123
pm2 restart editaliza-app
pm2 logs editaliza-app
```

### **Se dashboard admin parar:**
```bash
ssh root@161.35.127.123
pm2 restart editaliza-admin-dashboard
pm2 logs editaliza-admin-dashboard
```

### **Ver logs de auditoria:**
```bash
ssh root@161.35.127.123
tail -f /root/editaliza/logs/admin-audit.log
```

### **Backup manual:**
```bash
ssh root@161.35.127.123
cd /root/editaliza
tar -czf backup-$(date +%Y%m%d).tar.gz .
```

---

## 🎯 **PRÓXIMOS PASSOS SUGERIDOS**

1. **Testar dashboard** executivo completo
2. **Familiarizar com métricas** disponíveis
3. **Configurar alertas** por email (futuro)
4. **Expandir analytics** conforme necessário
5. **Integrar sistema de pagamentos** quando pronto

---

## 🆘 **CONTATOS DE EMERGÊNCIA**

### **Fornecedores:**
- **Servidor:** DigitalOcean (suporte 24/7)
- **Domínio:** Registro.br
- **SSL:** Let's Encrypt (auto-renovável)

### **Repositório:**
- **GitHub:** https://github.com/carlosvictorodrigues/Editaliza
- **Branch principal:** master

---

## ✅ **CHECKLIST FINAL - TUDO FUNCIONANDO**

- [x] **Site principal:** https://app.editaliza.com.br ✅
- [x] **Dashboard admin:** https://admin.editaliza.com.br ✅
- [x] **SSL configurado:** Certificados válidos ✅
- [x] **Banco conectado:** PostgreSQL operacional ✅
- [x] **Backups ativos:** PM2 + Git sincronizado ✅
- [x] **Logs funcionando:** Auditoria e monitoramento ✅

---

**Última atualização:** 22/08/2025  
**Status:** ✅ Ambiente 100% operacional e seguro  
**Configurado por:** Claude Code Assistant