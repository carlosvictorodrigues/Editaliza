/**
 * Sistema de preferências de email - Versão Corrigida
 */

(function() {
    'use strict';
    
    console.log('📧 Iniciando sistema de preferências de email...');
    
    // Aguardar DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        console.log('📧 Inicializando preferências de email...');
        
        // IDs dos checkboxes
        const checkboxIds = [
            'email_daily_schedule',
            'email_weekly_summary',
            'email_study_reminders'
        ];
        
        // Verificar se os checkboxes existem
        const checkboxes = {};
        let foundCount = 0;
        
        checkboxIds.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkboxes[id] = checkbox;
                foundCount++;
                console.log(`✅ Checkbox encontrado: ${id}`);
            } else {
                console.warn(`⚠️ Checkbox não encontrado: ${id}`);
            }
        });
        
        if (foundCount === 0) {
            console.error('❌ Nenhum checkbox de preferências encontrado!');
            return;
        }
        
        // Carregar preferências salvas
        loadPreferences();
        
        // Adicionar listeners
        setupListeners();
        
        // Funções internas
        function loadPreferences() {
            const savedPrefs = localStorage.getItem('email_preferences');
            
            if (savedPrefs) {
                try {
                    const prefs = JSON.parse(savedPrefs);
                    console.log('📧 Preferências carregadas:', prefs);
                    
                    Object.keys(checkboxes).forEach(id => {
                        if (prefs[id] !== undefined) {
                            checkboxes[id].checked = prefs[id];
                            console.log(`   ${id}: ${prefs[id]}`);
                        }
                    });
                } catch (e) {
                    console.error('Erro ao carregar preferências:', e);
                    setDefaults();
                }
            } else {
                console.log('📧 Usando preferências padrão');
                setDefaults();
            }
        }
        
        function setDefaults() {
            const defaults = {
                email_daily_schedule: true,
                email_weekly_summary: true,
                email_study_reminders: false
            };
            
            Object.keys(checkboxes).forEach(id => {
                if (defaults[id] !== undefined) {
                    checkboxes[id].checked = defaults[id];
                }
            });
            
            savePreferences();
        }
        
        function savePreferences() {
            const prefs = {};
            
            Object.keys(checkboxes).forEach(id => {
                prefs[id] = checkboxes[id].checked;
            });
            
            console.log('💾 Salvando preferências:', prefs);
            
            // Salvar no localStorage
            localStorage.setItem('email_preferences', JSON.stringify(prefs));
            
            // Salvar no servidor (opcional)
            saveToServer(prefs);
            
            // Mostrar feedback
            showSaveNotification();
        }
        
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
                    console.warn('⚠️ Erro ao salvar no servidor (status: ' + response.status + ')');
                }
            } catch (error) {
                console.warn('⚠️ Erro ao conectar com servidor:', error.message);
            }
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
        
        function setupListeners() {
            Object.keys(checkboxes).forEach(id => {
                const checkbox = checkboxes[id];
                
                // Remover listeners antigos se existirem
                checkbox.removeEventListener('change', handleCheckboxChange);
                
                // Adicionar novo listener
                checkbox.addEventListener('change', handleCheckboxChange);
                
                // Melhorar acessibilidade do label
                const label = checkbox.closest('label');
                if (label) {
                    // Garantir que o label seja clicável
                    label.style.cursor = 'pointer';
                    
                    // Prevenir comportamento duplo
                    label.removeEventListener('click', handleLabelClick);
                    label.addEventListener('click', handleLabelClick);
                }
            });
            
            console.log('✅ Listeners configurados para', Object.keys(checkboxes).length, 'checkboxes');
        }
        
        function handleCheckboxChange(e) {
            console.log(`📧 Checkbox alterado: ${e.target.id} = ${e.target.checked}`);
            savePreferences();
        }
        
        function handleLabelClick(e) {
            // Se o clique foi diretamente no checkbox, deixar o comportamento padrão
            if (e.target.type === 'checkbox') {
                return;
            }
            
            // Se o clique foi em outro elemento dentro do label, não fazer nada
            // (o browser já vai propagar o clique para o checkbox)
        }
        
        // API pública
        window.emailPreferences = {
            get: function() {
                const prefs = {};
                Object.keys(checkboxes).forEach(id => {
                    prefs[id] = checkboxes[id].checked;
                });
                return prefs;
            },
            set: function(prefs) {
                Object.keys(checkboxes).forEach(id => {
                    if (prefs[id] !== undefined) {
                        checkboxes[id].checked = prefs[id];
                    }
                });
                savePreferences();
            },
            reset: function() {
                setDefaults();
            }
        };
        
        console.log('✅ Sistema de preferências de email inicializado!');
    }
})();