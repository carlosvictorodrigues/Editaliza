# 🔒 Política de Segurança - Editaliza

## 🚨 Reportando Vulnerabilidades

Se você descobriu uma vulnerabilidade de segurança, **NÃO crie uma issue pública**.

### Como reportar:
1. Envie um email para: carlosvictorodrigues@gmail.com
2. Assunto: [SEGURANÇA] Vulnerabilidade em Editaliza
3. Inclua:
   - Descrição detalhada da vulnerabilidade
   - Passos para reproduzir
   - Impacto potencial
   - Sugestão de correção (se tiver)

**Responderemos em até 48 horas.**

## ✅ Práticas de Segurança Implementadas

### 🔐 Autenticação e Autorização
- ✅ Tokens JWT com expiração
- ✅ Refresh tokens seguros
- ✅ Bcrypt para hash de senhas (12 rounds)
- ✅ OAuth2 com Google
- ✅ Rate limiting em endpoints de autenticação
- ✅ Proteção contra brute force

### 🛡️ Proteção de Dados
- ✅ Sanitização de inputs (XSS prevention)
- ✅ Queries parametrizadas (SQL Injection prevention)
- ✅ CSRF tokens em todas as requisições
- ✅ Helmet.js para headers de segurança
- ✅ CORS configurado restritivamente

### 📝 Logs e Monitoramento
- ✅ Winston para logs estruturados
- ✅ Logs de segurança separados
- ✅ Sanitização de dados sensíveis em logs
- ✅ Auditoria de tentativas de login

### 🔧 Infraestrutura
- ✅ HTTPS obrigatório em produção
- ✅ Variáveis de ambiente para secrets
- ✅ Backup automático de dados
- ✅ Rate limiting global
- ✅ Validação de tipos com sanitização

## 🚦 Checklist de Segurança para Desenvolvedores

### Antes de cada commit:
- [ ] Nenhum secret hardcoded no código
- [ ] Nenhum console.log com dados sensíveis
- [ ] Inputs validados e sanitizados
- [ ] Queries usando placeholders (?)
- [ ] Endpoints protegidos com autenticação

### Antes de cada PR:
- [ ] npm audit sem vulnerabilidades críticas
- [ ] Testes de segurança passando
- [ ] Code review por outro desenvolvedor
- [ ] Documentação atualizada

### Antes de cada deploy:
- [ ] Variáveis de ambiente configuradas
- [ ] SSL/TLS ativo
- [ ] Backup realizado
- [ ] Logs configurados
- [ ] Monitoramento ativo

## 🔍 Headers de Segurança Configurados

```javascript
// Helmet.js configurado com:
- Content Security Policy (CSP)
- X-DNS-Prefetch-Control
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- X-Download-Options: noopen
- X-XSS-Protection: 1; mode=block
- X-Permitted-Cross-Domain-Policies: none
```

## 📊 Níveis de Severidade

| Nível | Descrição | Tempo de Resposta | Exemplo |
|-------|-----------|-------------------|---------|
| 🔴 **Crítico** | Comprometimento total | 24h | SQL Injection, RCE |
| 🟠 **Alto** | Dados sensíveis expostos | 48h | XSS, Auth bypass |
| 🟡 **Médio** | Funcionalidade comprometida | 1 semana | CSRF, Info disclosure |
| 🟢 **Baixo** | Impacto mínimo | 2 semanas | Missing headers |

## 🛠️ Ferramentas de Segurança Recomendadas

### Para desenvolvedores:
```bash
# Verificar vulnerabilidades
npm audit

# Corrigir automaticamente
npm audit fix

# Verificar secrets no código
npx trufflehog filesystem .

# Lint de segurança
npx eslint-plugin-security

# Verificar dependências desatualizadas
npx npm-check-updates
```

### Para produção:
- **Sentry** - Monitoramento de erros
- **Datadog** - Monitoramento de segurança
- **Cloudflare** - WAF e DDoS protection
- **Let's Encrypt** - SSL/TLS grátis

## 📋 Configurações Mínimas de Segurança

### Variáveis de Ambiente Obrigatórias:
```env
NODE_ENV=production
JWT_SECRET=<mínimo 32 caracteres aleatórios>
JWT_REFRESH_SECRET=<mínimo 32 caracteres aleatórios>
SESSION_SECRET=<mínimo 32 caracteres aleatórios>
```

### Rate Limiting:
```javascript
// Configuração atual:
- Login: 5 tentativas / 15 minutos
- API geral: 100 requisições / 15 minutos
- Password reset: 3 tentativas / hora
```

## 🔄 Processo de Atualização de Segurança

1. **Diariamente**: GitHub Actions verifica vulnerabilidades
2. **Semanalmente**: Review manual de dependências
3. **Mensalmente**: Auditoria completa de segurança
4. **Trimestralmente**: Penetration testing (se possível)

## 📚 Recursos Adicionais

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## 🚨 INCIDENTES DE SEGURANÇA RESOLVIDOS

### 18/08/2025 - Falsos Positivos GitGuardian
- **Problema:** Script `fix_production.sh` continha valores de exemplo que pareciam credenciais reais
- **Detecção:** GitGuardian detectou como "Generic High Entropy Secret" e "SMTP credentials"
- **Solução:** 
  - Arquivo removido do repositório
  - Padrões de exemplo atualizados para usar placeholders mais claros
  - `.env.prod.example` atualizado com valores claramente falsos
- **Status:** ✅ Resolvido - Eram apenas exemplos, não credenciais reais

### 15/08/2025 - Exposição de Credenciais
- **Problema:** Arquivo `.env` com credenciais reais foi commitado acidentalmente
- **Solução:** Credenciais revogadas e regeneradas
- **Status:** ✅ Resolvido

## 🤝 Programa de Bug Bounty

Atualmente não temos um programa formal de bug bounty, mas agradecemos todos os pesquisadores de segurança que reportam vulnerabilidades responsavelmente.

### Hall of Fame
*Lista de pesquisadores que ajudaram a melhorar nossa segurança:*
- GitGuardian (Detecção automática de secrets)
- (Seu nome pode estar aqui!)

## 📞 Contato de Emergência

Para questões urgentes de segurança:
- Email: carlosvictorodrigues@gmail.com
- Resposta garantida: 48 horas

---

**Última atualização**: 15/08/2025  
**Versão**: 1.0  
**Mantido por**: Carlos Victor Rodrigues