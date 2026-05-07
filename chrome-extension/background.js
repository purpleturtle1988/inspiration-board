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

  // Standard <img> element gives srcUrl directly; for overlaid images (Instagram etc.)
  // fall back to the content script which captured the right-clicked element.
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

  const apiUrl = serverUrl.replace(/\/$/, '') + '/api/images/url';

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
    });

    if (res.ok) {
      notify('Inspiration Board', '✓ Bild zur Inbox hinzugefügt!');
    } else {
      const data = await res.json().catch(() => ({}));
      notify('Inspiration Board – Fehler', data.error || 'Fehler ' + res.status);
    }
  } catch {
    notify('Inspiration Board – Verbindungsfehler', 'App nicht erreichbar: ' + serverUrl);
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
