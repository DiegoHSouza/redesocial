importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Suas credenciais do Firebase (as mesmas do firebaseConfig.js)
firebase.initializeApp({
  apiKey: "AIzaSyBPYi1AUEmrLKpqKhZ5fchjIjrXeo4b82E",
  authDomain: "cineverse-e19c0.firebaseapp.com",
  projectId: "cineverse-e19c0",
  storageBucket: "cineverse-e19c0.appspot.com",
  messagingSenderId: "42234002500",
  appId: "1:42234002500:web:6b95f67a8c195249011d87",
  measurementId: "G-YFJBMRER79"
});

const messaging = firebase.messaging();

// Configura o comportamento quando a notificação chega em background
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notificação recebida em background ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png', // Certifique-se de ter um ícone na pasta public ou use um link externo
    badge: '/badge.png',   // Opcional
    data: {
        url: payload.data.click_action || '/' // Link para abrir ao clicar
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handler para clique na notificação
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const urlToOpen = event.notification.data.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Se já tiver uma aba aberta, foca nela
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Se não, abre uma nova
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});