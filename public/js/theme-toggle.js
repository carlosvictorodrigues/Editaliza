/* eslint-env browser */

/**
 * ===============================================
 * EDITALIZA THEME SYSTEM - DISABLED
 * Light Mode Only - Dark mode removed
 * ===============================================
 */

// Disable all theme functionality
class DisabledThemeManager {
    constructor() {
        this.STORAGE_KEY = 'editaliza-theme';
        this.initialize();
    }

    initialize() {
        // Force light mode
        this.forceLightMode();
        
        // Remove any existing toggles
        this.removeThemeToggles();
        
        console.info('🌞 Light mode only - theme system disabled');
    }

    forceLightMode() {
        // Remove data-theme attributes
        document.documentElement.removeAttribute('data-theme');
        document.body.removeAttribute('data-theme');
        
        // Clear localStorage
        localStorage.removeItem(this.STORAGE_KEY);
        
        // Set light theme color
        this.updateMetaThemeColor();
    }

    removeThemeToggles() {
        // Remove all theme toggles
        const selectors = [
            '.theme-toggle',
            '.theme-toggle-nav', 
            '.theme-switch',
            '.fab-theme',
            '.floating-theme',
            '[data-theme-toggle]'
        ];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                element.style.visibility = 'hidden';
                element.style.opacity = '0';
                element.style.pointerEvents = 'none';
            });
        });

        // Remove any fixed bottom bars for themes
        const fixedElements = document.querySelectorAll('[style*="position: fixed"][style*="bottom: 0"]');
        fixedElements.forEach(element => {
            if (element.classList.toString().includes('theme')) {
                element.remove();
            }
        });
    }

    updateMetaThemeColor() {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        metaThemeColor.content = '#F7FAFC';
    }

    // Disabled API methods
    toggleTheme() {
        console.info('Theme toggle disabled - light mode only');
    }

    setTheme() {
        console.info('Theme setting disabled - light mode only');
    }

    getCurrentTheme() {
        return 'light';
    }

    getAPI() {
        return {
            toggle: () => this.toggleTheme(),
            setTheme: () => this.setTheme(),
            getCurrentTheme: () => this.getCurrentTheme(),
            isDark: () => false,
            isLight: () => true
        };
    }
}

// Global disabled theme manager
let disabledTheme;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    disabledTheme = new DisabledThemeManager();
    
    // Override global functions
    window.editalizeTheme = disabledTheme.getAPI();
    window.toggleTheme = () => disabledTheme.toggleTheme();
    window.setTheme = () => disabledTheme.setTheme();
    
    // Continuously force light mode
    setInterval(() => {
        disabledTheme.forceLightMode();
        disabledTheme.removeThemeToggles();
    }, 2000);
});

// Override on load as well
window.addEventListener('load', () => {
    if (disabledTheme) {
        disabledTheme.forceLightMode();
        disabledTheme.removeThemeToggles();
    }
});

// Export disabled manager
if (typeof window !== 'undefined') {
    window.DisabledThemeManager = DisabledThemeManager;
}