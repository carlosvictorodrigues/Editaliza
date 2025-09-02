/**
 * Obter informações de autenticação do SendGrid
 */

require('dotenv').config();
const axios = require('axios');

async function getSendGridAuth() {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
        console.log('❌ SENDGRID_API_KEY não encontrada');
        return;
    }
    
    console.log('📧 Verificando autenticação do SendGrid...\n');
    
    try {
        // Verificar domínios autenticados
        const response = await axios.get('https://api.sendgrid.com/v3/whitelabel/domains', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📋 Domínios configurados no SendGrid:\n');
        
        if (response.data && response.data.length > 0) {
            response.data.forEach(domain => {
                console.log(`Domain: ${domain.domain}`);
                console.log(`Status: ${domain.valid ? '✅ Verificado' : '❌ Não verificado'}`);
                console.log(`ID: ${domain.id}`);
                
                if (domain.dns) {
                    console.log('\n🔑 Registros DNS necessários:');
                    console.log('─'.repeat(50));
                    
                    Object.keys(domain.dns).forEach(key => {
                        const record = domain.dns[key];
                        if (record.host && record.data) {
                            console.log(`\nTipo: ${record.type}`);
                            console.log(`Host: ${record.host}`);
                            console.log(`Value: ${record.data}`);
                            console.log('─'.repeat(30));
                        }
                    });
                }
                console.log('\n');
            });
        } else {
            console.log('⚠️ Nenhum domínio configurado no SendGrid ainda.\n');
            console.log('📌 PASSOS PARA CONFIGURAR:\n');
            console.log('1. Acesse: https://app.sendgrid.com/settings/sender_auth');
            console.log('2. Clique em "Authenticate Your Domain"');
            console.log('3. Digite: editaliza.com.br');
            console.log('4. Escolha "I would like to brand the links for this domain" = NO');
            console.log('5. O SendGrid fornecerá os registros CNAME para adicionar no DNS');
            console.log('\n💡 Após obter os registros, adicione no DigitalOcean com:');
            console.log('   Type: CNAME');
            console.log('   TTL: 3600');
        }
        
        // Verificar senders autorizados
        console.log('\n📧 Verificando remetentes autorizados...\n');
        
        const sendersResponse = await axios.get('https://api.sendgrid.com/v3/verified_senders', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (sendersResponse.data && sendersResponse.data.results) {
            console.log('Remetentes verificados:');
            sendersResponse.data.results.forEach(sender => {
                console.log(`• ${sender.from_email} - ${sender.verified ? '✅ Verificado' : '❌ Pendente'}`);
            });
        } else {
            console.log('⚠️ Nenhum remetente verificado.');
            console.log('\n📌 ADICIONAR REMETENTE:');
            console.log('1. Acesse: https://app.sendgrid.com/settings/sender_auth/senders');
            console.log('2. Clique em "Verify Single Sender"');
            console.log('3. Adicione: contato@editaliza.com.br');
        }
        
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error('❌ API Key inválida ou sem permissões');
        } else {
            console.error('❌ Erro:', error.message);
        }
    }
}

getSendGridAuth();