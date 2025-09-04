/**
 * Sistema de preferências de email
 */

document.addEventListener('DOMContentLoaded', function() {
    // IDs dos checkboxes
    const checkboxIds = [
        'email_daily_schedule',
        'email_weekly_summary',
        'email_study_reminder'
    ];
    
    // Carregar preferências salvas
    function loadPreferences() {
        const savedPrefs = localStorage.getItem('email_preferences');
        
        if (savedPrefs) {
            try {
                const prefs = JSON.parse(savedPrefs);
                
                checkboxIds.forEach(id => {
                    const checkbox = document.getElementById(id);
                    if (checkbox && prefs[id] !== undefined) {
                        checkbox.checked = prefs[id];
                    }
                });
                
                console.log('✅ Preferências de email carregadas:', prefs);
            } catch (e) {
                console.error('Erro ao carregar preferências:', e);
            }
        } else {
            // Valores padrão
            const defaultPrefs = {
                email_daily_schedule: true,
                email_weekly_summary: true,
                email_study_reminder: false
            };
            
            checkboxIds.forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox && defaultPrefs[id] !== undefined) {
                    checkbox.checked = defaultPrefs[id];
                }
            });
        }
    }
    
    // Salvar preferências
    function savePreferences() {
        const prefs = {};
        
        checkboxIds.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                prefs[id] = checkbox.checked;
            }
        });
        
        // Salvar no localStorage
        localStorage.setItem('email_preferences', JSON.stringify(prefs));
        
        // Salvar no servidor (se tiver endpoint)
        saveToServer(prefs);
        
        // Feedback visual
        showSaveNotification();
    }
    
    // Salvar no servidor
    async function saveToServer(prefs) {
        try {
            const token = localStorage.getItem('editaliza_token');
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/user/preferences/email', {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(prefs)
            });
            
            if (response.ok) {
                console.log('✅ Preferências salvas no servidor');
            } else {
                console.warn('⚠️ Erro ao salvar no servidor, mas salvo localmente');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao salvar no servidor, mas salvo localmente:', error);
        }
    }
    
    // Mostrar notificação de salvamento
    function showSaveNotification() {
        // Criar ou reutilizar notificação
        let notification = document.getElementById('save-notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'save-notification';
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
                transition: all 0.3s ease;
                transform: translateY(100px);
                opacity: 0;
            `;
            document.body.appendChild(notification);
        }
        
        notification.textContent = '✅ Preferências salvas!';
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
        
        // Ocultar após 3 segundos
        setTimeout(() => {
            notification.style.transform = 'translateY(100px)';
            notification.style.opacity = '0';
        }, 3000);
    }
    
    // Adicionar listeners aos checkboxes
    function addListeners() {
        checkboxIds.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                // Adicionar evento de mudança
                checkbox.addEventListener('change', function() {
                    console.log(`📧 Preferência alterada: ${id} = ${this.checked}`);
                    savePreferences();
                });
                
                // Tornar o label clicável
                const label = checkbox.closest('label');
                if (label) {
                    label.style.cursor = 'pointer';
                    
                    // Adicionar efeito hover
                    label.addEventListener('mouseenter', function() {
                        this.style.backgroundColor = '#f9fafb';
                    });
                    
                    label.addEventListener('mouseleave', function() {
                        this.style.backgroundColor = '';
                    });
                }
            }
        });
    }
    
    // Inicializar
    loadPreferences();
    addListeners();
    
    // Expor API global
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
        }
    };
});