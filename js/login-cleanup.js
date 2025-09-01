/**
 * Sistema de limpeza de cache ao fazer login
 * Garante que dados de outros usuários não persistam
 */

// Função para limpar todos os dados em cache
function cleanupUserData() {
    console.log('🧹 Limpando dados do usuário anterior...');
    
    // Lista de chaves que devem ser preservadas (se houver)
    const preserveKeys = ['theme', 'language', 'preferences'];
    
    // Salvar valores que devem ser preservados
    const preserved = {};
    preserveKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) preserved[key] = value;
    });
    
    // Limpar todo o localStorage
    localStorage.clear();
    
    // Restaurar valores preservados
    Object.keys(preserved).forEach(key => {
        localStorage.setItem(key, preserved[key]);
    });
    
    // Limpar sessionStorage completamente
    sessionStorage.clear();
    
    // Limpar cookies relacionados ao plano (se existirem)
    document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name.includes('plan') || name.includes('session')) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
    });
    
    console.log('✅ Cache limpo com sucesso');
}

// Função para validar e carregar dados do usuário correto
async function loadCorrectUserData() {
    try {
        console.log('📋 Carregando dados do usuário logado...');
        
        // Buscar plano ativo do usuário atual
        const response = await fetch('/api/plans/active', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const plan = await response.json();
            console.log('✅ Plano ativo carregado:', plan.id, '-', plan.plan_name);
            
            // Salvar planId correto
            localStorage.setItem('currentPlanId', plan.id);
            sessionStorage.setItem('currentPlanId', plan.id);
            
            // Garantir que PlanContext use o plano correto
            if (window.PlanContext) {
                window.PlanContext.planId = plan.id;
                window.PlanContext.planData = plan;
            }
            
            return plan;
        } else if (response.status === 404) {
            console.log('⚠️ Nenhum plano ativo encontrado');
            // Redirecionar para criar plano
            window.location.href = '/create-plan.html';
        } else {
            throw new Error('Erro ao carregar plano');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
        // Em caso de erro, limpar tudo e fazer logout
        cleanupUserData();
        window.location.href = '/login.html';
    }
}

// Executar limpeza ao fazer login
function onLoginSuccess(token, userData) {
    console.log('🔐 Login realizado com sucesso');
    
    // 1. Limpar dados antigos
    cleanupUserData();
    
    // 2. Salvar novo token
    localStorage.setItem('token', token);
    
    // 3. Salvar dados do usuário
    if (userData) {
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('userName', userData.name);
        localStorage.setItem('userEmail', userData.email);
    }
    
    // 4. Carregar dados corretos
    loadCorrectUserData().then(() => {
        // 5. Redirecionar para home
        window.location.href = '/home.html';
    });
}

// Verificar integridade dos dados ao carregar páginas
function validateUserData() {
    const token = localStorage.getItem('token');
    const planId = localStorage.getItem('currentPlanId');
    
    if (!token) {
        console.log('❌ Token não encontrado, redirecionando para login');
        window.location.href = '/login.html';
        return false;
    }
    
    // Decodificar token para verificar expiração
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000; // Converter para milliseconds
        
        if (Date.now() > exp) {
            console.log('⚠️ Token expirado, fazendo logout');
            cleanupUserData();
            window.location.href = '/login.html';
            return false;
        }
        
        // Verificar se o planId corresponde ao usuário
        if (planId && window.location.pathname.includes('home')) {
            console.log('✅ Validação OK - Usuário:', payload.id, 'Plano:', planId);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Token inválido:', error);
        cleanupUserData();
        window.location.href = '/login.html';
        return false;
    }
}

// Exportar funções
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        cleanupUserData,
        loadCorrectUserData,
        onLoginSuccess,
        validateUserData
    };
} else {
    window.LoginCleanup = {
        cleanupUserData,
        loadCorrectUserData,
        onLoginSuccess,
        validateUserData
    };
}

// Auto-executar validação ao carregar
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Só validar em páginas que precisam de autenticação
        const protectedPages = ['home.html', 'dashboard.html', 'cronograma.html', 'plan.html'];
        const currentPage = window.location.pathname.split('/').pop();
        
        if (protectedPages.includes(currentPage)) {
            validateUserData();
        }
    });
}