/**
 * Wrapper de Compatibilidade para SecureStorage
 * 
 * Fornece uma interface compatível com localStorage
 * enquanto usa SecureStorage internamente
 * 
 * @version 1.0.0
 */

class StorageCompatibility {
    constructor() {
        this.initialized = false;
        this.storage = null;
        this.init();
    }

    async init() {
        // Aguardar SecureStorage estar disponível
        while (!window.secureStorage) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.storage = window.secureStorage;
        this.initialized = true;
        console.log('🔗 StorageCompatibility inicializado');
    }

    /**
     * Aguarda inicialização
     */
    async waitForInit() {
        while (!this.initialized) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    /**
     * Substituto assíncrono para localStorage.setItem
     */
    async setItem(key, value, options = {}) {
        await this.waitForInit();
        
        try {
            // Detectar se é uma string JSON e fazer parse
            let data = value;
            if (typeof value === 'string') {
                try {
                    data = JSON.parse(value);
                } catch {
                    // Se não for JSON válido, manter como string
                    data = value;
                }
            }
            
            await this.storage.setItem(key, data, options);
            return true;
        } catch (error) {
            console.error(`Erro ao salvar ${key}:`, error);
            return false;
        }
    }

    /**
     * Substituto assíncrono para localStorage.getItem
     */
    async getItem(key) {
        await this.waitForInit();
        
        try {
            const data = await this.storage.getItem(key);
            
            // Se retornou null, manter null
            if (data === null) {
                return null;
            }
            
            // Se é uma string simples, retornar como string
            if (typeof data === 'string') {
                return data;
            }
            
            // Se é um objeto, serializar para JSON (compatibilidade)
            return JSON.stringify(data);
        } catch (error) {
            console.error(`Erro ao recuperar ${key}:`, error);
            return null;
        }
    }

    /**
     * Substituto assíncrono para localStorage.removeItem
     */
    async removeItem(key) {
        await this.waitForInit();
        
        try {
            await this.storage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Erro ao remover ${key}:`, error);
            return false;
        }
    }

    /**
     * Substituto para localStorage.clear
     */
    async clear() {
        await this.waitForInit();
        
        try {
            return this.storage.clear();
        } catch (error) {
            console.error('Erro ao limpar storage:', error);
            return 0;
        }
    }

    /**
     * Versão síncrona (fallback) para localStorage.setItem
     * AVISO: Esta versão não usa criptografia!
     */
    setItemSync(key, value) {
        console.warn(`⚠️ Usando setItemSync para ${key} - sem criptografia!`);
        try {
            localStorage.setItem(`editaliza_fallback_${key}`, value);
            
            // Tentar salvar de forma assíncrona também
            this.setItem(key, value).catch(error => {
                console.error('Erro ao salvar assincronamente:', error);
            });
            
            return true;
        } catch (error) {
            console.error(`Erro em setItemSync para ${key}:`, error);
            return false;
        }
    }

    /**
     * Versão síncrona (fallback) para localStorage.getItem
     */
    getItemSync(key) {
        try {
            // Primeiro tentar buscar no localStorage de fallback
            const fallbackData = localStorage.getItem(`editaliza_fallback_${key}`);
            if (fallbackData) {
                console.warn(`⚠️ Usando dados de fallback para ${key}`);
                return fallbackData;
            }
            
            // Se não encontrou, tentar buscar assincronamente e retornar null por enquanto
            this.getItem(key).then(data => {
                if (data !== null) {
                    // Cachear para próximas consultas síncronas
                    localStorage.setItem(`editaliza_fallback_${key}`, data);
                }
            }).catch(error => {
                console.error('Erro ao buscar assincronamente:', error);
            });
            
            return null;
        } catch (error) {
            console.error(`Erro em getItemSync para ${key}:`, error);
            return null;
        }
    }

    /**
     * Versão síncrona para localStorage.removeItem
     */
    removeItemSync(key) {
        try {
            localStorage.removeItem(`editaliza_fallback_${key}`);
            
            // Tentar remover de forma assíncrona também
            this.removeItem(key).catch(error => {
                console.error('Erro ao remover assincronamente:', error);
            });
            
            return true;
        } catch (error) {
            console.error(`Erro em removeItemSync para ${key}:`, error);
            return false;
        }
    }
}

/**
 * Classe para interceptar e substituir localStorage
 */
class LocalStorageProxy {
    constructor() {
        this.compatibility = new StorageCompatibility();
        this.operations = new Map();
    }

    /**
     * Intercepta localStorage.setItem
     */
    setItem(key, value) {
        // Para manter compatibilidade, usar versão síncrona
        console.debug(`🔄 Interceptando localStorage.setItem: ${key}`);
        
        // Se a chave parece ser sensível, avisar
        if (this.isSensitiveKey(key)) {
            console.warn(`🔒 Chave sensível detectada: ${key} - considerando migração para SecureStorage`);
        }
        
        // Usar versão assíncrona quando possível
        this.compatibility.setItem(key, value).catch(error => {
            console.error('Erro na versão assíncrona:', error);
            // Fallback para localStorage tradicional
            try {
                window.originalLocalStorage.setItem(key, value);
            } catch (fallbackError) {
                console.error('Erro até no fallback:', fallbackError);
            }
        });
        
        // Para compatibilidade imediata, usar localStorage tradicional também
        try {
            window.originalLocalStorage.setItem(key, value);
        } catch (error) {
            console.error('Erro no localStorage tradicional:', error);
        }
    }

    /**
     * Intercepta localStorage.getItem
     */
    getItem(key) {
        console.debug(`🔍 Interceptando localStorage.getItem: ${key}`);
        
        // Para compatibilidade, tentar localStorage tradicional primeiro
        try {
            const traditionalValue = window.originalLocalStorage.getItem(key);
            if (traditionalValue) {
                // Se encontrou, tentar migrar para SecureStorage em background
                this.compatibility.setItem(key, traditionalValue).then(() => {
                    console.debug(`📦 Migrado em background: ${key}`);
                }).catch(error => {
                    console.error('Erro na migração em background:', error);
                });
                
                return traditionalValue;
            }
        } catch (error) {
            console.error('Erro ao acessar localStorage tradicional:', error);
        }
        
        // Se não encontrou no tradicional, tentar fallback síncrono
        return this.compatibility.getItemSync(key);
    }

    /**
     * Intercepta localStorage.removeItem
     */
    removeItem(key) {
        console.debug(`🗑️ Interceptando localStorage.removeItem: ${key}`);
        
        // Remover de ambos os locais
        this.compatibility.removeItem(key).catch(error => {
            console.error('Erro ao remover do SecureStorage:', error);
        });
        
        try {
            window.originalLocalStorage.removeItem(key);
        } catch (error) {
            console.error('Erro ao remover do localStorage tradicional:', error);
        }
    }

    /**
     * Intercepta localStorage.clear
     */
    clear() {
        console.debug('🧹 Interceptando localStorage.clear');
        
        this.compatibility.clear().catch(error => {
            console.error('Erro ao limpar SecureStorage:', error);
        });
        
        try {
            window.originalLocalStorage.clear();
        } catch (error) {
            console.error('Erro ao limpar localStorage tradicional:', error);
        }
    }

    /**
     * Propriedade length para compatibilidade
     */
    get length() {
        try {
            return window.originalLocalStorage.length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Método key para compatibilidade
     */
    key(index) {
        try {
            return window.originalLocalStorage.key(index);
        } catch (error) {
            return null;
        }
    }

    /**
     * Verifica se uma chave contém dados sensíveis
     */
    isSensitiveKey(key) {
        const sensitivePatterns = [
            'token', 'auth', 'password', 'session', 
            'credential', 'secret', 'key', 'user'
        ];
        
        const keyLower = key.toLowerCase();
        return sensitivePatterns.some(pattern => keyLower.includes(pattern));
    }
}

// Instalar proxy do localStorage se necessário
function installLocalStorageProxy() {
    if (typeof window !== 'undefined' && !window.originalLocalStorage) {
        console.info('🔧 Instalando proxy do localStorage...');
        
        // Salvar referência original
        window.originalLocalStorage = window.localStorage;
        
        // Criar proxy
        const proxy = new LocalStorageProxy();
        
        // Substituir localStorage
        Object.defineProperty(window, 'localStorage', {
            get() {
                return proxy;
            },
            configurable: false
        });
        
        console.info('✅ Proxy do localStorage instalado');
    }
}

// Função para migração manual de dados
async function migrateSpecificKeys(keyMappings) {
    if (!window.secureStorage) {
        console.warn('SecureStorage não está disponível para migração');
        return 0;
    }
    
    let migrated = 0;
    
    for (const [oldKey, newKey] of Object.entries(keyMappings)) {
        try {
            const value = window.originalLocalStorage.getItem(oldKey);
            if (value) {
                // Tentar fazer parse se for JSON
                let data = value;
                try {
                    data = JSON.parse(value);
                } catch {
                    // Manter como string se não for JSON
                }
                
                await window.secureStorage.setItem(newKey, data);
                window.originalLocalStorage.removeItem(oldKey);
                migrated++;
                
                console.debug(`📦 Migrado: ${oldKey} -> ${newKey}`);
            }
        } catch (error) {
            console.error(`Erro ao migrar ${oldKey}:`, error);
        }
    }
    
    console.info(`📦 Migração concluída: ${migrated} chaves migradas`);
    return migrated;
}

// Exportar classes e funções
export { 
    StorageCompatibility, 
    LocalStorageProxy, 
    installLocalStorageProxy,
    migrateSpecificKeys 
};

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
    window.StorageCompatibility = StorageCompatibility;
    window.LocalStorageProxy = LocalStorageProxy;
    window.installLocalStorageProxy = installLocalStorageProxy;
    window.migrateSpecificKeys = migrateSpecificKeys;
}