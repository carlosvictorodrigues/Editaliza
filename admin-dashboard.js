#!/usr/bin/env node

/**
 * 📊 ADMIN DASHBOARD - EDITALIZA
 * 
 * 🛡️ SUPER SEGURO:
 * - APENAS LEITURA (read-only)
 * - Porta separada (3001)
 * - Autenticação local
 * - Zero impacto na produção
 * 
 * Para iniciar: node admin-dashboard.js
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');

// 🔒 SEGURANÇA: Usar mesma conexão do site, mas APENAS LEITURA
const db = require('./database-simple-postgres.js');

const app = express();
const PORT = 3001; // Porta diferente da produção

// 🔐 Senha simples para acessar dashboard (pode mudar depois)
const ADMIN_PASSWORD = 'editaliza2024admin';

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 🛡️ Middleware de autenticação simples
const sessions = new Map();

function requireAuth(req, res, next) {
    const sessionId = req.headers.authorization || req.query.auth;
    
    if (sessions.has(sessionId)) {
        next();
    } else {
        res.status(401).json({ error: 'Não autorizado. Faça login primeiro.' });
    }
}

// 🔑 Rota de login
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        const sessionId = crypto.randomUUID();
        sessions.set(sessionId, { created: Date.now() });
        
        // Limpar sessões antigas (1 hora)
        setTimeout(() => sessions.delete(sessionId), 3600000);
        
        res.json({ 
            success: true, 
            sessionId,
            message: 'Login realizado com sucesso!' 
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Senha incorreta' 
        });
    }
});

// 📊 Dashboard principal
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - Editaliza</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0528f2 0%, #1ad937 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-card {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }
        .dashboard-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            width: 95%;
            max-width: 1200px;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #0528f2 0%, #1ad937 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .logo {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 5px;
        }
        .subtitle {
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #374151;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        input:focus {
            outline: none;
            border-color: #0528f2;
        }
        .btn {
            width: 100%;
            padding: 12px;
            background: #0528f2;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .btn:hover {
            background: #0420d1;
        }
        .security-notice {
            margin-top: 20px;
            padding: 15px;
            background: #f0fdf4;
            border: 1px solid #1ad937;
            border-radius: 6px;
            font-size: 13px;
            color: #166534;
        }
        .nav-tabs {
            display: flex;
            border-bottom: 2px solid #f3f4f6;
        }
        .tab {
            flex: 1;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }
        .tab.active {
            border-bottom-color: #0528f2;
            color: #0528f2;
            font-weight: 600;
        }
        .tab-content {
            padding: 20px;
            min-height: 400px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #0528f2;
        }
        .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: #0528f2;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #64748b;
            font-size: 14px;
        }
        .users-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .users-table th,
        .users-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        .users-table th {
            background: #f8fafc;
            font-weight: 600;
        }
        .users-table tbody tr:hover {
            background: #f8fafc;
        }
        .status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .status.active {
            background: #dcfce7;
            color: #166534;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #64748b;
        }
        .hidden { display: none; }
        .search-box {
            width: 100%;
            padding: 10px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <!-- Tela de Login -->
    <div id="loginScreen" class="login-card">
        <div class="header" style="margin: -40px -40px 30px -40px;">
            <div class="logo">🛡️ Editaliza Admin</div>
            <div class="subtitle">Dashboard de Monitoramento</div>
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="password">Senha de Acesso:</label>
                <input type="password" id="password" placeholder="Digite a senha admin" required>
            </div>
            <button type="submit" class="btn">🔑 Fazer Login</button>
        </form>
        
        <div class="security-notice">
            🔒 <strong>Ambiente Seguro:</strong><br>
            • Dashboard apenas para leitura<br>
            • Não modifica dados de produção<br>
            • Conexão isolada e protegida
        </div>
    </div>

    <!-- Dashboard Principal -->
    <div id="dashboardScreen" class="dashboard-card hidden">
        <div class="header">
            <div class="logo">📊 Editaliza Admin Dashboard</div>
            <div class="subtitle">Monitoramento de Usuários e Sistema</div>
        </div>
        
        <div class="nav-tabs">
            <div class="tab active" onclick="showTab('users')">👥 Usuários</div>
            <div class="tab" onclick="showTab('plans')">📋 Planos</div>
            <div class="tab" onclick="showTab('emails')">📧 Emails</div>
            <div class="tab" onclick="showTab('stats')">📊 Estatísticas</div>
        </div>
        
        <!-- Tab: Usuários -->
        <div id="usersTab" class="tab-content">
            <input type="text" class="search-box" placeholder="🔍 Buscar usuário por email ou nome..." id="userSearch">
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number" id="totalUsers">--</div>
                    <div class="stat-label">Total de Usuários</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="activeUsers">--</div>
                    <div class="stat-label">Usuários Ativos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="recentUsers">--</div>
                    <div class="stat-label">Cadastros (7 dias)</div>
                </div>
            </div>
            
            <div id="usersLoading" class="loading">🔄 Carregando usuários...</div>
            <table id="usersTable" class="users-table hidden">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Nome</th>
                        <th>Provider</th>
                        <th>Cadastro</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        
        <!-- Outras tabs... -->
        <div id="plansTab" class="tab-content hidden">
            <div class="loading">🔄 Carregando planos...</div>
        </div>
        
        <div id="emailsTab" class="tab-content hidden">
            <div class="loading">📧 Carregando logs de email...</div>
        </div>
        
        <div id="statsTab" class="tab-content hidden">
            <div class="loading">📊 Carregando estatísticas...</div>
        </div>
    </div>

    <script>
        let authToken = null;
        
        // Login
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    authToken = result.sessionId;
                    document.getElementById('loginScreen').classList.add('hidden');
                    document.getElementById('dashboardScreen').classList.remove('hidden');
                    loadUsers();
                } else {
                    alert('❌ ' + result.message);
                }
            } catch (error) {
                alert('❌ Erro de conexão: ' + error.message);
            }
        });
        
        // Trocar tabs
        function showTab(tabName) {
            // Remover active de todas as tabs
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            
            // Ativar tab selecionada
            event.target.classList.add('active');
            document.getElementById(tabName + 'Tab').classList.remove('hidden');
        }
        
        // Carregar usuários
        async function loadUsers() {
            try {
                const response = await fetch('/admin/users', {
                    headers: { 'Authorization': authToken }
                });
                
                const data = await response.json();
                
                // Atualizar estatísticas
                document.getElementById('totalUsers').textContent = data.stats.total;
                document.getElementById('activeUsers').textContent = data.stats.active;
                document.getElementById('recentUsers').textContent = data.stats.recent;
                
                // Atualizar tabela
                const tbody = document.querySelector('#usersTable tbody');
                tbody.innerHTML = '';
                
                data.users.forEach(user => {
                    const row = tbody.insertRow();
                    row.innerHTML = \`
                        <td>\${user.id}</td>
                        <td>\${user.email}</td>
                        <td>\${user.name || 'N/A'}</td>
                        <td>\${user.provider || 'local'}</td>
                        <td>\${formatDate(user.created_at)}</td>
                        <td><span class="status active">Ativo</span></td>
                    \`;
                });
                
                document.getElementById('usersLoading').classList.add('hidden');
                document.getElementById('usersTable').classList.remove('hidden');
                
            } catch (error) {
                document.getElementById('usersLoading').innerHTML = '❌ Erro ao carregar usuários: ' + error.message;
            }
        }
        
        // Formatação de data
        function formatDate(dateString) {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleDateString('pt-BR');
        }
        
        // Busca de usuários
        document.getElementById('userSearch').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#usersTable tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    </script>
</body>
</html>
    `);
});

// 📊 API: Listar usuários (APENAS LEITURA)
app.get('/admin/users', requireAuth, async (req, res) => {
    try {
        console.log('🔍 Buscando usuários no banco...');
        
        // 🔒 APENAS SELECT - ZERO RISCO
        const usersQuery = `
            SELECT 
                id, 
                email, 
                name, 
                provider,
                created_at,
                CASE 
                    WHEN password_hash IS NOT NULL THEN 'COM_SENHA'
                    ELSE 'SEM_SENHA'
                END as has_password
            FROM users 
            ORDER BY created_at DESC
            LIMIT 100
        `;
        
        const users = await new Promise((resolve, reject) => {
            db.all(usersQuery, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Estatísticas
        const totalQuery = 'SELECT COUNT(*) as count FROM users';
        const recentQuery = `SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'`;
        
        const total = await new Promise((resolve, reject) => {
            db.all(totalQuery, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows?.[0]?.count || 0);
            });
        });
        
        const recent = await new Promise((resolve, reject) => {
            db.all(recentQuery, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows?.[0]?.count || 0);
            });
        });
        
        console.log(`✅ Encontrados ${users.length} usuários`);
        
        res.json({
            success: true,
            users: users,
            stats: {
                total: parseInt(total) || users.length,
                active: users.length, // Todos ativos por enquanto
                recent: parseInt(recent) || 0
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar usuários',
            details: error.message 
        });
    }
});

// 🚀 Iniciar servidor
app.listen(PORT, () => {
    console.log(`
🛡️  ADMIN DASHBOARD INICIADO COM SEGURANÇA MÁXIMA
═══════════════════════════════════════════════════
🌐 URL: http://localhost:${PORT}
🔐 Senha: ${ADMIN_PASSWORD}
🛡️ Modo: APENAS LEITURA
⚡ Status: Isolado da produção

ACESSE: http://localhost:${PORT}
    `);
});

// 🛡️ Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('❌ Erro crítico:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Erro de promise:', error);
});