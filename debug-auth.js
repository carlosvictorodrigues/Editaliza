const jwt = require('jsonwebtoken');
require('dotenv').config();

// Token do erro (você pode pegar do navegador)
const token = process.argv[2] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTQxLCJlbWFpbCI6ImVkaXRhbGl6YUBvdXRsb29rLmNvbSIsIm5hbWUiOiJMdWNhcyIsInNlc3Npb25JZCI6ImdGcjNXVGdGSDNKbHhhaTJqMkZJViIsImlhdCI6MTcyNTAzODM5MSwiZXhwIjoxNzI1MTI0NzkxfQ.BSA-NQSyHZ5yZqo6DXG0nqJsP4fIlQJ8nLJ2SgJvJoQ';

try {
    // Decodificar sem verificar (para debug)
    const decoded = jwt.decode(token);
    
    console.log('🔐 Token decodificado:');
    console.log('User ID:', decoded.id);
    console.log('Email:', decoded.email);
    console.log('Nome:', decoded.name);
    console.log('Session ID:', decoded.sessionId);
    console.log('Emitido em:', new Date(decoded.iat * 1000).toLocaleString());
    console.log('Expira em:', new Date(decoded.exp * 1000).toLocaleString());
    
    // Verificar se expirou
    const now = Date.now() / 1000;
    if (decoded.exp < now) {
        console.log('\n⚠️ TOKEN EXPIRADO!');
    } else {
        console.log('\n✅ Token ainda válido');
    }
    
    console.log('\n📝 Problema identificado:');
    console.log('- O token é do usuário ID:', decoded.id);
    console.log('- A sessão 11910 pertence ao usuário ID: 148');
    console.log('- Por isso retorna 404 (não autorizado)');
    
} catch (error) {
    console.error('❌ Erro ao decodificar token:', error.message);
}

// Verificar sessões do usuário correto
const db = require('./database-postgresql.js');

async function checkUserSessions() {
    try {
        const decoded = jwt.decode(token);
        const userId = decoded.id;
        
        console.log('\n🔍 Buscando sessões do usuário', userId, '...');
        
        const sessions = await db.all(`
            SELECT ss.id, ss.subject_name, ss.status, ss.session_date
            FROM study_sessions ss
            JOIN study_plans sp ON ss.study_plan_id = sp.id
            WHERE sp.user_id = $1
            ORDER BY ss.session_date DESC, ss.id DESC
            LIMIT 10
        `, [userId]);
        
        if (sessions.length > 0) {
            console.log('\n📋 Sessões disponíveis para este usuário:');
            sessions.forEach(s => {
                const date = new Date(s.session_date).toLocaleDateString('pt-BR');
                console.log(`  - ID ${s.id}: ${s.subject_name} - ${date} (${s.status})`);
            });
        } else {
            console.log('❌ Nenhuma sessão encontrada para o usuário', userId);
        }
        
    } catch (error) {
        console.error('Erro ao buscar sessões:', error);
    } finally {
        process.exit(0);
    }
}

setTimeout(checkUserSessions, 100);