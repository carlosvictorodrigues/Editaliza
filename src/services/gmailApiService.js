/**
 * Gmail API Service - Solução definitiva para contornar bloqueio SMTP da DigitalOcean
 * Usa a API do Gmail com OAuth2 para enviar emails de forma segura via HTTPS.
 */

const { google } = require('googleapis');

class GmailApiService {
    constructor() {
        this.gmail = null;
        this.fromEmail = null;
        this.initialize();
    }

    initialize() {
        try {
            if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.EMAIL_USER || !process.env.GOOGLE_REFRESH_TOKEN) {
                console.warn('⚠️ Gmail API Service: Credenciais OAuth2 incompletas. O serviço não será iniciado.');
                return;
            }

            this.fromEmail = process.env.EMAIL_USER;

            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET
            );

            oauth2Client.setCredentials({
                refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
            });

            this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            console.info('✅ Gmail API Service (Método Direto) configurado e pronto.');

        } catch (error) {
            console.error('❌ Erro fatal ao inicializar GmailApiService:', error.message);
        }
    }

    async sendEmail(options) {
        if (!this.gmail) {
            const errorMessage = 'Gmail API Service não foi inicializado. Verifique as credenciais no .env';
            console.error(`❌ ${errorMessage}`);
            return { success: false, error: errorMessage, provider: 'None' };
        }

        // Função para codificar o subject em formato MIME (RFC 2047)
        const encodeSubject = (subject) => {
            // Se contém caracteres não-ASCII, codifica em UTF-8
            // eslint-disable-next-line no-control-regex
            if (!/^[\x00-\x7F]*$/.test(subject)) {
                return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
            }
            return subject;
        };

        // Monta o corpo do email no formato RFC 2822
        const emailLines = [
            `From: "Editaliza" <${this.fromEmail}>`,
            `To: ${options.to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${encodeSubject(options.subject)}`,
            '',
            options.html
        ];
        const email = emailLines.join('\r\n');
        
        // Codifica o email em base64url, como exigido pela API do Gmail
        const base64EncodedEmail = Buffer.from(email, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

        try {
            const res = await this.gmail.users.messages.send({
                userId: 'me', // 'me' refere-se à conta autenticada
                requestBody: {
                    raw: base64EncodedEmail,
                },
            });

            console.info('✅ Email enviado com sucesso via API Direta do Gmail:', res.data.id);
            return { success: true, messageId: res.data.id, provider: 'Gmail API Direct' };

        } catch (error) {
            console.error('❌ Erro ao enviar email via API Direta do Gmail:', error.message);
            if (error.response) {
                console.error('   - Detalhes:', error.response.data);
            }
            return { success: false, error: error.message, provider: 'Gmail API Direct' };
        }
    }
}

module.exports = new GmailApiService();