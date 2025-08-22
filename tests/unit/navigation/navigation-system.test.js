/**
 * @file tests/unit/navigation/navigation-system.test.js
 * @description Testes unitários para o Sistema de Navegação
 * @jest-environment jsdom
 */

// Mock do sistema de navegação baseado na estrutura observada
const NavigationSystem = {
    // Sistema de rotas
    routes: {
        '/': { name: 'Home', protected: true, component: 'dashboard' },
        '/login.html': { name: 'Login', protected: false, component: 'auth' },
        '/register.html': { name: 'Register', protected: false, component: 'auth' },
        '/dashboard.html': { name: 'Dashboard', protected: true, component: 'dashboard' },
        '/plan.html': { name: 'Plano de Estudos', protected: true, component: 'plan' },
        '/cronograma.html': { name: 'Cronograma', protected: true, component: 'schedule' },
        '/profile.html': { name: 'Perfil', protected: true, component: 'profile' },
        '/notes.html': { name: 'Anotações', protected: true, component: 'notes' },
        '/metodologia.html': { name: 'Metodologia', protected: false, component: 'info' },
        '/faq.html': { name: 'FAQ', protected: false, component: 'info' },
        '/politica-privacidade.html': { name: 'Política de Privacidade', protected: false, component: 'legal' }
    },

    // Estado da navegação
    state: {
        currentRoute: null,
        previousRoute: null,
        isAuthenticated: false,
        breadcrumbs: [],
        menuState: {
            isOpen: false,
            activeDropdown: null
        }
    },

    // Inicializar sistema de navegação
    init: function() {
        this.state.currentRoute = this.getCurrentRoute();
        this.state.isAuthenticated = this.checkAuthentication();
        this.updateBreadcrumbs();
        this.setupEventListeners();
        this.validateCurrentRoute();
    },

    // Obter rota atual
    getCurrentRoute: function() {
        let path = window.location.pathname;
        if (path === '/' || path === '') {
            path = '/home.html';
        }
        return path;
    },

    // Verificar autenticação
    checkAuthentication: function() {
        return !!localStorage.getItem('editaliza_token');
    },

    // Validar rota atual
    validateCurrentRoute: function() {
        const route = this.routes[this.state.currentRoute];
        
        if (!route) {
            console.warn(`Rota não encontrada: ${this.state.currentRoute}`);
            return false;
        }

        if (route.protected && !this.state.isAuthenticated) {
            console.warn(`Acesso negado para rota protegida: ${this.state.currentRoute}`);
            this.redirectTo('/login.html');
            return false;
        }

        return true;
    },

    // Navegação programática
    navigateTo: function(path, options = {}) {
        if (!this.isValidRoute(path)) {
            throw new Error(`Rota inválida: ${path}`);
        }

        const route = this.routes[path];
        
        // Verificar autorização
        if (route.protected && !this.state.isAuthenticated) {
            throw new Error(`Acesso negado para: ${path}`);
        }

        // Salvar rota anterior
        this.state.previousRoute = this.state.currentRoute;
        this.state.currentRoute = path;

        // Atualizar URL se não for só teste
        if (!options.testMode) {
            window.history.pushState({}, '', path);
        }

        // Atualizar breadcrumbs
        this.updateBreadcrumbs();

        // Disparar evento de navegação
        this.dispatchNavigationEvent(path, this.state.previousRoute);

        return true;
    },

    // Redirecionamento
    redirectTo: function(path) {
        if (!this.isValidRoute(path)) {
            throw new Error(`Rota inválida para redirecionamento: ${path}`);
        }

        window.location.href = path;
    },

    // Verificar se é rota válida
    isValidRoute: function(path) {
        return path in this.routes;
    },

    // Atualizar breadcrumbs
    updateBreadcrumbs: function() {
        const route = this.routes[this.state.currentRoute];
        if (!route) return;

        this.state.breadcrumbs = this.generateBreadcrumbs(this.state.currentRoute);
    },

    // Gerar breadcrumbs baseado na rota
    generateBreadcrumbs: function(path) {
        const breadcrumbs = [{ name: 'Início', path: '/' }];
        
        const route = this.routes[path];
        if (route && route.name !== 'Home') {
            breadcrumbs.push({ name: route.name, path: path });
        }

        return breadcrumbs;
    },

    // Sistema de menu dropdown
    toggleDropdown: function(menuId) {
        if (this.state.menuState.activeDropdown === menuId) {
            this.state.menuState.activeDropdown = null;
        } else {
            this.state.menuState.activeDropdown = menuId;
        }

        this.updateDropdownVisibility();
    },

    // Atualizar visibilidade dos dropdowns
    updateDropdownVisibility: function() {
        const dropdowns = document.querySelectorAll('.dropdown-content');
        dropdowns.forEach(dropdown => {
            const menuId = dropdown.getAttribute('data-menu-id');
            if (menuId === this.state.menuState.activeDropdown) {
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        });
    },

    // Fechar todos os dropdowns
    closeAllDropdowns: function() {
        this.state.menuState.activeDropdown = null;
        this.updateDropdownVisibility();
    },

    // Sistema responsivo
    handleResponsiveNavigation: function() {
        const screenWidth = window.innerWidth;
        
        if (screenWidth < 768) {
            this.enableMobileNavigation();
        } else {
            this.enableDesktopNavigation();
        }
    },

    // Navegação mobile
    enableMobileNavigation: function() {
        this.state.menuState.isMobile = true;
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
            mobileMenu.style.display = this.state.menuState.isOpen ? 'block' : 'none';
        }
    },

    // Navegação desktop
    enableDesktopNavigation: function() {
        this.state.menuState.isMobile = false;
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
            mobileMenu.style.display = 'none';
        }
    },

    // Toggle menu mobile
    toggleMobileMenu: function() {
        this.state.menuState.isOpen = !this.state.menuState.isOpen;
        this.enableMobileNavigation();
    },

    // Configurar listeners
    setupEventListeners: function() {
        // Click fora dos dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                this.closeAllDropdowns();
            }
        });

        // Resize da janela
        window.addEventListener('resize', () => {
            this.handleResponsiveNavigation();
        });

        // PopState para navegação do browser
        window.addEventListener('popstate', () => {
            this.state.currentRoute = this.getCurrentRoute();
            this.updateBreadcrumbs();
        });
    },

    // Disparar evento customizado
    dispatchNavigationEvent: function(newRoute, oldRoute) {
        const event = new CustomEvent('navigationChange', {
            detail: { newRoute, oldRoute }
        });
        document.dispatchEvent(event);
    },

    // Verificar se link é seguro
    isSecureLink: function(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            return urlObj.origin === window.location.origin;
        } catch {
            return false;
        }
    },

    // Tratamento de erros de navegação
    handleNavigationError: function(error, path) {
        console.error(`Erro de navegação para ${path}:`, error);
        
        // Tentar voltar para a página anterior
        if (this.state.previousRoute && this.isValidRoute(this.state.previousRoute)) {
            this.navigateTo(this.state.previousRoute, { testMode: true });
        } else {
            // Fallback para home
            this.redirectTo('/home.html');
        }
    },

    // Obter informações da rota atual
    getCurrentRouteInfo: function() {
        const route = this.routes[this.state.currentRoute];
        return {
            path: this.state.currentRoute,
            name: route?.name || 'Desconhecido',
            protected: route?.protected || false,
            component: route?.component || null,
            breadcrumbs: this.state.breadcrumbs
        };
    },

    // Listar todas as rotas acessíveis
    getAccessibleRoutes: function() {
        return Object.entries(this.routes)
            .filter(([path, route]) => !route.protected || this.state.isAuthenticated)
            .map(([path, route]) => ({ path, ...route }));
    },

    // Verificar se pode acessar rota
    canAccessRoute: function(path) {
        const route = this.routes[path];
        if (!route) return false;
        
        if (route.protected && !this.state.isAuthenticated) return false;
        
        return true;
    },

    // Limpar estado
    reset: function() {
        this.state = {
            currentRoute: null,
            previousRoute: null,
            isAuthenticated: false,
            breadcrumbs: [],
            menuState: {
                isOpen: false,
                activeDropdown: null
            }
        };
    }
};

