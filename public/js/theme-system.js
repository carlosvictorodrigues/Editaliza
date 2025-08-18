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
    
    // Create theme toggle button if it doesn't exist
    const createThemeToggle = () => {
        // Check if toggle already exists
        if (document.querySelector('[data-theme-toggle]')) {
            return;
        }
        
        // Find navigation container
        const navContainer = document.querySelector('.flex.items-center.space-x-3') || 
                           document.querySelector('nav') || 
                           document.querySelector('header');
        
        if (navContainer) {
            const toggleButton = document.createElement('button');
            toggleButton.setAttribute('data-theme-toggle', '');
            toggleButton.className = 'theme-toggle-nav';
            toggleButton.setAttribute('aria-label', 'Toggle theme');
            toggleButton.innerHTML = `
                <div class="theme-switch">
                    <svg class="sun-icon theme-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path>
                    </svg>
                    <svg class="moon-icon theme-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                    </svg>
                </div>
            `;
            
            toggleButton.addEventListener('click', window.toggleTheme);
            navContainer.appendChild(toggleButton);
        }
    };
    
    // Initialize theme
    const initTheme = () => {
        const theme = getThemePreference();
        applyTheme(theme);
        
        // Create theme toggle button
        createThemeToggle();
        
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