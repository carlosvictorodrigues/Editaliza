/**
 * Plan Dashboard Module
 * Consome o novo endpoint unificado /api/plans/:planId/dashboard
 */

class PlanDashboard {
    constructor(planId) {
        this.planId = planId;
        this.dashboardData = null;
        this.autoRefreshInterval = null;
    }

    /**
     * Busca dados do dashboard usando o endpoint unificado
     */
    async fetchDashboardData() {
        try {
            const response = await fetch(`/api/plans/${this.planId}/dashboard`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Erro ao carregar dashboard: ${response.status}`);
            }

            this.dashboardData = await response.json();
            return this.dashboardData;
        } catch (error) {
            console.error('Erro ao buscar dados do dashboard:', error);
            throw error;
        }
    }

    /**
     * Renderiza as estatísticas do plano
     */
    renderStatistics() {
        if (!this.dashboardData) return;

        const { schedule, progress, pace, projection } = this.dashboardData;

        // Atualizar cobertura do edital
        const coverageElement = document.getElementById('schedule-coverage');
        if (coverageElement) {
            coverageElement.innerHTML = `
                <div class="text-2xl font-bold">${schedule.coveragePct || 0}%</div>
                <div class="text-sm text-gray-600">
                    ${schedule.scheduledTopics} de ${schedule.totalTopics} tópicos
                </div>
            `;
        }

        // Atualizar progresso
        const progressElement = document.getElementById('progress-percentage');
        if (progressElement) {
            progressElement.innerHTML = `
                <div class="text-2xl font-bold">${progress.completedPct || 0}%</div>
                <div class="text-sm text-gray-600">
                    ${progress.completedTopics} tópicos concluídos
                </div>
            `;
        }

        // Atualizar ritmo de estudo
        const paceElement = document.getElementById('study-pace');
        if (paceElement) {
            const statusClass = projection.onTrack ? 'text-green-600' : 'text-red-600';
            paceElement.innerHTML = `
                <div class="mb-2">
                    <span class="text-lg font-semibold">Ritmo Atual:</span>
                    <span class="text-2xl font-bold ml-2">${pace.currentTopicsPerDay.toFixed(1)}</span>
                    <span class="text-sm text-gray-600"> tópicos/dia</span>
                </div>
                <div class="mb-2">
                    <span class="text-lg font-semibold">Ritmo Necessário:</span>
                    <span class="text-2xl font-bold ml-2 ${statusClass}">${pace.requiredTopicsPerDay.toFixed(1)}</span>
                    <span class="text-sm text-gray-600"> tópicos/dia</span>
                </div>
            `;
        }

        // Atualizar projeção
        const projectionElement = document.getElementById('projection-status');
        if (projectionElement) {
            const statusColor = this.dashboardData.uiHints.statusColor;
            const bgClass = statusColor === 'on-track' ? 'bg-green-100' : 
                           statusColor === 'attention-needed' ? 'bg-yellow-100' : 'bg-red-100';
            const textClass = statusColor === 'on-track' ? 'text-green-800' : 
                             statusColor === 'attention-needed' ? 'text-yellow-800' : 'text-red-800';
            
            projectionElement.innerHTML = `
                <div class="p-4 rounded-lg ${bgClass} ${textClass}">
                    <h3 class="font-bold text-lg mb-1">${this.dashboardData.uiHints.headline}</h3>
                    <p class="text-sm">${this.dashboardData.uiHints.subtext}</p>
                    ${projection.forecastDate ? 
                        `<p class="text-xs mt-2">Conclusão prevista: ${new Date(projection.forecastDate).toLocaleDateString('pt-BR')}</p>` 
                        : ''}
                </div>
            `;
        }
    }

    /**
     * Renderiza estatísticas de revisão
     */
    renderRevisions() {
        if (!this.dashboardData) return;

        const { revisions } = this.dashboardData;
        const revisionsElement = document.getElementById('revision-stats');
        
        if (revisionsElement) {
            const cycles = revisions.cycles.map(cycle => `
                <div class="revision-cycle p-3 border rounded-lg">
                    <h4 class="font-semibold">${cycle.label}</h4>
                    <div class="text-sm">
                        <span class="text-gray-600">Agendadas:</span> ${cycle.scheduled}<br>
                        <span class="text-green-600">Concluídas:</span> ${cycle.completed}<br>
                        ${cycle.overdue > 0 ? `<span class="text-red-600">Atrasadas:</span> ${cycle.overdue}` : ''}
                    </div>
                </div>
            `).join('');

            revisionsElement.innerHTML = `
                <div class="grid grid-cols-3 gap-3">
                    ${cycles}
                </div>
                ${revisions.debt > 0 ? 
                    `<div class="mt-3 p-3 bg-red-100 text-red-800 rounded-lg">
                        <strong>⚠️ Débito de revisão:</strong> ${revisions.debt} revisões atrasadas
                    </div>` 
                    : ''}
            `;
        }
    }

    /**
     * Renderiza informações do exame
     */
    renderExamInfo() {
        if (!this.dashboardData) return;

        const { exam } = this.dashboardData;
        const examInfoElement = document.getElementById('exam-info');
        
        if (examInfoElement) {
            const daysClass = exam.daysRemaining <= 30 ? 'text-red-600' : 
                             exam.daysRemaining <= 60 ? 'text-yellow-600' : 'text-green-600';
            
            examInfoElement.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <span class="text-gray-600">Data da Prova:</span>
                        <span class="font-semibold ml-2">
                            ${new Date(exam.date).toLocaleDateString('pt-BR')}
                        </span>
                    </div>
                    <div class="${daysClass} font-bold text-xl">
                        ${exam.daysRemaining} dias restantes
                    </div>
                </div>
            `;
        }
    }

    /**
     * Atualiza todos os componentes do dashboard
     */
    async updateDashboard() {
        try {
            // Mostrar indicador de carregamento
            this.showLoadingState();
            
            // Buscar dados
            await this.fetchDashboardData();
            
            // Renderizar componentes
            this.renderStatistics();
            this.renderRevisions();
            this.renderExamInfo();
            
            // Atualizar timestamp
            this.updateLastRefreshTime();
            
            // Remover indicador de carregamento
            this.hideLoadingState();
            
        } catch (error) {
            console.error('Erro ao atualizar dashboard:', error);
            this.showErrorState(error.message);
        }
    }

    /**
     * Mostra estado de carregamento
     */
    showLoadingState() {
        const indicator = document.getElementById('last-update-indicator');
        if (indicator) {
            indicator.innerHTML = `
                <span class="inline-flex items-center text-blue-600">
                    <svg class="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Atualizando dados...
                </span>
            `;
        }
    }

    /**
     * Esconde estado de carregamento
     */
    hideLoadingState() {
        const indicator = document.getElementById('last-update-indicator');
        if (indicator) {
            indicator.innerHTML = `
                <span class="inline-flex items-center text-green-600">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                    Dados atualizados
                </span>
            `;
        }
    }

    /**
     * Mostra estado de erro
     */
    showErrorState(message) {
        const indicator = document.getElementById('last-update-indicator');
        if (indicator) {
            indicator.innerHTML = `
                <span class="inline-flex items-center text-red-600">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    Erro: ${message}
                </span>
            `;
        }
    }

    /**
     * Atualiza timestamp da última atualização
     */
    updateLastRefreshTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const indicator = document.getElementById('last-update-indicator');
        if (indicator) {
            const currentHTML = indicator.innerHTML;
            indicator.innerHTML = currentHTML + ` <span class="text-xs">(${timeString})</span>`;
        }
    }

    /**
     * Inicia atualização automática
     */
    startAutoRefresh(intervalMinutes = 5) {
        // Limpar intervalo anterior se existir
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Configurar novo intervalo
        this.autoRefreshInterval = setInterval(() => {
            this.updateDashboard();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Para atualização automática
     */
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }
}

// Exportar para uso global
window.PlanDashboard = PlanDashboard;