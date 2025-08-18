/* eslint-env browser */

/**
 * ===============================================
 * EDITALIZA THEME TOGGLE SYSTEM
 * Sophisticated Dark Mode Implementation
 * ===============================================
 */

class EditalizeThemeManager {
    constructor() {
        this.STORAGE_KEY = 'editaliza-theme';
        this.THEME_ATTRIBUTE = 'data-theme';
        this.THEMES = {
            LIGHT: 'light',
            DARK: 'dark'
        };
        
        this.initialize();
    }

    /**
     * Initialize theme system
     */
    initialize() {
        // Set initial theme
        this.setInitialTheme();
        
        // Listen for system preference changes
        this.watchSystemPreference();
        
        // Create toggle button if it doesn't exist
        this.ensureToggleButton();
        
        // Update UI to match current theme
        this.updateUI();
        
        console.info('🎨 Editaliza Theme Manager initialized');
    }

    /**
     * Set the initial theme based on user preference or system setting
     */
    setInitialTheme() {
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const defaultTheme = savedTheme || (systemPrefersDark ? this.THEMES.DARK : this.THEMES.LIGHT);
        
        this.setTheme(defaultTheme, false); // Don't save to localStorage on initial load
    }

    /**
     * Set theme and optionally save to localStorage
     */
    setTheme(theme, saveToStorage = true) {
        if (!Object.values(this.THEMES).includes(theme)) {
            console.warn(`Invalid theme: ${theme}`);
            return;
        }

        // Apply theme to document
        document.documentElement.setAttribute(this.THEME_ATTRIBUTE, theme);
        
        // Save to localStorage if requested
        if (saveToStorage) {
            localStorage.setItem(this.STORAGE_KEY, theme);
        }
        
        // Update UI elements
        this.updateUI();
        
        // Trigger custom event for other components
        this.dispatchThemeChangeEvent(theme);
        
        console.info(`🌓 Theme changed to: ${theme}`);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === this.THEMES.DARK ? this.THEMES.LIGHT : this.THEMES.DARK;
        
        this.setTheme(newTheme);
        
        // Add a subtle haptic feedback for mobile devices
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
        return document.documentElement.getAttribute(this.THEME_ATTRIBUTE) || this.THEMES.LIGHT;
    }

    /**
     * Update UI elements to reflect current theme
     */
    updateUI() {
        const currentTheme = this.getCurrentTheme();
        const isDark = currentTheme === this.THEMES.DARK;
        
        // Update toggle icons
        const sunIcon = document.querySelector('.theme-icon.sun-icon');
        const moonIcon = document.querySelector('.theme-icon.moon-icon');
        
        if (sunIcon && moonIcon) {
            sunIcon.classList.toggle('active', !isDark);
            moonIcon.classList.toggle('active', isDark);
        }
        
        // Update any theme-aware components
        this.updateThemeAwareComponents(currentTheme);
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(currentTheme);
    }

    /**
     * Update theme-aware components
     */
    updateThemeAwareComponents(theme) {
        const isDark = theme === this.THEMES.DARK;
        
        // Update charts, graphics, or other dynamic content
        const charts = document.querySelectorAll('[data-chart]');
        charts.forEach(chart => {
            chart.setAttribute('data-theme', theme);
        });
        
        // Update any embedded elements that need theme awareness
        const embeds = document.querySelectorAll('[data-theme-aware]');
        embeds.forEach(embed => {
            embed.classList.toggle('dark-mode', isDark);
        });
    }

    /**
     * Update meta theme-color for mobile browser chrome
     */
    updateMetaThemeColor(theme) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        const color = theme === this.THEMES.DARK ? '#0f0f23' : '#f8fafc';
        metaThemeColor.content = color;
    }

    /**
     * Watch for system preference changes
     */
    watchSystemPreference() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        mediaQuery.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't set a preference
            if (!localStorage.getItem(this.STORAGE_KEY)) {
                const newTheme = e.matches ? this.THEMES.DARK : this.THEMES.LIGHT;
                this.setTheme(newTheme, false); // Don't save auto-switches
            }
        });
    }

    /**
     * Ensure toggle button exists and is properly configured
     */
    ensureToggleButton() {
        // Remove ONLY floating/fixed theme toggles, keep navigation ones
        const floatingToggles = document.querySelectorAll('.theme-toggle[style*="position: fixed"], .fab-theme, .floating-theme');
        floatingToggles.forEach(toggle => {
            toggle.remove();
        });

        // Remove any fixed bottom bars that are specifically theme bars
        const fixedElements = document.querySelectorAll('[style*="position: fixed"][style*="bottom: 0"]');
        fixedElements.forEach(element => {
            if (element.classList.toString().includes('theme') && 
                (element.classList.toString().includes('fab') || element.classList.toString().includes('floating'))) {
                element.remove();
            }
        });

        // Look for navigation toggle
        let navToggle = document.querySelector('.theme-toggle-nav');
        
        if (!navToggle) {
            // Try to find the navigation container to add toggle
            const navContainer = this.findNavigationContainer();
            if (navContainer) {
                navToggle = this.createNavigationToggle();
                navContainer.appendChild(navToggle);
            }
        }
        
        // Ensure click handler is attached
        if (navToggle) {
            const switchElement = navToggle.querySelector('.theme-switch');
            if (switchElement) {
                switchElement.addEventListener('click', () => this.toggleTheme());
            }
        }
    }

    /**
     * Find the best place to insert the navigation toggle
     */
    findNavigationContainer() {
        // Try to find the navigation actions container (where profile and logout buttons are)
        const candidates = [
            document.querySelector('.flex.items-center.space-x-3'), // Profile/logout container
            document.querySelector('nav.hidden.md\\:flex'), // Main navigation
            document.querySelector('.flex.justify-between.items-center.h-16'), // Header container
            document.querySelector('header .container'), // Header container
            document.querySelector('header') // Last resort: header element
        ];
        
        for (const candidate of candidates) {
            if (candidate) {
                return candidate;
            }
        }
        
        return null;
    }

    /**
     * Create the navigation-integrated theme toggle
     */
    createNavigationToggle() {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'theme-toggle-nav';
        toggleContainer.setAttribute('data-tooltip', 'Alternar tema');
        toggleContainer.innerHTML = `
            <div class="theme-switch" title="Alternar modo escuro">
                <svg class="theme-icon sun-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path>
                </svg>
                
                <svg class="theme-icon moon-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                </svg>
            </div>
        `;
        
        return toggleContainer;
    }

    /**
     * Create the theme toggle button HTML (legacy fallback)
     */
    createToggleButton() {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'theme-toggle';
        toggleContainer.innerHTML = `
            <svg class="theme-icon sun-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path>
            </svg>
            
            <div class="theme-switch" title="Toggle dark mode"></div>
            
            <svg class="theme-icon moon-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
            </svg>
        `;
        
        return toggleContainer;
    }

    /**
     * Dispatch custom theme change event
     */
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('editaliza:themeChange', {
            detail: {
                theme,
                isDark: theme === this.THEMES.DARK
            }
        });
        
        window.dispatchEvent(event);
    }

    /**
     * Public API for external components
     */
    getAPI() {
        return {
            toggle: () => this.toggleTheme(),
            setTheme: (theme) => this.setTheme(theme),
            getCurrentTheme: () => this.getCurrentTheme(),
            isDark: () => this.getCurrentTheme() === this.THEMES.DARK,
            isLight: () => this.getCurrentTheme() === this.THEMES.LIGHT
        };
    }
}

