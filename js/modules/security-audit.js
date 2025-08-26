/**
 * Sistema de Auditoria de Segurança
 * 
 * Monitora e reporta vulnerabilidades de segurança
 * relacionadas ao armazenamento de dados
 * 
 * @version 1.0.0
 */

class SecurityAudit {
    constructor() {
        this.vulnerabilities = [];
        this.securityLevel = 'unknown';
        this.lastAudit = null;
        this.auditHistory = [];
        
        this.config = {
            alertOnCritical: true,
            logVerbose: true,
            autoRemediate: false,
            auditInterval: 5 * 60 * 1000, // 5 minutos
            maxHistoryEntries: 100
        };
        
        this.init();
    }

    /**
     * Inicializa o sistema de auditoria
     */
    init() {
        console.info('🛡️ Inicializando Sistema de Auditoria de Segurança...');
        
        // Executar primeira auditoria
        this.performAudit();
        
        // Configurar auditoria periódica
        setInterval(() => {
            this.performAudit();
        }, this.config.auditInterval);
        
        // Monitorar tentativas de acesso ao localStorage
        this.monitorLocalStorageAccess();
        
        console.info('✅ Sistema de Auditoria de Segurança ativo');
    }

    /**
     * Executa auditoria completa de segurança
     */
    async performAudit() {
        const auditStart = Date.now();
        this.vulnerabilities = [];
        
        console.log('🔍 Iniciando auditoria de segurança...');
        
        try {
            // Verificar vulnerabilidades do localStorage
            await this.auditLocalStorageVulnerabilities();
            
            // Verificar dados sensíveis não criptografados
            await this.auditUnencryptedSensitiveData();
            
            // Verificar tokens expirados
            await this.auditTokenSecurity();
            
            // Verificar proteções XSS
            await this.auditXSSProtection();
            
            // Verificar integridade de dados
            await this.auditDataIntegrity();
            
            // Verificar configurações de segurança
            await this.auditSecurityConfiguration();
            
            // Calcular nível de segurança
            this.calculateSecurityLevel();
            
            const auditEnd = Date.now();
            const auditResult = {
                timestamp: new Date().toISOString(),
                duration: auditEnd - auditStart,
                vulnerabilitiesFound: this.vulnerabilities.length,
                securityLevel: this.securityLevel,
                vulnerabilities: [...this.vulnerabilities]
            };
            
            // Adicionar ao histórico
            this.auditHistory.unshift(auditResult);
            if (this.auditHistory.length > this.config.maxHistoryEntries) {
                this.auditHistory = this.auditHistory.slice(0, this.config.maxHistoryEntries);
            }
            
            this.lastAudit = auditResult;
            
            // Reportar resultados
            this.reportAuditResults();
            
            // Tentar remediar automaticamente se habilitado
            if (this.config.autoRemediate) {
                await this.autoRemediate();
            }
            
            return auditResult;
            
        } catch (error) {
            console.error('❌ Erro durante auditoria de segurança:', error);
            return null;
        }
    }

    /**
     * Audita vulnerabilidades do localStorage
     */
    async auditLocalStorageVulnerabilities() {
        try {
            const keys = Object.keys(localStorage);
            
            for (const key of keys) {
                const value = localStorage.getItem(key);
                
                // Verificar dados sensíveis em texto plano
                if (this.isSensitiveKey(key) && this.isPlainText(value)) {
                    this.addVulnerability('SENSITIVE_DATA_PLAINTEXT', 'CRITICAL', {
                        key: key,
                        description: `Dados sensíveis armazenados em texto plano: ${key}`,
                        recommendation: 'Migrar para SecureStorage com criptografia'
                    });
                }
                
                // Verificar dados muito grandes
                if (value && value.length > 100000) { // 100KB
                    this.addVulnerability('LARGE_DATA_STORAGE', 'MEDIUM', {
                        key: key,
                        size: value.length,
                        description: `Dados muito grandes no localStorage: ${key} (${value.length} chars)`,
                        recommendation: 'Considerar armazenamento alternativo ou compressão'
                    });
                }
                
                // Verificar possível XSS em dados
                if (this.containsPotentialXSS(value)) {
                    this.addVulnerability('POTENTIAL_XSS_DATA', 'HIGH', {
                        key: key,
                        description: `Possível payload XSS em dados armazenados: ${key}`,
                        recommendation: 'Sanitizar dados antes do armazenamento'
                    });
                }
            }
            
            // Verificar se localStorage está sendo usado diretamente
            if (keys.length > 0 && !this.isSecureStorageInUse()) {
                this.addVulnerability('DIRECT_LOCALSTORAGE_USAGE', 'HIGH', {
                    description: 'localStorage sendo usado diretamente sem criptografia',
                    recommendation: 'Migrar para SecureStorage'
                });
            }
            
        } catch (error) {
            console.error('Erro na auditoria de localStorage:', error);
        }
    }

