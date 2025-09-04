/**
 * Sistema de preferências de email - Versão Definitiva
 * Solução baseada na análise do Gemini
 */

(function() {
    'use strict';
    
    console.log('📧 Iniciando sistema de preferências de email (v3.0)...');
    
    const checkboxIds = ['email_daily_schedule', 'email_weekly_summary', 'email_study_reminders'];
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }
    
    async function init() {
        console.log('📧 Inicializando preferências de email...');
        
        // Tentar carregar preferências do servidor primeiro
        const serverPrefs = await loadFromServer();
        
        let foundCount = 0;
        
        checkboxIds.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                foundCount++;
                console.log(`✅ Checkbox encontrado: ${id}`);
                
                // NÃO remover o atributo checked - deixar o HTML decidir o estado inicial
                // Se houver preferências salvas, elas sobrescreverão o estado inicial
                
                // Adicionar listener APENAS UMA VEZ
                checkbox.addEventListener('change', handleCheckboxChange);
                
                // Carregar preferência salva ou manter o estado atual do HTML
                const savedValue = loadPreference(id);
                if (savedValue !== null) {
                    checkbox.checked = savedValue;
                    console.log(`   Carregado do localStorage: ${id} = ${savedValue}`);
                } else {
                    console.log(`   Usando valor padrão do HTML: ${id} = ${checkbox.checked}`);
                }
            } else {
                console.warn(`⚠️ Checkbox não encontrado: ${id}`);
            }
        });
        
        if (foundCount === 0) {
            console.error('❌ Nenhum checkbox de preferências encontrado!');
            return;
        }
        
        console.log(`✅ Sistema inicializado com ${foundCount} checkboxes`);
        
        // API pública
        window.emailPreferences = {
            get: function() {
                const prefs = {};
                checkboxIds.forEach(id => {
                    const checkbox = document.getElementById(id);
                    if (checkbox) {
                        prefs[id] = checkbox.checked;
                    }
                });
                return prefs;
            },
            set: function(prefs) {
                checkboxIds.forEach(id => {
                    const checkbox = document.getElementById(id);
                    if (checkbox && prefs[id] !== undefined) {
                        checkbox.checked = prefs[id];
                    }
                });
                savePreferences();
            },
            reset: function() {
                localStorage.removeItem('email_preferences');
                console.log('🔄 Preferências resetadas');
                // Recarregar os valores padrão do HTML
                checkboxIds.forEach(id => {
                    const checkbox = document.getElementById(id);
                    if (checkbox) {
                        // Restaurar ao estado original do HTML
                        checkbox.checked = checkbox.hasAttribute('checked');
                    }
                });
            },
            debug: function() {
                console.log('=== DEBUG INFO ===');
                console.log('LocalStorage:', localStorage.getItem('email_preferences'));
                checkboxIds.forEach(id => {
                    const checkbox = document.getElementById(id);
                    if (checkbox) {
                        console.log(`${id}:`);
                        console.log(`  checked: ${checkbox.checked}`);
                        console.log(`  disabled: ${checkbox.disabled}`);
                        console.log(`  has 'checked' attr: ${checkbox.hasAttribute('checked')}`);
                        console.log(`  parent tag: ${checkbox.parentElement.tagName}`);
                    }
                });
                
                // Verificar se há outros event listeners
                console.log('Testando cliques programáticos:');
                checkboxIds.forEach(id => {
                    const checkbox = document.getElementById(id);
                    if (checkbox) {
                        const before = checkbox.checked;
                        checkbox.click();
                        const after = checkbox.checked;
                        console.log(`${id}: ${before} -> ${after} (mudou: ${before !== after})`);
                    }
                });
            }
        };
    }
    
    function handleCheckboxChange(e) {
        console.log(`📝 Checkbox alterado: ${e.target.id} = ${e.target.checked}`);
        savePreferences();
        showSaveNotification();
    }
    
    function savePreferences() {
        const preferences = {};
        checkboxIds.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                preferences[id] = checkbox.checked;
            }
        });
        
        localStorage.setItem('email_preferences', JSON.stringify(preferences));
        console.log('💾 Preferências salvas:', preferences);
        
        // Tentar salvar no servidor (opcional)
        saveToServer(preferences);
    }
    
    function loadPreference(id) {
        const preferences = localStorage.getItem('email_preferences');
        if (preferences) {
            try {
                const parsed = JSON.parse(preferences);
                return parsed[id] !== undefined ? parsed[id] : null;
            } catch (e) {
                console.error('Erro ao parsear preferências:', e);
                return null;
            }
        }
        return null;
    }
    
    async function saveToServer(prefs) {
        try {
            const token = localStorage.getItem('editaliza_token') || localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/user/preferences/email', {
                method: 'PUT',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(prefs)
            });
            
            if (response.ok) {
                console.log('✅ Preferências salvas no servidor');
            } else {
                console.log('⚠️ Servidor retornou status:', response.status);
            }
        } catch (error) {
            console.log('⚠️ Erro ao salvar no servidor (pode estar offline):', error.message);
        }
    }
    
    // Função para carregar preferências do servidor
    async function loadFromServer() {
        try {
            const token = localStorage.getItem('editaliza_token') || localStorage.getItem('token');
            if (!token) return null;
            
            const response = await fetch('/api/user/preferences/email', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const prefs = await response.json();
                console.log('📦 Preferências carregadas do servidor:', prefs);
                return prefs;
            }
        } catch (error) {
            console.log('⚠️ Erro ao carregar do servidor:', error.message);
        }
        return null;
    }
    
    function showSaveNotification() {
        // Remover notificação anterior se existir
        const existingNotification = document.getElementById('email-save-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Criar nova notificação
        const notification = document.createElement('div');
        notification.id = 'email-save-notification';
        notification.innerHTML = '✅ Preferências salvas!';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            font-weight: 500;
            z-index: 9999;
            animation: slideInUp 0.3s ease-out;
        `;
        
        // Adicionar animação CSS se não existir
        if (!document.getElementById('email-pref-animations')) {
            const style = document.createElement('style');
            style.id = 'email-pref-animations';
            style.textContent = `
                @keyframes slideInUp {
                    from {
                        transform: translateY(100px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutDown {
                    from {
                        transform: translateY(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateY(100px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remover após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOutDown 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
})();