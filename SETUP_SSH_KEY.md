# 🔐 Configurar Chave SSH (Evitar Digitar Senha)

## Opção 1: Usar Git Bash (Recomendado)

1. Abra o **Git Bash**
2. Execute os comandos:

```bash
# Gerar chave SSH (se não tiver)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/editaliza_key -N ""

# Copiar chave pública para o servidor
# (vai pedir a senha uma última vez)
ssh-copy-id -i ~/.ssh/editaliza_key.pub root@161.35.127.123

# Configurar SSH para usar a chave
echo "Host editaliza
    HostName 161.35.127.123
    User root
    IdentityFile ~/.ssh/editaliza_key" >> ~/.ssh/config

# Testar conexão sem senha
ssh editaliza "echo 'Funcionou sem senha!'"
```

## Opção 2: Usar PuTTY/Pageant (Windows)

1. Baixe o **PuTTY** e **PuTTYgen**
2. Gere uma chave com PuTTYgen
3. Copie a chave pública para o servidor
4. Use Pageant para carregar a chave privada

## Opção 3: Script Temporário com sshpass

⚠️ **MENOS SEGURO - Use apenas para testes**

```powershell
# No PowerShell como Admin
# Instalar sshpass via WSL ou Git Bash
apt-get install sshpass

# Criar script
echo 'sshpass -p "Edital@2301" ssh root@161.35.127.123 "$@"' > ssh-editaliza.sh
chmod +x ssh-editaliza.sh

# Usar
./ssh-editaliza.sh "pm2 list"
```

## 📝 Depois de Configurar

Use o script de diagnóstico sem precisar digitar senha:

```bash
ssh editaliza 'bash -s' < fix_auth_remote.sh
```

---

**Recomendação**: Use a Opção 1 com Git Bash para máxima segurança e conveniência.