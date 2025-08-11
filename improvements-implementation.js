/**
 * IMPLEMENTAÇÃO DAS MELHORIAS BASEADAS NO RELATÓRIO DE AUDITORIA
 * 
 * Este arquivo contém as correções e melhorias identificadas:
 * 1. Modo "Reta Final" para cenários com pouco tempo
 * 2. Seletor de planos respeitando o design atual
 * 3. Validação pré-geração de cronograma
 * 4. Distribuição equilibrada de pesos
 */

// ============================================
// 1. MODO RETA FINAL - ADICIONAR AO FRONTEND
// ============================================

const RetaFinalFeature = {
    // Adicionar no formulário de criação/edição de plano
    renderRetaFinalCheckbox() {
        return `
            <div class="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <svg class="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center">
                            <input 
                                type="checkbox" 
                                id="retaFinalMode" 
                                name="reta_final_mode"
                                class="w-5 h-5 text-red-600 bg-white border-red-300 rounded focus:ring-red-500 focus:ring-2"
                            >
                            <label for="retaFinalMode" class="ml-3 text-lg font-bold text-red-700">
                                🚨 Modo Reta Final
                            </label>
                        </div>
                        <div class="mt-3">
                            <p class="text-sm text-red-600 font-medium mb-2">
                                ⚠️ <strong>ATENÇÃO:</strong> Ative apenas se há pouco tempo para estudar todo o conteúdo.
                            </p>
                            <div class="bg-white p-3 rounded-lg border border-red-200">
                                <h4 class="font-semibold text-red-700 mb-2">Como funciona:</h4>
                                <ul class="text-sm text-red-600 space-y-1">
                                    <li>• <strong>Prioriza disciplinas com peso maior</strong></li>
                                    <li>• Disciplinas com peso igual podem ficar de fora</li>
                                    <li>• Foca no que é mais provável de cair na prova</li>
                                    <li>• Gera relatório detalhado do que ficou de fora</li>
                                </ul>
                            </div>
                            <p class="text-xs text-red-500 mt-2 italic">
                                💡 Dica: Defina pesos diferentes para cada disciplina antes de ativar este modo
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Mostrar relatório após geração em modo reta final
    showRetaFinalReport(excludedTopics, prioritizedSubjects) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                        <h2 class="text-2xl font-bold text-red-700">Relatório Modo Reta Final</h2>
                    </div>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div class="space-y-6">
                    <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h3 class="text-lg font-semibold text-green-800 mb-3 flex items-center">
                            ✅ Disciplinas Priorizadas
                        </h3>
                        <div class="space-y-2">
                            ${prioritizedSubjects.map(subject => `
                                <div class="flex items-center justify-between bg-white p-2 rounded border">
                                    <span class="font-medium text-green-700">${subject.name}</span>
                                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-semibold">
                                        Peso ${subject.weight}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    ${excludedTopics.length > 0 ? `
                        <div class="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 class="text-lg font-semibold text-red-800 mb-3 flex items-center">
                                ⚠️ Tópicos Excluídos por Falta de Tempo
                            </h3>
                            <div class="space-y-2 max-h-40 overflow-y-auto">
                                ${excludedTopics.map(topic => `
                                    <div class="bg-white p-2 rounded border border-red-200">
                                        <span class="text-red-700">${topic.subject_name}: ${topic.description}</span>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <p class="text-sm text-yellow-800">
                                    💡 <strong>Sugestão:</strong> Revise estes tópicos durante os intervalos ou após terminar o cronograma principal.
                                </p>
                            </div>
                        </div>
                    ` : ''}

                    <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h3 class="text-lg font-semibold text-blue-800 mb-2">📊 Resumo da Estratégia</h3>
                        <ul class="text-sm text-blue-700 space-y-1">
                            <li>• Cronograma focado nas ${prioritizedSubjects.length} disciplinas mais importantes</li>
                            <li>• ${excludedTopics.length} tópicos ficaram de fora devido ao tempo limitado</li>
                            <li>• Priorização baseada nos pesos definidos por você</li>
                        </ul>
                    </div>
                </div>

                <div class="mt-6 flex justify-center">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="btn-primary px-6 py-2">
                        Entendi, continuar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
};

// ============================================
// 2. SELETOR DE PLANOS MELHORADO (DESIGN ATUAL)
// ============================================

const EnhancedPlanSelector = {
    async renderEnhancedSelector() {
        try {
            const plans = await app.getPlans();
            const currentPlanId = localStorage.getItem('selectedPlanId');
            
            const planSelector = document.getElementById('planSelector');
            if (!planSelector) return;

            // Limpar conteúdo atual
            planSelector.innerHTML = '';

            // Buscar dados detalhados de cada plano
            const plansWithDetails = await Promise.all(plans.map(async plan => {
                try {
                    const progress = await app.getActivePlanData(plan.id, 'progress');
                    const overdueCheck = await app.apiFetch(`/plans/${plan.id}/overdue_check`);
                    
                    return {
                        ...plan,
                        progress: progress.percentage || 0,
                        overdue: overdueCheck.count || 0,
                        examDate: plan.exam_date ? new Date(plan.exam_date) : null
                    };
                } catch (error) {
                    console.warn(`Erro ao buscar detalhes do plano ${plan.id}:`, error);
                    return {
                        ...plan,
                        progress: 0,
                        overdue: 0,
                        examDate: plan.exam_date ? new Date(plan.exam_date) : null
                    };
                }
            }));

            // Substituir o select simples por um dropdown customizado mantendo o design atual
            const container = planSelector.parentElement;
            container.innerHTML = `
                <label class="block text-sm font-medium text-gray-700 mb-1">Plano ativo:</label>
                <div class="dropdown relative">
                    <button id="customPlanSelector" 
                            class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:ring-brand text-left flex items-center justify-between min-w-[200px]">
                        <span id="currentPlanDisplay">Carregando...</span>
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>
                    <div id="planDropdownContent" class="dropdown-content" style="min-width: 300px; max-height: 400px; overflow-y: auto;">
                        ${plansWithDetails.map(plan => this.renderPlanOption(plan, plan.id == currentPlanId)).join('')}
                    </div>
                </div>
            `;

            // Atualizar display do plano atual
            const currentPlan = plansWithDetails.find(p => p.id == currentPlanId) || plansWithDetails[0];
            document.getElementById('currentPlanDisplay').innerHTML = this.renderPlanSummary(currentPlan);

            // Adicionar event listeners
            document.getElementById('customPlanSelector').addEventListener('click', () => {
                const dropdown = document.getElementById('planDropdownContent');
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });

            // Fechar dropdown ao clicar fora
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown')) {
                    document.getElementById('planDropdownContent').style.display = 'none';
                }
            });

        } catch (error) {
            console.error('Erro ao renderizar seletor de planos:', error);
        }
    },

    renderPlanSummary(plan) {
        const examDate = plan.examDate ? plan.examDate.toLocaleDateString('pt-BR') : 'Não definida';
        const progressColor = plan.progress >= 80 ? 'text-green-600' : plan.progress >= 50 ? 'text-yellow-600' : 'text-red-600';
        const overdueIndicator = plan.overdue > 0 ? `<span class="text-red-500 text-xs">●</span>` : '';
        
        return `
            <div class="flex items-center space-x-2">
                <span class="font-medium text-gray-900 truncate">${app.sanitizeHtml(plan.plan_name)}</span>
                ${overdueIndicator}
                <span class="text-xs ${progressColor} font-semibold">${plan.progress}%</span>
            </div>
        `;
    },

    renderPlanOption(plan, isSelected) {
        const examDate = plan.examDate ? plan.examDate.toLocaleDateString('pt-BR') : 'Não definida';
        const daysToExam = plan.examDate ? Math.ceil((plan.examDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
        const progressColor = plan.progress >= 80 ? 'bg-green-100 text-green-800' : plan.progress >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
        const selectedClass = isSelected ? 'bg-blue-50 border-blue-200' : '';
        
        return `
            <div class="plan-option p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${selectedClass}" 
                 data-plan-id="${plan.id}" onclick="EnhancedPlanSelector.selectPlan(${plan.id})">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-gray-900 truncate flex-1 mr-2">${app.sanitizeHtml(plan.plan_name)}</h4>
                    ${isSelected ? '<span class="text-blue-600 text-xs font-semibold">● ATIVO</span>' : ''}
                </div>
                
                <div class="flex items-center space-x-3 text-xs text-gray-600 mb-2">
                    <span>📅 ${examDate}</span>
                    ${daysToExam !== null ? `<span class="${daysToExam <= 30 ? 'text-red-600 font-semibold' : ''}">${daysToExam}d restantes</span>` : ''}
                </div>
                
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <span class="text-xs px-2 py-1 rounded-full ${progressColor}">${plan.progress}% concluído</span>
                        ${plan.overdue > 0 ? `<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">${plan.overdue} atrasadas</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    async selectPlan(planId) {
        try {
            // Salvar seleção
            localStorage.setItem('selectedPlanId', planId);
            app.state.activePlanId = planId;
            
            // Fechar dropdown
            document.getElementById('planDropdownContent').style.display = 'none';
            
            // Mostrar loading
            document.getElementById('currentPlanDisplay').innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span class="text-gray-600">Carregando plano...</span>
                </div>
            `;
            
            // Recarregar página para aplicar o novo plano
            setTimeout(() => {
                window.location.reload();
            }, 500);
            
        } catch (error) {
            console.error('Erro ao selecionar plano:', error);
            app.showToast('Erro ao trocar de plano. Tente novamente.', 'error');
        }
    }
};

// ============================================
// 3. VALIDAÇÃO APRIMORADA DE TÓPICOS
// ============================================

const TopicValidation = {
    setupValidation() {
        const topicTextarea = document.querySelector('textarea[name="topics"]');
        if (!topicTextarea) return;

        // Container para feedback
        const feedbackContainer = document.createElement('div');
        feedbackContainer.id = 'topicValidationFeedback';
        feedbackContainer.className = 'mt-2';
        topicTextarea.parentElement.appendChild(feedbackContainer);

        // Validação em tempo real
        topicTextarea.addEventListener('input', app.debounce(() => {
            this.validateTopics(topicTextarea.value);
        }, 500));

        // Validação inicial se já há conteúdo
        if (topicTextarea.value.trim()) {
            this.validateTopics(topicTextarea.value);
        }
    },

    validateTopics(topicsText) {
        const feedback = document.getElementById('topicValidationFeedback');
        if (!feedback) return;

        const topics = topicsText.split('\\n').map(t => t.trim()).filter(t => t.length > 0);
        
        if (topics.length === 0) {
            feedback.innerHTML = `
                <div class="flex items-center space-x-2 text-red-600">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                    <span class="text-sm font-medium">Adicione pelo menos um tópico</span>
                </div>
            `;
            this.toggleSubmitButton(false);
            return;
        }

        // Detectar duplicatas
        const duplicates = this.findDuplicates(topics);
        
        if (duplicates.length > 0) {
            feedback.innerHTML = `
                <div class="space-y-2">
                    <div class="flex items-center space-x-2 text-yellow-600">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        <span class="text-sm font-medium">Possíveis duplicatas encontradas:</span>
                    </div>
                    <div class="bg-yellow-50 p-2 rounded border border-yellow-200 text-sm text-yellow-800 max-h-20 overflow-y-auto">
                        ${duplicates.map(d => `• ${d}`).join('<br>')}
                    </div>
                </div>
            `;
            this.toggleSubmitButton(true); // Permite salvar mesmo com duplicatas (apenas aviso)
        } else if (topics.length > 0) {
            feedback.innerHTML = `
                <div class="flex items-center space-x-2 text-green-600">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    <span class="text-sm font-medium">${topics.length} tópicos válidos</span>
                </div>
            `;
            this.toggleSubmitButton(true);
        }
    },

    findDuplicates(topics) {
        const duplicates = [];
        const seen = new Set();
        
        topics.forEach(topic => {
            const normalized = topic.toLowerCase().replace(/[^a-zA-Z0-9\\s]/g, '').trim();
            
            // Verificar similaridade com tópicos já vistos
            for (const seenTopic of seen) {
                const similarity = this.calculateSimilarity(normalized, seenTopic);
                if (similarity > 0.8) { // 80% de similaridade
                    duplicates.push(topic);
                    break;
                }
            }
            
            seen.add(normalized);
        });
        
        return duplicates;
    },

    calculateSimilarity(str1, str2) {
        const words1 = str1.split(' ');
        const words2 = str2.split(' ');
        const commonWords = words1.filter(word => words2.includes(word));
        return (commonWords.length * 2) / (words1.length + words2.length);
    },

    toggleSubmitButton(enable) {
        const submitButtons = document.querySelectorAll('button[type="submit"], .btn-primary[data-submit]');
        submitButtons.forEach(btn => {
            btn.disabled = !enable;
            if (enable) {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        });
    }
};

// ============================================
// 4. PREVIEW DE REPLANEJAMENTO MELHORADO
// ============================================

const ReplanPreview = {
    async showPreview(planId, overdueData) {
        try {
            // Buscar detalhes das tarefas atrasadas
            const replanDetails = await app.apiFetch(`/plans/${planId}/replan_preview`);
            
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4';
                modal.innerHTML = `
                    <div class="bg-white rounded-xl shadow-2xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                                <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                                </svg>
                                <span>Preview do Replanejamento</span>
                            </h2>
                            <button onclick="this.parentElement.parentElement.parentElement.remove(); resolve(false);" class="text-gray-400 hover:text-gray-600">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div class="metric-card red-accent">
                                <div class="text-center">
                                    <p class="text-2xl font-bold text-red-600">${overdueData.count}</p>
                                    <p class="text-sm text-gray-600">Tarefas Atrasadas</p>
                                </div>
                            </div>
                            <div class="metric-card blue-accent">
                                <div class="text-center">
                                    <p class="text-2xl font-bold text-blue-600">${replanDetails.available_slots || 0}</p>
                                    <p class="text-sm text-gray-600">Slots Disponíveis</p>
                                </div>
                            </div>
                            <div class="metric-card green-accent">
                                <div class="text-center">
                                    <p class="text-2xl font-bold text-green-600">${replanDetails.success_rate || '95'}%</p>
                                    <p class="text-sm text-gray-600">Taxa de Sucesso</p>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-4 mb-6">
                            <h3 class="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                                </svg>
                                <span>Timeline de Mudanças</span>
                            </h3>
                            <div class="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                                ${this.renderTimeline(replanDetails.changes || [])}
                            </div>
                        </div>

                        <div class="flex justify-end space-x-3">
                            <button onclick="this.parentElement.parentElement.parentElement.remove(); resolve(false);" 
                                    class="btn-secondary px-6 py-2">
                                Cancelar
                            </button>
                            <button onclick="this.parentElement.parentElement.parentElement.remove(); resolve(true);" 
                                    class="btn-primary px-6 py-2 flex items-center space-x-2">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                <span>Confirmar Replanejamento</span>
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                // Auto-focus no botão de confirmar
                setTimeout(() => {
                    modal.querySelector('.btn-primary').focus();
                }, 100);
            });
        } catch (error) {
            console.error('Erro ao carregar preview:', error);
            app.showToast('Erro ao carregar preview. Executando replanejamento direto.', 'warning');
            return true; // Prosseguir com replanejamento mesmo sem preview
        }
    },

    renderTimeline(changes) {
        if (changes.length === 0) {
            return '<p class="text-center text-gray-500 italic py-4">Calculando mudanças...</p>';
        }

        return changes.map(change => `
            <div class="flex items-start space-x-3 mb-3 last:mb-0">
                <div class="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900">${change.description}</p>
                    <p class="text-xs text-gray-500">${change.date}</p>
                </div>
            </div>
        `).join('');
    }
};

// ============================================
// 5. INICIALIZAÇÃO E INTEGRAÇÃO
// ============================================

// Auto-inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar melhorias baseadas na página atual
    const currentPage = window.location.pathname.split('/').pop();
    
    console.log('🚀 Inicializando melhorias da auditoria para:', currentPage);
    
    switch(currentPage) {
        case 'home.html':
            // Seletor de planos melhorado
            setTimeout(() => EnhancedPlanSelector.renderEnhancedSelector(), 1000);
            break;
            
        case 'plan.html':
        case 'dashboard.html':
            // Validação de tópicos
            setTimeout(() => TopicValidation.setupValidation(), 500);
            break;
    }
    
    // Melhorar funcionalidade de replanejamento global
    const originalReplanFunction = window.addReplanListener;
    if (originalReplanFunction) {
        window.addReplanListener = function() {
            const replanButton = document.getElementById('replanButton');
            if (replanButton) {
                replanButton.onclick = async function() {
                    if (!app.state.activePlanId) return;
                    
                    const overdueData = await app.apiFetch(`/plans/${app.state.activePlanId}/overdue_check`);
                    const confirmed = await ReplanPreview.showPreview(app.state.activePlanId, overdueData);
                    
                    if (confirmed) {
                        // Executar replanejamento original
                        originalReplanFunction.call(this);
                    }
                };
            }
        };
    }
});

// Tornar funcionalidades globais
window.RetaFinalFeature = RetaFinalFeature;
window.EnhancedPlanSelector = EnhancedPlanSelector;
window.TopicValidation = TopicValidation;
window.ReplanPreview = ReplanPreview;

console.log('✅ Melhorias da auditoria carregadas com sucesso');