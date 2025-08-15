/**
 * EMERGENCY NOTIFICATION STOPPER
 * Run this in browser console to immediately stop infinite notifications
 */

(function() {
    console.log('🚨 EMERGENCY: Stopping infinite notifications...');
    
    // 1. Stop all notification integrations
    if (window.NotificationIntegrations) {
        try {
            window.NotificationIntegrations.rollback();
            console.log('✅ NotificationIntegrations stopped');
        } catch (e) {
            console.log('⚠️ Error stopping NotificationIntegrations:', e);
        }
    }
    
    // 2. Disable contextual notifications
    if (window.ContextualNotifications) {
        try {
            window.ContextualNotifications.disable();
            console.log('✅ ContextualNotifications disabled');
        } catch (e) {
            console.log('⚠️ Error disabling ContextualNotifications:', e);
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
        console.log('✅ All toast containers removed');
    } catch (e) {
        console.log('⚠️ Error removing toast containers:', e);
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
        console.log('✅ All timeouts and intervals cleared');
    } catch (e) {
        console.log('⚠️ Error clearing timeouts/intervals:', e);
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
        console.log('✅ Event listeners cleared');
    } catch (e) {
        console.log('⚠️ Error clearing event listeners:', e);
    }
    
    // 6. Set emergency flag in localStorage
    try {
        localStorage.setItem('editaliza_emergency_notifications_disabled', 'true');
        localStorage.setItem('editaliza_notifications_enabled', 'false');
        console.log('✅ Emergency flags set in localStorage');
    } catch (e) {
        console.log('⚠️ Error setting emergency flags:', e);
    }
    
    console.log('🟢 EMERGENCY STOP COMPLETE - Infinite notifications should be stopped');
    console.log('🔄 Refresh the page to restore normal notification system');
})();