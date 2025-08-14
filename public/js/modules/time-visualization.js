/**
 * @file js/modules/time-visualization.js
 * @description Módulo de visualização híbrida de tempo de estudo por disciplina
 * @version 1.0 - Gráfico de rosca + Acordeão aprimorado
 */

const TimeVisualization = {
    // Variável para armazenar instância do gráfico
    chartInstance: null,
    
    // Cores distintas para o gráfico
    distinctColors: [
        'rgba(59, 130, 246, 0.8)',   // Blue
        'rgba(34, 197, 94, 0.8)',    // Green
        'rgba(168, 85, 247, 0.8)',   // Purple
        'rgba(251, 146, 60, 0.8)',   // Orange
        'rgba(236, 72, 153, 0.8)',   // Pink
        'rgba(20, 184, 166, 0.8)',   // Teal
        'rgba(245, 158, 11, 0.8)',   // Amber
        'rgba(239, 68, 68, 0.8)',    // Red
        'rgba(99, 102, 241, 0.8)',   // Indigo
        'rgba(14, 165, 233, 0.8)',   // Sky
    ],
    
    /**
     * Gera cores distintas para o gráfico
     */
    generateColors(count) {
        const colors = [...this.distinctColors];
        
        // Se precisar de mais cores, gera aleatórias
        while (colors.length < count) {
            const r = Math.floor(Math.random() * 200) + 55;
            const g = Math.floor(Math.random() * 200) + 55;
            const b = Math.floor(Math.random() * 200) + 55;
            colors.push(`rgba(${r}, ${g}, ${b}, 0.8)`);
        }
        
        return colors.slice(0, count);
    },
    
    /**
     * Cria container HTML para visualização híbrida
     */
    createVisualizationContainer() {
        return `
            <div class="mt-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-700 flex items-center">
                        <span class="text-lg mr-2">🔬</span>Análise Detalhada por Disciplina
                    </h3>
                    <!-- Toggle de Visualização -->
                    <div class="flex bg-gray-100 rounded-lg p-1">
                        <button id="chartViewBtn" class="px-3 py-1 text-sm font-medium rounded-md bg-white text-gray-700 shadow-sm transition-all" onclick="TimeVisualization.toggleView('chart')">
                            📊 Gráfico
                        </button>
                        <button id="detailViewBtn" class="px-3 py-1 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 transition-all" onclick="TimeVisualization.toggleView('detail')">
                            📋 Detalhado
                        </button>
                    </div>
                </div>
                
                <!-- Visualização em Gráfico -->
                <div id="chartVisualization" class="">
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="lg:col-span-2">
                            <div class="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <canvas id="timeDistributionChart" width="400" height="300"></canvas>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <!-- Cards de resumo -->
                            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                                <h4 class="text-sm font-semibold text-blue-800 mb-2 flex items-center">
                                    <span class="mr-2">⏱️</span>Tempo Total
                                </h4>
                                <p class="text-2xl font-bold text-blue-600" id="totalTimeStudied">00:00h</p>
                                <p class="text-xs text-blue-600 mt-1">acumulado em todas as disciplinas</p>
                            </div>
                            <div class="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                                <h4 class="text-sm font-semibold text-green-800 mb-2 flex items-center">
                                    <span class="mr-2">🎯</span>Disciplina Foco
                                </h4>
                                <p class="text-lg font-bold text-green-600" id="topSubject">-</p>
                                <p class="text-xs text-green-600 mt-1" id="topSubjectTime">0% do tempo total</p>
                            </div>
                            <div class="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
                                <h4 class="text-sm font-semibold text-purple-800 mb-2 flex items-center">
                                    <span class="mr-2">📊</span>Média por Disciplina
                                </h4>
                                <p class="text-lg font-bold text-purple-600" id="avgTimePerSubject">00:00h</p>
                                <p class="text-xs text-purple-600 mt-1" id="subjectCount">0 disciplinas</p>
                            </div>
                            <div class="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-200">
                                <h4 class="text-sm font-semibold text-orange-800 mb-2 flex items-center">
                                    <span class="mr-2">🚀</span>Produtividade
                                </h4>
                                <p class="text-lg font-bold text-orange-600" id="productivityRate">-</p>
                                <p class="text-xs text-orange-600 mt-1">tópicos/hora em média</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Visualização em Acordeão -->
                <div id="detailVisualization" class="hidden">
                    <div id="detailedProgressAccordion" class="space-y-2">
                        <div class="text-gray-500 text-center p-4">Carregando análise detalhada...</div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * Alterna entre visualizações
     */
    toggleView(view) {
        const chartBtn = document.getElementById('chartViewBtn');
        const detailBtn = document.getElementById('detailViewBtn');
        const chartView = document.getElementById('chartVisualization');
        const detailView = document.getElementById('detailVisualization');
        
        if (!chartBtn || !detailBtn || !chartView || !detailView) return;
        
        if (view === 'chart') {
            // Ativar visualização de gráfico
            chartBtn.classList.add('bg-white', 'text-gray-700', 'shadow-sm');
            chartBtn.classList.remove('text-gray-500');
            detailBtn.classList.remove('bg-white', 'text-gray-700', 'shadow-sm');
            detailBtn.classList.add('text-gray-500');
            
            chartView.classList.remove('hidden');
            detailView.classList.add('hidden');
        } else {
            // Ativar visualização detalhada
            detailBtn.classList.add('bg-white', 'text-gray-700', 'shadow-sm');
            detailBtn.classList.remove('text-gray-500');
            chartBtn.classList.remove('bg-white', 'text-gray-700', 'shadow-sm');
            chartBtn.classList.add('text-gray-500');
            
            detailView.classList.remove('hidden');
            chartView.classList.add('hidden');
        }
        
        // Salvar preferência no localStorage
        localStorage.setItem('timeVisualizationPreference', view);
    },
    
    /**
     * Renderiza o gráfico de rosca
     */
    renderDoughnutChart(subjectsWithTime) {
        const ctx = document.getElementById('timeDistributionChart');
        if (!ctx) return;
        
        // Destruir gráfico anterior se existir
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }
        
        // Criar novo gráfico
        this.chartInstance = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: subjectsWithTime.map(s => s.name),
                datasets: [{
                    data: subjectsWithTime.map(s => s.totalTime / 3600), // Converter para horas
                    backgroundColor: this.generateColors(subjectsWithTime.length),
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#1f2937'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 11,
                                family: "'Inter', sans-serif"
                            },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const hours = value.toFixed(1);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return {
                                            text: `${label} (${hours}h - ${percentage}%)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const hours = context.parsed.toFixed(1);
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${hours}h (${percentage}%)`;
                            },
                            afterLabel: function(context) {
                                // Adicionar informação extra
                                const subjectData = subjectsWithTime[context.dataIndex];
                                if (subjectData) {
                                    const topicsStudied = subjectData.topics?.filter(t => t.timeStudied > 0).length || 0;
                                    const totalTopics = subjectData.topics?.length || 0;
                                    return `Tópicos: ${topicsStudied}/${totalTopics}`;
                                }
                                return '';
                            }
                        }
                    }
                },
                cutout: '60%', // Tamanho do buraco central
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        // Ao clicar em um segmento, mudar para visualização detalhada
                        this.toggleView('detail');
                        // Expandir o acordeão correspondente
                        const index = elements[0].index;
                        setTimeout(() => {
                            const accordions = document.querySelectorAll('.accordion-header');
                            if (accordions[index]) {
                                // Fechar todos os acordeões
                                accordions.forEach(acc => {
                                    const content = acc.nextElementSibling;
                                    const arrow = acc.querySelector('svg');
                                    acc.classList.remove('open');
                                    content.style.maxHeight = null;
                                    if (arrow) arrow.style.transform = 'rotate(0deg)';
                                });
                                
                                // Abrir o acordeão clicado
                                const header = accordions[index];
                                const content = header.nextElementSibling;
                                const arrow = header.querySelector('svg');
                                header.classList.add('open');
                                content.style.maxHeight = `${content.scrollHeight}px`;
                                if (arrow) arrow.style.transform = 'rotate(180deg)';
                                
                                // Scroll suave até o elemento
                                header.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }, 100);
                    }
                }
            }
        });
    },
    
    /**
     * Renderiza o acordeão aprimorado
     */
    renderEnhancedAccordion(subjectDetails, sanitizeHtml, formatTime) {
        const accordionContainer = document.getElementById('detailedProgressAccordion');
        if (!accordionContainer) return;
        
        accordionContainer.innerHTML = subjectDetails.map((subject, idx) => {
            const subjectPercentage = subject.progress.toFixed(1);
            const subjectTimeDisplay = subject.totalTime > 0
                ? formatTime(subject.totalTime).substring(0, 5) + 'h'
                : '–';
            
            // Cor do indicador baseada no tempo de estudo
            const timeIndicatorColor = subject.totalTime > 7200 ? 'bg-green-500' : 
                                      subject.totalTime > 3600 ? 'bg-yellow-500' : 
                                      subject.totalTime > 0 ? 'bg-orange-500' : 'bg-gray-300';
            
            // Calcular estatísticas da disciplina
            const topicsWithTime = subject.topics.filter(t => t.timeStudied > 0);
            const avgTimePerTopic = topicsWithTime.length > 0 
                ? subject.totalTime / topicsWithTime.length 
                : 0;
            
            const topicsHtml = subject.topics.length > 0 ? subject.topics.map(topic => {
                const timeDisplay = formatTime(topic.timeStudied, '–');
                const timeClass = topic.timeStudied > 0 ? 'text-gray-600' : 'text-gray-400';
                const statusIcon = topic.timeStudied > 0 ? '✅' : '⏳';
                
                // Barra de progresso individual do tópico
                const maxTopicTime = Math.max(...subject.topics.map(t => t.timeStudied));
                const topicProgress = maxTopicTime > 0 ? (topic.timeStudied / maxTopicTime) * 100 : 0;
                
                return `
                <li class="flex flex-col py-2 px-3 rounded hover:bg-slate-100 transition-all">
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-gray-600 flex items-center flex-1">
                            <span class="mr-2">${statusIcon}</span>
                            <span class="truncate">${sanitizeHtml(topic.description)}</span>
                        </span>
                        <span class="font-medium ${timeClass} ml-2">${timeDisplay}</span>
                    </div>
                    ${topic.timeStudied > 0 ? `
                        <div class="mt-1 w-full bg-gray-200 rounded-full h-1">
                            <div class="bg-blue-400 h-1 rounded-full transition-all" style="width: ${topicProgress}%"></div>
                        </div>
                    ` : ''}
                </li>
            `}).join('') : '<li class="text-sm text-gray-500 px-2">Nenhum tópico cadastrado.</li>';
            
            return `
                <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200">
                    <div class="accordion-header p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50 transition-colors">
                        <div class="flex-grow">
                            <div class="flex justify-between items-center mb-2">
                                <div class="flex items-center space-x-2">
                                    <div class="w-2 h-2 rounded-full ${timeIndicatorColor} animate-pulse"></div>
                                    <span class="font-semibold text-gray-800">${sanitizeHtml(subject.name)}</span>
                                </div>
                                <div class="flex items-center space-x-3">
                                    <span class="text-sm font-bold text-editaliza-blue">${subjectTimeDisplay}</span>
                                    <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                        ${subjectPercentage}%
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center space-x-4">
                                <div class="flex-1">
                                    <div class="progress-bar-container">
                                        <div class="progress-bar-compact bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500" 
                                             style="width: ${subjectPercentage}%;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <svg class="w-5 h-5 text-gray-500 ml-4 transform transition-transform duration-200" 
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </div>
                    <div class="accordion-content bg-gray-50 border-t border-gray-100" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
                        <ul class="p-4 space-y-1">
                            ${topicsHtml}
                        </ul>
                        <div class="px-4 pb-3 text-xs text-gray-600 border-t border-gray-200 pt-3 bg-white">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex items-center">
                                    <span class="mr-2">📊</span>
                                    <span>Tópicos estudados: <strong>${topicsWithTime.length}/${subject.topics.length}</strong></span>
                                </div>
                                <div class="flex items-center">
                                    <span class="mr-2">⏱️</span>
                                    <span>Tempo médio: <strong>${avgTimePerTopic > 0 ? 
                                        formatTime(avgTimePerTopic).substring(0, 5) + 'h' : '-'}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Adicionar event listeners para acordeão
        this.setupAccordionListeners();
    },
    
    /**
     * Configura listeners do acordeão
     */
    setupAccordionListeners() {
        const accordionContainer = document.getElementById('detailedProgressAccordion');
        if (!accordionContainer) return;
        
        accordionContainer.addEventListener('click', (event) => {
            const header = event.target.closest('.accordion-header');
            if (!header) return;
            
            const content = header.nextElementSibling;
            const arrow = header.querySelector('svg');
            const isOpen = header.classList.contains('open');
            
            // Fechar todos os outros acordeões
            document.querySelectorAll('.accordion-header').forEach(h => {
                if (h !== header && h.classList.contains('open')) {
                    const c = h.nextElementSibling;
                    const a = h.querySelector('svg');
                    h.classList.remove('open');
                    c.style.maxHeight = '0';
                    if (a) a.style.transform = 'rotate(0deg)';
                }
            });
            
            // Toggle do acordeão clicado
            if (isOpen) {
                header.classList.remove('open');
                content.style.maxHeight = '0';
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            } else {
                header.classList.add('open');
                content.style.maxHeight = `${content.scrollHeight}px`;
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            }
        });
    },
    
    /**
     * Atualiza visualização com dados
     */
    updateVisualization(data, formatTime, sanitizeHtml) {
        // Verificar se o container principal existe
        const mainContainer = document.getElementById('timeAnalysisContainer');
        if (!mainContainer || !mainContainer.querySelector('#chartVisualization')) {
            console.warn('⚠️ Container de visualização não encontrado, pulando atualização');
            return;
        }
        
        // Filtrar disciplinas com tempo
        const subjectsWithTime = data.subjectDetails.filter(s => s.totalTime > 0);
        
        if (subjectsWithTime.length > 0) {
            // Calcular estatísticas
            const totalTimeSeconds = subjectsWithTime.reduce((sum, s) => sum + s.totalTime, 0);
            const avgTimeSeconds = totalTimeSeconds / subjectsWithTime.length;
            const topSubject = subjectsWithTime.reduce((max, s) => s.totalTime > max.totalTime ? s : max, subjectsWithTime[0]);
            
            // Calcular produtividade
            const totalTopicsStudied = subjectsWithTime.reduce((sum, s) => 
                sum + s.topics.filter(t => t.timeStudied > 0).length, 0);
            const productivityRate = totalTimeSeconds > 0 
                ? (totalTopicsStudied / (totalTimeSeconds / 3600)).toFixed(1)
                : '0';
            
            // Atualizar cards de resumo com verificação de null
            const totalTimeElement = document.getElementById('totalTimeStudied');
            const topSubjectElement = document.getElementById('topSubject');
            const topSubjectTimeElement = document.getElementById('topSubjectTime');
            const avgTimeElement = document.getElementById('avgTimePerSubject');
            const subjectCountElement = document.getElementById('subjectCount');
            const productivityElement = document.getElementById('productivityRate');
            
            if (totalTimeElement) totalTimeElement.textContent = formatTime(totalTimeSeconds).substring(0, 5) + 'h';
            if (topSubjectElement) topSubjectElement.textContent = topSubject.name;
            if (topSubjectTimeElement) topSubjectTimeElement.textContent = `${((topSubject.totalTime / totalTimeSeconds) * 100).toFixed(1)}% do tempo total`;
            if (avgTimeElement) avgTimeElement.textContent = formatTime(avgTimeSeconds).substring(0, 5) + 'h';
            if (subjectCountElement) subjectCountElement.textContent = `${subjectsWithTime.length} disciplina${subjectsWithTime.length > 1 ? 's' : ''}`;
            if (productivityElement) productivityElement.textContent = productivityRate;
            
            // Renderizar gráfico
            this.renderDoughnutChart(subjectsWithTime);
        } else {
            // Sem dados de tempo - usar as mesmas variáveis com verificação
            const totalTimeElement = document.getElementById('totalTimeStudied');
            const topSubjectElement = document.getElementById('topSubject');
            const topSubjectTimeElement = document.getElementById('topSubjectTime');
            const avgTimeElement = document.getElementById('avgTimePerSubject');
            const subjectCountElement = document.getElementById('subjectCount');
            const productivityElement = document.getElementById('productivityRate');
            
            if (totalTimeElement) totalTimeElement.textContent = '00:00h';
            if (topSubjectElement) topSubjectElement.textContent = '-';
            if (topSubjectTimeElement) topSubjectTimeElement.textContent = '0% do tempo total';
            if (avgTimeElement) avgTimeElement.textContent = '00:00h';
            if (subjectCountElement) subjectCountElement.textContent = '0 disciplinas';
            if (productivityElement) productivityElement.textContent = '-';
            
            // Mostrar mensagem no lugar do gráfico
            const chartContainer = document.getElementById('chartVisualization');
            if (chartContainer) {
                chartContainer.innerHTML = '<p class="text-gray-500 text-center p-8">Nenhuma disciplina com tempo registrado para exibir no gráfico.</p>';
            }
        }
        
        // Sempre renderizar acordeão (mesmo sem tempo)
        this.renderEnhancedAccordion(data.subjectDetails, sanitizeHtml, formatTime);
        
        // Restaurar preferência de visualização
        const preference = localStorage.getItem('timeVisualizationPreference') || 'chart';
        this.toggleView(preference);
    }
};

// Disponibilizar globalmente
window.TimeVisualization = TimeVisualization;