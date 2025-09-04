// ============================================================================
// MELHORIAS NO SISTEMA DE TIMER - BREAK VISUAL E NOTIFICAÇÕES
// ============================================================================

// Variáveis para controlar o estado do break
let isInBreak = false;
let breakNotificationInterval = null;
let lastBreakTime = 0;

/**
 * Sistema de break visual do Pomodoro (sem modal)
 * Muda cor do timer e toca som, mas NÃO para o cronômetro
 */
function showPomodoroBreakModal() {
    if (!usePomodoroMode) return;
    
    const currentSeconds = getElapsedSeconds();
    
    // Se já estamos em break, não fazer nada
    if (isInBreak) return;
    
    // Marcar que estamos em break
    isInBreak = true;
    lastBreakTime = currentSeconds;
    
    // Tocar som de início do break
    playBreakSound();
    
    // Mudar visual do timer para indicar break
    applyBreakVisualStyle();
    
    // Mostrar notificação inicial do break
    showBreakNotification(
        '🧘 Hora do Break!',
        'Respire fundo e relaxe por 5 minutos. O timer continua rodando.',
        'info'
    );
    
    // Iniciar notificações periódicas durante o break
    startBreakNotifications();
    
    // Agendar fim do break após 5 minutos
    setTimeout(() => {
        endBreak();
    }, 5 * 60 * 1000); // 5 minutos
}

/**
 * Aplica estilo visual para indicar que está em break
 */
function applyBreakVisualStyle() {
    const timerContainer = document.querySelector('.timer-display');
    const timerElement = document.getElementById('timer');
    
    if (timerContainer) {
        timerContainer.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        timerContainer.style.boxShadow = '0 15px 35px rgba(102, 126, 234, 0.3)';
    }
    
    if (timerElement) {
        timerElement.style.color = '#ffd700';
        timerElement.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
    }
    
    // Adicionar indicador de break
    const breakIndicator = document.createElement('div');
    breakIndicator.id = 'break-indicator';
    breakIndicator.innerHTML = '☕ MODO BREAK ATIVO ☕';
    breakIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        font-weight: bold;
        z-index: 10000;
        animation: pulse 2s infinite;
        box-shadow: 0 5px 15px rgba(245, 87, 108, 0.4);
    `;
    document.body.appendChild(breakIndicator);
}

/**
 * Remove estilo visual do break
 */
function removeBreakVisualStyle() {
    const timerContainer = document.querySelector('.timer-display');
    const timerElement = document.getElementById('timer');
    
    if (timerContainer) {
        timerContainer.style.background = '';
        timerContainer.style.boxShadow = '';
    }
    
    if (timerElement) {
        timerElement.style.color = '';
        timerElement.style.textShadow = '';
    }
    
    // Remover indicador de break
    const breakIndicator = document.getElementById('break-indicator');
    if (breakIndicator) {
        breakIndicator.remove();
    }
}

/**
 * Inicia notificações periódicas durante o break
 */
function startBreakNotifications() {
    const breakTips = [
        { icon: '💧', title: 'Hidratação', message: 'Beba um copo de água!' },
        { icon: '🏃', title: 'Movimento', message: 'Levante e faça um alongamento rápido!' },
        { icon: '👁️', title: 'Descanso Visual', message: 'Olhe para longe da tela por 20 segundos' },
        { icon: '🌬️', title: 'Respiração', message: 'Faça 3 respirações profundas' },
        { icon: '🎯', title: 'Foco', message: 'Prepare-se mentalmente para o próximo ciclo' }
    ];
    
    let tipIndex = 0;
    
    // Mostrar uma dica a cada minuto durante o break
    breakNotificationInterval = setInterval(() => {
        if (!isInBreak) {
            clearInterval(breakNotificationInterval);
            return;
        }
        
        if (tipIndex < breakTips.length) {
            const tip = breakTips[tipIndex];
            showBreakNotification(
                `${tip.icon} ${tip.title}`,
                tip.message,
                'info'
            );
            tipIndex++;
        }
    }, 60000); // A cada 1 minuto
}

/**
 * Finaliza o período de break
 */
function endBreak() {
    if (!isInBreak) return;
    
    isInBreak = false;
    
    // Tocar som de fim do break
    playBreakSound(true);
    
    // Remover estilo visual do break
    removeBreakVisualStyle();
    
    // Parar notificações do break
    if (breakNotificationInterval) {
        clearInterval(breakNotificationInterval);
        breakNotificationInterval = null;
    }
    
    // Mostrar notificação de retorno ao foco
    showBreakNotification(
        '🎯 Break Finalizado!',
        'Hora de voltar ao foco! Próximo break em 25 minutos.',
        'success'
    );
    
    // Verificar se completou uma sessão
    checkSessionCompletion();
}

/**
 * Verifica se completou uma sessão de estudo
 */
function checkSessionCompletion() {
    const currentMinutes = Math.floor(getElapsedSeconds() / 60);
    const sessionDuration = getSessionDuration();
    
    // Se completou o tempo da sessão
    if (currentMinutes >= sessionDuration && currentMinutes % sessionDuration === 0) {
        showSessionCompletionNotification();
        updateProgress();
    }
}

/**
 * Obtém a duração da sessão do plano atual
 */
function getSessionDuration() {
    const defaultDuration = 50; // 50 minutos padrão
    
    try {
        const currentPlan = JSON.parse(localStorage.getItem('currentStudyPlan'));
        if (currentPlan && currentPlan.sessionDuration) {
            return parseInt(currentPlan.sessionDuration);
        }
    } catch (e) {
        console.log('Usando duração padrão da sessão');
    }
    
    return defaultDuration;
}

/**
 * Mostra notificação de conclusão de sessão
 */
function showSessionCompletionNotification() {
    const motivationalMessages = [
        '🏆 Parabéns! Você completou uma sessão inteira!',
        '🌟 Incrível! Mais uma sessão concluída com sucesso!',
        '💪 Você está arrasando! Continue assim!',
        '🎯 Meta atingida! Sua dedicação está valendo a pena!',
        '🚀 Excelente trabalho! Você está no caminho certo!'
    ];
    
    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    
    // Notificação especial de conclusão
    showBreakNotification(
        '🎊 Sessão Completa!',
        randomMessage,
        'success'
    );
    
    // Tocar som especial de conquista
    playAchievementSound();
    
    // Atualizar gamificação
    if (window.updateGamificationProgress) {
        window.updateGamificationProgress('session_completed');
    }
}

/**
 * Mostra notificação estilizada para breaks
 */
function showBreakNotification(title, message, type = 'info') {
    // Criar container de notificação
    const notification = document.createElement('div');
    notification.className = 'break-notification';
    
    const colors = {
        info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        success: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        max-width: 350px;
        background: ${colors[type]};
        color: white;
        padding: 15px 20px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.5s ease-out;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    notification.innerHTML = `
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${title}</div>
        <div style="font-size: 14px; opacity: 0.95;">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover após 5 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.5s ease-out';
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}

