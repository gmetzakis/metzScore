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
  const customIcon = data.icon || '/icons/logo2.png';
  const customBadge = data.badge || customIcon;
  const options = {
    body: data.body || '',
    data,
    // Explicitly provide both the main notification icon and the small Android badge.
    // Many browsers, especially Android Chrome, ignore badge unless the icon is set.
    // Use PNG files and keep them in the public folder so the service worker can fetch them.
    icon: customIcon,
    badge: customBadge
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
