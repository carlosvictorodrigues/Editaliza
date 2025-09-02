/**
 * Debug detalhado do SendGrid - Verificar eventos e problemas
 */

require('dotenv').config();
const axios = require('axios');

async function debugSendGrid() {
    console.log('🔍 DEBUG DETALHADO DO SENDGRID\n');
    console.log('═'.repeat(60));
    
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
        console.log('❌ SENDGRID_API_KEY não encontrada');
        return;
    }
    
    // 1. Verificar Events via API
    console.log('📊 1. VERIFICANDO EVENTS API...\n');
    
    try {
        // Buscar eventos recentes
        const eventsResponse = await axios.get('https://api.sendgrid.com/v3/suppression/bounces', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Bounces encontrados:', eventsResponse.data.length);
        if (eventsResponse.data.length > 0) {
            console.log('Emails rejeitados:');
            eventsResponse.data.forEach(bounce => {
                console.log(`  - ${bounce.email}: ${bounce.reason}`);
            });
        }
    } catch (error) {
        console.log('Erro ao buscar bounces:', error.response?.status || error.message);
    }
    
    // 2. Verificar Blocks
    console.log('\n📊 2. VERIFICANDO BLOCKS...\n');
    
    try {
        const blocksResponse = await axios.get('https://api.sendgrid.com/v3/suppression/blocks', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Blocks encontrados:', blocksResponse.data.length);
        if (blocksResponse.data.length > 0) {
            console.log('Emails bloqueados:');
            blocksResponse.data.forEach(block => {
                console.log(`  - ${block.email}: ${block.reason}`);
            });
        }
    } catch (error) {
        console.log('Erro ao buscar blocks:', error.response?.status || error.message);
    }
    
    // 3. Verificar Invalid Emails
    console.log('\n📊 3. VERIFICANDO EMAILS INVÁLIDOS...\n');
    
    try {
        const invalidResponse = await axios.get('https://api.sendgrid.com/v3/suppression/invalid_emails', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Emails inválidos:', invalidResponse.data.length);
        if (invalidResponse.data.length > 0) {
            invalidResponse.data.forEach(invalid => {
                console.log(`  - ${invalid.email}: ${invalid.reason}`);
            });
        }
    } catch (error) {
        console.log('Erro ao buscar inválidos:', error.response?.status || error.message);
    }
    
    // 4. Teste com email simples de texto
    console.log('\n📊 4. TESTE COM EMAIL SIMPLES (TEXTO PURO)...\n');
    
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(apiKey);
    
    const simpleEmail = {
        to: 'carlosvictorodrigues@gmail.com',
        from: 'contato@editaliza.com.br',
        subject: 'Teste Simples - Texto Puro',
        text: 'Este é um teste simples sem HTML.'
    };
    
    try {
        console.log('Enviando email de texto puro...');
        const response = await sgMail.send(simpleEmail);
        console.log('✅ Status:', response[0].statusCode);
        console.log('✅ Message ID:', response[0].headers['x-message-id']);
        
        // Aguardar 3 segundos e verificar status
        console.log('\n⏳ Aguardando 3 segundos para verificar status...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
    } catch (error) {
        console.error('❌ Erro no envio:', error.response?.body || error.message);
    }
    
    // 5. Verificar configuração da conta
    console.log('\n📊 5. VERIFICANDO CONFIGURAÇÃO DA CONTA...\n');
    
    try {
        const userResponse = await axios.get('https://api.sendgrid.com/v3/user/profile', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Perfil da conta:');
        console.log('  Email:', userResponse.data.email);
        console.log('  Username:', userResponse.data.username);
        console.log('  Active:', userResponse.data.active);
        
    } catch (error) {
        console.log('Erro ao buscar perfil:', error.response?.status || error.message);
    }
    
    // 6. Verificar sender authentication
    console.log('\n📊 6. VERIFICANDO SENDER AUTHENTICATION...\n');
    
    try {
        const sendersResponse = await axios.get('https://api.sendgrid.com/v3/verified_senders', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (sendersResponse.data.results) {
            console.log('Remetentes verificados:');
            sendersResponse.data.results.forEach(sender => {
                console.log(`  ${sender.from_email}:`);
                console.log(`    Verificado: ${sender.verified ? '✅' : '❌'}`);
                console.log(`    Locked: ${sender.locked ? 'Sim' : 'Não'}`);
            });
        }
    } catch (error) {
        console.log('Erro ao buscar senders:', error.response?.status || error.message);
    }
    
    // 7. Verificar limites da conta
    console.log('\n📊 7. POSSÍVEIS CAUSAS DO PROBLEMA:\n');
    console.log('─'.repeat(40));
    
    console.log('⚠️ Possíveis causas para "Processing" eterno:');
    console.log('1. Conta SendGrid em modo de revisão (nova conta)');
    console.log('2. Conta suspensa ou com restrições');
    console.log('3. Limite de envio atingido');
    console.log('4. IP do servidor bloqueado pelo SendGrid');
    console.log('5. Problema com verificação do domínio (apesar de mostrar verified)');
    
    console.log('\n💡 RECOMENDAÇÕES:');
    console.log('─'.repeat(40));
    console.log('1. Entre em contato com o suporte do SendGrid');
    console.log('2. Verifique se a conta está ativa no painel do SendGrid');
    console.log('3. Teste com outro provedor (Amazon SES, Mailgun)');
    console.log('4. Verifique se há alertas ou avisos no painel do SendGrid');
    
    console.log('\n📧 ALTERNATIVA IMEDIATA:');
    console.log('─'.repeat(40));
    console.log('Use Gmail SMTP com senha de app enquanto resolve o SendGrid:');
    console.log('1. Acesse: https://myaccount.google.com/apppasswords');
    console.log('2. Crie uma senha de app');
    console.log('3. Configure EMAIL_USER e EMAIL_PASS no .env');
    
    console.log('═'.repeat(60));
}

debugSendGrid();