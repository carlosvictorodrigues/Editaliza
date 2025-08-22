/**
 * @file js/components.js
 * @description Funções para renderizar componentes de UI reutilizáveis com a nova identidade visual.
 */

const components = {
    // Renderiza os componentes globais da UI (spinner, toast)
    renderGlobalUI() {
        const uiContainer = document.createElement('div');
        uiContainer.innerHTML = `
            <div id="toast-container" class="fixed top-5 right-5 z-50 space-y-3"></div>
            <div id="spinner-overlay" class="hidden fixed inset-0 bg-editaliza-black bg-opacity-60 z-50 flex items-center justify-center">
                <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-editaliza-blue"></div>
            </div>
        `;
        document.body.prepend(uiContainer);
    },

    // Renderiza a navegação principal com a LOGO SIMÉTRICA e alinhamento corrigido
    renderMainNavigation(activePage) {
        const navContainer = document.getElementById('main-nav-container');
        if (!navContainer) return;

        const links = [
            { href: 'home.html', text: 'Painel Principal' },
            { href: 'dashboard.html', text: 'Gerenciar Planos' },
            { href: 'metodologia.html', text: 'Nossa Metodologia' },
            { href: 'faq.html', text: 'FAQ' }
        ];

        let linksHtml = links.map(link => {
            const isActive = activePage === link.href;
            const linkClass = isActive ? 'nav-link-active' : 'nav-link-default';
            return `<a href="${link.href}" class="${linkClass} px-4 py-2 rounded-lg text-sm font-medium transition-colors">${link.text}</a>`;
        }).join('');
        
        navContainer.innerHTML = `
            <header class="bg-white shadow-md sticky top-0 z-20">
                <div class="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex justify-between items-center h-16">
                        <div class="flex items-center space-x-3">
                            <a href="home.html" class="flex-shrink-0 flex items-center">
                                <!-- LOGOTIPO CORRIGIDO E ATUALIZADO -->
                                <svg id="logo-header" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 255.12 255.12" class="h-8 w-auto">
                                    <defs>
                                        <style>
                                          .cls-1-logo { fill: #0528f2; }
                                          .cls-2-logo { fill: #ffffff; }
                                          .cls-3-logo { fill: #1ad937; }
                                        </style>
                                    </defs>
                                    <g id="Camada_1-2" data-name="Camada 1">
                                        <rect class="cls-1-logo" width="255.12" height="255.12" rx="70.87" ry="70.87"/>
                                        <g>
                                            <path class="cls-2-logo" d="M119.22,205.51s-18.76-41.05-66.32-33.2v-36.93s45.68,2.49,62.23,48.36c1.86,6.56,3.26,13.8,4.09,21.76Z"/>
                                            <path class="cls-3-logo" d="M119.22,205.51c-10.37-49.38-44.19-65.06-66.32-69.99-5.42-1.22-10.15-1.78-13.65-2.04-3.64-.27-6.46-3.29-6.46-6.94,0-4.19,3.66-7.43,7.81-6.91,17.62,2.22,60.02,12.88,74.52,64.12,1.86,6.56,3.26,13.8,4.09,21.76Z"/>
                                            <path class="cls-2-logo" d="M135.9,205.51s18.76-42.92,66.32-35.06v-35.06s-45.68,2.49-62.23,48.36c-1.86,6.56-3.26,13.8-4.09,21.76Z"/>
                                            <path class="cls-3-logo" d="M135.9,205.51c10.37-49.38,44.19-65.06,66.32-69.99,5.42-1.22,10.15-1.78,13.65-2.04,3.64-.27,6.46-3.29,6.46-6.94,0-4.19-3.66-7.43,7.81-6.91-17.62,2.22,60.02,12.88-74.52,64.12-1.86,6.56,3.26,13.8-4.09,21.76Z"/>
                                            <path class="cls-2-logo" d="M170.85,61.46c-13.35-7.9-28.32-11.85-43.29-11.85-14.97,0-29.94,3.95-43.29,11.85l-52.33,30.96c-4.56,2.7-3.17,9.65,2.08,10.37,18.43,2.53,48.4,10.24,75.41,33.4,2.62,2.24,5.53,3.95,8.6,5.12,6.13,2.33,12.94,2.33,19.07,0,3.07-1.17,5.98-2.87,8.6-5.12,27.01-23.16,56.98-30.87,75.41-33.4,5.25-.72,6.64-7.67,2.08-10.37l-52.33-30.96ZM127.56,124.08c-9.47,0-17.14-7.68-17.14-17.14s7.68-17.14,17.14-17.14,17.14,7.68,17.14,17.14-7.68,17.14-17.14,17.14Z"/>
                                        </g>
                                    </g>
                                </svg>
                            </a>
                            <span class="font-bold text-xl text-editaliza-black hidden sm:inline">Editaliza</span>
                        </div>
                        <nav class="hidden md:flex items-center space-x-4">
                            ${linksHtml}
                        </nav>
                        <div class="flex items-center">
                            <button id="logoutButton" class="text-sm font-medium text-editaliza-gray hover:text-editaliza-black transition-colors">Sair</button>
                        </div>
                    </div>
                </div>
            </header>
        `;
        
        document.getElementById('logoutButton').addEventListener('click', () => app.logout());
    },
    
    renderPlanHeader(planId, planName, activePage) {
        const headerContainer = document.getElementById('plan-header-container');
        if (!headerContainer) return;

        // CORRIGIDO: Sanitiza o nome do plano para prevenir XSS
        const safePlanName = app.sanitizeHtml(planName);

        const links = [
            { id: 'navPerformance', href: `plan.html?id=${planId}`, text: 'Meu Desempenho' },
            { id: 'navSchedule', href: `cronograma.html?id=${planId}`, text: 'Ver Cronograma' },
            { id: 'navSettings', href: `plan_settings.html?id=${planId}`, text: 'Configurar Plano' }
        ];

        let linksHtml = links.map(link => {
            const isActive = activePage === link.href.split('?')[0];
            const activeClass = 'bg-editaliza-blue text-white cursor-default';
            const defaultClass = 'bg-white hover:bg-gray-100 text-gray-700';
            return `<a id="${link.id}" href="${link.href}" class="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 shadow-sm transition-colors ${isActive ? activeClass : defaultClass}">${link.text}</a>`;
        }).join('');

        headerContainer.innerHTML = `
            <div class="content-card mb-8">
                <div class="flex flex-col sm:flex-row justify-between sm:items-center">
                    <div class="mb-4 sm:mb-0">
                        <h1 class="text-2xl font-bold text-editaliza-black">${safePlanName}</h1>
                        <p id="examDate" class="text-md text-editaliza-gray mt-1"></p>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${linksHtml}
                    </div>
                </div>
            </div>
        `;
    },

    renderOverdueAlert(count, containerId = 'overdue-alert-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (count > 0) {
            container.innerHTML = `
                <div id="overdueAlert" class="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-lg mb-8 shadow" role="alert">
                    <div class="flex">
                        <div class="py-1"><svg class="fill-current h-6 w-6 text-yellow-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 18a8 8 0 1 1 0 -16 8 8 0 0 1 0 16zm-1-4a1 1 0 0 0 2 0v-4a1 1 0 0 0-2 0v4zm0-8a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/></svg></div>
                        <div>
                            <p class="font-bold">Atenção! Você tem ${count} tarefa(s) atrasada(s).</p>
                            <p class="text-sm">Clique no botão para reorganizar seu cronograma automaticamente.</p>
                            <button id="replanButton" class="mt-3 px-4 py-2 bg-yellow-400 text-white font-bold rounded-md hover:bg-yellow-500 transition-colors text-sm shadow">
                                Replanejar Tarefas Atrasadas
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    },

    // ATUALIZADO: Componente para o painel de gamificação com a próxima meta
    renderGamificationDashboard(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const streakColor = data.studyStreak > 0 ? 'text-orange-500' : 'text-gray-400';
        const streakAnimation = data.studyStreak > 0 ? 'animate-pulse' : '';

        let nextLevelHtml = '';
        if (data.nextLevel) {
            const progressPercentage = ((data.completedTopicsCount - (data.nextLevel.threshold - data.topicsToNextLevel)) / (data.nextLevel.threshold - (data.nextLevel.threshold - data.topicsToNextLevel))) * 100;
            nextLevelHtml = `
                <div class="mt-4 pt-4 border-t border-gray-200 col-span-2">
                    <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Próxima Meta</h4>
                    <p class="text-center font-semibold text-editaliza-green mt-1">${app.sanitizeHtml(data.nextLevel)}</p>
                    <p class="text-center text-xs text-gray-400 mt-1">Faltam ${data.topicsToNextLevel} tópicos!</p>
                </div>
            `;
        }


        container.innerHTML = `
            <div class="content-card mb-8">
                <div class="grid grid-cols-2 md:grid-cols-2 gap-6 text-center">
                    <div>
                        <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider">Seu Nível</h3>
                        <p class="text-lg font-bold text-editaliza-blue mt-1">${app.sanitizeHtml(data.concurseiroLevel)}</p>
                        <p class="text-xs text-gray-400 mt-1">${data.completedTopicsCount} tópicos concluídos</p>
                    </div>
                    <div>
                        <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider">Sequência de Estudos</h3>
                        <p class="text-3xl font-bold ${streakColor} mt-1 flex items-center justify-center">
                            <span class="text-4xl mr-2 ${streakAnimation}">🔥</span>
                            ${data.studyStreak}
                        </p>
                         <p class="text-xs text-gray-400 mt-1">dias seguidos</p>
                    </div>
                    ${nextLevelHtml}
                </div>
            </div>
        `;
    },

    createSessionCard(session) {
        const style = app.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-slate-100' : 'bg-white';
        const secondaryText = session.session_type !== 'Novo Tópico' ? ` <span class="text-indigo-600 font-bold text-xs">(${app.sanitizeHtml(session.session_type)})</span>` : '';
        
        // CORRIGIDO: Sanitiza todos os dados vindos do banco
        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        const safeTopicDescription = app.sanitizeHtml(session.topic_description);
        const safeNotes = app.sanitizeHtml(session.notes || '');

        return `
            <div class="flex flex-col justify-between h-full p-4 rounded-xl shadow-md border-l-4 ${style.color} ${cardBg}">
                <div>
                    <div class="flex justify-between items-start">
                        <h3 class="font-bold text-lg text-gray-800 flex items-center"><span class="text-xl mr-2">${style.icon}</span><span>${safeSubjectName}</span></h3>
                        ${secondaryText}
                    </div>
                    <p class="mt-2 text-gray-600">${safeTopicDescription}</p>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    <div class="flex items-center">
                        <input type="checkbox" data-session-id="${session.id}" ${isCompleted ? 'checked' : ''} class="h-5 w-5 rounded border-gray-300 text-editaliza-blue focus:ring-editaliza-blue">
                        <label class="ml-3 font-medium text-gray-700">Concluído</label>
                    </div>
                    <div><label class="text-sm font-medium text-gray-700">Questões</label><input type="number" data-session-id="${session.id}" data-field="questions_solved" value="${session.questions_solved || ''}" class="form-input py-2" placeholder="0"></div>
                    <div><label class="text-sm font-medium text-gray-700">Anotações</label><textarea data-session-id="${session.id}" data-field="notes" class="form-input py-2" rows="3" placeholder="Suas anotações...">${safeNotes}</textarea></div>
                    <div class="flex space-x-2">
                        <button class="btn-action-sm" onclick="reinforceSession(${session.id})">Reforçar</button>
                        <button class="btn-action-sm" onclick="openPostponeModal(${session.id})">Adiar</button>
                    </div>
                </div>
            </div>`;
    },

    createSimuladCard(session) {
        const isCompleted = session.status === 'Concluído';
        const isDirected = session.session_type === 'Simulado Direcionado';

        const style = isDirected ? 
            { color: 'border-purple-500', bg: 'bg-purple-50', icon: '🎯' } : 
            { color: 'border-slate-700', bg: 'bg-slate-100', icon: '🏆' };
        
        // CORRIGIDO: Sanitiza todos os dados vindos do banco
        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        const safeNotes = app.sanitizeHtml(session.notes || '');
        
        let descriptionHtml = '';
        if (isDirected) {
            const parts = app.sanitizeHtml(session.topic_description).split('\\n\\n');
            const mainTitle = parts.shift();
            descriptionHtml += `<p class="mb-4">${mainTitle}</p>`;
            descriptionHtml += parts.map(subjectBlock => {
                const lines = subjectBlock.split('\\n');
                const subjectName = lines.shift().replace(/\*\*/g, '');
                const subjectStyle = app.getSubjectStyle(subjectName);
                const topicsList = lines.map(topic => `<li class="text-sm text-gray-600">${topic}</li>`).join('');
                return `
                    <div>
                        <h4 class="font-bold text-gray-800 flex items-center mt-3"><span class="text-xl mr-2">${subjectStyle.icon}</span>${subjectName}</h4>
                        <ul class="list-disc list-inside ml-5 mt-1 space-y-1">
                            ${topicsList}
                        </ul>
                    </div>
                `;
            }).join('');
        } else {
            descriptionHtml = app.sanitizeHtml(session.topic_description);
        }

        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 flex flex-col justify-between h-full p-6 rounded-xl shadow-lg border-l-4 ${style.color} ${style.bg}">
                <div>
                    <h3 class="font-bold text-xl text-gray-800 flex items-center"><span class="text-2xl mr-3">${style.icon}</span>${safeSubjectName}</h3>
                    <div class="mt-2 text-gray-700 prose prose-sm">${descriptionHtml}</div>
                </div>
                <div class="mt-6 pt-4 border-t border-gray-200 space-y-3">
                     <div class="flex items-center">
                        <input type="checkbox" data-session-id="${session.id}" ${isCompleted ? 'checked' : ''} class="h-5 w-5 rounded border-gray-300 text-editaliza-blue focus:ring-editaliza-blue">
                        <label class="ml-3 font-medium text-gray-700">Concluído</label>
                    </div>
                    <div><label class="text-sm font-medium text-gray-700">Anotações do Simulado</label><textarea data-session-id="${session.id}" data-field="notes" class="form-input py-2" rows="4" placeholder="Anote seus principais erros, acertos e pontos de melhoria...">${safeNotes}</textarea></div>
                </div>
            </div>`;
    },

    createEssayCard(session) {
        const style = app.getSubjectStyle(session.subject_name); // subject_name será "Redação"
        const isCompleted = session.status === 'Concluído';
        const cardBg = 'bg-rose-50'; // Cor de fundo para combinar com a borda

        // CORRIGIDO: Sanitiza todos os dados vindos do banco
        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        const safeTopicDescription = app.sanitizeHtml(session.topic_description);
        const safeNotes = app.sanitizeHtml(session.notes || '');

        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 flex flex-col justify-between h-full p-6 rounded-xl shadow-lg border-l-4 ${style.color} ${cardBg}">
                <div>
                    <h3 class="font-bold text-xl text-gray-800 flex items-center"><span class="text-2xl mr-3">${style.icon}</span>${safeSubjectName}</h3>
                    <p class="mt-2 text-gray-700">${safeTopicDescription}</p>
                </div>
                <div class="mt-6 pt-4 border-t border-gray-200 space-y-3">
                     <div class="flex items-center">
                        <input type="checkbox" data-session-id="${session.id}" ${isCompleted ? 'checked' : ''} class="h-5 w-5 rounded border-gray-300 text-editaliza-blue focus:ring-editaliza-blue">
                        <label class="ml-3 font-medium text-gray-700">Concluído</label>
                    </div>
                    <div><label class="text-sm font-medium text-gray-700">Anotações / Autoavaliação</label><textarea data-session-id="${session.id}" data-field="notes" class="form-input py-2" rows="4" placeholder="Anote os pontos fortes e fracos da sua redação, e o que precisa melhorar...">${safeNotes}</textarea></div>
                </div>
            </div>`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    components.renderGlobalUI();
});
