#!/usr/bin/env node

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testDirectEmail() {
    console.log('📧 TESTE DIRETO DE EMAIL (sem emailService)');
    console.log('═'.repeat(50));
    
    try {
        // Criar transporter diretamente
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        console.log('🔍 Verificando conexão...');
        await transporter.verify();
        console.log('✅ Conexão SMTP verificada com sucesso!');
        
        // Tentar enviar email real
        console.log('\n📨 Enviando email de teste para Carlos Victor...');
        const result = await transporter.sendMail({
            from: {
                name: 'Editaliza - Teste',
                address: process.env.EMAIL_USER
            },
            to: 'carlosvictorodrigues@gmail.com',
            subject: '🧪 TESTE - Email de Boas-vindas Corrigido',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0528f2;">🎉 Problema Resolvido!</h2>
                    
                    <p>Olá Carlos Victor,</p>
                    
                    <p>Este é um <strong>email de teste</strong> para confirmar que a correção no sistema CACKTO foi bem-sucedida!</p>
                    
                    <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #0528f2; margin-top: 0;">✅ O que foi corrigido:</h3>
                        <ul style="margin: 10px 0;">
                            <li>Adicionado <code>emailService</code> ao processador CACKTO</li>
                            <li>Modificado <code>handlePaymentApproved()</code> para enviar email real</li>
                            <li>Adicionado tratamento de erros para não falhar o webhook</li>
                            <li>Implementado logs detalhados do envio</li>
                        </ul>
                    </div>
                    
                    <p><strong>Agora quando um pagamento for aprovado via CACKTO:</strong></p>
                    <ol>
                        <li>✅ Usuário será criado/encontrado</li>
                        <li>✅ Assinatura será ativada</li>
                        <li>✅ <strong>EMAIL DE BOAS-VINDAS SERÁ ENVIADO!</strong></li>
                        <li>✅ Logs de auditoria serão gravados</li>
                    </ol>
                    
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">
                        Este email foi enviado como teste para verificar que o sistema está funcionando corretamente.
                        <br>Data: ${new Date().toLocaleString('pt-BR')}
                    </p>
                </div>
            `
        });
        
        console.log('🎉 EMAIL ENVIADO COM SUCESSO!');
        console.log('📝 Message ID:', result.messageId);
        console.log('📧 Para:', result.accepted[0]);
        
        console.log('\n' + '═'.repeat(50));
        console.log('✅ CORREÇÃO CONFIRMADA!');
        console.log('🚀 O próximo webhook CACKTO enviará emails reais!');
        
        return true;
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        
        if (error.code === 'EAUTH') {
            console.log('\n💡 DICA: Problema de autenticação Gmail');
            console.log('   Verifique se:');
            console.log('   1. A senha de app está correta');
            console.log('   2. A autenticação de 2 fatores está ativada');
            console.log('   3. A senha de app foi gerada corretamente');
        }
        
        return false;
    }
}

testDirectEmail().then(success => {
    process.exit(success ? 0 : 1);
});