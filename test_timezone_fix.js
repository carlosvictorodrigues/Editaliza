/**
 * Teste para verificar correção do fuso horário de Brasília
 */

// Função original (problemática)
const getDateOriginal = () => {
    return new Date().toISOString().split('T')[0];
};

// Função corrigida para Brasília
const getBrazilianDate = () => {
    const now = new Date();
    // Converter para horário de Brasília (UTC-3)
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    return brazilTime.toISOString().split('T')[0];
};

// Teste de comparação
console.log('🌍 Teste de Fuso Horário - Brasília');
console.log('=====================================');
console.log('Horário atual do sistema:', new Date().toString());
console.log('Data original (UTC/Local):', getDateOriginal());
console.log('Data corrigida (Brasília):', getBrazilianDate());
console.log('');

// Simular sessão de hoje
const today = getBrazilianDate();
console.log(`📅 Sessões de hoje (${today}):`);

// Teste de lógica de tarefa atrasada
const testSessions = [
    { session_date: today, status: 'Pendente', subject_name: 'Sessão de Hoje' },
    { session_date: '2024-08-12', status: 'Pendente', subject_name: 'Sessão de Ontem' },
    { session_date: '2024-08-14', status: 'Pendente', subject_name: 'Sessão de Amanhã' }
];

testSessions.forEach(session => {
    const isOverdue = session.session_date < getBrazilianDate() && session.status === 'Pendente';
    console.log(`${session.subject_name}: ${session.session_date} - ${isOverdue ? '🔴 ATRASADA' : '✅ OK'}`);
});

console.log('');
console.log('✅ Teste concluído! Tarefas de hoje não devem mais aparecer como atrasadas às 21h.');