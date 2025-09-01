/**
 * Plan Page - Versão corrigida para consumir o novo endpoint
 */

(function() {
    'use strict';
    
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('id');
    let dashboardData = null;
    
    // Função principal de inicialização
    async function initialize() {
        if (!planId) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        try {
            console.log('🚀 Iniciando carregamento do plano', planId);
            
            // Renderizar navegação
            if (window.components?.renderMainNavigation) {
                await window.components.renderMainNavigation('plan.html');
            }
            
            // Buscar dados do novo endpoint consolidado
            const token = localStorage.getItem('editaliza_token');
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`/api/plans/${planId}/dashboard`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Erro ao carregar dashboard: ${response.status}`);
            }
            
            dashboardData = await response.json();
            console.log('✅ Dados recebidos:', dashboardData);
            
            // Renderizar header com nome do plano
            const headerContainer = document.getElementById('plan-header-container');
            if (headerContainer && dashboardData.exam) {
                headerContainer.innerHTML = `
                    <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <div class="flex justify-between items-center">
                            <div>
                                <h1 class="text-2xl font-bold text-gray-800">Plano de Estudos</h1>
                                <p class="text-gray-600 mt-1">Acompanhe seu progresso</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm text-gray-500">Dias restantes</p>
                                <p class="text-3xl font-bold ${dashboardData.exam.daysRemaining <= 30 ? 'text-red-600' : 'text-blue-600'}">
                                    ${dashboardData.exam.daysRemaining}
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Renderizar todos os componentes
            renderGamification();
            renderPerformance();
            renderSchedule();
            renderProgress();
            renderSubjectAnalysis();
            renderStudyTimeDistribution();
            renderGoalProgress();
            renderQuestionRadar();
            
        } catch (error) {
            console.error('❌ Erro ao carregar dashboard:', error);
            showError(error.message);
        }
    }
    
    // Renderizar gamificação REAL do backend
    async function renderGamification() {
        const container = document.getElementById('gamification-dashboard');
        console.log('🎮 Buscando gamificação REAL do backend...');
        
        if (!container) {
            console.error('❌ Container gamification-dashboard não encontrado!');
            return;
        }
        
        // Mostrar loading
        container.innerHTML = '<p class="text-center text-gray-500 animate-pulse">Carregando sistema de gamificação...</p>';
        
        try {
            // Buscar dados REAIS do backend
            const token = localStorage.getItem('editaliza_token');
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            // Chamar endpoint real de gamificação
            const response = await fetch('/api/gamification/profile', {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if (response.ok) {
                const gamificationData = await response.json();
                console.log('✅ Dados REAIS de gamificação recebidos:', gamificationData);
                
                // Usar o módulo de gamificação real
                if (window.Gamification && window.Gamification.renderGamificationDashboard) {
                    window.Gamification.renderGamificationDashboard(gamificationData, 'gamification-dashboard');
                    
                    // Atualizar streak no header
                    const streakDisplay = document.getElementById('streak-display');
                    if (streakDisplay) {
                        streakDisplay.textContent = gamificationData.current_streak || '0';
                    }
                } else {
                    console.warn('Módulo Gamification não carregado, usando fallback');
                    renderGamificationFallback();
                }
            } else {
                console.error('Erro ao buscar gamificação:', response.status);
                renderGamificationFallback();
            }
        } catch (error) {
            console.error('Erro ao conectar com backend de gamificação:', error);
            renderGamificationFallback();
        }
    }
    
    // Fallback caso não consiga carregar dados reais
    function renderGamificationFallback() {
        const container = document.getElementById('gamification-dashboard');
        if (!container || !dashboardData) return
        
        const { pace, projection, uiHints, progress } = dashboardData;
        
        // Atualizar o contador de streak (0 por enquanto)
        const streakDisplay = document.getElementById('streak-display');
        if (streakDisplay) {
            streakDisplay.textContent = '0';
        }
        
        // Determinar cor do status
        const statusColors = {
            'on-track': 'bg-green-100 text-green-800 border-green-200',
            'attention-needed': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'off-track': 'bg-red-100 text-red-800 border-red-200'
        };
        
        const statusClass = statusColors[uiHints?.statusColor] || statusColors['off-track'];
        
        // Renderizar informações interpretadas e ricas
        const completedPct = progress?.completedPct || 0;
        const totalTopics = dashboardData.schedule?.totalTopics || 0;
        const completedTopics = progress?.completedTopics || 0;
        const pendingTopics = progress?.pendingTopics || 0;
        const daysRemaining = dashboardData.exam?.daysRemaining || 0;
        const requiredPace = pace?.requiredTopicsPerDay || 0;
        const currentPace = pace?.currentTopicsPerDay || 0;
        
        // Calcular informações adicionais
        const coverageInfo = dashboardData.schedule?.coveragePct > 100 
            ? "Cronograma com revisões incluídas" 
            : `${dashboardData.schedule?.coveragePct}% do edital coberto`;
            
        const paceMessage = currentPace >= requiredPace 
            ? "✅ Ritmo adequado para terminar a tempo"
            : `⚠️ Aumente ${(requiredPace - currentPace).toFixed(1)} tópicos/dia`;
        
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">📊 Diagnóstico do Seu Progresso</h2>
                
                <!-- Status Principal com Interpretação -->
                <div class="${statusClass} rounded-lg p-4 border mb-4">
                    <h3 class="font-bold text-lg">${uiHints?.headline || 'Analisando...'}</h3>
                    <p class="text-sm mt-1">${uiHints?.subtext || ''}</p>
                    <p class="text-xs mt-2 opacity-75">${paceMessage}</p>
                </div>
                
                <!-- Métricas Interpretadas -->
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <!-- O que você planejou -->
                    <div class="bg-blue-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">📋 O que planejou</p>
                        <p class="text-lg font-bold text-blue-700">${totalTopics} tópicos</p>
                        <p class="text-xs text-gray-500">${coverageInfo}</p>
                    </div>
                    
                    <!-- Onde você está -->
                    <div class="bg-green-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">📍 Onde está</p>
                        <p class="text-lg font-bold text-green-700">${completedTopics} concluídos</p>
                        <p class="text-xs text-gray-500">${completedPct.toFixed(1)}% do plano</p>
                    </div>
                    
                    <!-- O que falta -->
                    <div class="bg-orange-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">🎯 O que falta</p>
                        <p class="text-lg font-bold text-orange-700">${pendingTopics} tópicos</p>
                        <p class="text-xs text-gray-500">em ${daysRemaining} dias</p>
                    </div>
                </div>
                
                <!-- Análise de Ritmo -->
                <div class="bg-gray-50 rounded-lg p-3 mb-4">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-sm font-semibold text-gray-700">Análise de Ritmo</p>
                            <p class="text-xs text-gray-500 mt-1">
                                Você precisa estudar <span class="font-bold text-gray-700">${requiredPace.toFixed(1)}</span> tópicos/dia
                                ${currentPace > 0 ? ` (atual: ${currentPace.toFixed(1)})` : ''}
                            </p>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-bold ${projection?.onTrack ? 'text-green-600' : 'text-red-600'}">
                                ${daysRemaining}
                            </p>
                            <p class="text-xs text-gray-500">dias restantes</p>
                        </div>
                    </div>
                </div>
                
                <!-- Conquistas com Títulos e Frases -->
                <div class="mt-4">
                    <h3 class="text-sm font-semibold text-gray-600 mb-2">🏆 Suas Conquistas</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <!-- Conquista: Iniciante -->
                        <div class="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-2 border border-blue-200">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">🎯</span>
                                <div class="flex-1">
                                    <p class="text-xs font-bold text-blue-800">Jornada Iniciada</p>
                                    <p class="text-xs text-blue-600">"Todo expert já foi iniciante"</p>
                                </div>
                            </div>
                        </div>
                        
                        ${progress?.sessions?.sessionsCompleted >= 1 ? `
                        <div class="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-2 border border-green-200">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">✅</span>
                                <div class="flex-1">
                                    <p class="text-xs font-bold text-green-800">Primeira Lapada no Edital</p>
                                    <p class="text-xs text-green-600">"O primeiro passo foi dado!"</p>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${progress?.completedTopics >= 5 ? `
                        <div class="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-2 border border-purple-200">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">💪</span>
                                <div class="flex-1">
                                    <p class="text-xs font-bold text-purple-800">Momentum</p>
                                    <p class="text-xs text-purple-600">"5 tópicos dominados!"</p>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${progress?.completedTopics >= 10 ? `
                        <div class="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-2 border border-yellow-200">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">⭐</span>
                                <div class="flex-1">
                                    <p class="text-xs font-bold text-yellow-800">Dezena Conquistada</p>
                                    <p class="text-xs text-yellow-600">"10 tópicos no bolso!"</p>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${progress?.completedTopics >= 25 ? `
                        <div class="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-2 border border-orange-200">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">🔥</span>
                                <div class="flex-1">
                                    <p class="text-xs font-bold text-orange-800">Quarteto de Ferro</p>
                                    <p class="text-xs text-orange-600">"25% do caminho percorrido!"</p>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Renderizar diagnóstico de performance
    function renderPerformance() {
        const container = document.getElementById('performanceDashboard');
        if (!container || !dashboardData) return;
        
        const { progress, schedule, revisions } = dashboardData;
        
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Card de Tópicos -->
                <div class="bg-white rounded-lg p-4 border border-gray-200">
                    <h3 class="text-sm font-semibold text-gray-600 mb-2">TÓPICOS</h3>
                    <p class="text-2xl font-bold text-gray-800">${progress?.completedTopics || 0}</p>
                    <p class="text-xs text-gray-500">de ${schedule?.totalTopics || 0} concluídos</p>
                    <div class="mt-2 bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${progress?.completedPct || 0}%"></div>
                    </div>
                </div>
                
                <!-- Card de Sessões -->
                <div class="bg-white rounded-lg p-4 border border-gray-200">
                    <h3 class="text-sm font-semibold text-gray-600 mb-2">SESSÕES</h3>
                    <p class="text-2xl font-bold text-gray-800">${progress?.sessions?.sessionsCompleted || 0}</p>
                    <p class="text-xs text-gray-500">sessões concluídas</p>
                    <div class="mt-2">
                        <span class="text-xs text-gray-500">Estudo: ${progress?.sessions?.studyInitialCount || 0}</span>
                        <span class="text-xs text-gray-500 ml-2">Revisão: ${progress?.sessions?.revisionCount || 0}</span>
                    </div>
                </div>
                
                <!-- Card de Revisões -->
                <div class="bg-white rounded-lg p-4 border border-gray-200">
                    <h3 class="text-sm font-semibold text-gray-600 mb-2">REVISÕES</h3>
                    <p class="text-2xl font-bold ${revisions?.debt > 0 ? 'text-red-600' : 'text-green-600'}">
                        ${revisions?.debt || 0}
                    </p>
                    <p class="text-xs text-gray-500">revisões pendentes</p>
                    <div class="mt-2 flex gap-2 text-xs">
                        ${revisions?.cycles?.map(c => `
                            <span class="${c.overdue > 0 ? 'text-red-600' : 'text-gray-500'}">
                                ${c.label}: ${c.overdue}
                            </span>
                        `).join('') || ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Renderizar cronograma com informações interpretadas
    function renderSchedule() {
        const container = document.getElementById('scheduleDashboard');
        if (!container || !dashboardData) return;
        
        const { schedule, exam, projection, progress, revisions } = dashboardData;
        
        // Calcular informações sobre o cronograma
        const unscheduledPct = schedule?.totalTopics > 0 
            ? ((schedule?.unscheduledTopics / schedule?.totalTopics) * 100).toFixed(1)
            : 0;
            
        const sessionsTotal = (progress?.sessions?.studyInitialCount || 0) + (progress?.sessions?.revisionCount || 0);
        
        container.innerHTML = `
            <div class="bg-white rounded-lg p-4">
                <h3 class="font-semibold text-gray-700 mb-3">📅 Seu Cronograma Explicado</h3>
                
                <!-- Resumo do que foi planejado -->
                <div class="bg-blue-50 rounded-lg p-3 mb-3">
                    <p class="text-sm font-semibold text-blue-800 mb-1">O que você planejou:</p>
                    <ul class="text-xs text-blue-700 space-y-1">
                        <li>• ${schedule?.scheduledTopics || 0} tópicos novos para estudar</li>
                        <li>• ${progress?.sessions?.revisionCount || 0} sessões de revisão automáticas</li>
                        <li>• Total: ${sessionsTotal} sessões de estudo</li>
                        ${schedule?.unscheduledTopics > 0 ? `
                            <li class="text-orange-600">• ⚠️ ${schedule?.unscheduledTopics} tópicos não couberam no prazo (${unscheduledPct}%)</li>
                        ` : ''}
                    </ul>
                </div>
                
                <!-- Sistema de Revisões -->
                <div class="bg-purple-50 rounded-lg p-3 mb-3">
                    <p class="text-sm font-semibold text-purple-800 mb-1">🔄 Sistema de Revisões:</p>
                    <div class="text-xs text-purple-700">
                        <p class="mb-1">Cada tópico estudado gera 3 revisões automáticas:</p>
                        <div class="grid grid-cols-3 gap-2 mt-1">
                            <div class="text-center">
                                <span class="font-bold">7 dias</span>
                                <p class="text-xs">Consolidação</p>
                            </div>
                            <div class="text-center">
                                <span class="font-bold">14 dias</span>
                                <p class="text-xs">Reforço</p>
                            </div>
                            <div class="text-center">
                                <span class="font-bold">28 dias</span>
                                <p class="text-xs">Fixação</p>
                            </div>
                        </div>
                        ${revisions?.debt > 0 ? `
                            <p class="mt-2 text-red-600 font-semibold">⚠️ Você tem ${revisions.debt} revisões atrasadas!</p>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Projeção Interpretada -->
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-sm font-semibold text-gray-700 mb-1">📊 Projeção:</p>
                    <div class="text-xs text-gray-600">
                        ${projection?.onTrack ? `
                            <p class="text-green-600 font-semibold">✅ No ritmo certo! Mantenha ${dashboardData.pace?.requiredTopicsPerDay?.toFixed(1)} tópicos/dia</p>
                        ` : `
                            <p class="text-red-600 font-semibold">⚠️ Ritmo insuficiente! Precisa acelerar para ${dashboardData.pace?.requiredTopicsPerDay?.toFixed(1)} tópicos/dia</p>
                        `}
                        <p class="mt-1">Data da prova: ${exam?.date ? new Date(exam.date).toLocaleDateString('pt-BR') : 'N/A'}</p>
                        <p>Dias restantes: ${exam?.daysRemaining || 0}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Renderizar progresso geral com gráficos visuais
    function renderProgress() {
        const container = document.getElementById('progressDashboard');
        if (!container || !dashboardData) return;
        
        const { progress, schedule, revisions } = dashboardData;
        
        // Calcular percentuais para gráficos
        const completedPct = progress?.completedPct || 0;
        const pendingPct = 100 - completedPct;
        const totalTopics = schedule?.totalTopics || 0;
        const completedTopics = progress?.completedTopics || 0;
        const pendingTopics = progress?.pendingTopics || 0;
        
        // Criar gráfico de pizza simples com CSS
        const pieChart = completedPct > 0 ? `
            background: conic-gradient(
                #10b981 0deg ${completedPct * 3.6}deg,
                #e5e7eb ${completedPct * 3.6}deg 360deg
            );
        ` : 'background: #e5e7eb;';
        
        container.innerHTML = `
            <div class="bg-white rounded-lg p-6">
                <h3 class="font-semibold text-gray-700 mb-4">📈 Visão Geral do Progresso</h3>
                
                <!-- Gráfico de Pizza e Estatísticas -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <!-- Gráfico de Pizza -->
                    <div class="flex flex-col items-center justify-center">
                        <div class="relative mb-4">
                            <div class="w-36 h-36 rounded-full shadow-inner" style="${pieChart}"></div>
                            <div class="absolute inset-0 flex items-center justify-center">
                                <div class="text-center bg-white rounded-full w-28 h-28 flex flex-col items-center justify-center shadow-lg">
                                    <span class="text-3xl font-bold text-gray-800">${completedPct.toFixed(0)}%</span>
                                    <span class="text-sm text-gray-500 font-medium">Completo</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-4 text-sm">
                            <div class="flex items-center gap-2">
                                <div class="w-4 h-4 bg-green-500 rounded shadow-sm"></div>
                                <span class="text-gray-700">Concluído <span class="font-bold">(${completedTopics})</span></span>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="w-4 h-4 bg-gray-300 rounded shadow-sm"></div>
                                <span class="text-gray-700">Pendente <span class="font-bold">(${pendingTopics})</span></span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Barras de Progresso Detalhadas -->
                    <div class="space-y-3">
                        <!-- Tópicos -->
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="text-gray-600">Tópicos Estudados</span>
                                <span class="font-semibold">${completedTopics} de ${totalTopics}</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500"
                                     style="width: ${completedPct}%"></div>
                            </div>
                        </div>
                        
                        <!-- Sessões -->
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="text-gray-600">Sessões Concluídas</span>
                                <span class="font-semibold">${progress?.sessions?.sessionsCompleted || 0} de ${(progress?.sessions?.studyInitialCount || 0) + (progress?.sessions?.revisionCount || 0)}</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                                     style="width: ${((progress?.sessions?.sessionsCompleted || 0) / ((progress?.sessions?.studyInitialCount || 0) + (progress?.sessions?.revisionCount || 0))) * 100}%"></div>
                            </div>
                        </div>
                        
                        <!-- Revisões -->
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="text-gray-600">Revisões em Dia</span>
                                <span class="font-semibold ${revisions?.debt > 0 ? 'text-red-600' : 'text-green-600'}">
                                    ${revisions?.debt > 0 ? `${revisions.debt} atrasadas` : 'Tudo em dia'}
                                </span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-gradient-to-r ${revisions?.debt > 0 ? 'from-red-400 to-red-600' : 'from-purple-400 to-purple-600'} h-2 rounded-full transition-all duration-500"
                                     style="width: ${revisions?.debt > 0 ? '100' : '0'}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Cards de Métricas -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
                        <p class="text-2xl font-bold text-green-700">${completedTopics}</p>
                        <p class="text-xs text-green-600">Tópicos Dominados</p>
                    </div>
                    <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 text-center">
                        <p class="text-2xl font-bold text-orange-700">${pendingTopics}</p>
                        <p class="text-xs text-orange-600">Ainda Faltam</p>
                    </div>
                    <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
                        <p class="text-2xl font-bold text-blue-700">${progress?.sessions?.sessionsCompleted || 0}</p>
                        <p class="text-xs text-blue-600">Sessões Feitas</p>
                    </div>
                    <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 text-center">
                        <p class="text-2xl font-bold text-purple-700">${revisions?.debt || 0}</p>
                        <p class="text-xs text-purple-600">Revisões Pendentes</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    
    // Renderizar análise por disciplina
    async function renderSubjectAnalysis() {
        const container = document.getElementById('detailedProgressAccordion');
        if (!container || !dashboardData) return;
        
        // Buscar dados de tempo de estudo por disciplina
        try {
            const token = localStorage.getItem('editaliza_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(`/api/plans/${planId}/study-time`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.subjects && data.subjects.length > 0) {
                    // Renderizar dados reais
                    const subjectsHtml = data.subjects.map(subject => `
                        <div class="border rounded-lg p-4 mb-3 hover:bg-gray-50 transition-colors">
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="font-semibold text-gray-800">${subject.name}</h4>
                                <span class="text-sm font-medium text-blue-600">
                                    ${Math.floor(subject.totalTimeSeconds / 3600)}h ${Math.floor((subject.totalTimeSeconds % 3600) / 60)}min
                                </span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-blue-500 h-2 rounded-full" style="width: ${(subject.totalTimeSeconds / data.totalStudyTimeSeconds * 100).toFixed(1)}%"></div>
                            </div>
                            ${subject.topics && subject.topics.length > 0 ? `
                                <div class="mt-2 space-y-1">
                                    ${subject.topics.slice(0, 3).map(topic => `
                                        <div class="text-xs text-gray-600 pl-4">
                                            • ${topic.name}: ${Math.floor(topic.timeSeconds / 60)} min
                                        </div>
                                    `).join('')}
                                    ${subject.topics.length > 3 ? `
                                        <div class="text-xs text-gray-500 pl-4">... e mais ${subject.topics.length - 3} tópicos</div>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `).join('');
                    
                    container.innerHTML = `
                        <div class="space-y-2">
                            <div class="text-sm text-gray-600 mb-3">
                                Total estudado: <span class="font-bold">${Math.floor(data.totalStudyTimeSeconds / 3600)}h ${Math.floor((data.totalStudyTimeSeconds % 3600) / 60)}min</span>
                            </div>
                            ${subjectsHtml}
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div class="text-center py-8 text-gray-500">
                            <p class="text-lg mb-2">📚 Ainda sem dados de estudo</p>
                            <p class="text-sm">Complete algumas sessões para ver a análise detalhada</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Erro ao buscar análise por disciplina:', error);
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>Erro ao carregar análise por disciplina</p>
                </div>
            `;
        }
    }
    
    // Renderizar metas de progresso
    function renderGoalProgress() {
        const container = document.getElementById('goalProgressDashboard');
        if (!container || !dashboardData) return;
        
        const { plan } = dashboardData;
        
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-blue-50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm text-gray-600">Meta Diária</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">📅</span>
                    </div>
                    <p class="text-2xl font-bold text-blue-600">${plan?.dailyGoal || 50}</p>
                    <p class="text-xs text-gray-500">questões/dia</p>
                </div>
                <div class="bg-purple-50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm text-gray-600">Meta Semanal</span>
                        <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">📊</span>
                    </div>
                    <p class="text-2xl font-bold text-purple-600">${plan?.weeklyGoal || 300}</p>
                    <p class="text-xs text-gray-500">questões/semana</p>
                </div>
            </div>
        `;
    }
    
    // Renderizar radar de questões
    function renderQuestionRadar() {
        const container = document.getElementById('questionRadarDashboard');
        if (!container || !dashboardData) return;
        
        container.innerHTML = `
            <div class="text-center p-6">
                <div class="mb-4">
                    <span class="text-4xl">📊</span>
                </div>
                <p class="text-gray-600">Análise de desempenho em questões</p>
                <p class="text-sm text-gray-500 mt-2">Em desenvolvimento</p>
            </div>
        `;
    }
    
    // Mostrar erro
    function showError(message) {
        const containers = [
            'gamification-dashboard',
            'performanceDashboard',
            'scheduleDashboard',
            'progressDashboard'
        ];
        
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-600 text-center">⚠️ Erro ao carregar dados</p>
                        <p class="text-red-500 text-sm text-center mt-1">${message}</p>
                        <button onclick="location.reload()" 
                                class="mt-3 mx-auto block px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm">
                            Recarregar Página
                        </button>
                    </div>
                `;
            }
        });
    }
    
    // Botão de atualização
    document.getElementById('refresh-metrics-btn')?.addEventListener('click', () => {
        location.reload();
    });
    
    // Renderizar distribuição de tempo de estudo
    async function renderStudyTimeDistribution() {
        const container = document.getElementById('studyTimeDashboard');
        if (!container || !planId) return;
        
        try {
            const token = localStorage.getItem('editaliza_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(`/api/plans/${planId}/study-time`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.subjects && data.subjects.length > 0) {
                    const totalHours = Math.floor(data.totalStudyTimeSeconds / 3600);
                    const totalMinutes = Math.floor((data.totalStudyTimeSeconds % 3600) / 60);
                    
                    // Criar visualização gráfica
                    const subjectsChart = data.subjects.map(subject => {
                        const percentage = (subject.totalTimeSeconds / data.totalStudyTimeSeconds * 100).toFixed(1);
                        const hours = Math.floor(subject.totalTimeSeconds / 3600);
                        const minutes = Math.floor((subject.totalTimeSeconds % 3600) / 60);
                        
                        return `
                            <div class="mb-4">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-sm font-medium text-gray-700">${subject.name}</span>
                                    <span class="text-sm text-gray-600">${hours}h ${minutes}min (${percentage}%)</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-3">
                                    <div class="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500" 
                                         style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('');
                    
                    container.innerHTML = `
                        <div class="bg-white rounded-lg p-6">
                            <div class="mb-4 text-center">
                                <p class="text-2xl font-bold text-gray-800">${totalHours}h ${totalMinutes}min</p>
                                <p class="text-sm text-gray-600">Tempo total dedicado</p>
                            </div>
                            <div class="space-y-3">
                                ${subjectsChart}
                            </div>
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div class="bg-gray-50 rounded-lg p-8 text-center">
                            <span class="text-4xl mb-4 block">⏱️</span>
                            <p class="text-gray-600 font-medium">Nenhum tempo de estudo registrado ainda</p>
                            <p class="text-sm text-gray-500 mt-2">Complete sessões para ver a distribuição do seu tempo</p>
                        </div>
                    `;
                }
            } else {
                throw new Error('Erro ao buscar dados');
            }
        } catch (error) {
            console.error('Erro ao buscar tempo de estudo:', error);
            container.innerHTML = `
                <div class="bg-red-50 rounded-lg p-6 text-center">
                    <p class="text-red-600">Erro ao carregar dados de tempo de estudo</p>
                </div>
            `;
        }
    }
    
    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Exportar para uso global
    window.PlanPageFixed = {
        initialize,
        getDashboardData: () => dashboardData
    };
})();