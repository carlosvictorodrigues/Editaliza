/**
 * SecureStorage - Sistema de Armazenamento Seguro
 * 
 * Substitui o uso direto do localStorage com:
 * - Criptografia AES-256
 * - Validação e sanitização
 * - Expiração automática de tokens
 * - Proteção contra XSS
 * - Verificação de integridade
 * 
 * @version 1.0.0
 * @author Claude Code
 */

class SecureStorage {
    constructor() {
        this.prefix = 'editaliza_secure_';
        this.version = '1.0.0';
        this.keySize = 256;
        this.ivSize = 16;
        
        // Gerar chave de criptografia única por sessão
        this.encryptionKey = this.generateSessionKey();
        
        // Configurações de segurança
        this.config = {
            defaultTTL: 24 * 60 * 60 * 1000, // 24 horas
            tokenTTL: 2 * 60 * 60 * 1000,    // 2 horas para tokens
            maxRetries: 3,
            enableIntegrityCheck: true,
            enableXSSProtection: true
        };
        
        // Dados sensíveis que requerem criptografia
        this.sensitiveKeys = [
            'token', 'authToken', 'refreshToken', 'password',
            'sessionId', 'user', 'credentials', 'apiKey'
        ];
        
        this.initSecurityMeasures();
    }

    /**
     * Inicializa medidas de segurança
     */
    initSecurityMeasures() {
        // Verificar se o ambiente é seguro
        if (this.isEnvironmentCompromised()) {
            console.warn('🔒 SecureStorage: Ambiente potencialmente comprometido');
            this.enableSecurityMode();
        }

        // Limpar dados expirados na inicialização
        this.cleanExpiredData();
        
        // Configurar limpeza automática
        setInterval(() => {
            this.cleanExpiredData();
        }, 60 * 1000); // A cada minuto
    }

    /**
     * Gera chave de criptografia única por sessão
     */
    generateSessionKey() {
        const array = new Uint8Array(32); // 256 bits
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Verifica se o ambiente está comprometido
     */
    isEnvironmentCompromised() {
        try {
            // Verificar tentativas de manipulação do localStorage
            const testKey = '__security_test__';
            const testValue = 'test_value';
            
            localStorage.setItem(testKey, testValue);
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            if (retrieved !== testValue) {
                return true;
            }

            // Verificar se há scripts maliciosos injetados
            const suspiciousPatterns = [
                'eval(', 'document.write(', 'innerHTML =', 
                'outerHTML =', 'document.cookie'
            ];
            
            const scripts = document.querySelectorAll('script');
            for (let script of scripts) {
                const content = script.textContent || script.innerText || '';
                for (let pattern of suspiciousPatterns) {
                    if (content.includes(pattern)) {
                        console.warn('🚨 Padrão suspeito detectado:', pattern);
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Erro na verificação de segurança:', error);
            return true;
        }
    }

    /**
     * Ativa modo de segurança reforçada
     */
    enableSecurityMode() {
        this.config.enableXSSProtection = true;
        this.config.enableIntegrityCheck = true;
        this.config.tokenTTL = 30 * 60 * 1000; // Reduzir TTL para 30 minutos
        console.info('🛡️ Modo de segurança reforçada ativado');
    }

    /**
     * Criptografa dados usando Web Crypto API
     */
    async encrypt(data) {
        try {
            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(this.encryptionKey.slice(0, 32)),
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );

            const iv = crypto.getRandomValues(new Uint8Array(this.ivSize));
            const encodedData = new TextEncoder().encode(JSON.stringify(data));
            
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encodedData
            );

            // Combinar IV + dados criptografados
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encrypted), iv.length);

            return btoa(String.fromCharCode(...result));
        } catch (error) {
            console.error('Erro na criptografia:', error);
            throw new Error('Falha na criptografia dos dados');
        }
    }

    /**
     * Descriptografa dados
     */
    async decrypt(encryptedData) {
        try {
            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(this.encryptionKey.slice(0, 32)),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            const data = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );
            
            const iv = data.slice(0, this.ivSize);
            const encrypted = data.slice(this.ivSize);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );

