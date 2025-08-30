/**
 * EMERGENCY NOTIFICATION STOPPER
 * Run this in browser console to immediately stop infinite notifications
 */

(function() {
    void('🚨 EMERGENCY: Stopping infinite notifications...');
    
    // 1. Stop all notification integrations
    if (window.NotificationIntegrations) {
        try {
            window.NotificationIntegrations.rollback();
            void('✅ NotificationIntegrations stopped');
        } catch (e) {
            void('⚠️ Error stopping NotificationIntegrations:', e);
        }
    }
    
    // 2. Disable contextual notifications
    if (window.ContextualNotifications) {
        try {
            window.ContextualNotifications.disable();
            void('✅ ContextualNotifications disabled');
        } catch (e) {
            void('⚠️ Error disabling ContextualNotifications:', e);
        }
    }
    
    // 3. Remove all existing toast containers
    try {
        const toastContainers = document.querySelectorAll('#toast-container, .toast-container');
        toastContainers.forEach(container => {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });
        void('✅ All toast containers removed');
    } catch (e) {
        void('⚠️ Error removing toast containers:', e);
    }
    
    // 4. Clear all timeouts and intervals
    try {
        // Clear all timeouts
        let timeoutId = setTimeout(() => {}, 0);
        while (timeoutId--) {
            clearTimeout(timeoutId);
        }
        
        // Clear all intervals
        let intervalId = setInterval(() => {}, 0);
        while (intervalId--) {
            clearInterval(intervalId);
        }
        void('✅ All timeouts and intervals cleared');
    } catch (e) {
        void('⚠️ Error clearing timeouts/intervals:', e);
    }
    
    // 5. Remove all pomodoro event listeners
    try {
        // Create new elements to replace current ones (removes all listeners)
        const elementsWithListeners = document.querySelectorAll('[data-session]');
        elementsWithListeners.forEach(element => {
            const clone = element.cloneNode(true);
            if (element.parentNode) {
                element.parentNode.replaceChild(clone, element);
            }
        });
        void('✅ Event listeners cleared');
    } catch (e) {
        void('⚠️ Error clearing event listeners:', e);
    }
    
    // 6. Set emergency flag in localStorage
    try {
        localStorage.setItem('editaliza_emergency_notifications_disabled', 'true');
        localStorage.setItem('editaliza_notifications_enabled', 'false');
        void('✅ Emergency flags set in localStorage');
    } catch (e) {
        void('⚠️ Error setting emergency flags:', e);
    }
    
    void('🟢 EMERGENCY STOP COMPLETE - Infinite notifications should be stopped');
    void('🔄 Refresh the page to restore normal notification system');
})();