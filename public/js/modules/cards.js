/**
 * @file js/modules/cards.js
 * @description Study cards generation system - Session, Simulado, Essay, Review cards
 * @version 2.0 - Modularized for performance  
 */

const Cards = {
    // Sistema principal de criao de cards por tipo
    createCard(session) {
        if (!session) return '';

        // Compatibilidade com dados antigos
        const sessionType = session.session_type;
        
        switch (sessionType) {
            case 'Prática Dirigida': // Compatibilidade com dados antigos
            case 'Simulado Direcionado':
                return this.createDirectedSimuladoCard(session);
            case 'Simulado Completo':
                return this.createSimuladCard(session);
            case 'Redação':
                return this.createEssayCard(session);
            case 'Revisão 7D':
            case 'Revisão 14D':  
            case 'Revisão 28D':
                return this.createReviewCard(session);
            default:
                return this.createSessionCard(session);
        }
    },

    // Card de sesso de estudo padro
    createSessionCard(session) {
        const style = this.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-white to-slate-50';
        const sessionTypeConfig = {
            'Novo Tópico': { bg: 'bg-gradient-to-r from-blue-100 to-blue-200', text: 'text-blue-800', icon: '\u270D\uFE0F', border: 'border-blue-300', showBadge: false },
            'Reforço Extra': { bg: 'bg-gradient-to-r from-orange-100 to-orange-200', text: 'text-orange-800', icon: '\uD83D\uDCAA', border: 'border-orange-300', showBadge: false },
            'Revisão 7D': { bg: 'bg-gradient-to-r from-yellow-100 to-yellow-200', text: 'text-yellow-800', icon: '\uD83D\uDD01', border: 'border-yellow-300', showBadge: true, badgeText: '7D' },
            'Revisão 14D': { bg: 'bg-gradient-to-r from-purple-100 to-purple-200', text: 'text-purple-800', icon: '\uD83D\uDD01', border: 'border-purple-300', showBadge: true, badgeText: '14D' },
            'Revisão 28D': { bg: 'bg-gradient-to-r from-pink-100 to-pink-200', text: 'text-pink-800', icon: '\uD83D\uDD01', border: 'border-pink-300', showBadge: true, badgeText: '28D' },
            'Simulado Direcionado': { bg: 'bg-gradient-to-r from-purple-100 to-indigo-200', text: 'text-purple-800', icon: '\uD83C\uDFAF', border: 'border-purple-400', showBadge: false },
            'Simulado Completo': { bg: 'bg-gradient-to-r from-slate-100 to-gray-200', text: 'text-slate-800', icon: '\uD83E\uDDE9', border: 'border-slate-400', showBadge: false },
            'Redação': { bg: 'bg-gradient-to-r from-rose-100 to-rose-200', text: 'text-rose-800', icon: '✍️', border: 'border-rose-300', showBadge: false }
        };
        
        const typeConfig = sessionTypeConfig[session.session_type] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: '📚', showBadge: false };
        
        // Badge de reviso com posicionamento absoluto
        const badgeHtml = typeConfig.showBadge ?
            `<span class="absolute top-3 right-3 flex items-center bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                <span class="mr-1.5">${typeConfig.icon}</span>
                <span>${typeConfig.badgeText}</span>
            </span>` : '';

        // cone de tipo de sesso (secundrio) 
        const secondaryText = !typeConfig.showBadge ? `<div class="flex items-center">
            <span class="${typeConfig.bg} ${typeConfig.text} ${typeConfig.border} border-2 px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center shadow-sm">
                <span class="text-xl">${typeConfig.icon}</span>
            </span>
        </div>` : '';
        
        const safeSubjectName = this.sanitizeHtml(session.subject_name);
        const safeTopicDescription = this.sanitizeHtml(session.topic_description);
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));

        return `
            <div id="session-card-${session.id}" class="relative study-card flex flex-col h-full p-6 rounded-2xl shadow-lg border-l-4 ${style.color} ${cardBg} transform transition-all duration-300 hover:shadow-2xl group">
                ${badgeHtml}
                <div class="flex-grow">
                    <!-- Header com cone e ttulo -->
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 ${style.color.replace('border-', 'bg-').replace('-500', '-100')} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <span class="text-2xl">${style.icon}</span>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-bold text-lg ${isCompleted ? 'text-gray-600' : 'text-gray-800'} group-hover:text-gray-900 transition-colors">
                                        ${safeSubjectName}
                                    </h3>
                                </div>
                            </div>
                        </div>
                        ${secondaryText}
                    </div>
                    
                    <!-- Description -->
                    <p class="text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-600'} leading-relaxed mb-4">
                        ${safeTopicDescription}
                    </p>
                    
                    <!-- Visual separator -->
                    <div class="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4"></div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto" data-session-id="${session.id}">
                    ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center font-bold py-4 bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-700 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02]">
                            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <span class="text-lg">Tarefa Concluída!</span>
                            <span class=\"ml-3 text-2xl animate-bounce group-hover/btn:scale-110 transition-transform\">\u279C</span>
                        </button>
                    ` : `
                        <!-- Main Action Button -->
                        <button onclick='window.openStudySession(${session.id})' data-session='${sessionJsonString}' class="start-study-btn timer-aware-button group/btn w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3 mb-3 shadow-lg">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                            </svg>
                            <span class="text-lg button-text">Iniciar Estudo</span>
                        </button>
                        
                        <!-- Action Buttons Row -->
                        <div class="flex gap-2">
                            <!-- Postpone Button -->
                            <button 
                                onclick="window.postponeSession(${session.id})" 
                                class="postpone-btn flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 font-semibold py-2.5 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2"
                                title="Adiar esta sessão para o próximo dia disponível"
                            >
                                <span class="text-lg">📅</span>
                                <span class="text-sm">Adiar</span>
                            </button>
                            
                            <!-- Reinforce Button -->
                            <button 
                                onclick="window.reinforceSession(${session.id})" 
                                class="reinforce-btn flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 font-semibold py-2.5 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2"
                                title="Criar sessão de reforço para revisão em 3 dias"
                            >
                                <span class="text-lg">💪</span>
                                <span class="text-sm text-gray-700">Reforçar</span>
                            </button>
                        </div>
                    `}
                </div>
            </div>`;
    },

    // Novo card especfico para Simulado Direcionado
    createDirectedSimuladoCard(session) {
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-amber-50 via-amber-50 to-orange-50';
        
        // Extrair meta informaes
        const meta = session.meta || {};
        const focus = meta.focus || [];
        const nQuestoes = meta.nQuestoes || 25;
        const tempoSugerido = meta.tempoSugerido || '30-40 min';
        const linkGabarito = meta.linkGabarito || null;
        
        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col justify-between h-full p-8 rounded-3xl shadow-xl border-l-4 border-amber-500 ${cardBg} group">
                <!-- Header Section -->
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-4">
                            <div class="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                                <span class="text-4xl">🎯</span>
                            </div>
                            <div class="flex-grow">
                                <div class="flex items-center space-x-3 mb-2">
                                    <h3 class="font-bold text-2xl text-gray-800 group-hover:text-gray-900 transition-colors">
                                        ${this.sanitizeHtml(session.subject_name || 'Simulado Direcionado')}
                                    </h3>
                                    <span class="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                        SIMULADO DIRECIONADO
                                    </span>
                                </div>
                                <p class="text-base font-semibold text-gray-600 mb-1">Teste Específico de Conteúdo</p>
                                <p class="text-sm text-gray-500">Questões focadas em tópicos selecionados</p>
                            </div>
                        </div>
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Content Section -->
                    <div class="bg-white/80 p-6 rounded-2xl border-2 border-amber-200">
                        ${focus.length > 0 ? `
                            <div class="mb-4">
                                <p class="text-sm font-semibold text-gray-700 mb-2">🎯 Foco em:</p>
                                <div class="flex flex-wrap gap-2">
                                    ${focus.map(f => `<span class="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg text-xs font-medium">${f}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex items-center space-x-2">
                                <span class="text-lg">📋</span>
                                <span class="text-sm text-gray-600">${nQuestoes} questões</span>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="text-lg">⏰</span>
                                <span class="text-sm text-gray-600">${tempoSugerido}</span>
                            </div>
                        </div>
                        ${linkGabarito ? `
                            <div class="mt-4 pt-4 border-t border-amber-200">
                                <a href="${linkGabarito}" class="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center space-x-1">
                                    <span>📄</span>
                                    <span>Ver gabarito</span>
                                </a>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto pt-6 border-t border-amber-200">
                    ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center font-bold py-5 bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-700 rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg">
                           <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                               <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                                   <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                               </svg>
                           </div>
                           <span class="text-xl">Simulado Concluído!</span>
                           <span class="ml-4 text-3xl animate-bounce group-hover/btn:scale-110 transition-transform">🎯</span>
                        </button>
                    ` : `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-4">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-xl">Iniciar Simulado</span>
                            <span class="text-2xl group-hover/btn:animate-bounce">🎯</span>
                        </button>
                    `}
                </div>
            </div>
        `;
    },
    
    // Card de simulado (direcionado ou completo)
    createSimuladCard(session) {
        const isCompleted = session.status === 'Concluído';
        const isDirected = session.session_type === 'Simulado Direcionado';

        // Estilos diferenciados para cada tipo de simulado
        const style = isDirected ? 
            { 
                color: 'border-purple-500', 
                bg: isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50', 
                icon: '🎯', 
                gradient: 'from-purple-600 via-indigo-600 to-blue-600',
                badge: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg',
                title: 'Simulado Direcionado - Teste Específico',
                subtitle: 'Questões focadas em tópicos já estudados'
            } : 
            { 
                color: 'border-slate-600', 
                bg: isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50', 
                icon: '🎯', 
                gradient: 'from-slate-600 via-gray-600 to-zinc-600',
                badge: 'bg-gradient-to-r from-slate-600 to-gray-600 text-white shadow-lg',
                title: 'Simulado Completo - Avaliação Geral',
                subtitle: 'Teste abrangente de todo o conhecimento'
            };
        
        const safeSubjectName = this.sanitizeHtml(session.subject_name);
        
        let descriptionHtml = this.generateSimuladoDescription(session, isDirected, style);
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));

        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col justify-between h-full p-8 rounded-3xl shadow-xl border-l-4 ${style.color} ${style.bg} group">
                <!-- Header Section -->
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-4">
                            <div class="w-20 h-20 bg-gradient-to-br ${style.gradient} rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                                <span class="text-4xl">${style.icon}</span>
                            </div>
                            <div class="flex-grow">
                                <div class="flex items-center space-x-3 mb-2">
                                    <h3 class="font-bold text-2xl text-gray-800 group-hover:text-gray-900 transition-colors">${safeSubjectName}</h3>
                                    <span class="${style.badge} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                        ${isDirected ? 'DIRECIONADO' : 'COMPLETO'}
                                    </span>
                                </div>
                                <p class="text-base font-semibold text-gray-600 mb-1">${style.title}</p>
                                <p class="text-sm text-gray-500">${style.subtitle}</p>
                            </div>
                        </div>
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Content Section -->
                    <div class="prose prose-sm max-w-none">${descriptionHtml}</div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto pt-6 border-t border-gray-200">
                     ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center font-bold py-5 bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-700 rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg">
                           <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                               <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                                   <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                               </svg>
                           </div>
                           <span class="text-xl">Simulado Concluído!</span>
                           <span class="ml-4 text-3xl animate-bounce group-hover/btn:scale-110 transition-transform">🎯</span>
                        </button>
                    ` : `
                        <button onclick='window.openStudySession(${session.id})' data-session='${sessionJsonString}' class="timer-aware-button group/btn w-full ${this.getSmartButtonClasses(session.id, `bg-gradient-to-r ${style.gradient}`)} hover:shadow-2xl text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-4">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-xl button-text">${this.getSmartButtonText(session.id, 'Iniciar Simulado')}</span>
                            <span class="text-2xl group-hover/btn:animate-bounce button-icon">${this.getSmartButtonIcon(session.id, style.icon)}</span>
                        </button>
                    `}
                </div>
            </div>`;
    },

    // Card de redao
    createEssayCard(session) {
        const style = this.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-rose-50 to-pink-50';

        const safeSubjectName = this.sanitizeHtml(session.subject_name);
        const safeTopicDescription = this.sanitizeHtml(session.topic_description);
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));
        
        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col justify-between h-full p-8 rounded-3xl shadow-xl border-l-4 ${style.color} ${cardBg} group">
                <!-- Header Section -->
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-4">
                            <div class="w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                <span class="text-3xl">