            const jsonString = new TextDecoder().decode(decrypted);
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Erro na descriptografia:', error);
            throw new Error('Falha na descriptografia dos dados');
        }
    }

    /**
     * Sanitiza dados para prevenir XSS
     */
    sanitizeData(data) {
        if (!this.config.enableXSSProtection) {
            return data;
        }

        if (typeof data === 'string') {
            return data
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '');
        }

        if (typeof data === 'object' && data !== null) {
            const sanitized = Array.isArray(data) ? [] : {};
            for (let key in data) {
                sanitized[key] = this.sanitizeData(data[key]);
            }
            return sanitized;
        }

        return data;
    }

    /**
     * Valida dados de entrada
     */
    validateData(key, data) {
        if (!key || typeof key !== 'string') {
            throw new Error('Chave inválida');
        }

        if (key.length > 100) {
            throw new Error('Chave muito longa');
        }

        // Validar tamanho dos dados
        const dataSize = JSON.stringify(data).length;
        if (dataSize > 1024 * 1024) { // 1MB
            throw new Error('Dados muito grandes para armazenamento');
        }

        return true;
    }

    /**
     * Gera hash de integridade
     */
    async generateIntegrityHash(data) {
        if (!this.config.enableIntegrityCheck) {
            return null;
        }

        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Erro ao gerar hash de integridade:', error);
            return null;
        }
    }

    /**
     * Verifica integridade dos dados
     */
    async verifyIntegrity(data, expectedHash) {
        if (!this.config.enableIntegrityCheck || !expectedHash) {
            return true;
        }

        try {
            const actualHash = await this.generateIntegrityHash(data);
            return actualHash === expectedHash;
        } catch (error) {
            console.error('Erro na verificação de integridade:', error);
            return false;
        }
    }

    /**
     * Determina TTL baseado no tipo de dados
     */
    getTTL(key) {
        // Tokens têm TTL menor por segurança
        if (this.sensitiveKeys.some(sensitiveKey => 
            key.toLowerCase().includes(sensitiveKey.toLowerCase()))) {
            return this.config.tokenTTL;
        }
        return this.config.defaultTTL;
    }

    /**
     * Verifica se a chave contém dados sensíveis
     */
    isSensitiveData(key) {
        return this.sensitiveKeys.some(sensitiveKey => 
            key.toLowerCase().includes(sensitiveKey.toLowerCase()));
    }

    /**
     * Armazena dados de forma segura
     */
    async setItem(key, data, options = {}) {
        try {
            this.validateData(key, data);
            
            const sanitizedData = this.sanitizeData(data);
            const ttl = options.ttl || this.getTTL(key);
            const expiration = Date.now() + ttl;
            
            const integrityHash = await this.generateIntegrityHash(sanitizedData);
            
            const envelope = {
                data: sanitizedData,
                timestamp: Date.now(),
                expiration,
                version: this.version,
                integrity: integrityHash,
                sensitive: this.isSensitiveData(key)
            };

            let serializedData;
            
            // Criptografar dados sensíveis
            if (envelope.sensitive) {
                serializedData = await this.encrypt(envelope);
            } else {
                serializedData = btoa(JSON.stringify(envelope));
            }

            const storageKey = this.prefix + key;
            localStorage.setItem(storageKey, serializedData);
            
            console.debug(`🔒 Dados armazenados com segurança: ${key}`);
            return true;

        } catch (error) {
            console.error(`Erro ao armazenar ${key}:`, error);
            throw error;
        }
    }

    /**
     * Recupera dados de forma segura
     */
    async getItem(key) {
        try {
            const storageKey = this.prefix + key;
            const stored = localStorage.getItem(storageKey);
            
            if (!stored) {
                return null;
            }

            let envelope;
            
            // Determinar se os dados são sensíveis e descriptografar se necessário
            try {
                if (this.isSensitiveData(key)) {
                    envelope = await this.decrypt(stored);
                } else {
                    envelope = JSON.parse(atob(stored));
                }
            } catch (decryptError) {
                console.warn(`Erro ao descriptografar ${key}, removendo dados corrompidos`);
                this.removeItem(key);
                return null;
            }

            // Verificar versão
            if (envelope.version !== this.version) {
                console.warn(`Versão incompatível para ${key}, removendo dados antigos`);
                this.removeItem(key);
                return null;
            }

            // Verificar expiração
            if (envelope.expiration && Date.now() > envelope.expiration) {
                console.debug(`Dados expirados para ${key}, removendo`);
                this.removeItem(key);
                return null;
            }

            // Verificar integridade
            const integrityValid = await this.verifyIntegrity(envelope.data, envelope.integrity);
            if (!integrityValid) {
                console.warn(`Integridade comprometida para ${key}, removendo dados`);
                this.removeItem(key);
                return null;
            }

            return envelope.data;

        } catch (error) {
            console.error(`Erro ao recuperar ${key}:`, error);
            return null;
        }
    }

    /**
     * Remove item do armazenamento
     */
    removeItem(key) {
        try {
            const storageKey = this.prefix + key;
            localStorage.removeItem(storageKey);
            console.debug(`🗑️ Item removido: ${key}`);
            return true;
        } catch (error) {
            console.error(`Erro ao remover ${key}:`, error);
            return false;
        }
    }

    /**
     * Limpa todos os dados do SecureStorage
     */
    clear() {
        try {
            const keys = Object.keys(localStorage);
            let removed = 0;
            
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                    removed++;
                }
            });
            
            console.info(`🧹 SecureStorage limpo: ${removed} itens removidos`);
            return removed;
        } catch (error) {
            console.error('Erro ao limpar SecureStorage:', error);
            return 0;
        }
    }

    /**
     * Remove dados expirados
     */
    cleanExpiredData() {
        try {
            const keys = Object.keys(localStorage);
            let cleaned = 0;
            
            keys.forEach(async key => {
                if (key.startsWith(this.prefix)) {
                    const originalKey = key.replace(this.prefix, '');
                    const data = await this.getItem(originalKey);
                    
                    // getItem já remove dados expirados automaticamente
                    if (data === null && localStorage.getItem(key)) {
                        localStorage.removeItem(key);
                        cleaned++;
                    }
                }
            });
            
            if (cleaned > 0) {
                console.debug(`🧹 Dados expirados limpos: ${cleaned} itens`);
            }
            
            return cleaned;
        } catch (error) {
            console.error('Erro na limpeza de dados expirados:', error);
            return 0;
        }
    }

    /**
     * Obtém estatísticas do armazenamento
     */
    getStorageStats() {
        try {
            const keys = Object.keys(localStorage);
            const secureKeys = keys.filter(key => key.startsWith(this.prefix));
            
            let totalSize = 0;
            let sensitiveCount = 0;
            let expiredCount = 0;
            
            secureKeys.forEach(key => {
                const data = localStorage.getItem(key);
                totalSize += data.length;
                
                const originalKey = key.replace(this.prefix, '');
                if (this.isSensitiveData(originalKey)) {
                    sensitiveCount++;
                }
            });
            
            return {
                totalItems: secureKeys.length,
                totalSize: totalSize,
                sensitiveItems: sensitiveCount,
                expiredItems: expiredCount,
                version: this.version
            };
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            return null;
        }
    }

    /**
     * Migra dados do localStorage tradicional
     */
    async migrateFromLocalStorage(keyMappings = {}) {
        try {
            let migrated = 0;
            const keys = Object.keys(localStorage);
            
            for (let key of keys) {
                // Pular chaves já do SecureStorage
                if (key.startsWith(this.prefix)) {
                    continue;
                }
                
                // Verificar se é uma chave do Editaliza
                if (key.startsWith('editaliza_') || keyMappings[key]) {
                    const data = localStorage.getItem(key);
                    const newKey = keyMappings[key] || key.replace('editaliza_', '');
                    
                    try {
                        // Tentar fazer parse dos dados
                        const parsedData = JSON.parse(data);
                        await this.setItem(newKey, parsedData);
                        
                        // Remover dados antigos após migração bem-sucedida
                        localStorage.removeItem(key);
                        migrated++;
                        
                        console.debug(`📦 Migrado: ${key} -> ${newKey}`);
                    } catch (parseError) {
                        // Se não é JSON, armazenar como string
                        await this.setItem(newKey, data);
                        localStorage.removeItem(key);
                        migrated++;
                        
                        console.debug(`📦 Migrado (string): ${key} -> ${newKey}`);
                    }
                }
            }
            
            console.info(`📦 Migração concluída: ${migrated} itens migrados`);
            return migrated;
        } catch (error) {
            console.error('Erro na migração:', error);
            return 0;
        }
    }
}

// Exportar instância única (singleton)
const secureStorage = new SecureStorage();

// Polyfill para compatibilidade
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecureStorage, secureStorage };
}

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
    window.SecureStorage = SecureStorage;
    window.secureStorage = secureStorage;
}

export { SecureStorage, secureStorage };