/* eslint-env browser */
/**
 * Modern Theme System with Design Tokens
 * Professional Dark Mode Implementation
 */

(function() {
    'use strict';
    
    // Prevent transitions on page load
    document.documentElement.classList.add('no-transitions');
    
    // Get saved theme or detect system preference
    const getThemePreference = () => {
        const saved = localStorage.getItem('editaliza-theme');
        if (saved) return saved;
        
        // Respect system preference as default
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
    };
    
    // Apply theme
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update meta theme-color for mobile browsers
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = theme === 'dark' ? '#121212' : '#F7FAFC';
        
        // Update all theme toggle buttons
        document.querySelectorAll('[data-theme-toggle]').forEach(button => {
            const isDark = theme === 'dark';
            const sunIcon = button.querySelector('.sun-icon');
            const moonIcon = button.querySelector('.moon-icon');
            
            if (sunIcon && moonIcon) {
                sunIcon.style.display = isDark ? 'none' : 'block';
                moonIcon.style.display = isDark ? 'block' : 'none';
            }
            
            // Update aria-label for accessibility
            button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
            button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        });
    };
    
    // Initialize theme
    const initTheme = () => {
        const theme = getThemePreference();
        applyTheme(theme);
        
        // Enable transitions after initial load
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove('no-transitions');
            });
        });
    };
    
    // Toggle theme function
    window.toggleTheme = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        applyTheme(newTheme);
        localStorage.setItem('editaliza-theme', newTheme);
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('theme-changed', { 
            detail: { theme: newTheme } 
        }));
    };
    
    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', (e) => {
            // Only apply if user hasn't manually set a preference
            if (!localStorage.getItem('editaliza-theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
    
    // Listen for storage changes (sync across tabs)
    window.addEventListener('storage', (e) => {
        if (e.key === 'editaliza-theme' && e.newValue) {
            applyTheme(e.newValue);
        }
    });
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
    
    // Export for use in other modules
    window.themeSystem = {
        toggle: window.toggleTheme,
        getTheme: () => document.documentElement.getAttribute('data-theme') || 'light',
        setTheme: (theme) => {
            if (theme === 'light' || theme === 'dark') {
                applyTheme(theme);
                localStorage.setItem('editaliza-theme', theme);
            }
        },
        reset: () => {
            localStorage.removeItem('editaliza-theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
        },
        isDark: () => document.documentElement.getAttribute('data-theme') === 'dark'
    };
})();