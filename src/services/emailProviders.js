/**
 * Email Provider Configuration
 * Suporta múltiplos provedores de email para produção
 */

const { createTransport } = require('nodemailer');

class EmailProviders {
    constructor() {
        this.provider = process.env.EMAIL_PROVIDER || 'gmail';
        this.transporter = null;
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Get email configuration based on provider
     */
    getProviderConfig() {
        const configs = {
            // Gmail (atual - funciona bem para baixo volume)
            gmail: {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                tls: {
                    rejectUnauthorized: false
                },
                pool: true,
                maxConnections: 5,
                maxMessages: 100,
                rateDelta: 1000,
                rateLimit: 5
            },

            // SendGrid (recomendado para produção)
            sendgrid: {
                host: 'smtp.sendgrid.net',
                port: 587,
                secure: false,
                auth: {
                    user: 'apikey',
                    pass: process.env.SENDGRID_API_KEY
                },
                pool: true,
                maxConnections: 20,
                maxMessages: 500
            },

            // Amazon SES (melhor custo-benefício para alto volume)
            ses: {
                host: `email-smtp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
                port: 587,
                secure: false,
                auth: {
                    user: process.env.AWS_SES_ACCESS_KEY_ID,
                    pass: process.env.AWS_SES_SECRET_ACCESS_KEY
                },
                pool: true,
                maxConnections: 14,
                maxMessages: 500
            },

            // Mailgun (boa alternativa)
            mailgun: {
                host: process.env.MAILGUN_HOST || 'smtp.mailgun.org',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.MAILGUN_USER,
                    pass: process.env.MAILGUN_PASS
                },
                pool: true,
                maxConnections: 10,
                maxMessages: 100
            },

            // Elastic Email
            elastic: {
                host: 'smtp.elasticemail.com',
                port: 2525,
                secure: false,
                auth: {
                    user: process.env.ELASTIC_EMAIL_USER,
                    pass: process.env.ELASTIC_EMAIL_API_KEY
                },
                pool: true,
                maxConnections: 10,
                maxMessages: 100
            },

            // Microsoft 365 / Outlook
            outlook: {
                host: 'smtp.office365.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.OUTLOOK_USER,
                    pass: process.env.OUTLOOK_PASS
                },
                tls: {
                    ciphers: 'SSLv3'
                },
                pool: true,
                maxConnections: 5,
                maxMessages: 100
            },

            // SMTP genérico (para servidores próprios)
            smtp: {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                pool: true,
                maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS) || 5,
                maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES) || 100
            }
        };

        return configs[this.provider] || configs.gmail;
    }

    /**
     * Initialize transporter with retry logic
     */
    async initializeTransporter() {
        const config = this.getProviderConfig();
        
        // Validate required credentials
        if (!this.validateConfig(config)) {
            console.error(`❌ Email provider ${this.provider} is not properly configured`);
            return null;
        }

        try {
            this.transporter = createTransport(config);
            
            // Verify connection
            await this.verifyConnection();
            
            console.log(`✅ Email provider ${this.provider} initialized successfully`);
            return this.transporter;
        } catch (error) {
            console.error(`❌ Failed to initialize email provider ${this.provider}:`, error.message);
            return null;
        }
    }

    /**
     * Validate provider configuration
     */
    validateConfig(config) {
        if (!config.auth) return false;
        
        switch (this.provider) {
            case 'sendgrid':
                return !!process.env.SENDGRID_API_KEY;
            case 'ses':
                return !!(process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY);
            case 'mailgun':
                return !!(process.env.MAILGUN_USER && process.env.MAILGUN_PASS);
            case 'elastic':
                return !!(process.env.ELASTIC_EMAIL_USER && process.env.ELASTIC_EMAIL_API_KEY);
            case 'outlook':
                return !!(process.env.OUTLOOK_USER && process.env.OUTLOOK_PASS);
            case 'smtp':
                return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
            case 'gmail':
            default:
                return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
        }
    }

    /**
     * Verify email connection
     */
    async verifyConnection() {
        if (!this.transporter) {
            throw new Error('Transporter not initialized');
        }

        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            throw new Error(`Connection verification failed: ${error.message}`);
        }
    }

    /**
     * Send email with retry logic
     */
    async sendMail(mailOptions, attempt = 1) {
        if (!this.transporter) {
            await this.initializeTransporter();
            if (!this.transporter) {
                throw new Error('Email service is not available');
            }
        }

        try {
            const result = await this.transporter.sendMail(mailOptions);
            return { success: true, result };
        } catch (error) {
            console.error(`Email sending attempt ${attempt} failed:`, error.message);

            // Retry logic
            if (attempt < this.retryAttempts) {
                console.log(`Retrying email send... (attempt ${attempt + 1}/${this.retryAttempts})`);
                
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                
                // Try to reinitialize transporter if connection failed
                if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
                    await this.initializeTransporter();
                }
                
                return this.sendMail(mailOptions, attempt + 1);
            }

            throw error;
        }
    }

    /**
     * Get provider recommendations
     */
    static getRecommendations() {
        return {
            development: {
                provider: 'gmail',
                reason: 'Simples de configurar, adequado para testes',
                limit: '500 emails/dia'
            },
            smallProduction: {
                provider: 'sendgrid',
                reason: 'Fácil integração, boa entregabilidade, free tier generoso',
                limit: '100 emails/dia grátis'
            },
            mediumProduction: {
                provider: 'ses',
                reason: 'Melhor custo-benefício, alta entregabilidade',
                limit: '$0.10 por 1000 emails'
            },
            largeProduction: {
                provider: 'ses',
                reason: 'Escala infinita, menor custo por email',
                limit: 'Sem limites, pagamento por uso'
            }
        };
    }

    /**
     * Get provider status
     */
    async getStatus() {
        const status = {
            provider: this.provider,
            configured: false,
            connected: false,
            limits: null
        };

        const config = this.getProviderConfig();
        status.configured = this.validateConfig(config);

        if (status.configured && this.transporter) {
            try {
                await this.verifyConnection();
                status.connected = true;
            } catch (error) {
                status.connected = false;
                status.error = error.message;
            }
        }

        // Add provider-specific limits
        const limits = {
            gmail: { daily: 500, perSecond: 5 },
            sendgrid: { daily: 100, perSecond: 10 }, // Free tier
            ses: { daily: 'unlimited', perSecond: 14 },
            mailgun: { daily: 5000, perSecond: 10 }, // Free tier
            elastic: { daily: 150, perSecond: 5 }, // Free tier
            outlook: { daily: 10000, perSecond: 30 },
            smtp: { daily: 'varies', perSecond: 'varies' }
        };

        status.limits = limits[this.provider] || limits.smtp;

        return status;
    }
}

module.exports = EmailProviders;