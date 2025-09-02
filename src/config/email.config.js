/**
 * Configuração centralizada de email
 * Padrão: Gmail SMTP com suporte@editaliza.com.br
 */

module.exports = {
    // Provedor padrão
    provider: 'gmail',
    
    // Configuração do Gmail
    gmail: {
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER || 'suporte@editaliza.com.br',
            pass: process.env.EMAIL_PASS
        }
    },
    
    // Configuração padrão do remetente
    from: {
        email: 'suporte@editaliza.com.br',
        name: 'Editaliza'
    },
    
    // URLs da aplicação
    urls: {
        app: process.env.APP_URL || 'https://app.editaliza.com.br',
        site: 'https://editaliza.com.br'
    },
    
    // Configurações de retry
    retry: {
        maxAttempts: 3,
        delay: 5000 // 5 segundos
    },
    
    // Templates de email
    templates: {
        colors: {
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#4caf50',
            warning: '#ff9800',
            error: '#f44336',
            text: '#333333',
            textLight: '#666666',
            background: '#f5f5f5'
        },
        footer: {
            text: '© 2025 Editaliza - Transformando sonhos em aprovações',
            unsubscribe: 'Você está recebendo este email porque se cadastrou no Editaliza.'
        }
    },
    
    // Configurações de desenvolvimento
    development: {
        simulateEmails: false, // Set true para simular emails em dev
        logEmails: true,       // Log detalhado dos emails
        testRecipient: 'carlosvictorodrigues@gmail.com' // Email para testes
    }
};