describe('Sistema de Navegação - Testes Unitários', () => {
    beforeEach(() => {
        // Limpar DOM
        document.body.innerHTML = '';
        
        // Resetar sistema
        NavigationSystem.reset();
        
        // Mock do localStorage
        Storage.prototype.getItem = jest.fn();
        Storage.prototype.setItem = jest.fn();
        
        // Mock do window.location
        delete window.location;
        window.location = {
            pathname: '/home.html',
            origin: 'http://localhost:3000',
            href: 'http://localhost:3000/home.html'
        };
        
        // Mock do window.history
        window.history = {
            pushState: jest.fn()
        };
        
        jest.clearAllMocks();
    });

    describe('Inicialização do Sistema', () => {
        test('deve inicializar sistema corretamente', () => {
            NavigationSystem.init();
            
            expect(NavigationSystem.state.currentRoute).toBe('/home.html');
            expect(NavigationSystem.state.breadcrumbs).toHaveLength(1);
        });

        test('deve detectar autenticação corretamente', () => {
            Storage.prototype.getItem.mockReturnValue('mock-token');
            
            const isAuth = NavigationSystem.checkAuthentication();
            expect(isAuth).toBe(true);
        });

        test('deve detectar ausência de autenticação', () => {
            Storage.prototype.getItem.mockReturnValue(null);
            
            const isAuth = NavigationSystem.checkAuthentication();
            expect(isAuth).toBe(false);
        });

        test('deve obter rota atual corretamente', () => {
            window.location.pathname = '/dashboard.html';
            
            const route = NavigationSystem.getCurrentRoute();
            expect(route).toBe('/dashboard.html');
        });

        test('deve tratar rota raiz corretamente', () => {
            window.location.pathname = '/';
            
            const route = NavigationSystem.getCurrentRoute();
            expect(route).toBe('/home.html');
        });
    });

    describe('Validação de Rotas', () => {
        test('deve validar rota existente', () => {
            const isValid = NavigationSystem.isValidRoute('/dashboard.html');
            expect(isValid).toBe(true);
        });

        test('deve rejeitar rota inexistente', () => {
            const isValid = NavigationSystem.isValidRoute('/nonexistent.html');
            expect(isValid).toBe(false);
        });

        test('deve validar rota atual corretamente', () => {
            NavigationSystem.state.currentRoute = '/dashboard.html';
            NavigationSystem.state.isAuthenticated = true;
            
            const isValid = NavigationSystem.validateCurrentRoute();
            expect(isValid).toBe(true);
        });

        test('deve rejeitar acesso a rota protegida sem autenticação', () => {
            NavigationSystem.state.currentRoute = '/dashboard.html';
            NavigationSystem.state.isAuthenticated = false;
            
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const isValid = NavigationSystem.validateCurrentRoute();
            
            expect(isValid).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Acesso negado para rota protegida')
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('Navegação Programática', () => {
        test('deve navegar para rota válida', () => {
            NavigationSystem.state.isAuthenticated = true;
            
            const result = NavigationSystem.navigateTo('/dashboard.html', { testMode: true });
            
            expect(result).toBe(true);
            expect(NavigationSystem.state.currentRoute).toBe('/dashboard.html');
        });

        test('deve rejeitar navegação para rota inválida', () => {
            expect(() => {
                NavigationSystem.navigateTo('/invalid.html');
            }).toThrow('Rota inválida: /invalid.html');
        });

        test('deve rejeitar acesso não autorizado', () => {
            NavigationSystem.state.isAuthenticated = false;
            
            expect(() => {
                NavigationSystem.navigateTo('/dashboard.html');
            }).toThrow('Acesso negado para: /dashboard.html');
        });

        test('deve salvar rota anterior', () => {
            NavigationSystem.state.currentRoute = '/home.html';
            NavigationSystem.state.isAuthenticated = true;
            
            NavigationSystem.navigateTo('/dashboard.html', { testMode: true });
            
            expect(NavigationSystem.state.previousRoute).toBe('/home.html');
        });

        test('deve atualizar histórico do browser', () => {
            NavigationSystem.state.isAuthenticated = true;
            
            NavigationSystem.navigateTo('/dashboard.html');
            
            expect(window.history.pushState).toHaveBeenCalledWith({}, '', '/dashboard.html');
        });
    });

    describe('Sistema de Breadcrumbs', () => {
        test('deve gerar breadcrumbs para página inicial', () => {
            const breadcrumbs = NavigationSystem.generateBreadcrumbs('/home.html');
            
            expect(breadcrumbs).toHaveLength(1);
            expect(breadcrumbs[0]).toEqual({ name: 'Início', path: '/' });
        });

        test('deve gerar breadcrumbs para página interna', () => {
            const breadcrumbs = NavigationSystem.generateBreadcrumbs('/dashboard.html');
            
            expect(breadcrumbs).toHaveLength(2);
            expect(breadcrumbs[0]).toEqual({ name: 'Início', path: '/' });
            expect(breadcrumbs[1]).toEqual({ name: 'Dashboard', path: '/dashboard.html' });
        });

        test('deve atualizar breadcrumbs na navegação', () => {
            NavigationSystem.state.currentRoute = '/dashboard.html';
            NavigationSystem.updateBreadcrumbs();
            
            expect(NavigationSystem.state.breadcrumbs).toHaveLength(2);
        });
    });

    describe('Sistema de Menu Dropdown', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div class="dropdown-content" data-menu-id="user-menu"></div>
                <div class="dropdown-content" data-menu-id="nav-menu"></div>
            `;
        });

        test('deve abrir dropdown corretamente', () => {
            NavigationSystem.toggleDropdown('user-menu');
            
            expect(NavigationSystem.state.menuState.activeDropdown).toBe('user-menu');
        });

        test('deve fechar dropdown quando já aberto', () => {
            NavigationSystem.state.menuState.activeDropdown = 'user-menu';
            
            NavigationSystem.toggleDropdown('user-menu');
            
            expect(NavigationSystem.state.menuState.activeDropdown).toBe(null);
        });

        test('deve trocar entre dropdowns', () => {
            NavigationSystem.state.menuState.activeDropdown = 'user-menu';
            
            NavigationSystem.toggleDropdown('nav-menu');
            
            expect(NavigationSystem.state.menuState.activeDropdown).toBe('nav-menu');
        });

        test('deve fechar todos os dropdowns', () => {
            NavigationSystem.state.menuState.activeDropdown = 'user-menu';
            
            NavigationSystem.closeAllDropdowns();
            
            expect(NavigationSystem.state.menuState.activeDropdown).toBe(null);
        });

        test('deve atualizar visibilidade dos dropdowns', () => {
            NavigationSystem.state.menuState.activeDropdown = 'user-menu';
            
            NavigationSystem.updateDropdownVisibility();
            
            const activeDropdown = document.querySelector('[data-menu-id="user-menu"]');
            const inactiveDropdown = document.querySelector('[data-menu-id="nav-menu"]');
            
            expect(activeDropdown.style.display).toBe('block');
            expect(inactiveDropdown.style.display).toBe('none');
        });
    });

    describe('Navegação Responsiva', () => {
        beforeEach(() => {
            document.body.innerHTML = '<div id="mobile-menu"></div>';
        });

        test('deve ativar navegação mobile em telas pequenas', () => {
            Object.defineProperty(window, 'innerWidth', { value: 600, writable: true });
            
            NavigationSystem.handleResponsiveNavigation();
            
            expect(NavigationSystem.state.menuState.isMobile).toBe(true);
        });

        test('deve ativar navegação desktop em telas grandes', () => {
            Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
            
            NavigationSystem.handleResponsiveNavigation();
            
            expect(NavigationSystem.state.menuState.isMobile).toBe(false);
        });

        test('deve mostrar menu mobile quando aberto', () => {
            NavigationSystem.state.menuState.isOpen = true;
            
            NavigationSystem.enableMobileNavigation();
            
            const mobileMenu = document.getElementById('mobile-menu');
            expect(mobileMenu.style.display).toBe('block');
        });

        test('deve alternar menu mobile', () => {
            NavigationSystem.state.menuState.isOpen = false;
            
            NavigationSystem.toggleMobileMenu();
            
            expect(NavigationSystem.state.menuState.isOpen).toBe(true);
        });
    });

    describe('Segurança e Validação', () => {
        test('deve validar link seguro', () => {
            const isSecure = NavigationSystem.isSecureLink('http://localhost:3000/dashboard.html');
            expect(isSecure).toBe(true);
        });

        test('deve rejeitar link externo', () => {
            const isSecure = NavigationSystem.isSecureLink('https://malicious-site.com/fake-page');
            expect(isSecure).toBe(false);
        });

        test('deve rejeitar URL malformada', () => {
            const isSecure = NavigationSystem.isSecureLink('invalid-url');
            expect(isSecure).toBe(false);
        });

        test('deve verificar permissão de acesso', () => {
            NavigationSystem.state.isAuthenticated = true;
            
            const canAccess = NavigationSystem.canAccessRoute('/dashboard.html');
            expect(canAccess).toBe(true);
        });

        test('deve negar acesso a rota protegida', () => {
            NavigationSystem.state.isAuthenticated = false;
            
            const canAccess = NavigationSystem.canAccessRoute('/dashboard.html');
            expect(canAccess).toBe(false);
        });
    });

    describe('Informações e Utilitários', () => {
        test('deve fornecer informações da rota atual', () => {
            NavigationSystem.state.currentRoute = '/dashboard.html';
            NavigationSystem.state.breadcrumbs = [
                { name: 'Início', path: '/' },
                { name: 'Dashboard', path: '/dashboard.html' }
            ];
            
            const info = NavigationSystem.getCurrentRouteInfo();
            
            expect(info.path).toBe('/dashboard.html');
            expect(info.name).toBe('Dashboard');
            expect(info.protected).toBe(true);
            expect(info.component).toBe('dashboard');
            expect(info.breadcrumbs).toHaveLength(2);
        });

        test('deve listar rotas acessíveis para usuário autenticado', () => {
            NavigationSystem.state.isAuthenticated = true;
            
            const routes = NavigationSystem.getAccessibleRoutes();
            
            expect(routes.length).toBeGreaterThan(5);
            expect(routes.some(r => r.path === '/dashboard.html')).toBe(true);
        });

        test('deve listar apenas rotas públicas para usuário não autenticado', () => {
            NavigationSystem.state.isAuthenticated = false;
            
            const routes = NavigationSystem.getAccessibleRoutes();
            
            expect(routes.every(r => !r.protected)).toBe(true);
        });
    });

    describe('Tratamento de Erros', () => {
        test('deve tratar erro de navegação graciosamente', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            NavigationSystem.state.previousRoute = '/home.html';
            
            NavigationSystem.handleNavigationError(new Error('Teste'), '/invalid.html');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Erro de navegação para /invalid.html'),
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });

        test('deve retornar para rota anterior em caso de erro', () => {
            NavigationSystem.state.previousRoute = '/home.html';
            
            const spy = jest.spyOn(NavigationSystem, 'navigateTo');
            NavigationSystem.handleNavigationError(new Error('Teste'), '/invalid.html');
            
            expect(spy).toHaveBeenCalledWith('/home.html', { testMode: true });
            spy.mockRestore();
        });
    });

    describe('Event Listeners', () => {
        test('deve configurar listeners corretamente', () => {
            const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
            const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');
            
            NavigationSystem.setupEventListeners();
            
            expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
            expect(windowAddEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
            expect(windowAddEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
            
            addEventListenerSpy.mockRestore();
            windowAddEventListenerSpy.mockRestore();
        });

        test('deve disparar evento personalizado na navegação', () => {
            const eventSpy = jest.spyOn(document, 'dispatchEvent');
            
            NavigationSystem.dispatchNavigationEvent('/new-route', '/old-route');
            
            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'navigationChange',
                    detail: { newRoute: '/new-route', oldRoute: '/old-route' }
                })
            );
            
            eventSpy.mockRestore();
        });
    });

    describe('Estado e Reset', () => {
        test('deve resetar estado completamente', () => {
            // Configurar estado
            NavigationSystem.state.currentRoute = '/dashboard.html';
            NavigationSystem.state.isAuthenticated = true;
            NavigationSystem.state.menuState.isOpen = true;
            
            // Resetar
            NavigationSystem.reset();
            
            // Verificar reset
            expect(NavigationSystem.state.currentRoute).toBe(null);
            expect(NavigationSystem.state.isAuthenticated).toBe(false);
            expect(NavigationSystem.state.menuState.isOpen).toBe(false);
            expect(NavigationSystem.state.breadcrumbs).toHaveLength(0);
        });
    });
});