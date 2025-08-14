/**
 * @file js/modules/gamification.js
 * @description Gamification dashboard and metrics system
 * @version 2.0 - Modularized for performance
 */

const Gamification = {
    // Dashboard de gamificação com métricas precisas
    renderGamificationDashboard(gamificationData, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !gamificationData) return;
        
        // Usar dados reais do backend com próximo nível
        const safeData = {
            currentStreak: gamificationData.studyStreak || 0,
            totalXP: gamificationData.experiencePoints || 0,
            totalStudyDays: gamificationData.totalStudyDays || 0,
            levelName: gamificationData.concurseiroLevel || 'Aspirante a Servidor(a) 🌱',
            nextLevel: gamificationData.nextLevel || null,
            topicsToNextLevel: gamificationData.topicsToNextLevel || 0,
            achievementsCount: gamificationData.achievements ? gamificationData.achievements.length : 0,
            achievements: gamificationData.achievements || [],
            completedTopicsCount: gamificationData.completedTopicsCount || 0,
            totalCompletedSessions: gamificationData.totalCompletedSessions || 0
        };

        // Obter ícone e título limpo do nível atual
        const levelIcon = safeData.levelName.split(' ').pop();
        const levelTitle = safeData.levelName.replace(levelIcon, '').trim();

        // Cards únicos com informações não duplicadas e métricas corretas
        container.innerHTML = `
            <div class="mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                        <span class="text-2xl mr-3">📊</span>Estatísticas de Desempenho
                    </h3>
                    <div class="text-sm text-gray-500 italic">
                        <span class="w-2 h-2 bg-green-500 rounded-full inline-block mr-2 animate-pulse"></span>
                        Atualizado em tempo real
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Rank Atual Aprimorado -->
                    <div class="bg-gradient-to-br from-slate-50 to-gray-100 border border-gray-200 p-6 rounded-xl shadow-lg text-center hover:shadow-xl transition-all duration-300">
                        <div class="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <span class="text-2xl drop-shadow">${levelIcon}</span>
                        </div>
                        <p class="text-lg font-semibold text-orange-800 uppercase tracking-wider mb-1">Rank Atual</p>
                        <p class="text-xl font-bold text-orange-600 leading-tight">${levelTitle}</p>
                        <div class="mt-2 text-xs text-gray-600 bg-orange-50 rounded-full px-3 py-1 inline-block">
                            <span class="w-2 h-2 bg-orange-500 rounded-full inline-block mr-1 animate-pulse"></span>
                            ${safeData.completedTopicsCount} tópicos
                        </div>
                    </div>
                    
                    <!-- Total de Dias de Estudo -->
                    <div class="bg-slate-50 border border-gray-200 p-6 rounded-xl shadow-inner text-center">
                        <div class="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">📅</span>
                        </div>
                        <p class="text-lg font-semibold text-editaliza-blue uppercase tracking-wider mb-1">Total de Dias</p>
                        <p class="text-4xl font-bold text-editaliza-blue">${safeData.totalStudyDays}</p>
                        <p class="text-xs text-editaliza-blue mt-1">${safeData.totalStudyDays === 1 ? 'dia estudado' : 'dias estudados'}</p>
                    </div>
                    
                    <!-- Experiência Total -->
                    <div class="bg-slate-50 border border-gray-200 p-6 rounded-xl shadow-inner text-center">
                        <div class="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">✨</span>
                        </div>
                        <p class="text-lg font-semibold text-purple-800 uppercase tracking-wider mb-1">Experiência</p>
                        <p class="text-4xl font-bold text-purple-600">${safeData.totalXP.toLocaleString()}</p>
                        <p class="text-xs text-purple-600 mt-1">pontos XP totais</p>
                    </div>
                    
                    <!-- Conquistas -->
                    <div class="bg-slate-50 border border-gray-200 p-6 rounded-xl shadow-inner text-center">
                        <div class="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">🏅</span>
                        </div>
                        <p class="text-lg font-semibold text-green-800 uppercase tracking-wider mb-1">Conquistas</p>
                        <p class="text-4xl font-bold text-green-700">${safeData.achievementsCount}</p>
                        <p class="text-xs text-green-700 mt-1">${safeData.achievementsCount === 1 ? 'medalha obtida' : 'medalhas obtidas'}</p>
                    </div>
                </div>
            </div>
        `;

        // Se houver conquistas, renderizar seção adicional
        if (safeData.achievements && safeData.achievements.length > 0) {
            container.innerHTML += this.renderAchievements(safeData.achievements);
        }

        // Se houver informações de próximo nível, renderizar progresso
        if (safeData.nextLevel && safeData.topicsToNextLevel !== undefined) {
            container.innerHTML += this.renderLevelProgress(safeData);
        }
    },

    // Renderizar conquistas obtidas com estrutura aprimorada
    renderAchievements(achievements) {
        // Verificar se achievements é válido e não vazio
        if (!achievements || !Array.isArray(achievements) || achievements.length === 0) {
            return `
                <div class="mt-8">
                    <h4 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                        <span class="text-2xl mr-3">🏅</span>Suas Conquistas
                    </h4>
                    <div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                        <span class="text-4xl mb-4 block">🎆</span>
                        <p class="text-gray-600 font-medium mb-2">Nenhuma conquista ainda</p>
                        <p class="text-sm text-gray-500">Complete seus primeiros estudos para desbloquear conquistas!</p>
                    </div>
                </div>
            `;
        }

        const achievementCards = achievements.slice(0, 6).map(achievement => {
            // Verificar se o achievement tem a estrutura correta
            let title, description, achievedDate;
            
            if (typeof achievement === 'string') {
                // Fallback para achievements antigos (formato string)
                title = achievement;
                description = "Conquista desbloqueada";
                achievedDate = "Data não disponível";
            } else if (achievement && typeof achievement === 'object') {
                // Novo formato de objeto
                title = achievement.title || 'Conquista';
                description = achievement.description || 'Parabéns pela conquista!';
                
                // Tratar datas de forma segura
                try {
                    const dateValue = achievement.achieved_date || achievement.earned_at || new Date();
                    const dateObj = new Date(dateValue);
                    
                    if (isNaN(dateObj.getTime())) {
                        achievedDate = "Data inválida";
                    } else {
                        achievedDate = dateObj.toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        });
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao processar data da conquista:', error);
                    achievedDate = "Data não disponível";
                }
            } else {
                // Fallback para casos inesperados
                title = "Conquista desconhecida";
                description = "Dados da conquista incompletos";
                achievedDate = "Data não disponível";
            }

            // Ícones aprimorados para conquistas
            const achievementIcons = {
                'Primeiro Estudo': '🌟',
                'Sequência de 3 dias': '🔥',
                'Sequência de 7 dias': '💪',
                'Duas Semanas Seguidas': '🔥',
                'Mês de Dedicação': '🎆',
                'Primeiro Simulado': '🎯',
                '10 Tópicos Concluídos': '📚',
                '20 Sessões Completadas': '📈',
                '50 Tópicos Concluídos': '🏆',
                'Veterano de Estudos': '⭐',
                'Centurião do Conhecimento': '🏅',
                'Estudioso Iniciante': '📚',
                'Quarteto de Conhecimento': '📈',
                'Centurião das Sessões': '🏆',
                'default': '🏅'
            };

            const icon = achievementIcons[title] || achievementIcons.default;

            return `
                <div class="achievement-card bg-white border-2 border-yellow-200 rounded-xl p-4 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
                    <div class="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:from-yellow-500 group-hover:to-orange-600 transition-all duration-300">
                        <span class="text-2xl">${icon}</span>
                    </div>
                    <h4 class="font-bold text-gray-800 text-sm mb-1 leading-tight">${title}</h4>
                    <p class="text-xs text-gray-600 mb-2 leading-relaxed">${description}</p>
                    <p class="text-xs text-yellow-600 font-medium">${achievedDate}</p>
                </div>
            `;
        }).join('');

        return `
            <div class="mt-8">
                <h4 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <span class="text-2xl mr-3">🏅</span>Suas Conquistas Recentes
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    ${achievementCards}
                </div>
                ${achievements.length > 6 ? `
                    <div class="text-center mt-4">
                        <p class="text-sm text-gray-500">E mais ${achievements.length - 6} conquistas!</p>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Renderizar progresso aprimorado para próximo rank
    renderLevelProgress(data) {
        if (!data.nextLevel && !data.nextRank) return '';

        // Usar dados do novo sistema de ranking se disponível
        const currentRank = data.currentRank || {
            icon: data.levelName?.split(' ').pop() || '🌱',
            title: data.levelName?.replace(/[\ud83c-\ud83f][\ud83c-\ud83f]?/g, '').trim() || 'Iniciante',
            color: '#CD7F32',
            bgColor: '#FFF8DC'
        };
        
        const nextRank = data.nextRank || {
            icon: data.nextLevel?.split(' ').pop() || '❓',
            title: data.nextLevel?.replace(/[\ud83c-\ud83f][\ud83c-\ud83f]?/g, '').trim() || 'Próximo Nível',
            color: '#C0C0C0',
            bgColor: '#F8F8FF'
        };

        // Calcular progresso com mais precisão
        let progressPercent = 0;
        if (data.rankProgress !== undefined) {
            progressPercent = Math.max(0, Math.min(100, data.rankProgress));
        } else {
            const totalNeeded = (data.completedTopicsCount || 0) + (data.topicsToNextLevel || 0);
            progressPercent = totalNeeded > 0 
                ? Math.max(0, Math.min(100, ((data.completedTopicsCount || 0) / totalNeeded) * 100))
                : 0;
        }

        return `
            <div class="mt-8">
                <h4 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <span class="text-2xl mr-3">🎖️</span>Progresso de Ranking
                </h4>
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-lg" style="background: linear-gradient(135deg, ${currentRank.bgColor || '#FFF8DC'} 0%, ${nextRank.bgColor || '#F8F8FF'} 100%)">
                    <div class="flex items-center justify-between mb-6">
                        <!-- Rank Atual -->
                        <div class="text-center flex-1">
                            <div class="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, ${currentRank.color || '#CD7F32'}, ${currentRank.color || '#CD7F32'}88); box-shadow: 0 4px 12px ${currentRank.color || '#CD7F32'}44;">
                                <span class="text-3xl drop-shadow-lg">${currentRank.icon}</span>
                            </div>
                            <p class="text-sm font-bold text-gray-800">Rank Atual</p>
                            <p class="text-lg font-bold" style="color: ${currentRank.color || '#CD7F32'}">${currentRank.title}</p>
                            ${currentRank.subtitle ? `<p class="text-xs text-gray-600 mt-1">${currentRank.subtitle}</p>` : ''}
                        </div>
                        
                        <!-- Barra de Progresso Aprimorada -->
                        <div class="flex-2 mx-8">
                            <div class="relative">
                                <div class="w-full bg-gray-300 rounded-full h-6 shadow-inner">
                                    <div class="h-6 rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2" 
                                         style="width: ${progressPercent}%; background: linear-gradient(90deg, ${currentRank.color || '#CD7F32'}, ${nextRank.color || '#C0C0C0'});">
                                        ${progressPercent > 15 ? `<span class="text-xs text-white font-bold drop-shadow">${progressPercent.toFixed(1)}%</span>` : ''}
                                    </div>
                                </div>
                                ${progressPercent <= 15 ? `
                                    <div class="text-center mt-2">
                                        <span class="text-sm font-bold" style="color: ${currentRank.color || '#CD7F32'}">${progressPercent.toFixed(1)}%</span>
                                    </div>
                                ` : ''}
                            </div>
                            
                            <!-- Indicador de Progresso -->
                            <div class="mt-3 text-center">
                                <div class="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1 shadow-md">
                                    <span class="w-2 h-2 rounded-full animate-pulse" style="background-color: ${nextRank.color || '#C0C0C0'}"></span>
                                    <span class="text-xs text-gray-700 font-medium">${data.topicsToNextLevel || 0} tópicos restantes</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Próximo Rank -->
                        <div class="text-center flex-1">
                            <div class="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center opacity-75 hover:opacity-100 transition-opacity duration-300" style="background: linear-gradient(135deg, ${nextRank.color || '#C0C0C0'}, ${nextRank.color || '#C0C0C0'}88); box-shadow: 0 4px 12px ${nextRank.color || '#C0C0C0'}44;">
                                <span class="text-3xl drop-shadow-lg">${nextRank.icon}</span>
                            </div>
                            <p class="text-sm font-bold text-gray-800">Próximo Rank</p>
                            <p class="text-lg font-bold" style="color: ${nextRank.color || '#C0C0C0'}">${nextRank.title}</p>
                            ${nextRank.subtitle ? `<p class="text-xs text-gray-600 mt-1">${nextRank.subtitle}</p>` : ''}
                        </div>
                    </div>
                    
                    <!-- Motivação -->
                    ${currentRank.motivationalText || nextRank.motivationalText ? `
                        <div class="text-center pt-4 border-t border-gray-200/50">
                            <p class="text-sm font-medium text-gray-700 italic">
                                ${progressPercent >= 75 ? 
                                    (nextRank.motivationalText || 'Você está quase lá! Continue assim!') : 
                                    (currentRank.motivationalText || 'Continue progredindo, você está no caminho certo!')}
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Renderizar alerta de tarefas atrasadas
    renderOverdueAlert(count, containerId = 'overdue-alert-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (count > 0) {
            container.innerHTML = `
                <div id="overdueAlert" class="overdue-alert-card p-8 rounded-3xl mb-8 shadow-xl animate-glow" role="alert" style="background: linear-gradient(135deg, #fef2f2 0%, #fef3c7 50%, #fef7cd 100%) !important; border: 2px solid #f87171 !important; background-image: radial-gradient(circle at top right, rgba(239, 68, 68, 0.1) 0%, transparent 50%), radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.1) 0%, transparent 50%) !important;">
                    <div class="flex items-start space-x-6">
                        <div class="flex-shrink-0">
                            <div class="w-20 h-20 bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse border-4 border-white">
                                <svg class="w-10 h-10 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-grow">
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center space-x-3">
                                    <h3 class="text-2xl font-bold text-red-800">⚠️ Atenção!</h3>
                                    <div class="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                                </div>
                                <span class="bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center space-x-2 shadow-lg">
                                    <span class="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                                    <span>${count} atrasada${count > 1 ? 's' : ''}</span>
                                    <span class="text-lg">🚨</span>
                                </span>
                            </div>
                            <p class="text-gray-800 font-bold text-lg mb-3">Você tem ${count} tarefa${count > 1 ? 's' : ''} atrasada${count > 1 ? 's' : ''}.</p>
                            <p class="text-gray-700 text-base mb-6 leading-relaxed">Não se preocupe! Podemos reorganizar seu cronograma automaticamente para você voltar aos trilhos. 💪</p>
                            
                            <!-- Action Section -->
                            <div class="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                                <button id="showReplanDetailsButton" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold px-6 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-3 border-2 border-blue-200">
                                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-lg">Ver Detalhes</span>
                                    <span class="text-xl">📋</span>
                                </button>
                                
                                <button id="replanButton" class="flex-1 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:via-orange-700 hover:to-amber-700 text-white font-bold px-6 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-3 border-2 border-red-200 animate-pulse">
                                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-lg">Replanejar Agora</span>
                                    <span class="text-2xl">🚀</span>
                                </button>
                                
                                <button onclick="document.getElementById('overdueAlert').style.display='none'" class="sm:w-auto px-6 py-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-2xl transition-colors duration-300 flex items-center justify-center border-2 border-gray-200 hover:border-gray-300">
                                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                    </svg>
                                    Depois
                                </button>
                            </div>
                            
                            <!-- Seção de detalhes do replanejamento (inicialmente oculta) -->
                            <div id="replanDetails" class="hidden mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 shadow-lg">
                                <div class="flex items-center mb-4">
                                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                                        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                    </div>
                                    <h4 class="font-bold text-lg text-blue-800">📋 Estratégia de Replanejamento</h4>
                                </div>
                                <div id="replanDetailsContent" class="text-base text-blue-700">
                                    <div class="animate-pulse flex items-center space-x-2">
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce"></div>
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
                                        <div class="w-4 h-4 bg-blue-300 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
                                        <span class="ml-2">Carregando detalhes...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    },

    // Sistema de métricas em tempo real com detecção de mudanças
    async updateMetrics(planId, forceRefresh = false) {
        if (!planId) return null;

        try {
            const previousData = this._lastGamificationData;
            const data = window.app?.getGamificationData ? 
                await window.app.getGamificationData(planId, forceRefresh) : null;
            
            if (data) {
                // Detectar mudanças e exibir notificações
                this._detectAndNotifyChanges(previousData, data);
                
                // Renderizar dashboard atualizado
                this.renderGamificationDashboard(data, 'gamification-dashboard');
                
                // Armazenar dados para próxima comparação
                this._lastGamificationData = { ...data };
                
                return data;
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar métricas de gamificação:', error);
        }

        return null;
    },

    // Detectar mudanças e exibir notificações apropriadas
    _detectAndNotifyChanges(previousData, newData) {
        if (!previousData || !newData) return;

        // Detectar mudança de rank
        const previousRank = previousData.currentRank || { title: previousData.concurseiroLevel };
        const newRank = newData.currentRank || { title: newData.concurseiroLevel };
        
        if (previousRank.title !== newRank.title) {
            console.log('🎊 Rank up detectado!', previousRank.title, '→', newRank.title);
            this.showRankUpNotification(previousRank, newRank);
        }

        // Detectar novas conquistas
        const previousAchievements = previousData.achievements || [];
        const newAchievements = newData.achievements || [];
        
        if (newAchievements.length > previousAchievements.length) {
            const achievementsDiff = newAchievements.length - previousAchievements.length;
            console.log(`🏅 ${achievementsDiff} nova(s) conquista(s) detectada(s)!`);
            
            // Mostrar notificação para as novas conquistas
            const latestAchievements = newAchievements.slice(-achievementsDiff);
            latestAchievements.forEach((achievement, index) => {
                setTimeout(() => {
                    this.showAchievementNotification(achievement);
                }, index * 1000); // Espaçar notificações em 1 segundo
            });
        }

        // Detectar ganho significativo de XP
        const previousXP = previousData.experiencePoints || 0;
        const newXP = newData.experiencePoints || 0;
        const xpGained = newXP - previousXP;
        
        if (xpGained > 0) {
            this.animateXPGain(xpGained, newXP);
        }
    },

    // Sistema aprimorado de notificações de conquistas
    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-5 z-50 bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-6 rounded-2xl shadow-2xl transform translate-x-full opacity-0 transition-all duration-500';
        
        // Verificar se o achievement tem estrutura de objeto
        let title, description, icon;
        if (typeof achievement === 'object' && achievement.title) {
            title = achievement.title;
            description = achievement.description || 'Conquista desbloqueada!';
        } else if (typeof achievement === 'string') {
            title = achievement;
            description = 'Conquista desbloqueada!';
        } else {
            title = 'Nova Conquista';
            description = 'Parabéns pelo seu progresso!';
        }

        const achievementIcons = {
            'Primeiro Estudo': '🌟',
            'Sequência de 3 dias': '🔥',
            'Sequência de 7 dias': '💪',
            'Duas Semanas Seguidas': '🔥',
            'Mês de Dedicação': '🎆',
            'Primeiro Simulado': '🎯',
            '10 Tópicos Concluídos': '📚',
            '20 Sessões Completadas': '📈',
            '50 Tópicos Concluídos': '🏆',
            'Veterano de Estudos': '⭐',
            'Centurião do Conhecimento': '🏅',
            'Estudioso Iniciante': '📚',
            'Quarteto de Conhecimento': '📈',
            'Centurião das Sessões': '🏆',
            'default': '🏅'
        };

        icon = achievementIcons[title] || achievementIcons.default;

        notification.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                    <span class="text-3xl">${icon}</span>
                </div>
                <div>
                    <h4 class="font-bold text-lg mb-1">🎉 Nova Conquista!</h4>
                    <p class="font-semibold">${title}</p>
                    <p class="text-sm opacity-90">${description}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white/80 hover:text-white text-xl ml-2">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animar entrada
        requestAnimationFrame(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
        });

        // Remover após 7 segundos
        setTimeout(() => {
            notification.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 500);
        }, 7000);

        // Som de conquista (se suportado)
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance('Nova conquista desbloqueada!');
            utterance.volume = 0.1;
            utterance.rate = 1.2;
            speechSynthesis.speak(utterance);
        }
    },

    // Sistema de notificação de rank-up
    showRankUpNotification(currentRank, newRank) {
        if (!newRank || !newRank.title) return;

        const notification = document.createElement('div');
        notification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 text-white p-8 rounded-3xl shadow-2xl opacity-0 scale-75 transition-all duration-700';
        
        notification.innerHTML = `
            <div class="text-center">
                <div class="mb-6">
                    <h2 class="text-3xl font-bold mb-2">🎊 RANK UP! 🎊</h2>
                    <p class="text-xl opacity-90">Parabéns! Você subiu de rank!</p>
                </div>
                
                <div class="flex items-center justify-center space-x-8 mb-6">
                    <div class="text-center opacity-70">
                        <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span class="text-2xl">${currentRank?.icon || '🥉'}</span>
                        </div>
                        <p class="text-sm">${currentRank?.title || 'Rank Anterior'}</p>
                    </div>
                    
                    <div class="text-4xl animate-pulse">➡️</div>
                    
                    <div class="text-center">
                        <div class="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce shadow-lg">
                            <span class="text-3xl">${newRank.icon}</span>
                        </div>
                        <p class="text-lg font-bold">${newRank.title}</p>
                        <p class="text-sm opacity-90">${newRank.subtitle || ''}</p>
                    </div>
                </div>
                
                <div class="bg-white/10 rounded-2xl p-4 mb-6">
                    <p class="text-sm italic">"${newRank.motivationalText || newRank.description || 'Continue assim!'}"</p>
                </div>
                
                <button onclick="this.parentElement.parentElement.remove()" class="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-full transition-all duration-300 font-medium">
                    Continuar 🚀
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animar entrada
        requestAnimationFrame(() => {
            notification.classList.remove('opacity-0', 'scale-75');
            notification.classList.add('opacity-100', 'scale-100');
        });

        // Som de rank up
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Parabéns! Você alcançou o rank ${newRank.title}!`);
            utterance.volume = 0.2;
            utterance.rate = 1.1;
            speechSynthesis.speak(utterance);
        }

        // Remover após 10 segundos
        setTimeout(() => {
            notification.classList.add('opacity-0', 'scale-75');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 700);
        }, 10000);
    },

    // Animação de progressão de XP
    animateXPGain(xpGained, totalXP) {
        const xpElements = document.querySelectorAll('.xp-counter');
        xpElements.forEach(element => {
            const startXP = totalXP - xpGained;
            const endXP = totalXP;
            const duration = 2000; // 2 segundos
            const startTime = Date.now();

            const updateCounter = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animação easing
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const currentXP = Math.round(startXP + (endXP - startXP) * easedProgress);
                
                element.textContent = currentXP.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                }
            };

            requestAnimationFrame(updateCounter);
        });

        // Mostrar XP flutuante
        this.showFloatingXP(xpGained);
    },

    // Mostrar XP flutuante
    showFloatingXP(xpGained) {
        const floatingXP = document.createElement('div');
        floatingXP.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none';
        floatingXP.innerHTML = `
            <div class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-full text-xl font-bold shadow-2xl animate-bounce">
                +${xpGained} XP ✨
            </div>
        `;

        document.body.appendChild(floatingXP);

        // Animar e remover
        setTimeout(() => {
            floatingXP.style.transform = 'translate(-50%, -200px)';
            floatingXP.style.opacity = '0';
            floatingXP.style.transition = 'all 1s ease-out';
            
            setTimeout(() => {
                if (floatingXP.parentNode) {
                    floatingXP.remove();
                }
            }, 1000);
        }, 1000);
    }
};

// Disponibilizar globalmente para compatibilidade
window.Gamification = Gamification;