/* eslint-env browser */
/**
 * Disabled Theme System - Light Mode Only
 * Dark mode has been completely removed
 */

(function() {
    'use strict';
    
    // Force light mode only
    const forceLight = () => {
        // Remove any data-theme attributes
        document.documentElement.removeAttribute('data-theme');
        document.body.removeAttribute('data-theme');
        
        // Clear localStorage theme
        localStorage.removeItem('editaliza-theme');
        
        // Remove any theme toggles
        const toggles = document.querySelectorAll('[data-theme-toggle], .theme-toggle, .theme-toggle-nav, .theme-switch');
        toggles.forEach(toggle => {
            toggle.style.display = 'none';
            toggle.style.visibility = 'hidden';
            toggle.style.opacity = '0';
            toggle.style.pointerEvents = 'none';
        });
        
        // Set meta theme-color to light
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = '#F7FAFC';
    };
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceLight);
    } else {
        forceLight();
    }
    
    // Run periodically to ensure no dark mode activation
    setInterval(forceLight, 1000);
    
    // Disable theme functions
    window.toggleTheme = () => {
        console.info('Theme toggle disabled - light mode only');
    };
    
    window.themeSystem = {
        toggle: () => console.info('Theme toggle disabled'),
        getTheme: () => 'light',
        setTheme: () => console.info('Theme setting disabled'),
        reset: () => console.info('Theme reset disabled'),
        isDark: () => false
    };
})();