/**
 * ===============================================
 * ADDITIONAL THEME UTILITIES
 * ===============================================
 */

/**
 * Utility class for theme-aware animations and effects
 */
class ThemeAwareEffects {
    static applyThemeTransition() {
        // Add smooth transition for theme changes
        document.documentElement.style.setProperty(
            '--theme-transition',
            'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        );
    }
    
    static handleReducedMotion() {
        // Respect user's motion preferences
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.documentElement.style.setProperty('--theme-transition', 'none');
        }
    }
    
    static initializeThemeAwareElements() {
        // Initialize any elements that need special theme handling
        const themeAwareElements = document.querySelectorAll('[data-theme-aware]');
        
        themeAwareElements.forEach(element => {
            // Add any special initialization logic here
            element.setAttribute('data-theme-initialized', 'true');
        });
    }
}

/**
 * ===============================================
 * INITIALIZATION AND GLOBAL FUNCTIONS
 * ===============================================
 */

// Global theme manager instance
let editalizeTheme;

// Initialize theme system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme manager
    editalizeTheme = new EditalizeThemeManager();
    
    // Apply theme effects
    ThemeAwareEffects.applyThemeTransition();
    ThemeAwareEffects.handleReducedMotion();
    ThemeAwareEffects.initializeThemeAwareElements();
    
    // Expose API globally for backward compatibility
    window.editalizeTheme = editalizeTheme.getAPI();
    
    // Legacy function names for backward compatibility
    window.toggleTheme = () => editalizeTheme.toggleTheme();
    window.setTheme = (theme) => editalizeTheme.setTheme(theme);
    
    // Re-initialize toggle after navigation loads
    setTimeout(() => {
        editalizeTheme.ensureToggleButton();
    }, 100);
});

// Also listen for navigation changes (in case navigation is loaded dynamically)
window.addEventListener('load', () => {
    if (editalizeTheme) {
        setTimeout(() => {
            editalizeTheme.ensureToggleButton();
        }, 200);
    }
});

// Handle page visibility changes to sync theme across tabs
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && editalizeTheme) {
        // Re-read theme from localStorage in case it changed in another tab
        const savedTheme = localStorage.getItem('editaliza-theme');
        if (savedTheme && savedTheme !== editalizeTheme.getCurrentTheme()) {
            editalizeTheme.setTheme(savedTheme, false);
        }
    }
});

/**
 * ===============================================
 * THEME PERSISTENCE AND SERVER SYNC
 * ===============================================
 */

/**
 * Sync theme preference with server (if user is logged in)
 */
async function syncThemeWithServer(theme) {
    try {
        const response = await fetch('/api/user/theme', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ theme })
        });
        
        if (response.ok) {
            console.info('✅ Theme preference saved to server');
        }
    } catch {
        console.info('ℹ️ Theme saved locally only (user not logged in or offline)');
    }
}

// Listen for theme changes and sync with server
window.addEventListener('editaliza:themeChange', (event) => {
    syncThemeWithServer(event.detail.theme);
});

/**
 * ===============================================
 * EXPORT FOR MODULE SYSTEMS
 * ===============================================
 */

// CommonJS/Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EditalizeThemeManager, ThemeAwareEffects };
}

// AMD/RequireJS
if (typeof define === 'function' && define.amd) {
    define(() => ({ EditalizeThemeManager, ThemeAwareEffects }));
}

// ES6 Modules (for modern bundlers)
if (typeof window !== 'undefined') {
    window.EditalizeThemeManager = EditalizeThemeManager;
    window.ThemeAwareEffects = ThemeAwareEffects;
}