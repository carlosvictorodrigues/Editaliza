/**
 * @file js/ux-improvements.js
 * @description Melhorias de UX para resolver problemas identificados
 * @version 1.0
 */

const UXImprovements = {
    
    // ==========================================
    // 1. MELHORIA: FEEDBACK AVANÇADO DE REPLANEJAMENTO
    // ==========================================
    
    /**
     * Modal de confirmação com preview de replanejamento
     */
    showReplanPreview: async function(planId, overdueData) {
        const modal = document.createElement('div');
        modal.id = 'replan-preview-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4';
        modal.style.display = 'none';
        
        try {
            // Buscar preview do replanejamento
            const preview = await app.apiFetch(`/plans/${planId}/replan_preview`);
            
            modal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <div class="text-center mb-6">
                        <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-900 mb-2">Preview do Replanejamento</h2>
                        <p class="text-gray-600">Veja exatamente o que será alterado no seu cronograma</p>
                    </div>
                    
                    <!-- Estatísticas do Replanejamento -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-red-600">${overdueData.count}</div>
                            <div class="text-sm text-red-700">Tarefas Atrasadas</div>
                        </div>
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-blue-600">${preview.affectedDays || 0}</div>
                            <div class="text-sm text-blue-700">Dias Impactados</div>
                        </div>
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-green-600">${preview.redistributedTasks || 0}</div>
                            <div class="text-sm text-green-700">Tarefas Redistribuídas</div>
                        </div>
                    </div>
                    
                    <!-- Estratégia de Replanejamento -->
                    <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <div class="ml-3">
                                <h3 class="text-sm font-medium text-blue-800">Estratégia de Redistribuição</h3>
                                <div class="mt-2 text-sm text-blue-700">
                                    <p>${preview.strategy || 'As tarefas atrasadas serão redistribuídas para os próximos dias disponíveis, priorizando manter o equilíbrio entre as disciplinas.'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Timeline de Mudanças -->
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold mb-4">📅 Cronograma de Mudanças</h3>
                        <div id="replan-timeline" class="space-y-3 max-h-60 overflow-y-auto">
                            ${this.renderReplanTimeline(preview.changes || [])}
                        </div>
                    </div>
                    
                    <!-- Botões de Ação -->
                    <div class="flex flex-col sm:flex-row gap-4">
                        <button id="confirm-replan" class="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105">
                            <div class="flex items-center justify-center space-x-2">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                </svg>
                                <span>Confirmar Replanejamento</span>
                            </div>
                        </button>
                        <button id="cancel-replan" class="sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-300">
                            Cancelar
                        </button>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Erro ao carregar preview:', error);
            modal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                    <div class="text-center">
                        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h2 class="text-xl font-bold text-gray-900 mb-2">Erro ao Carregar Preview</h2>
                        <p class="text-gray-600 mb-6">Não foi possível carregar os detalhes do replanejamento.</p>
                        <button id="cancel-replan" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg">
                            Fechar
                        </button>
                    </div>
                </div>
            `;
        }
        
        document.body.appendChild(modal);
        
        // Animação de entrada
        requestAnimationFrame(() => {
            modal.style.display = 'flex';
            modal.style.opacity = '0';
            modal.style.transform = 'scale(0.95)';
            requestAnimationFrame(() => {
                modal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                modal.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            });
        });
        
        return new Promise((resolve) => {
            // Listeners
            modal.querySelector('#confirm-replan')?.addEventListener('click', () => {
                this.closeModal(modal);
                resolve(true);
            });
            
            modal.querySelector('#cancel-replan').addEventListener('click', () => {
                this.closeModal(modal);
                resolve(false);
            });
            
            // Fechar ao clicar fora
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                    resolve(false);
                }
            });
        });
    },
    
    renderReplanTimeline: function(changes) {
        if (!changes || changes.length === 0) {
            return '<div class="text-center text-gray-500 py-4">Nenhuma mudança específica detectada</div>';
        }
        
        return changes.map(change => `
            <div class="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                <div class="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></div>
                <div class="flex-1">
                    <div class="font-medium text-gray-900">${change.date}</div>
                    <div class="text-sm text-gray-600">${change.description}</div>
                </div>
                <div class="text-xs text-gray-500">${change.subject}</div>
            </div>
        `).join('');
    },
    
    /**
     * Feedback visual durante o replanejamento
     */
    showReplanProgress: function(planId) {
        const progressModal = document.createElement('div');
        progressModal.id = 'replan-progress-modal';
        progressModal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4';
        
        progressModal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
                <div class="mb-6">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <svg class="w-8 h-8 text-white animate-spin" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <h2 class="text-xl font-bold text-gray-900 mb-2">Replanejando...</h2>
                    <p class="text-gray-600">Reorganizando seu cronograma</p>
                </div>
                
                <div class="space-y-3">
                    <div id="step-1" class="flex items-center space-x-3 p-3 rounded-lg transition-all duration-300">
                        <div class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        </div>
                        <span class="text-gray-600">Analisando tarefas atrasadas...</span>
                    </div>
                    <div id="step-2" class="flex items-center space-x-3 p-3 rounded-lg transition-all duration-300">
                        <div class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                            <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                        </div>
                        <span class="text-gray-600">Calculando nova distribuição...</span>
                    </div>
                    <div id="step-3" class="flex items-center space-x-3 p-3 rounded-lg transition-all duration-300">
                        <div class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                            <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                        </div>
                        <span class="text-gray-600">Atualizando cronograma...</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(progressModal);
        
        // Simular progresso
        this.animateReplanSteps(progressModal);
        
        return progressModal;
    },
    
    animateReplanSteps: function(modal) {
        const steps = ['step-1', 'step-2', 'step-3'];
        let currentStep = 0;
        
        const updateStep = () => {
            if (currentStep < steps.length) {
                const stepEl = modal.querySelector(`#${steps[currentStep]}`);
                const circle = stepEl.querySelector('.w-6.h-6 > div');
                const text = stepEl.querySelector('span');
                
                stepEl.classList.add('bg-blue-50');
                circle.classList.remove('bg-gray-400', 'animate-pulse');
                circle.classList.add('bg-blue-500', 'animate-spin');
                text.classList.remove('text-gray-600');
                text.classList.add('text-blue-700', 'font-medium');
                
                setTimeout(() => {
                    circle.classList.remove('animate-spin');
                    circle.innerHTML = '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
                    circle.classList.add('bg-green-500');
                    stepEl.classList.remove('bg-blue-50');
                    stepEl.classList.add('bg-green-50');
                    text.classList.remove('text-blue-700');
                    text.classList.add('text-green-700');
                    
                    currentStep++;
                    if (currentStep < steps.length) {
                        setTimeout(updateStep, 800);
                    }
                }, 1500);
            }
        };
        
        setTimeout(updateStep, 500);
    },
    
    // ==========================================
    // 2. MELHORIA: SELETOR DE PLANOS MELHORADO  
    // ==========================================
    
    /**
     * Renderizar seletor de planos com informações visuais
     */
    renderEnhancedPlanSelector: async function(containerId = 'planSelector') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        try {
            const plans = await app.getPlans();
            const activePlanId = localStorage.getItem(app.config.planKey);
            
            // Buscar dados dos planos
            const plansWithData = await Promise.all(
                plans.map(async (plan) => {
                    try {
                        const [progress, overdue] = await Promise.all([
                            app.getActivePlanData(plan.id, 'progress'),
                            app.apiFetch(`/plans/${plan.id}/overdue_check`)
                        ]);
                        return { ...plan, progress, overdue: overdue.count || 0 };
                    } catch (error) {
                        console.warn(`Erro ao carregar dados do plano ${plan.id}:`, error);
                        return { ...plan, progress: { percentage: 0 }, overdue: 0 };
                    }
                })
            );
            
            const activePlan = plansWithData.find(p => p.id == activePlanId) || plansWithData[0];
            
            container.className = 'relative';
            container.innerHTML = `
                <button id="plan-selector-button" class="w-full bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <div class="flex items-center justify-between">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center space-x-3">
                                <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                    ${activePlan.plan_name.charAt(0).toUpperCase()}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-semibold text-gray-900 truncate">${app.sanitizeHtml(activePlan.plan_name)}</div>
                                    <div class="flex items-center space-x-4 text-sm text-gray-500">
                                        <span class="flex items-center">
                                            <div class="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                            ${activePlan.progress.percentage}% concluído
                                        </span>
                                        ${activePlan.overdue > 0 ? 
                                            `<span class="flex items-center text-red-600">
                                                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                                </svg>
                                                ${activePlan.overdue} atraso${activePlan.overdue > 1 ? 's' : ''}
                                            </span>` : ''
                                        }
                                        ${activePlan.exam_date ? 
                                            `<span>${this.calculateDaysToExam(activePlan.exam_date)} dias</span>` : ''
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                        <svg class="w-5 h-5 text-gray-400 transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                </button>
                
                <div id="plan-selector-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
                    ${plansWithData.map(plan => `
                        <button class="plan-option w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200 ${plan.id == activePlanId ? 'bg-blue-50 border-l-4 border-blue-500' : ''}" data-plan-id="${plan.id}">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 bg-gradient-to-br ${this.getPlanGradient(plan.id)} rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    ${plan.plan_name.charAt(0).toUpperCase()}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium text-gray-900 truncate">${app.sanitizeHtml(plan.plan_name)}</div>
                                    <div class="flex items-center space-x-3 text-xs text-gray-500">
                                        <div class="flex items-center">
                                            <div class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                                            ${plan.progress.percentage}%
                                        </div>
                                        ${plan.overdue > 0 ? 
                                            `<span class="text-red-600">${plan.overdue} atraso${plan.overdue > 1 ? 's' : ''}</span>` : 
                                            '<span class="text-green-600">Em dia</span>'
                                        }
                                        ${plan.exam_date ? 
                                            `<span>${this.calculateDaysToExam(plan.exam_date)} dias</span>` : ''
                                        }
                                    </div>
                                </div>
                            </div>
                        </button>
                    `).join('')}
                </div>
            `;
            
            // Event listeners
            const button = container.querySelector('#plan-selector-button');
            const dropdown = container.querySelector('#plan-selector-dropdown');
            const arrow = button.querySelector('svg');
            
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = !dropdown.classList.contains('hidden');
                dropdown.classList.toggle('hidden');
                arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            });
            
            // Fechar dropdown ao clicar fora
            document.addEventListener('click', () => {
                if (!dropdown.classList.contains('hidden')) {
                    dropdown.classList.add('hidden');
                    arrow.style.transform = 'rotate(0deg)';
                }
            });
            
            // Seleção de plano
            dropdown.addEventListener('click', (e) => {
                const option = e.target.closest('.plan-option');
                if (option) {
                    const newPlanId = option.dataset.planId;
                    this.switchPlan(newPlanId);
                }
            });
            
        } catch (error) {
            console.error('Erro ao renderizar seletor de planos:', error);
            container.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <span class="text-red-600 text-sm">Erro ao carregar planos</span>
                </div>
            `;
        }
    },
    
    getPlanGradient: function(planId) {
        const gradients = [
            'from-blue-500 to-purple-600',
            'from-green-500 to-teal-600', 
            'from-purple-500 to-pink-600',
            'from-orange-500 to-red-600',
            'from-indigo-500 to-blue-600'
        ];
        return gradients[planId % gradients.length];
    },
    
    calculateDaysToExam: function(examDate) {
        const today = new Date();
        const exam = new Date(examDate);
        const diffTime = exam - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    },
    
    switchPlan: async function(newPlanId) {
        // Mostrar loading
        const button = document.querySelector('#plan-selector-button');
        const originalContent = button.innerHTML;
        
        button.innerHTML = `
            <div class="flex items-center justify-center">
                <svg class="w-5 h-5 animate-spin text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                </svg>
                <span class="ml-2">Carregando...</span>
            </div>
        `;
        
        try {
            // Salvar novo plano
            localStorage.setItem(app.config.planKey, newPlanId);
            app.state.activePlanId = newPlanId;
            
            // Invalidar cache
            app.invalidatePlanCache(newPlanId);
            
            // Mostrar toast de sucesso
            app.showToast('Plano alterado com sucesso!', 'success');
            
            // Aguardar um momento para o usuário ver o feedback
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            console.error('Erro ao trocar plano:', error);
            button.innerHTML = originalContent;
            app.showToast('Erro ao alterar plano. Tente novamente.', 'error');
        }
    },
    
    // ==========================================
    // 3. MELHORIA: VALIDAÇÃO DE TÓPICOS
    // ==========================================
    
    /**
     * Validação em tempo real para campos de estudo
     */
    setupTopicValidation: function() {
        // Validação para campos de tópicos no checklist
        const topicInputs = document.querySelectorAll('input[data-field="topic_description"], textarea[data-field="notes"]');
        
        topicInputs.forEach(input => {
            this.addValidationToField(input);
        });
    },
    
    addValidationToField: function(field) {
        const fieldContainer = field.closest('.space-y-2') || field.parentElement;
        
        // Criar indicador de validação
        const validationIndicator = document.createElement('div');
        validationIndicator.className = 'validation-indicator mt-1 text-xs hidden';
        fieldContainer.appendChild(validationIndicator);
        
        // Função de validação
        const validate = () => {
            const value = field.value.trim();
            const fieldName = field.dataset.field;
            let isValid = true;
            let message = '';
            
            // Regras específicas por tipo de campo
            if (fieldName === 'topic_description') {
                if (value.length < 3) {
                    isValid = false;
                    message = '⚠️ Descrição muito curta (mínimo 3 caracteres)';
                } else if (value.length > 200) {
                    isValid = false;
                    message = '⚠️ Descrição muito longa (máximo 200 caracteres)';
                } else if (this.containsInappropriateContent(value)) {
                    isValid = false;
                    message = '⚠️ Conteúdo inapropriado detectado';
                }
            }
            
            if (fieldName === 'notes') {
                if (value.length > 1000) {
                    isValid = false;
                    message = '⚠️ Anotações muito longas (máximo 1000 caracteres)';
                }
            }
            
            // Validação de duplicatas
            if (fieldName === 'topic_description' && value.length >= 3) {
                if (this.checkForDuplicateTopics(value, field)) {
                    isValid = false;
                    message = '⚠️ Tópico similar já existe';
                }
            }
            
            // Aplicar estilo visual
            if (isValid) {
                field.classList.remove('border-red-300', 'bg-red-50');
                field.classList.add('border-green-300', 'bg-green-50');
                validationIndicator.className = 'validation-indicator mt-1 text-xs text-green-600';
                validationIndicator.innerHTML = '✅ Válido';
                validationIndicator.classList.remove('hidden');
            } else {
                field.classList.remove('border-green-300', 'bg-green-50');
                field.classList.add('border-red-300', 'bg-red-50');
                validationIndicator.className = 'validation-indicator mt-1 text-xs text-red-600';
                validationIndicator.innerHTML = message;
                validationIndicator.classList.remove('hidden');
            }
            
            return isValid;
        };
        
        // Event listeners
        field.addEventListener('input', app.debounce(validate, 300));
        field.addEventListener('blur', validate);
        
        // Validação inicial
        if (field.value.trim()) {
            validate();
        }
    },
    
    containsInappropriateContent: function(text) {
        const inappropriateWords = ['spam', 'teste123', 'asdfgh', 'qwerty'];
        const lowerText = text.toLowerCase();
        return inappropriateWords.some(word => lowerText.includes(word));
    },
    
    checkForDuplicateTopics: function(newTopic, currentField) {
        const allTopicFields = document.querySelectorAll('input[data-field="topic_description"]');
        const normalizedNew = newTopic.toLowerCase().trim();
        
        for (let field of allTopicFields) {
            if (field !== currentField) {
                const existingTopic = field.value.toLowerCase().trim();
                if (existingTopic && this.calculateSimilarity(normalizedNew, existingTopic) > 0.8) {
                    return true;
                }
            }
        }
        return false;
    },
    
    calculateSimilarity: function(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    },
    
    levenshteinDistance: function(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    },
    
    // ==========================================
    // UTILITÁRIOS
    // ==========================================
    
    closeModal: function(modal) {
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        setTimeout(() => {
            modal.remove();
        }, 300);
    },
    
    /**
     * Inicializar todas as melhorias
     */
    init: function() {
        console.log('🚀 Inicializando melhorias de UX...');
        
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupAllImprovements();
            });
        } else {
            this.setupAllImprovements();
        }
    },
    
    setupAllImprovements: function() {
        // Configurar validação de tópicos se estiver na página de estudo
        if (document.getElementById('studySessionModal')) {
            this.setupTopicValidation();
        }
        
        // Substituir seletor de planos se existir
        if (document.getElementById('planSelector')) {
            this.renderEnhancedPlanSelector();
        }
        
        // Interceptar função de replanejamento se existir
        this.interceptReplanFunction();
        
        console.log('✅ Melhorias de UX inicializadas');
    },
    
    interceptReplanFunction: function() {
        // Interceptar cliques no botão de replanejamento
        const replanButton = document.getElementById('replanButton');
        if (replanButton) {
            // Remover listeners existentes
            const newButton = replanButton.cloneNode(true);
            replanButton.parentNode.replaceChild(newButton, replanButton);
            
            // Adicionar novo listener com preview
            newButton.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const planId = app.state.activePlanId;
                if (!planId) return;
                
                // Obter dados de tarefas atrasadas
                const overdueData = await app.apiFetch(`/plans/${planId}/overdue_check`);
                
                // Mostrar preview
                const confirmed = await this.showReplanPreview(planId, overdueData);
                
                if (confirmed) {
                    // Mostrar progresso
                    const progressModal = this.showReplanProgress(planId);
                    
                    try {
                        const response = await app.apiFetch(`/plans/${planId}/replan`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        
                        if (response.success) {
                            // Fechar modal de progresso
                            this.closeModal(progressModal);
                            
                            // Mostrar sucesso
                            app.showToast('✅ Cronograma replanejado com sucesso! As tarefas foram redistribuídas.', 'success');
                            
                            setTimeout(() => {
                                window.location.reload();
                            }, 1500);
                        } else {
                            throw new Error(response.message || 'Erro ao replanejar cronograma');
                        }
                    } catch (error) {
                        console.error('Erro no replanejamento:', error);
                        this.closeModal(progressModal);
                        app.showToast('❌ Erro ao replanejar cronograma: ' + error.message, 'error');
                    }
                }
            });
        }
    }
};

// Inicializar automaticamente
UXImprovements.init();

// Tornar disponível globalmente
window.UXImprovements = UXImprovements;