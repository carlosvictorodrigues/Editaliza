/**
 * Sistema de Templates de Email Padronizado - Editaliza
 * Identidade visual consistente para todos os emails
 */

class EmailTemplates {
    constructor() {
        // Cores da marca (baseadas no CSS do projeto)
        this.colors = {
            primary: '#0528f2',
            primaryDark: '#0422c8',
            primaryLight: '#3654f4',
            gradientStart: '#667eea',
            gradientEnd: '#764ba2',
            success: '#4caf50',
            warning: '#ff9800',
            error: '#f44336',
            text: '#333333',
            textLight: '#666666',
            textMuted: '#999999',
            background: '#f5f5f5',
            white: '#ffffff',
            border: '#e0e0e0'
        };

        // URL do logotipo hospedado
        this.logoUrl = 'https://app.editaliza.com.br/logotipo.png';
        
        // URLs base
        this.urls = {
            app: 'https://app.editaliza.com.br',
            site: 'https://editaliza.com.br',
            support: 'mailto:suporte@editaliza.com.br'
        };
    }

    /**
     * Template base que envolve todos os emails
     */
    baseTemplate(content, options = {}) {
        const {
            preheader = '',
            showSocialLinks = true,
            showUnsubscribe = false,
            unsubscribeToken = null
        } = options;

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>Editaliza</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: ${this.colors.background}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheader}</div>` : ''}
    
    <!-- Container Principal -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${this.colors.background};">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                
                <!-- Card do Email -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: ${this.colors.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
                    
                    <!-- Header Design 4: Padrão Geométrico -->
                    <tr>
                        <td style="background-color: ${this.colors.white}; background-image: repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(102, 126, 234, 0.03) 35px, rgba(102, 126, 234, 0.03) 70px); padding: 40px 40px 35px 40px; text-align: center;">
                            <img src="${this.logoUrl}" alt="Editaliza" style="width: 200px; height: auto; display: inline-block;" />
                        </td>
                    </tr>
                    
                    <!-- Barra gradiente segmentada -->
                    <tr>
                        <td style="padding: 0;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td width="25%" style="height: 3px; background: ${this.colors.gradientStart};"></td>
                                    <td width="25%" style="height: 3px; background: #6b72ec;"></td>
                                    <td width="25%" style="height: 3px; background: #6f66d4;"></td>
                                    <td width="25%" style="height: 3px; background: ${this.colors.gradientEnd};"></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Conteúdo -->
                    <tr>
                        <td style="padding: 40px;">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #fafafa; padding: 30px 40px; border-top: 1px solid ${this.colors.border};">
                            
                            ${showSocialLinks ? this.socialLinks() : ''}
                            
                            <!-- Informações da Empresa -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding-top: 20px;">
                                        <p style="margin: 0; color: ${this.colors.textMuted}; font-size: 12px; line-height: 1.6;">
                                            © 2025 Editaliza - Transformando sonhos em aprovações<br>
                                            Todos os direitos reservados
                                        </p>
                                    </td>
                                </tr>
                                
                                ${showUnsubscribe ? `
                                <tr>
                                    <td align="center" style="padding-top: 15px;">
                                        <p style="margin: 0; color: ${this.colors.textMuted}; font-size: 11px;">
                                            Você está recebendo este email porque se cadastrou no Editaliza.<br>
                                            <a href="${this.urls.app}/unsubscribe?token=${unsubscribeToken}" style="color: ${this.colors.primary}; text-decoration: underline;">
                                                Descadastrar-se dos emails
                                            </a>
                                        </p>
                                    </td>
                                </tr>
                                ` : ''}
                                
                                <tr>
                                    <td align="center" style="padding-top: 15px;">
                                        <p style="margin: 0; color: ${this.colors.textMuted}; font-size: 11px;">
                                            <a href="${this.urls.site}/privacidade" style="color: ${this.colors.textMuted}; text-decoration: underline; margin: 0 10px;">
                                                Política de Privacidade
                                            </a>
                                            |
                                            <a href="${this.urls.site}/termos" style="color: ${this.colors.textMuted}; text-decoration: underline; margin: 0 10px;">
                                                Termos de Uso
                                            </a>
                                            |
                                            <a href="${this.urls.support}" style="color: ${this.colors.textMuted}; text-decoration: underline; margin: 0 10px;">
                                                Suporte
                                            </a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
            </td>
        </tr>
    </table>
</body>
</html>`;
    }

    /**
     * Links para redes sociais
     */
    socialLinks() {
        return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <!-- Instagram -->
                            <td style="padding: 0 10px;">
                                <a href="https://instagram.com/editaliza" style="text-decoration: none;">
                                    <img src="https://img.icons8.com/fluency/48/instagram-new.png" alt="Instagram" width="32" height="32" style="display: block;" />
                                </a>
                            </td>
                            <!-- LinkedIn -->
                            <td style="padding: 0 10px;">
                                <a href="https://linkedin.com/company/editaliza" style="text-decoration: none;">
                                    <img src="https://img.icons8.com/fluency/48/linkedin.png" alt="LinkedIn" width="32" height="32" style="display: block;" />
                                </a>
                            </td>
                            <!-- YouTube -->
                            <td style="padding: 0 10px;">
                                <a href="https://youtube.com/@editaliza" style="text-decoration: none;">
                                    <img src="https://img.icons8.com/fluency/48/youtube-play.png" alt="YouTube" width="32" height="32" style="display: block;" />
                                </a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>`;
    }

    /**
     * Botão de ação padronizado
     */
    actionButton(text, url, variant = 'primary') {
        const styles = {
            primary: {
                background: `linear-gradient(135deg, ${this.colors.gradientStart} 0%, ${this.colors.gradientEnd} 100%)`,
                color: this.colors.white
            },
            success: {
                background: this.colors.success,
                color: this.colors.white
            },
            outline: {
                background: 'transparent',
                color: this.colors.primary,
                border: `2px solid ${this.colors.primary}`
            }
        };

        const style = styles[variant] || styles.primary;

        return `
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 30px auto;">
            <tr>
                <td align="center">
                    <a href="${url}" style="
                        display: inline-block;
                        padding: 14px 32px;
                        background: ${style.background};
                        color: ${style.color};
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 16px;
                        ${style.border ? `border: ${style.border};` : ''}
                        ">
                        ${text}
                    </a>
                </td>
            </tr>
        </table>`;
    }

    /**
     * Card informativo
     */
    infoCard(title, content, icon = '📋', color = null) {
        const bgColor = color || '#f8f9fa';
        const borderColor = color ? this.adjustColor(color, -20) : '#e9ecef';

        return `
        <div style="
            background-color: ${bgColor};
            border-left: 4px solid ${borderColor};
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        ">
            <h3 style="
                margin: 0 0 10px 0;
                color: ${this.colors.text};
                font-size: 16px;
                font-weight: 600;
            ">
                ${icon} ${title}
            </h3>
            <div style="color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6;">
                ${content}
            </div>
        </div>`;
    }

    /**
     * Template: Email de Boas-vindas
     */
    welcomeEmail(userName) {
        const content = `
            <h1 style="margin: 0 0 10px 0; color: ${this.colors.text}; font-size: 28px; font-weight: 700; text-align: center;">
                Bem-vindo ao Editaliza! 🎉
            </h1>
            
            <p style="margin: 0 0 30px 0; color: ${this.colors.textLight}; font-size: 16px; line-height: 1.6; text-align: center;">
                Olá <strong>${userName}</strong>, que alegria ter você conosco!
            </p>
            
            <p style="margin: 0 0 20px 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.8;">
                Sua jornada rumo à aprovação começa agora. O Editaliza foi criado para transformar 
                sua preparação em um processo organizado, eficiente e motivador.
            </p>
            
            ${this.infoCard(
                'Primeiros Passos',
                `
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li style="margin: 5px 0;">Crie seu primeiro plano de estudos personalizado</li>
                    <li style="margin: 5px 0;">Configure suas matérias e tópicos prioritários</li>
                    <li style="margin: 5px 0;">Estabeleça suas metas semanais</li>
                    <li style="margin: 5px 0;">Comece a registrar suas sessões de estudo</li>
                </ul>
                `,
                '🚀',
                '#e3f2fd'
            )}
            
            ${this.actionButton('Acessar Plataforma', this.urls.app)}
            
            ${this.infoCard(
                'Dica do Dia',
                'Consistência é a chave! Estudar um pouco todos os dias é mais eficaz do que longas sessões esporádicas.',
                '💡',
                '#fff3e0'
            )}
            
            <p style="margin: 30px 0 0 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6; text-align: center;">
                Qualquer dúvida, estamos aqui para ajudar!<br>
                <strong>Bons estudos! 📚</strong>
            </p>
        `;

        return this.baseTemplate(content, {
            preheader: 'Sua jornada rumo à aprovação começa agora!',
            showSocialLinks: true
        });
    }

    /**
     * Template: Recuperação de Senha
     */
    passwordRecoveryEmail(userName, resetLink, expirationTime = '1 hora') {
        const content = `
            <h1 style="margin: 0 0 10px 0; color: ${this.colors.text}; font-size: 26px; font-weight: 700; text-align: center;">
                Recuperação de Senha 🔐
            </h1>
            
            <p style="margin: 0 0 30px 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6;">
                Olá <strong>${userName}</strong>,
            </p>
            
            <p style="margin: 0 0 20px 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no Editaliza.
                Se você não fez essa solicitação, pode ignorar este email com segurança.
            </p>
            
            ${this.infoCard(
                'Importante',
                `Este link de recuperação expira em <strong>${expirationTime}</strong> por motivos de segurança.`,
                '⏰',
                '#ffebee'
            )}
            
            ${this.actionButton('Redefinir Minha Senha', resetLink)}
            
            <p style="margin: 30px 0 0 0; color: ${this.colors.textMuted}; font-size: 12px; line-height: 1.6; text-align: center;">
                Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                <a href="${resetLink}" style="color: ${this.colors.primary}; word-break: break-all;">
                    ${resetLink}
                </a>
            </p>
            
            ${this.infoCard(
                'Segurança',
                'Por sua segurança, nunca compartilhe este link com outras pessoas.',
                '🔒',
                '#f3e5f5'
            )}
        `;

        return this.baseTemplate(content, {
            preheader: 'Solicitação de redefinição de senha',
            showSocialLinks: false
        });
    }

    /**
     * Template: Cronograma Diário
     */
    dailyScheduleEmail(userName, schedule, stats = {}) {
        const today = new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        });

        const content = `
            <h1 style="margin: 0 0 10px 0; color: ${this.colors.text}; font-size: 26px; font-weight: 700; text-align: center;">
                Seu Cronograma de Hoje 📅
            </h1>
            
            <p style="margin: 0 0 30px 0; color: ${this.colors.textLight}; font-size: 14px; text-align: center;">
                ${today}
            </p>
            
            <p style="margin: 0 0 20px 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6;">
                Bom dia, <strong>${userName}</strong>! ☀️
            </p>
            
            ${stats.streak ? `
            <div style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, ${this.colors.gradientStart}, ${this.colors.gradientEnd}); color: white; padding: 15px 30px; border-radius: 50px; font-weight: 600;">
                    🔥 ${stats.streak} dias de sequência!
                </div>
            </div>
            ` : ''}
            
            ${schedule}
            
            ${stats.todayGoal ? this.infoCard(
                'Meta de Hoje',
                `Complete ${stats.todayGoal} tópicos para manter seu ritmo ideal!`,
                '🎯',
                '#e8f5e9'
            ) : ''}
            
            ${this.actionButton('Iniciar Estudos', this.urls.app)}
            
            ${this.infoCard(
                'Frase Motivacional',
                '"O sucesso é a soma de pequenos esforços repetidos dia após dia." - Robert Collier',
                '✨',
                '#fff8e1'
            )}
            
            <p style="margin: 30px 0 0 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6; text-align: center;">
                Tenha um dia produtivo! 💪
            </p>
        `;

        return this.baseTemplate(content, {
            preheader: 'Seu cronograma de estudos está pronto!',
            showSocialLinks: false,
            showUnsubscribe: true,
            unsubscribeToken: stats.unsubscribeToken
        });
    }

    /**
     * Template: Resumo Semanal
     */
    weeklyReportEmail(userName, weekData) {
        const content = `
            <h1 style="margin: 0 0 10px 0; color: ${this.colors.text}; font-size: 26px; font-weight: 700; text-align: center;">
                Resumo Semanal 📊
            </h1>
            
            <p style="margin: 0 0 30px 0; color: ${this.colors.textLight}; font-size: 14px; text-align: center;">
                Semana de ${weekData.startDate} a ${weekData.endDate}
            </p>
            
            <p style="margin: 0 0 20px 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6;">
                Olá <strong>${userName}</strong>, veja como foi sua semana:
            </p>
            
            <!-- Estatísticas em Cards -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                <tr>
                    <td width="48%" style="padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; font-weight: 700; color: ${this.colors.primary};">
                            ${weekData.totalHours}h
                        </div>
                        <div style="font-size: 12px; color: ${this.colors.textMuted}; margin-top: 5px;">
                            Horas Estudadas
                        </div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; font-weight: 700; color: ${this.colors.success};">
                            ${weekData.topicsCompleted}
                        </div>
                        <div style="font-size: 12px; color: ${this.colors.textMuted}; margin-top: 5px;">
                            Tópicos Concluídos
                        </div>
                    </td>
                </tr>
            </table>
            
            ${weekData.bestDay ? this.infoCard(
                'Melhor Dia',
                `${weekData.bestDay.name} - ${weekData.bestDay.hours}h de estudo`,
                '🏆',
                '#e8f5e9'
            ) : ''}
            
            ${weekData.improvement ? this.infoCard(
                'Evolução',
                weekData.improvement,
                '📈',
                '#e3f2fd'
            ) : ''}
            
            ${this.actionButton('Ver Relatório Completo', `${this.urls.app}/relatorios`)}
            
            <p style="margin: 30px 0 0 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6; text-align: center;">
                Continue assim! Cada semana te aproxima mais do seu objetivo! 🎯
            </p>
        `;

        return this.baseTemplate(content, {
            preheader: 'Veja seu progresso da semana',
            showSocialLinks: true,
            showUnsubscribe: true,
            unsubscribeToken: weekData.unsubscribeToken
        });
    }

    /**
     * Template: Lembrete de Estudo
     */
    studyReminderEmail(userName, sessionInfo) {
        const content = `
            <h1 style="margin: 0 0 10px 0; color: ${this.colors.text}; font-size: 26px; font-weight: 700; text-align: center;">
                Hora de Estudar! ⏰
            </h1>
            
            <p style="margin: 0 0 30px 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6;">
                Olá <strong>${userName}</strong>,
            </p>
            
            <p style="margin: 0 0 20px 0; color: ${this.colors.textLight}; font-size: 14px; line-height: 1.6;">
                Está na hora da sua sessão de estudos! Preparamos tudo para você:
            </p>
            
            ${this.infoCard(
                'Próxima Sessão',
                `
                <strong>Matéria:</strong> ${sessionInfo.subject}<br>
                <strong>Tópico:</strong> ${sessionInfo.topic}<br>
                <strong>Duração Prevista:</strong> ${sessionInfo.duration} minutos
                `,
                '📚',
                '#e3f2fd'
            )}
            
            ${this.actionButton('Iniciar Sessão', `${this.urls.app}/sessao`)}
            
            ${this.infoCard(
                'Dica Rápida',
                'Desligue as notificações do celular e foque 100% no seu estudo!',
                '💡',
                '#fff3e0'
            )}
        `;

        return this.baseTemplate(content, {
            preheader: 'Sua sessão de estudos está programada',
            showSocialLinks: false
        });
    }

    /**
     * Função auxiliar para ajustar cor (clarear/escurecer)
     */
    adjustColor(color, amount) {
        const num = parseInt(color.replace('#', ''), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
}

module.exports = new EmailTemplates();