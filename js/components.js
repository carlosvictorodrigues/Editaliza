/* eslint-env browser */
/* global app, TimerSystem */

/**
 * @file js/components.js
 * @description Funções para renderizar componentes de UI reutilizáveis com a nova identidade visual.
 */

const components = {
    // ... (conteúdo existente do generateSmartButton e outras funções)

    createSessionCard(session) {
        // ... (lógica existente)
    },

    createSimuladCard(session) {
        const isCompleted = session.status === 'Concluído';
        const isDirected = session.session_type === 'Simulado Direcionado';
        const badgeIcon = isDirected ? '🎯' : '🏆';
        const badgeText = isDirected ? 'DIRECIONADO' : 'COMPLETO';

        // ... (resto da lógica do card de simulado)

        // Adicionar o badge no HTML gerado
        return `
            <div class="... study-card ...">
                <span class="session-badge simulado-badge">${badgeIcon} ${badgeText}</span>
                ...
            </div>
        `;
    },

    createReviewCard(session) {
        const isCompleted = session.status === 'Concluído';
        let reviewType = '';
        if (session.topic_description.includes('(R7)')) reviewType = '7D';
        else if (session.topic_description.includes('(R14)')) reviewType = '14D';
        else if (session.topic_description.includes('(R28)')) reviewType = '28D';

        // ... (resto da lógica do card de revisão)

        // Adicionar o badge no HTML gerado
        return `
            <div class="... study-card ...">
                ${reviewType ? `<span class="session-badge review-badge review-${reviewType.toLowerCase()}">🔄 ${reviewType}</span>` : ''}
                ...
            </div>
        `;
    },

    // ... (resto das funções existentes)
};

// Adicionar CSS para os novos badges
const style = document.createElement('style');
style.textContent = `
.session-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    text-shadow: 1px 1px 1px rgba(0,0,0,0.2);
}
.review-badge {
    background: linear-gradient(135deg, #f59e0b, #ef4444);
}
.simulado-badge {
    background: linear-gradient(135deg, #8b5cf6, #3b82f6);
}
`;
document.head.appendChild(style);

window.components = components;