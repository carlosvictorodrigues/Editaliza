// ===== CORREÇÃO CRÍTICA: Função global para abrir sessões de estudo melhorada =====
function openStudySession(sessionId) {
    try {
        console.log(`🎯 Iniciando sessão ${sessionId} no cronograma...`);
        
        // CORREÇÃO: Verificar se há um timer ativo para essa sessão
        if (window.TimerSystem && TimerSystem.hasActiveTimer(sessionId)) {
            console.log(`⏰ Timer ativo encontrado para sessão ${sessionId} - continuando sem abrir modal`);
            TimerSystem.continueTimer(sessionId);
            app.showToast('⏱️ Timer retomado! Continue estudando.', 'success');
            return; // Não abrir modal
        }
        
        // CORREÇÃO: Verificar se há um timer pausado com tempo
        if (window.TimerSystem && TimerSystem.timers[sessionId] && TimerSystem.timers[sessionId].elapsed > 1000) {
            const timeStr = TimerSystem.formatTime(TimerSystem.timers[sessionId].elapsed);
            console.log(`⏸️ Timer pausado encontrado para sessão ${sessionId} - Tempo: ${timeStr}`);
            
            // Perguntar se quer continuar ou começar do zero (via modal de confirmação)
            const continueTimer = confirm(`Você já tem ${timeStr} de estudo nesta sessão.\n\nDeseja:\n- OK: Continuar de onde parou\n- Cancelar: Começar do zero`);
            
            if (continueTimer) {
                TimerSystem.continueTimer(sessionId);
                app.showToast(`⏱️ Continuando de ${timeStr}`, 'success');
                return; // Não abrir modal
            } else {
                // Resetar timer e abrir modal normalmente
                TimerSystem.timers[sessionId] = null;
                delete TimerSystem.timers[sessionId];
            }
        }
        
        // SOLUÇÃO: Buscar sessão de forma mais flexível
        let foundSession = null;
        
        // Primeiro, procurar em todas as datas do fullSchedule
        if (typeof fullSchedule !== 'undefined') {
            for (const dateStr in fullSchedule) {
                const sessions = fullSchedule[dateStr];
                foundSession = sessions.find(s => s.id == sessionId);
                if (foundSession) {
                    console.log(`📚 Sessão encontrada no cronograma local:`, foundSession);
                    break;
                }
            }
        }
        
        // Se não encontrou, tentar buscar no servidor
        if (!foundSession && app.state.activePlanId) {
            console.log(`🔍 Sessão não encontrada no cronograma local, buscando no servidor...`);
            
            // Buscar sessão individual do servidor
            app.apiFetch(`/schedules/sessions/${sessionId}`)
                .then(sessionData => {
                    console.log(`✅ Sessão encontrada no servidor:`, sessionData);
                    StudyChecklist.show(sessionData);
                })
                .catch(error => {
                    console.error(`❌ Erro ao buscar sessão ${sessionId}:`, error);
                    app.showToast('Erro: Sessão não encontrada. Verifique se você tem permissão para acessá-la.', 'error');
                });
            return;
        }
        
        if (foundSession) {
            console.log(`✅ Abrindo modal de estudo para sessão:`, foundSession);
            StudyChecklist.show(foundSession);
        } else {
            console.error(`❌ Sessão ${sessionId} não encontrada`);
            app.showToast('Sessão não encontrada. Recarregue a página e tente novamente.', 'error');
        }
        
    } catch (error) {
        console.error(`❌ Erro ao abrir sessão ${sessionId}:`, error);
        app.showToast('Erro inesperado ao abrir sessão. Tente novamente.', 'error');
    }
}