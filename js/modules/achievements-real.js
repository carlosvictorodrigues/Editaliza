/**
 * Conquistas REAIS do Sistema Editaliza
 * Mapeamento completo baseado no backend
 * Progressão ajustada para motivar desde o início
 */

const EDITALIZA_ACHIEVEMENTS = {
    // Conquistas por TÓPICOS CONCLUÍDOS - Progressão suave no início
    TOPICS: [
        // CONQUISTAS INICIAIS - Vitórias rápidas para motivar
        { id: 'topics_1', threshold: 1, icon: '🎯', title: 'Primeira Lapada no Edital', description: 'O primeiro soco na cara da procrastinação!' },
        { id: 'topics_2', threshold: 2, icon: '🔥', title: 'Tá Pegando o Jeito', description: 'Dois tópicos! O começo da sua jornada épica!' },
        { id: 'topics_3', threshold: 3, icon: '🚀', title: 'Decolando', description: 'Três tópicos! Houston, não temos mais procrastinação!' },
        { id: 'topics_5', threshold: 5, icon: '📚', title: 'Maratonista do PDF', description: 'Cinco tópicos! Sua vista já começou a reclamar.' },
        { id: 'topics_7', threshold: 7, icon: '⚡', title: 'Ritmo de Cruzeiro', description: 'Uma semana de tópicos! Tá voando baixo!' },
        { id: 'topics_10', threshold: 10, icon: '✨', title: 'Destruidor de Questões', description: 'Dezena completa! Já discute gabarito com confiança.' },
        
        // CONQUISTAS INTERMEDIÁRIAS - Progressão gradual
        { id: 'topics_15', threshold: 15, icon: '🎓', title: 'Estudante Aplicado', description: 'Quinze tópicos! Seus amigos já pedem dicas.' },
        { id: 'topics_20', threshold: 20, icon: '📖', title: 'Devorador de Conteúdo', description: 'Vinte tópicos! O café já é seu melhor amigo.' },
        { id: 'topics_25', threshold: 25, icon: '👑', title: 'Dono do Material', description: 'Sabe até a cor da caneta do professor!' },
        { id: 'topics_30', threshold: 30, icon: '💡', title: 'Iluminado', description: 'Trinta tópicos! Você virou referência no grupo.' },
        { id: 'topics_40', threshold: 40, icon: '🏃', title: 'Maratonista', description: 'Quarenta tópicos! Nada mais te para!' },
        { id: 'topics_50', threshold: 50, icon: '🌟', title: 'Meio Monstro', description: 'Cinquenta! Você é lenda no grupo de estudos.' },
        
        // CONQUISTAS AVANÇADAS - Grandes marcos
        { id: 'topics_75', threshold: 75, icon: '🦾', title: 'Máquina de Guerra', description: 'Setenta e cinco! As bancas tremem!' },
        { id: 'topics_100', threshold: 100, icon: '🏛️', title: 'Centurião do Conhecimento', description: 'Cem tópicos! Bancas te bloqueiam no Instagram.' },
        { id: 'topics_150', threshold: 150, icon: '🔮', title: 'Oráculo dos Concursos', description: 'Você prevê questões da prova!' },
        { id: 'topics_200', threshold: 200, icon: '💪', title: 'Chuck Norris dos Editais', description: 'Os editais temem você!' },
        { id: 'topics_300', threshold: 300, icon: '🌌', title: 'Transcendente', description: 'Trezentos! Você existe em outra dimensão.' },
        { id: 'topics_500', threshold: 500, icon: '🧠', title: 'Cérebro Jurídico Supremo', description: 'Conquista épica para os imortais!' },
        { id: 'topics_1000', threshold: 1000, icon: '🏛️', title: 'Vai Escolher Onde Tomar Posse', description: 'Mil tópicos! Não é se vai passar, é onde.' }
    ],
    
    // Conquistas por STREAK (dias consecutivos) - Celebrar consistência desde cedo
    STREAK: [
        { id: 'streak_1', threshold: 1, icon: '🌱', title: 'Semente Plantada', description: 'Primeiro dia! Toda jornada começa com um passo!' },
        { id: 'streak_2', threshold: 2, icon: '🔗', title: 'Criando o Hábito', description: 'Dois dias seguidos! Consistência chegando!' },
        { id: 'streak_3', threshold: 3, icon: '📺', title: 'Resistente ao Netflix', description: 'Três dias! Resistiu à série nova!' },
        { id: 'streak_5', threshold: 5, icon: '🎯', title: 'Semana de Trabalho', description: 'Cinco dias! Melhor que muito CLT!' },
        { id: 'streak_7', threshold: 7, icon: '🛋️', title: 'Imune ao Sofá', description: 'Uma semana! O sofá esqueceu sua forma!' },
        { id: 'streak_10', threshold: 10, icon: '💪', title: 'Força de Vontade', description: 'Dez dias! Você é imparável!' },
        { id: 'streak_14', threshold: 14, icon: '😤', title: 'Inimigo do Descanso', description: 'Duas semanas! Descanso? Não conheço!' },
        { id: 'streak_21', threshold: 21, icon: '🧠', title: 'Hábito Formado', description: 'Três semanas! Dizem que agora é automático!' },
        { id: 'streak_30', threshold: 30, icon: '🤖', title: 'Máquina de Aprovar', description: 'Um mês! Você é uma máquina!' },
        { id: 'streak_60', threshold: 60, icon: '🌟', title: 'Lendário', description: 'Dois meses! Você é inspiração!' },
        { id: 'streak_100', threshold: 100, icon: '👑', title: 'Imortal', description: 'Cem dias! Você transcendeu!' }
    ],
    
    // Conquistas por SESSÕES COMPLETADAS - Recompensas frequentes no começo
    SESSIONS: [
        { id: 'sessions_1', threshold: 1, icon: '🎬', title: 'Primeira Sessão', description: 'Começou! O primeiro de muitos!' },
        { id: 'sessions_3', threshold: 3, icon: '🎪', title: 'Circo Pegando Fogo', description: 'Três sessões! Tá esquentando!' },
        { id: 'sessions_5', threshold: 5, icon: '✋', title: 'High Five', description: 'Cinco sessões! Toca aqui!' },
        { id: 'sessions_7', threshold: 7, icon: '🍀', title: 'Número da Sorte', description: 'Sete sessões! Sorte é treino!' },
        { id: 'sessions_10', threshold: 10, icon: '🎯', title: 'Dezena Cravada', description: 'Dez sessões! Tá ficando sério!' },
        { id: 'sessions_15', threshold: 15, icon: '🏃', title: 'Pegando Ritmo', description: 'Quinze sessões! Agora vai!' },
        { id: 'sessions_20', threshold: 20, icon: '💊', title: 'Viciado(a) em Questões', description: 'Vinte! Questões são sua droga legal!' },
        { id: 'sessions_25', threshold: 25, icon: '📚', title: 'Rato de Biblioteca', description: 'Já mora na biblioteca!' },
        { id: 'sessions_30', threshold: 30, icon: '🔥', title: 'Em Chamas', description: 'Trinta sessões! Tá pegando fogo!' },
        { id: 'sessions_40', threshold: 40, icon: '💺', title: 'Cadeira Cativa', description: 'Sua cadeira já tem seu formato!' },
        { id: 'sessions_50', threshold: 50, icon: '🪑', title: 'Lombar Suprema', description: 'Já fez mais fisioterapia que simulados.' },
        { id: 'sessions_75', threshold: 75, icon: '📖', title: 'PhD em Resumos', description: 'Seus resumos viram material de curso!' },
        { id: 'sessions_100', threshold: 100, icon: '👑', title: 'Rei/Rainha do Resumo', description: 'Cem sessões! Domina a arte do estudo.' },
        { id: 'sessions_150', threshold: 150, icon: '🛏️', title: 'Travesseiro Vade Mecum', description: 'Dorme abraçado com os livros!' },
        { id: 'sessions_200', threshold: 200, icon: '🏖️', title: 'O que é Férias?', description: 'Férias? Nunca ouvi falar.' },
        { id: 'sessions_300', threshold: 300, icon: '🎉', title: 'Destruidor de Finais de Semana', description: 'Churrasco? Só depois da posse!' },
        { id: 'sessions_500', threshold: 500, icon: '🌟', title: 'Lenda Viva', description: 'Quinhentas sessões! Você é história!' }
    ]
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.EDITALIZA_ACHIEVEMENTS = EDITALIZA_ACHIEVEMENTS;
}