</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-2xl text-gray-800 group-hover:text-gray-900 transition-colors">${safeSubjectName}</h3>
                                <p class="text-sm font-medium text-gray-500 uppercase tracking-wider">Redao</p>
                            </div>
                        </div>
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Content Section -->
                    <div class="bg-white/60 p-6 rounded-2xl border border-rose-100">
                        <p class="text-lg text-gray-700 leading-relaxed">${safeTopicDescription}</p>
                        
                        <!-- Writing Tips -->
                        <div class="mt-4 flex items-center space-x-4 text-sm text-gray-600">
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">📝</span>
                                <span>Estrutura</span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">💡</span>
                                <span>Argumentação</span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">🎨</span>
                                <span>Criatividade</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto pt-6 border-t ${isCompleted ? 'border-green-200' : 'border-rose-200'}">
                    ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center font-bold py-5 bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-700 rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg">
                            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                                <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <span class="text-xl">Redação Concluída!</span>
                            <span class="ml-4 text-3xl animate-bounce group-hover/btn:scale-110 transition-transform">🎯</span>
                        </button>
                    ` : `
                         <button onclick='window.openStudySession(${session.id})' data-session='${sessionJsonString}' class="timer-aware-button group/btn w-full ${this.getSmartButtonClasses(session.id, 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700')} hover:shadow-2xl text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-4">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-xl button-text">Iniciar Redação</span>
                            <span class="text-2xl group-hover/btn:animate-bounce button-icon">✍️</span>
                         </button>
                    `}
                </div>
            </div>
        `;
    },

    // Card de reviso com labels R7/R14/R28
    createReviewCard(session) {
        const style = this.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50';

        const description = this.sanitizeHtml(session.topic_description);
        const parts = description.split('\n\n');
        const mainTitle = parts.shift(); // "Revisão dos seguintes tópicos:"

        const topicsHtml = this.generateReviewTopics(parts);
        
        // Determinar label da revisão (R7/R14/R28)
        const reviewLabel = this.getReviewLabel(session);
        const reviewChip = reviewLabel ? this.createReviewChip(reviewLabel) : '';

        return `
            <div id="session-card-${session.id}" class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col h-full p-8 rounded-3xl shadow-xl border-l-4 ${style.color} ${cardBg} transform transition-all duration-300 hover:shadow-2xl group border-2 border-yellow-300">
                <!-- Header -->
                <div class="flex-grow">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex-1">
                            <div class="flex items-center space-x-4 mb-4">
                                <div class="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                                    <span class="text-3xl">🔄</span>
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center space-x-3 mb-2">
                                        <h3 class="font-bold text-2xl ${isCompleted ? 'text-gray-600' : 'text-gray-800'} group-hover:text-gray-900 transition-colors">
                                            ${this.sanitizeHtml(session.subject_name)}
                                        </h3>
                                        <span class="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                            REVISÃO
                                        </span>
                                        ${reviewChip}
                                    </div>
                                    <p class="text-base font-semibold text-gray-600">Consolidação de Conhecimento</p>
                                    <p class="text-sm text-gray-500">Reforço dos tópicos estudados</p>
                                </div>
                            </div>
                        </div>
                        <!-- Indicador visual -->
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Contedo principal -->
                    <div class="bg-white/80 p-6 rounded-2xl border-2 border-yellow-200 mb-6">
                        <p class="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                            <span class="text-2xl mr-3">📋</span>
                            ${mainTitle}
                        </p>
                        <div class="prose prose-sm max-w-none">${topicsHtml}</div>
                    </div>
                </div>
                
                <!-- Ao -->
                <div class="mt-auto pt-6 border-t-2 ${isCompleted ? 'border-green-200' : 'border-yellow-200'}" data-session-id="${session.id}">
                    ${isCompleted ? `
                        <button onclick='window.openStudySession(${session.id})' class="group/btn w-full cursor-pointer flex items-center justify-center font-bold py-5 bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-700 rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg">
                            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover/btn:bg-green-200 transition-colors">
                                <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                            </div>
                            <span class="text-xl">Revisão Concluída!</span>
                            <span class="ml-4 text-3xl animate-bounce group-hover/btn:scale-110 transition-transform">🎯</span>
                        </button>
                    ` : `
                        <!-- Main Review Button -->
                        <button onclick='app.markSessionAsCompleted(${session.id})' class="group/btn w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center space-x-4 mb-3">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <span class="text-xl">Marcar como Concluída</span>
                            <span class="text-2xl group-hover/btn:animate-bounce">🔄</span>
                        </button>
                        
                        <!-- Review Action Buttons Row -->
                        <div class="flex gap-2">
                            <!-- Postpone Button -->
                            <button 
                                onclick="window.postponeSession(${session.id})" 
                                class="postpone-btn flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 font-semibold py-2.5 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2"
                                title="Adiar esta reviso para o prximo dia disponvel"
                            >
                                <span class="text-lg">📅</span>
                                <span class="text-sm">Adiar</span>
                            </button>
                            
                            <!-- Reinforce Button -->
                            <button 
                                onclick="window.reinforceSession(${session.id})" 
                                class="reinforce-btn flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 font-semibold py-2.5 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2"
                                title="Criar uma nova sesso de reforço para esta reviso em 3 dias"
                            >
                                <span class="text-lg">💪</span>
                                <span class="text-sm text-gray-700">Reforçar</span>
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    // Helper para criar chip de revisão
    createReviewChip(label) {
        const colors = {
            'R7': 'bg-green-100 text-green-800 border-green-300',
            'R14': 'bg-amber-100 text-amber-800 border-amber-300',
            'R28': 'bg-red-100 text-red-800 border-red-300'
        };
        const color = colors[label] || 'bg-gray-100 text-gray-800 border-gray-300';
        return `<span class="${color} border px-2 py-1 rounded-full text-xs font-bold ml-2">${label}</span>`;
    },
    
    // Helper para determinar label da revisão
    getReviewLabel(session) {
        // Primeiro tenta pegar da meta
        if (session.meta?.reviewLabel) {
            return session.meta.reviewLabel;
        }
        // Fallback: inferir do tipo de sessão
        if (session.session_type?.includes('7D')) return 'R7';
        if (session.session_type?.includes('14D')) return 'R14';
        if (session.session_type?.includes('28D')) return 'R28';
        return null;
    },
    
    // Utilitrios auxiliares
    sanitizeHtml(str) {
        if (!str) return '';
        return window.app?.sanitizeHtml ? window.app.sanitizeHtml(str) : str;
    },

    getSubjectStyle(name) {
        const base = window.app?.getSubjectStyle ? window.app.getSubjectStyle(name) : { color: 'border-gray-400', icon: '\uD83D\uDCDA' }; // 📚
        const map = {
            'Constitucional': '\u2696\uFE0F', // ⚖️
            'Administrativo': '\uD83C\uDFDB\uFE0F', // 🏛️
            'Português': '\uD83D\uDCD8', // 📘
            'Civil': '\uD83D\uDCD7', // 📗
            'Raciocínio Lógico': '\uD83E\uDDE0', // 🧠
            'Processual Civil': '\uD83D\uDCD8', // 📘
            'Penal': '\uD83D\uDE94', // 🚔
            'Processual Penal': '\uD83D\uDC69\u200D\u2696\uFE0F', // 👩‍⚖️
            'Legislação': '\uD83D\uDCDC' // 📜
        };
        let icon = (base && base.icon) ? String(base.icon) : '';
        const looksBroken = /[\?<>=:\x00-\x1F]/.test(icon) || icon.length <= 1;
        if (looksBroken) {
            for (const key in map) {
                if (name && name.includes(key)) { icon = map[key]; break; }
            }
            if (!icon) icon = '\uD83D\uDCDA';
        }
        return { color: (base && base.color) ? base.color : 'border-gray-400', icon };
    },

    getSmartButtonClasses(sessionId, defaultClasses = 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700') {
        if (window.SmartButtons?.generateSmartButton) {
            return window.SmartButtons.generateSmartButton(sessionId).classes;
        }
        return defaultClasses;
    },

    getSmartButtonText(sessionId, defaultText = 'Iniciar Estudo') {
        if (window.SmartButtons?.generateSmartButton) {
            return window.SmartButtons.generateSmartButton(sessionId, defaultText).text;
        }
        return defaultText;
    },

    getSmartButtonIcon(sessionId, defaultIcon = '▶️') {
        if (window.SmartButtons?.generateSmartButton) {
            return window.SmartButtons.generateSmartButton(sessionId).icon;
        }
        return defaultIcon;
    },

    // Funes auxiliares especficas
    generateSimuladoDescription(session, isDirected, style) {
        if (!isDirected) {
            return `<p class="text-lg text-gray-700 leading-relaxed">${this.sanitizeHtml(session.topic_description)}</p>`;
        }

        const description = this.sanitizeHtml(session.topic_description);
        const parts = description.split('\n\n');
        const mainTitle = parts[0];
        
        if (parts.length <= 1) {
            return `<p class="text-lg text-gray-700 leading-relaxed">${description}</p>`;
        }

        let html = `<p class="mb-6 text-xl font-bold text-gray-800">${mainTitle}</p>`;
        
        // Processar lista de tópicos organizados por disciplinas
        const topicsList = parts[1];
        if (topicsList && topicsList.includes('"')) {
            html += this.processDirectedSimuladoTopics(topicsList, isDirected);
        }
        
        // Adicionar texto final se existir
        if (parts[2]) {
            html += `<div class="bg-gradient-to-r from-purple-100 to-indigo-100 p-4 rounded-xl border border-purple-200"><p class="text-sm text-gray-700 font-medium italic">${parts[2]}</p></div>`;
        }

        return html;
    },

    processDirectedSimuladoTopics(topicsList, isDirected) {
        const lines = topicsList.split('\n').filter(line => line.trim());
        const disciplineGroups = {};
        let currentDiscipline = null;
        
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                currentDiscipline = trimmedLine.replace(/\*\*/g, '');
                if (!disciplineGroups[currentDiscipline]) {
                    disciplineGroups[currentDiscipline] = [];
                }
            } else if (trimmedLine.startsWith('"') && currentDiscipline) {
                disciplineGroups[currentDiscipline].push(trimmedLine.replace('"', '').trim());
            } else if (trimmedLine.startsWith('"') && !currentDiscipline) {
                if (!disciplineGroups['Tópicos Gerais']) {
                    disciplineGroups['Tópicos Gerais'] = [];
                }
                disciplineGroups['Tópicos Gerais'].push(trimmedLine.replace('"', '').trim());
            }
        });

        const disciplineIcons = { 'Direito Constitucional': '\u2696\uFE0F','Direito Administrativo': '\uD83C\uDFDB\uFE0F','Direito Civil': '\uD83D\uDCD7','Direito Penal': '\uD83D\uDE94','Matemática': '\uD83D\uDCCA','Português': '\uD83D\uDCD8','Informática': '\uD83D\uDDA5\uFE0F','default': '\u2022' };

        const hasValidGroups = Object.keys(disciplineGroups).length > 0 && 
            Object.values(disciplineGroups).some(topics => topics.length > 0);

        if (!hasValidGroups) {
            const allTopics = topicsList.split('\n').filter(line => line.trim().startsWith('"'));
            return `
                <div class="bg-white/90 p-6 rounded-2xl border-2 border-purple-200 shadow-lg mb-6">
                    <h4 class="font-bold text-gray-800 mb-4 flex items-center text-lg">
                        <span class="text-2xl mr-3">${disciplineIcons.default}</span>
                        Tpicos do Simulado
                    </h4>
                    <ul class="space-y-2">
                        ${allTopics.map(topic => `
                            <li class="flex items-start space-x-3 py-2 px-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                                <span class="text-purple-500 font-bold mt-1">"</span>
                                <span class="text-gray-700 leading-relaxed">${topic.replace('"', '').trim()}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        return `
            <div class="space-y-4 mb-6">
                ${Object.entries(disciplineGroups).map(([discipline, topics]) => {
                    const icon = disciplineIcons[discipline] || disciplineIcons.default;
                    const topicCount = topics.length;
                    
                    if (topicCount === 0) return '';
                    
                    return `
                        <div class="bg-white/90 p-6 rounded-2xl border-2 border-purple-200 shadow-purple-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-purple-300">
                            <h4 class="font-bold text-gray-800 mb-4 flex items-center justify-between text-lg">
                                <div class="flex items-center">
                                    <span class="text-2xl mr-3">${icon}</span>
                                    <span>${discipline}</span>
                                </div>
                                <span class="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium">
                                    ${topicCount} ${topicCount === 1 ? 'tópico' : 'tópicos'}
                                </span>
                            </h4>
                            <ul class="space-y-2">
                                ${topics.map(topic => `
                                    <li class="flex items-start space-x-3 py-2 px-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                                        <span class="text-purple-500 font-bold mt-1">•</span>
                                        <span class="text-gray-700 leading-relaxed">${topic}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                }).filter(Boolean).join('')}
            </div>
        `;
    },

    generateReviewTopics(parts) {
        const disciplineIcons = { 'Direito Constitucional': '\u2696\uFE0F','Direito Administrativo': '\uD83C\uDFDB\uFE0F','Direito Civil': '\uD83D\uDCD7','Direito Penal': '\uD83D\uDE94','Matemática': '\uD83D\uDCCA','Português': '\uD83D\uDCD8','Informática': '\uD83D\uDDA5\uFE0F','default': '\u2022' };

        return parts.map(part => {
            const lines = part.split('\n');
            const subjectName = lines.shift().replace(/\*\*/g, '');
            const icon = disciplineIcons[subjectName] || disciplineIcons.default;
            const topicList = lines.map(line => `
                <li class="flex items-start space-x-3 py-2 px-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                    <span class="text-yellow-600 font-bold mt-1">•</span>
                    <span class="text-gray-700">${line.replace(/^["\-•]\s*/, '').trim()}</span>
                </li>
            `).join('');
            
            return `
                <div class="bg-white/80 p-5 rounded-2xl border-2 border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300 mb-4">
                    <h4 class="font-bold text-gray-800 mb-4 flex items-center text-lg">
                        <span class="text-2xl mr-3">${icon}</span>
                        ${subjectName}
                        <span class="ml-2 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium">
                            ${lines.length} ${lines.length === 1 ? 'tópico' : 'tópicos'}
                        </span>
                    </h4>
                    <ul class="space-y-2">${topicList}</ul>
                </div>
            `;
        }).join('');
    }
};

// Disponibilizar globalmente para compatibilidade
window.Cards = Cards;





