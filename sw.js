/**
 * Service Worker para Notificações Push - Editaliza
 * @version 2.0 - Fix para evitar loops de recarga
 */

const CACHE_NAME = 'editaliza-v2.1';
const STATIC_CACHE = 'editaliza-static-v2.1';
const DYNAMIC_CACHE = 'editaliza-dynamic-v2.1';

// URLs essenciais para cache
const ESSENTIAL_URLS = [
    '/css/style.css',
    '/js/app.js',
    '/manifest.json'
];

// URLs que nunca devem ser cacheadas (sempre buscar da rede)
const NEVER_CACHE = [
    '/api/',
    '/auth/',
    '/sessions/',
    '/plans/',
    '/users/'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    console.log('[SW v2.0] Instalando...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW v2.0] Cache estático criado');
                // Cache apenas recursos essenciais, NÃO as páginas HTML
                return cache.addAll(ESSENTIAL_URLS.filter(url => !url.endsWith('.html')));
            })
            .catch(err => {
                console.error('[SW v2.0] Erro no cache:', err);
            })
    );
    
    // Força ativação imediata
    self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
    console.log('[SW v2.0] Ativando...');
    
    event.waitUntil(
        // Limpar caches antigos
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('[SW v2.0] Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW v2.0] Ativado e caches limpos');
            return self.clients.claim();
        })
    );
});

// Interceptar requests - ESTRATÉGIA INTELIGENTE
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Ignorar requests que não devem ser interceptados
    if (
        event.request.method !== 'GET' ||
        !event.request.url.startsWith(self.location.origin) ||
        NEVER_CACHE.some(path => url.pathname.startsWith(path))
    ) {
        return; // Deixa o navegador lidar normalmente
    }
    
    // Estratégia para recursos estáticos (CSS, JS, imagens)
    if (url.pathname.startsWith('/css/') || 
        url.pathname.startsWith('/js/') || 
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.json') ||
        url.pathname.includes('favicon')) {
        
        event.respondWith(
            caches.open(STATIC_CACHE).then(cache => {
                return cache.match(event.request).then(response => {
                    if (response) {
                        // Retorna do cache e atualiza em background
                        fetch(event.request).then(fetchResponse => {
                            if (fetchResponse.ok) {
                                cache.put(event.request, fetchResponse.clone());
                            }
                        }).catch(() => {});
                        return response;
                    }
                    
                    // Se não está no cache, busca e armazena
                    return fetch(event.request).then(fetchResponse => {
                        if (fetchResponse.ok) {
                            cache.put(event.request, fetchResponse.clone());
                        }
                        return fetchResponse;
                    }).catch(() => {
                        // Fallback para recursos críticos
                        return new Response('/* Resource not available offline */', {
                            headers: { 'Content-Type': 'text/css' }
                        });
                    });
                });
            })
        );
        return;
    }
    
    // Para páginas HTML - SEMPRE REDE PRIMEIRO (evita cache desatualizado)
    if (url.pathname.endsWith('.html') || url.pathname === '/') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Se conseguiu da rede, retorna (sem cachear páginas HTML)
                    if (response.ok) {
                        return response;
                    }
                    throw new Error('Network response not ok');
                })
                .catch(() => {
                    // Se falhou na rede, tenta do cache dinâmico
                    return caches.match(event.request).then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Se não tem no cache, retorna página de erro offline minimalista
                        return new Response(`
                            <!DOCTYPE html>
                            <html lang="pt-BR">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Offline - Editaliza</title>
                                <style>
                                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                    .offline-icon { font-size: 64px; margin-bottom: 20px; }
                                    button { padding: 10px 20px; background: #0528f2; color: white; border: none; border-radius: 5px; cursor: pointer; }
                                    button:hover { background: #0420d0; }
                                </style>
                            </head>
                            <body>
                                <div class="offline-icon">🌐</div>
                                <h1>Você está offline</h1>
                                <p>Verifique sua conexão com a internet e tente novamente.</p>
                                <button onclick="location.reload()">Tentar Novamente</button>
                            </body>
                            </html>
                        `, {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' },
                            status: 200
                        });
                    });
                })
        );
    }
});

// Lidar com notificações push
self.addEventListener('push', event => {
    console.log('[SW v2.0] Push recebido');
    
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
        data: data.data || { url: '/' },
        actions: data.actions || [
            { action: 'study', title: 'Estudar Agora' },
            { action: 'later', title: 'Mais Tarde' }
        ],
        requireInteraction: data.requireInteraction || false,
        tag: 'editaliza-study-reminder'  // Evita notificações duplicadas
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Clique em notificação - SEM FORÇAR RECARGA
self.addEventListener('notificationclick', event => {
    console.log('[SW v2.0] Notificação clicada:', event.action);
    
    event.notification.close();

    if (event.action === 'study' || !event.action) {
        const urlToOpen = (event.notification.data && event.notification.data.url) || '/home.html';
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                    // Procurar janela existente do Editaliza
                    for (const client of clientList) {
                        if (client.url.includes('editaliza') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Se não encontrou, abre nova janela
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    } else if (event.action === 'later') {
        // Marcar para lembrar mais tarde (via sistema de notificações da app)
        console.log('[SW v2.0] Lembrete agendado para mais tarde');
    }
});

// Background sync para notificações agendadas
self.addEventListener('sync', event => {
    console.log('[SW v2.0] Background sync:', event.tag);
    
    if (event.tag === 'study-reminder') {
        event.waitUntil(
            self.registration.showNotification('Hora dos Estudos! 🎯', {
                body: 'Mantenha sua sequência de estudos!',
                icon: '/favicon-192.png',
                badge: '/favicon-32.png',
                vibrate: [200, 100, 200],
                tag: 'editaliza-reminder'
            })
        );
    }
});

// Mensagens do cliente
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: '2.0' });
    }
});

// Log de inicialização
console.log('[SW v2.0] Service Worker carregado - Cache inteligente ativo!');