    /**
     * Audita dados sensíveis não criptografados
     */
    async auditUnencryptedSensitiveData() {
        try {
            const sensitivePatterns = [
                /token/i, /auth/i, /password/i, /secret/i,
                /key/i, /credential/i, /session/i, /jwt/i
            ];
            
            const keys = Object.keys(localStorage);
            
            for (const key of keys) {
                const value = localStorage.getItem(key);
                
                // Verificar se a chave indica dados sensíveis
                const isSensitiveKey = sensitivePatterns.some(pattern => pattern.test(key));
                
                if (isSensitiveKey && value) {
                    // Verificar se parece ser dados não criptografados
                    if (this.isLikelyUnencrypted(value)) {
                        this.addVulnerability('UNENCRYPTED_SENSITIVE_DATA', 'CRITICAL', {
                            key: key,
                            description: `Dados sensíveis não criptografados: ${key}`,
                            recommendation: 'Implementar criptografia para dados sensíveis'
                        });
                    }
                }
                
                // Verificar se o valor contém dados que parecem sensíveis
                if (this.containsSensitivePattern(value)) {
                    this.addVulnerability('SENSITIVE_PATTERN_IN_DATA', 'HIGH', {
                        key: key,
                        description: `Padrão sensível detectado nos dados: ${key}`,
                        recommendation: 'Verificar e criptografar se necessário'
                    });
                }
            }
            
        } catch (error) {
            console.error('Erro na auditoria de dados não criptografados:', error);
        }
    }

    /**
     * Audita segurança de tokens
     */
    async auditTokenSecurity() {
        try {
            const tokenKeys = ['authToken', 'token', 'editaliza_token', 'jwt'];
            
            for (const tokenKey of tokenKeys) {
                const token = localStorage.getItem(tokenKey);
                
                if (token) {
                    // Verificar se o token está expirado
                    if (this.isTokenExpired(token)) {
                        this.addVulnerability('EXPIRED_TOKEN', 'MEDIUM', {
                            key: tokenKey,
                            description: `Token expirado encontrado: ${tokenKey}`,
                            recommendation: 'Remover tokens expirados automaticamente'
                        });
                    }
                    
                    // Verificar se o token é muito antigo (mais de 24 horas)
                    if (this.isTokenTooOld(token)) {
                        this.addVulnerability('OLD_TOKEN', 'MEDIUM', {
                            key: tokenKey,
                            description: `Token muito antigo: ${tokenKey}`,
                            recommendation: 'Implementar renovação automática de tokens'
                        });
                    }
                    
                    // Verificar se o token está em texto plano
                    if (this.isPlainTextJWT(token)) {
                        this.addVulnerability('PLAINTEXT_JWT', 'HIGH', {
                            key: tokenKey,
                            description: `JWT em texto plano: ${tokenKey}`,
                            recommendation: 'Criptografar JWTs no armazenamento local'
                        });
                    }
                }
            }
            
        } catch (error) {
            console.error('Erro na auditoria de tokens:', error);
        }
    }

    /**
     * Audita proteções contra XSS
     */
    async auditXSSProtection() {
        try {
            // Verificar se há dados que poderiam ser usados para XSS
            const keys = Object.keys(localStorage);
            
            for (const key of keys) {
                const value = localStorage.getItem(key);
                
                if (value && this.containsXSSVectors(value)) {
                    this.addVulnerability('XSS_VECTOR_IN_STORAGE', 'HIGH', {
                        key: key,
                        description: `Possível vetor XSS em dados armazenados: ${key}`,
                        recommendation: 'Sanitizar dados antes do armazenamento'
                    });
                }
            }
            
            // Verificar se CSP está configurado
            const metaCsp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            if (!metaCsp) {
                this.addVulnerability('MISSING_CSP', 'MEDIUM', {
                    description: 'Content Security Policy não configurado',
                    recommendation: 'Implementar CSP para prevenir XSS'
                });
            }
            
        } catch (error) {
            console.error('Erro na auditoria de proteção XSS:', error);
        }
    }

