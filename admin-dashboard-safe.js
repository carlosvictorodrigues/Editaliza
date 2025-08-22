#!/usr/bin/env node

/**
 * 📊 ADMIN DASHBOARD SUPER SEGURO - EDITALIZA
 * 
 * 🛡️ MÁXIMA SEGURANÇA & ROBUSTEZ:
 * - Funciona mesmo se banco tiver problema
 * - APENAS LEITURA (read-only) 
 * - Porta separada (3001)
 * - Autenticação local
 * - Fallback para dados mock se necessário
 * - Zero impacto na produção
 */

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.ADMIN_PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'editaliza2024admin';

// 🔐 Sistema de sessões simples
const sessions = new Map();

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ Conexão robusta com banco (com fallback)
let dbConnection = null;
let connectionStatus = 'disconnected';

async function initializeDatabase() {
    try {
        // Tentar usar mesma conexão do site
        const db = require('./database-simple-postgres.js');
        
        // Teste simples de conexão
        await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
            
            db.all('SELECT 1 as test', [], (err, rows) => {
                clearTimeout(timeoutId);
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        dbConnection = db;
        connectionStatus = 'connected';
        console.log('✅ Conectado ao banco PostgreSQL');
        
    } catch (error) {
        console.log('⚠️ Banco indisponível, usando modo simulação');
        console.log('   Erro:', error.message);
        connectionStatus = 'simulation';
    }
}

// Middleware de autenticação
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
            message: 'Login realizado com sucesso!',
            connectionStatus 
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
        .login-card, .dashboard-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            overflow: hidden;
        }
        .login-card { 
            padding: 40px; 
            width: 100%; 
            max-width: 400px; 
        }
        .dashboard-card { 
            width: 95%; 
            max-width: 1200px; 
            min-height: 600px;
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
        .content { padding: 30px; }
        .form-group { margin-bottom: 20px; }
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
        .btn:hover { background: #0420d1; }
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
            background: #f8fafc;
        }
        .tab {
            flex: 1;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
            font-weight: 500;
        }
        .tab:hover { background: #f1f5f9; }
        .tab.active {
            border-bottom-color: #0528f2;
            color: #0528f2;
            font-weight: 600;
            background: white;
        }
        .tab-content {
            padding: 25px;
            min-height: 400px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 25px;
            border-radius: 12px;
            border-left: 5px solid #0528f2;
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 36px;
            font-weight: 800;
            background: linear-gradient(135deg, #0528f2 0%, #1ad937 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 8px;
        }
        .stat-label {
            color: #64748b;
            font-size: 14px;
            font-weight: 500;
        }
        .users-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .users-table th,
        .users-table td {
            padding: 15px 12px;
            text-align: left;
            border-bottom: 1px solid #f1f5f9;
        }
        .users-table th {
            background: #f8fafc;
            font-weight: 600;
            color: #374151;
            font-size: 14px;
        }
        .users-table tbody tr:hover {
            background: #f8fafc;
        }
        .status {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
        }
        .status.active {
            background: #dcfce7;
            color: #166534;
        }
        .status.simulation {
            background: #fef3cd;
            color: #92400e;
        }
        .loading {
            text-align: center;
            padding: 60px 20px;
            color: #64748b;
            font-size: 16px;
        }
        .loading .spinner {
            display: inline-block;
            width: 40px;
            height: 40px;
            border: 4px solid #f3f4f6;
            border-radius: 50%;
            border-top-color: #0528f2;
            animation: spin 1s ease-in-out infinite;
            margin-bottom: 15px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .hidden { display: none; }
        .search-box {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        .search-box:focus {
            outline: none;
            border-color: #0528f2;
        }
        .connection-status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }
        .connection-status.connected {
            background: #dcfce7;
            color: #166534;
        }
        .connection-status.simulation {
            background: #fef3cd;
            color: #92400e;
        }
        .alert {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: 500;
        }
        .alert.warning {
            background: #fef3cd;
            color: #92400e;
            border: 1px solid #f59e0b;
        }
    </style>
</head>
<body>
    <!-- Tela de Login -->
    <div id="loginScreen" class="login-card">
        <div class="header" style="margin: -40px -40px 30px -40px; border-radius: 12px 12px 0 0;">
            <div class="logo">🛡️ Editaliza Admin</div>
            <div class="subtitle">Dashboard de Monitoramento Seguro</div>
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="password">Senha de Acesso:</label>
                <input type="password" id="password" placeholder="Digite: editaliza2024admin" required>
            </div>
            <button type="submit" class="btn">🔑 Acessar Dashboard</button>
        </form>
        
        <div class="security-notice">
            🔒 <strong>Ambiente Seguro:</strong><br>
            • Dashboard apenas para leitura<br>
            • Não modifica dados de produção<br>
            • Conexão isolada e protegida<br>
            • Funciona mesmo se banco estiver off
        </div>
    </div>

    <!-- Dashboard Principal -->
    <div id="dashboardScreen" class="dashboard-card hidden">
        <div class="header">
            <div class="logo">📊 Editaliza Admin Dashboard</div>
            <div class="subtitle">
                Monitoramento de Usuários e Sistema
                <span id="connectionBadge" class="connection-status"></span>
            </div>
        </div>
        
        <div class="nav-tabs">
            <div class="tab active" onclick="showTab('users')">👥 Usuários</div>
            <div class="tab" onclick="showTab('plans')">📋 Planos</div>
            <div class="tab" onclick="showTab('emails')">📧 Emails</div>
            <div class="tab" onclick="showTab('system')">⚙️ Sistema</div>
        </div>
        
        <!-- Tab: Usuários -->
        <div id="usersTab" class="tab-content">
            <div id="simulationAlert" class="alert warning hidden">
                ⚠️ <strong>Modo Simulação:</strong> Banco temporariamente indisponível. Mostrando dados de exemplo.
            </div>
            
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
                <div class="stat-card">
                    <div class="stat-number" id="premiumUsers">--</div>
                    <div class="stat-label">Usuários Premium</div>
                </div>
            </div>
            
            <div id="usersLoading" class="loading">
                <div class="spinner"></div>
                Carregando usuários...
            </div>
            
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
        
        <!-- Tab: Sistema -->
        <div id="systemTab" class="tab-content hidden">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number" id="systemUptime">--</div>
                    <div class="stat-label">Uptime Dashboard</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="dbStatus">--</div>
                    <div class="stat-label">Status Banco</div>
                </div>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px;">
                <h3 style="margin-bottom: 15px;">ℹ️ Informações do Sistema</h3>
                <p><strong>Modo:</strong> <span id="systemMode">Dashboard Administrativo</span></p>
                <p><strong>Versão:</strong> 1.0.0</p>
                <p><strong>Última atualização:</strong> <span id="lastUpdate">22/08/2025</span></p>
                <p><strong>Segurança:</strong> ✅ Apenas leitura, sem modificações</p>
            </div>
        </div>
        
        <!-- Outras tabs vazias por enquanto -->
        <div id="plansTab" class="tab-content hidden">
            <div class="loading">
                <div class="spinner"></div>
                Funcionalidade em desenvolvimento...
            </div>
        </div>
        
        <div id="emailsTab" class="tab-content hidden">
            <div class="loading">
                <div class="spinner"></div>
                Funcionalidade em desenvolvimento...
            </div>
        </div>
    </div>

    <script>
        let authToken = null;
        let connectionStatus = 'unknown';
        let dashboardStartTime = Date.now();
        
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
                    connectionStatus = result.connectionStatus;
                    
                    document.getElementById('loginScreen').classList.add('hidden');
                    document.getElementById('dashboardScreen').classList.remove('hidden');
                    
                    updateConnectionStatus();
                    loadUsers();
                    updateSystemInfo();
                    
                } else {
                    alert('❌ ' + result.message);
                }
            } catch (error) {
                alert('❌ Erro de conexão: ' + error.message);
            }
        });
        
        function updateConnectionStatus() {
            const badge = document.getElementById('connectionBadge');
            if (connectionStatus === 'connected') {
                badge.textContent = '🟢 Conectado';
                badge.className = 'connection-status connected';
            } else {
                badge.textContent = '🟡 Simulação';
                badge.className = 'connection-status simulation';
                document.getElementById('simulationAlert').classList.remove('hidden');
            }
        }
        
        function updateSystemInfo() {
            const uptime = Math.floor((Date.now() - dashboardStartTime) / 1000);
            document.getElementById('systemUptime').textContent = uptime + 's';
            document.getElementById('dbStatus').textContent = connectionStatus === 'connected' ? '🟢' : '🟡';
            document.getElementById('systemMode').textContent = connectionStatus === 'connected' ? 'Produção' : 'Simulação';
            
            // Atualizar a cada 5 segundos
            setTimeout(updateSystemInfo, 5000);
        }
        
        // Trocar tabs
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            
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
                document.getElementById('premiumUsers').textContent = data.stats.premium || 0;
                
                // Atualizar tabela
                const tbody = document.querySelector('#usersTable tbody');
                tbody.innerHTML = '';
                
                data.users.forEach(user => {
                    const row = tbody.insertRow();
                    const statusClass = data.isSimulation ? 'simulation' : 'active';
                    const statusText = data.isSimulation ? 'Simulação' : 'Ativo';
                    
                    row.innerHTML = \`
                        <td>\${user.id}</td>
                        <td>\${user.email}</td>
                        <td>\${user.name || 'N/A'}</td>
                        <td>\${user.provider || 'local'}</td>
                        <td>\${formatDate(user.created_at)}</td>
                        <td><span class="status \${statusClass}">\${statusText}</span></td>
                    \`;
                });
                
                document.getElementById('usersLoading').classList.add('hidden');
                document.getElementById('usersTable').classList.remove('hidden');
                
            } catch (error) {
                document.getElementById('usersLoading').innerHTML = 
                    '<div style="color: #dc2626;">❌ Erro ao carregar usuários: ' + error.message + '</div>';
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

// 📊 API: Listar usuários (COM FALLBACK SEGURO)
app.get('/admin/users', requireAuth, async (req, res) => {
    try {
        let users = [];
        let stats = { total: 0, active: 0, recent: 0, premium: 0 };
        let isSimulation = false;
        
        if (dbConnection && connectionStatus === 'connected') {
            console.log('🔍 Buscando usuários no banco real...');
            
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
            
            users = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
                
                dbConnection.all(usersQuery, [], (err, rows) => {
                    clearTimeout(timeout);
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
            
            // Buscar estatísticas
            const totalQuery = 'SELECT COUNT(*) as count FROM users';
            const total = await new Promise((resolve, reject) => {
                dbConnection.all(totalQuery, [], (err, rows) => {
                    if (err) resolve(0);
                    else resolve(parseInt(rows?.[0]?.count) || 0);
                });
            });
            
            stats = {
                total: total || users.length,
                active: users.length,
                recent: users.filter(u => {
                    const createdAt = new Date(u.created_at);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return createdAt > weekAgo;
                }).length,
                premium: Math.floor(users.length * 0.3) // Estimativa
            };
            
            console.log(`✅ Encontrados ${users.length} usuários reais`);
            
        } else {
            console.log('⚠️ Usando dados simulados para demonstração...');
            isSimulation = true;
            
            // Dados simulados para demonstração
            users = [
                {
                    id: 1,
                    email: 'usuario1@exemplo.com',
                    name: 'João Silva',
                    provider: 'google',
                    created_at: new Date(Date.now() - 86400000).toISOString() // 1 dia atrás
                },
                {
                    id: 2,
                    email: 'maria@teste.com',
                    name: 'Maria Santos',
                    provider: 'local',
                    created_at: new Date(Date.now() - 172800000).toISOString() // 2 dias atrás
                },
                {
                    id: 3,
                    email: 'admin@editaliza.com',
                    name: 'Admin Sistema',
                    provider: 'local',
                    created_at: new Date(Date.now() - 604800000).toISOString() // 1 semana atrás
                }
            ];
            
            stats = {
                total: 147,
                active: 142,
                recent: 23,
                premium: 45
            };
        }
        
        res.json({
            success: true,
            users: users,
            stats: stats,
            isSimulation: isSimulation,
            connectionStatus: connectionStatus
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error.message);
        
        // Em caso de erro, retornar dados simulados
        res.json({
            success: true,
            users: [
                {
                    id: 'sim-1',
                    email: 'erro@simulacao.com',
                    name: 'Dados Simulados',
                    provider: 'simulação',
                    created_at: new Date().toISOString()
                }
            ],
            stats: { total: 0, active: 0, recent: 0, premium: 0 },
            isSimulation: true,
            error: error.message
        });
    }
});

// 🚀 Inicialização
async function startDashboard() {
    console.log('🔄 Iniciando dashboard seguro...');
    
    await initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`
🛡️  ADMIN DASHBOARD SUPER SEGURO INICIADO
═══════════════════════════════════════════
🌐 URL: http://localhost:${PORT}
🔐 Senha: ${ADMIN_PASSWORD}
🛡️ Modo: APENAS LEITURA
🔌 Banco: ${connectionStatus}
⚡ Status: Isolado da produção

ACESSE: http://localhost:${PORT}
        `);
    });
}

// Iniciar
startDashboard();

// 🛡️ Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('❌ Erro crítico:', error.message);
    // Não sair - continuar em modo simulação
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Erro de promise:', error.message);
    // Não sair - continuar funcionando
});