/**
 * Toca som de break
 */
function playBreakSound(isEnd = false) {
    try {
        const audio = new Audio();
        if (isEnd) {
            // Som de fim do break (mais energético)
            audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDGH0fPTgjMGHm7A7+OZURE=';
        } else {
            // Som de início do break (mais suave)
            audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYmNjYmFgYWJjY2JhYGFiY2NiYWBhYmNjYmFgYWJjY2JhYGFiY2NiYWBhYmNjYmFgYWJjY2JhYGFiY2NiYWBhYmNjYmFgYWJjY2JhYGFiY2NiYWBhYmNjYmFgYWJjY2JhYGF=';
        }
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Som de break não pôde ser reproduzido'));
    } catch (e) {
        console.log('Erro ao tocar som:', e);
    }
}

/**
 * Toca som de conquista
 */
function playAchievementSound() {
    try {
        const audio = new Audio();
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAAABAAEAEAfAAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fZJivrJBhNjVgodDbq2EcBj+a2/LDciUFLYHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFQpGn+DyvmwhBDGH0fPTgjMGHm7A7+OZURE=';
        audio.volume = 0.6;
        audio.play().catch(e => console.log('Som de conquista não pôde ser reproduzido'));
    } catch (e) {
        console.log('Erro ao tocar som de conquista:', e);
    }
}

/**
 * Obtém segundos decorridos do timer
 */
function getElapsedSeconds() {
    return elapsedSeconds || 0;
}

/**
 * CSS de animações para as notificações
 */
const animationStyles = `
<style>
@keyframes slideIn {
    from {
        transform: translateX(400px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOut {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(400px);
        opacity: 0;
    }
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
    100% {
        transform: scale(1);
    }
}
</style>
`;

// Adicionar estilos ao documento
if (!document.getElementById('break-animation-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'break-animation-styles';
    styleElement.innerHTML = animationStyles;
    document.head.appendChild(styleElement.firstElementChild);
}

// ============================================================================
// INSTRUÇÕES PARA INTEGRAÇÃO NO TIMER.JS:
// ============================================================================
// 
// 1. ADICIONAR no início do arquivo timer.js (após as variáveis globais existentes):
//    let isInBreak = false;
//    let breakNotificationInterval = null;
//    let lastBreakTime = 0;
//
// 2. SUBSTITUIR a função showPomodoroBreakModal() completa pela versão acima
//
// 3. ADICIONAR todas as funções auxiliares:
//    - applyBreakVisualStyle()
//    - removeBreakVisualStyle()  
//    - startBreakNotifications()
//    - endBreak()
//    - checkSessionCompletion()
//    - getSessionDuration()
//    - showSessionCompletionNotification()
//    - showBreakNotification()
//    - playBreakSound()
//    - playAchievementSound()
//
// 4. VERIFICAR que a variável elapsedSeconds existe e está acessível
//
// 5. TESTAR o fluxo completo:
//    - Timer continua rodando durante o break
//    - Visual muda aos 25 minutos
//    - Notificações aparecem durante o break
//    - Visual volta ao normal aos 30 minutos
//    - Sessão completa é detectada corretamente