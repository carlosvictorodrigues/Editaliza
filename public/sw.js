/**
 * Service Worker para Notificações Push - Editaliza
 */

const CACHE_NAME = 'editaliza-v1';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/js/app.js',
    '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    console.log('[ServiceWorker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('[ServiceWorker] Erro no cache:', err);
            })
    );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Ativado');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName !== CACHE_NAME;
                }).map(cacheName => {
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
    // Apenas fazer cache de requisições GET
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retorna do cache ou busca na rede
                return response || fetch(event.request);
            })
            .catch(() => {
                // Fallback offline
                if (event.request.destination === 'document') {
                    return caches.match('/');
                }
            })
    );
});

// Receber notificações push
self.addEventListener('push', event => {
    console.log('[ServiceWorker] Push recebido');
    
    let data = {
        title: 'Hora de Estudar! 📚',
        body: 'Sua sessão de estudos está esperando por você.',
        icon: '/favicon-192.png',
        badge: '/favicon-32.png'
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/favicon-192.png',
        badge: data.badge || '/favicon-32.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: data.actions || [
            { action: 'study', title: 'Estudar Agora' },
            { action: 'later', title: 'Mais Tarde' }
        ],
        requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
    console.log('[ServiceWorker] Notificação clicada:', event.action);
    
    event.notification.close();

    if (event.action === 'study' || !event.action) {
        // Abrir a aplicação
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                    for (const client of clientList) {
                        if (client.url.includes('editaliza') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow('/home.html');
                    }
                })
        );
    } else if (event.action === 'later') {
        // Reagendar notificação para 30 minutos depois
        setTimeout(() => {
            self.registration.showNotification('Lembrete de Estudos 📚', {
                body: 'Não esqueça da sua sessão de estudos!',
                icon: '/favicon-192.png',
                badge: '/favicon-32.png',
                vibrate: [200, 100, 200]
            });
        }, 30 * 60 * 1000); // 30 minutos
    }
});

// Background sync para notificações agendadas
self.addEventListener('sync', event => {
    if (event.tag === 'study-reminder') {
        event.waitUntil(
            self.registration.showNotification('Hora dos Estudos! 🎯', {
                body: 'Mantenha sua sequência de estudos!',
                icon: '/favicon-192.png',
                badge: '/favicon-32.png',
                vibrate: [200, 100, 200]
            })
        );
    }
});

// Mensagens do cliente
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});