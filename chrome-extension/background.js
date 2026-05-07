const MENU_ID = 'send-to-inspiration-board';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: '📷 An Inspiration Board senden',
    contexts: ['all'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const { serverUrl } = await chrome.storage.sync.get({ serverUrl: '' });
  if (!serverUrl) {
    notify('Inspiration Board', 'Bitte zuerst die Server-URL im Plugin-Popup einstellen.');
    return;
  }

  // Get image URL: standard <img> provides srcUrl, overlays (Instagram) need content script
  let imageUrl = info.srcUrl;
  if (!imageUrl && tab?.id) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_IMAGE_URL' });
      imageUrl = resp?.url;
    } catch {
      // content script unavailable (e.g. chrome:// pages)
    }
  }

  if (!imageUrl) {
    notify('Inspiration Board', 'Kein Bild gefunden – bitte direkt auf ein Foto rechtsklicken.');
    return;
  }

  const base = serverUrl.replace(/\/$/, '');

  // Strategy 1: download the image inside the extension and upload as file.
  // This works even when the server can't reach CDN URLs (Instagram, etc.)
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error('fetch ' + imgRes.status);

    const blob = await imgRes.blob();
    if (!blob.type.startsWith('image/')) throw new Error('not an image');

    const ext = blob.type.includes('png') ? 'png'
              : blob.type.includes('gif') ? 'gif'
              : blob.type.includes('webp') ? 'webp'
              : 'jpg';

    const form = new FormData();
    form.append('file', blob, 'image.' + ext);

    const res = await fetch(base + '/api/images/upload', { method: 'POST', body: form });
    if (res.ok) {
      notify('Inspiration Board', '✓ Bild zur Inbox hinzugefügt!');
      return;
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'upload ' + res.status);
  } catch (uploadErr) {
    // Strategy 2: let the server fetch the URL itself (fallback)
    try {
      const res = await fetch(base + '/api/images/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl }),
      });
      if (res.ok) {
        notify('Inspiration Board', '✓ Bild zur Inbox hinzugefügt!');
        return;
      }
      const data = await res.json().catch(() => ({}));
      notify('Inspiration Board – Fehler', data.error || 'Fehler ' + res.status);
    } catch {
      notify('Inspiration Board – Verbindungsfehler', 'App nicht erreichbar: ' + base);
    }
  }
});

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title,
    message,
  });
}
