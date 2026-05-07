// Service Worker for PWA Share Target support
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const file = formData.get('file');
        const sharedUrl = formData.get('url') || formData.get('text') || '';

        // Store shared data in a broadcast so the app can pick it up
        const clients = await self.clients.matchAll({ type: 'window' });

        if (file && file instanceof File) {
          const arrayBuffer = await file.arrayBuffer();
          clients.forEach((client) => {
            client.postMessage({
              type: 'SHARE_FILE',
              fileName: file.name,
              mimeType: file.type,
              buffer: arrayBuffer,
            });
          });
        } else if (sharedUrl) {
          clients.forEach((client) => {
            client.postMessage({ type: 'SHARE_URL', url: sharedUrl });
          });
        }

        return Response.redirect('/?shared=1', 303);
      })()
    );
  }
});
