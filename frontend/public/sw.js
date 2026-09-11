self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'metzScore';
  const options = {
    body: data.body || '',
    data,
    // Use app logo by default for both the large icon and the small status-bar badge
    // `icon` shows inside the notification; `badge` is used by some Android/Chrome
    // as the small monochrome status-bar icon. Prefer PNGs for broad support.
    icon: data.icon || '/icons/logo2.png',
    badge: data.badge || '/icons/logo2.png'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