    /**
     * Audita integridade de dados
     */
    async auditDataIntegrity() {
        try {
            if (window.secureStorage) {
                // Verificar se há dados com integridade comprometida
                const stats = window.secureStorage.getStorageStats();
                
                if (stats && stats.totalItems > 0) {
                    // Tentar verificar integridade de alguns dados
                    const testKeys = ['token', 'user', 'settings'];
                    
                    for (const key of testKeys) {
                        try {
                            const data = await window.secureStorage.getItem(key);
                            // Se retornou null mas havia dados, pode indicar corrupção
                            if (data === null && localStorage.getItem(`editaliza_secure_${key}`)) {
                                this.addVulnerability('DATA_INTEGRITY_COMPROMISED', 'HIGH', {
                                    key: key,
                                    description: `Possível corrupção de dados: ${key}`,
                                    recommendation: 'Verificar e restaurar dados do backup'
                                });
                            }
                        } catch (error) {
                            this.addVulnerability('DATA_READ_ERROR', 'MEDIUM', {
                                key: key,
                                description: `Erro ao ler dados: ${key}`,
                                recommendation: 'Investigar problemas de armazenamento'
                            });
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Erro na auditoria de integridade:', error);
        }
    }

    /**
     * Audita configurações de segurança
     */
    async auditSecurityConfiguration() {
        try {
            // Verificar se SecureStorage está configurado corretamente
            if (!window.secureStorage) {
                this.addVulnerability('SECURE_STORAGE_NOT_AVAILABLE', 'CRITICAL', {
                    description: 'SecureStorage não está disponível',
                    recommendation: 'Implementar SecureStorage para armazenamento seguro'
                });
            } else {
                const config = window.secureStorage.config;
                
                if (config) {
                    // Verificar TTL de tokens
                    if (config.tokenTTL > 4 * 60 * 60 * 1000) { // Mais de 4 horas
                        this.addVulnerability('TOKEN_TTL_TOO_LONG', 'MEDIUM', {
                            description: `TTL de token muito longo: ${config.tokenTTL}ms`,
                            recommendation: 'Reduzir TTL de tokens para máximo 2 horas'
                        });
                    }
                    
                    // Verificar se proteção XSS está habilitada
                    if (!config.enableXSSProtection) {
                        this.addVulnerability('XSS_PROTECTION_DISABLED', 'HIGH', {
                            description: 'Proteção XSS desabilitada no SecureStorage',
                            recommendation: 'Habilitar proteção XSS'
                        });
                    }
                }
            }
            
            // Verificar HTTPS
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                this.addVulnerability('INSECURE_CONNECTION', 'CRITICAL', {
                    description: 'Conexão não segura (HTTP)',
                    recommendation: 'Usar HTTPS para proteger dados em trânsito'
                });
            }
            
        } catch (error) {
            console.error('Erro na auditoria de configurações:', error);
        }
    }

    /**
     * Adiciona uma vulnerabilidade encontrada
     */
    addVulnerability(type, severity, details) {
        const vulnerability = {
            id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            severity,
            timestamp: new Date().toISOString(),
            ...details
        };
        
        this.vulnerabilities.push(vulnerability);
        
        if (this.config.logVerbose) {
            console.warn(`⚠️ Vulnerabilidade ${severity}:`, vulnerability);
        }
        
        if (this.config.alertOnCritical && severity === 'CRITICAL') {
            console.error(`🚨 VULNERABILIDADE CRÍTICA: ${details.description}`);
        }
    }

    /**
     * Calcula nível geral de segurança
     */
    calculateSecurityLevel() {
        if (this.vulnerabilities.length === 0) {
            this.securityLevel = 'EXCELLENT';
            return;
        }
        
        const critical = this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
        const high = this.vulnerabilities.filter(v => v.severity === 'HIGH').length;
        const medium = this.vulnerabilities.filter(v => v.severity === 'MEDIUM').length;
        const low = this.vulnerabilities.filter(v => v.severity === 'LOW').length;
        
        if (critical > 0) {
            this.securityLevel = 'CRITICAL';
        } else if (high > 2) {
            this.securityLevel = 'POOR';
        } else if (high > 0 || medium > 3) {
            this.securityLevel = 'FAIR';
        } else if (medium > 0 || low > 2) {
            this.securityLevel = 'GOOD';
        } else {
            this.securityLevel = 'EXCELLENT';
        }
    }

    /**
     * Reporta resultados da auditoria
     */
    reportAuditResults() {
        const level = this.securityLevel;
        const count = this.vulnerabilities.length;
        
        const levelEmoji = {
            'EXCELLENT': '🛡️',
            'GOOD': '✅',
            'FAIR': '⚠️',
            'POOR': '⚠️',
            'CRITICAL': '🚨'
        };
        
        const levelColor = {
            'EXCELLENT': 'color: green',
            'GOOD': 'color: lightgreen',
            'FAIR': 'color: yellow',
            'POOR': 'color: orange',
            'CRITICAL': 'color: red'
        };
        
        console.log(`\n🔍 RELATÓRIO DE AUDITORIA DE SEGURANÇA`);
        console.log(`=====================================`);
        console.log(`%c${levelEmoji[level]} Nível de Segurança: ${level}`, levelColor[level]);
        console.log(`📊 Vulnerabilidades encontradas: ${count}`);
        
        if (count > 0) {
            const severityCount = this.vulnerabilities.reduce((acc, v) => {
                acc[v.severity] = (acc[v.severity] || 0) + 1;
                return acc;
            }, {});
            
            Object.entries(severityCount).forEach(([severity, count]) => {
                console.log(`   ${severity}: ${count}`);
            });
            
            console.log('\n🔍 VULNERABILIDADES DETALHADAS:');
            this.vulnerabilities.forEach((v, index) => {
                console.log(`\n${index + 1}. ${v.type} (${v.severity})`);
                console.log(`   ${v.description}`);
                if (v.recommendation) {
                    console.log(`   💡 ${v.recommendation}`);
                }
            });
        }
        
        console.log(`\n⏰ Auditoria realizada: ${new Date().toLocaleString()}`);
    }

    /**
     * Tentativa de remediação automática
     */
    async autoRemediate() {
        if (!this.config.autoRemediate) {
            return;
        }
        
        console.log('🔧 Iniciando remediação automática...');
        let remediated = 0;
        
        for (const vulnerability of this.vulnerabilities) {
            try {
                if (await this.remediateVulnerability(vulnerability)) {
                    remediated++;
                }
            } catch (error) {
                console.error(`Erro ao remediar ${vulnerability.type}:`, error);
            }
        }
        
        console.log(`✅ Remediação automática concluída: ${remediated} vulnerabilidades corrigidas`);
    }

    /**
     * Tenta remediar uma vulnerabilidade específica
     */
    async remediateVulnerability(vulnerability) {
        switch (vulnerability.type) {
            case 'EXPIRED_TOKEN':
                localStorage.removeItem(vulnerability.key);
                console.log(`🧹 Token expirado removido: ${vulnerability.key}`);
                return true;
                
            case 'SENSITIVE_DATA_PLAINTEXT':
                if (window.secureStorage && vulnerability.key) {
                    try {
                        const data = localStorage.getItem(vulnerability.key);
                        await window.secureStorage.setItem(vulnerability.key.replace('editaliza_', ''), data);
                        localStorage.removeItem(vulnerability.key);
                        console.log(`🔒 Dados migrados para SecureStorage: ${vulnerability.key}`);
                        return true;
                    } catch (error) {
                        console.error('Erro na migração automática:', error);
                    }
                }
                break;
                
            default:
                return false;
        }
        
        return false;
    }

    // Métodos utilitários para análise

    isSensitiveKey(key) {
        const sensitivePatterns = ['token', 'auth', 'password', 'secret', 'key', 'credential', 'session'];
        return sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern));
    }

    isPlainText(value) {
        if (!value) return false;
        try {
            // Se conseguir fazer parse JSON, provavelmente não está criptografado
            JSON.parse(value);
            return true;
        } catch {
            // Se não é JSON mas é string legível, provavelmente não está criptografado
            return /^[a-zA-Z0-9\s\-_.,;:!?()[\]{}'"@#$%&*+=<>\/\\|`~]*$/.test(value);
        }
    }

    isLikelyUnencrypted(value) {
        if (!value) return false;
        // Dados criptografados geralmente são base64 ou hex
        const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length % 4 === 0;
        const isHex = /^[a-fA-F0-9]+$/.test(value) && value.length % 2 === 0;
        return !isBase64 && !isHex && value.length > 10;
    }

    containsSensitivePattern(value) {
        if (!value || typeof value !== 'string') return false;
        const patterns = [
            /password\s*[:=]\s*\w+/i,
            /token\s*[:=]\s*\w+/i,
            /secret\s*[:=]\s*\w+/i,
            /api[_-]?key\s*[:=]\s*\w+/i
        ];
        return patterns.some(pattern => pattern.test(value));
    }

    containsPotentialXSS(value) {
        if (!value || typeof value !== 'string') return false;
        const xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe\b/i,
            /<object\b/i,
            /<embed\b/i
        ];
        return xssPatterns.some(pattern => pattern.test(value));
    }

    containsXSSVectors(value) {
        return this.containsPotentialXSS(value);
    }

    isTokenExpired(token) {
        try {
            if (token.includes('.')) { // Parece ser JWT
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload.exp && Date.now() > payload.exp * 1000;
            }
        } catch {
            // Não é JWT válido
        }
        return false;
    }

    isTokenTooOld(token) {
        try {
            if (token.includes('.')) { // Parece ser JWT
                const payload = JSON.parse(atob(token.split('.')[1]));
                const issuedAt = payload.iat * 1000;
                const dayInMs = 24 * 60 * 60 * 1000;
                return payload.iat && Date.now() - issuedAt > dayInMs;
            }
        } catch {
            // Não é JWT válido
        }
        return false;
    }

    isPlainTextJWT(token) {
        return token && token.includes('.') && !this.isBase64Encoded(token);
    }

    isBase64Encoded(str) {
        try {
            return btoa(atob(str)) === str;
        } catch {
            return false;
        }
    }

    isSecureStorageInUse() {
        if (!window.secureStorage) return false;
        const stats = window.secureStorage.getStorageStats();
        return stats && stats.totalItems > 0;
    }

    monitorLocalStorageAccess() {
        if (typeof window === 'undefined') return;
        
        // Interceptar tentativas de acesso direto ao localStorage
        const originalSetItem = localStorage.setItem;
        const originalGetItem = localStorage.getItem;
        
        localStorage.setItem = function(key, value) {
            console.warn(`⚠️ Acesso direto ao localStorage detectado: setItem(${key})`);
            return originalSetItem.call(this, key, value);
        };
        
        localStorage.getItem = function(key) {
            console.debug(`🔍 Acesso direto ao localStorage: getItem(${key})`);
            return originalGetItem.call(this, key);
        };
    }

    /**
     * Obtém relatório completo de segurança
     */
    getSecurityReport() {
        return {
            timestamp: new Date().toISOString(),
            securityLevel: this.securityLevel,
            vulnerabilities: this.vulnerabilities,
            auditHistory: this.auditHistory,
            recommendations: this.getRecommendations()
        };
    }

    /**
     * Obtém recomendações de segurança
     */
    getRecommendations() {
        const recommendations = [];
        
        if (this.vulnerabilities.some(v => v.type === 'SENSITIVE_DATA_PLAINTEXT')) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Migrar dados sensíveis para SecureStorage',
                description: 'Implementar criptografia para todos os dados sensíveis'
            });
        }
        
        if (this.vulnerabilities.some(v => v.type === 'DIRECT_LOCALSTORAGE_USAGE')) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Substituir localStorage por SecureStorage',
                description: 'Usar sistema de armazenamento seguro em toda aplicação'
            });
        }
        
        if (this.vulnerabilities.some(v => v.type.includes('XSS'))) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Implementar proteção contra XSS',
                description: 'Sanitizar dados e implementar CSP'
            });
        }
        
        return recommendations;
    }
}

// Instância singleton
const securityAudit = new SecurityAudit();

// Exportar
export { SecurityAudit, securityAudit };

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
    window.SecurityAudit = SecurityAudit;
    window.securityAudit = securityAudit;
}