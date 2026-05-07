const MENU_ID = 'send-to-inspiration-board';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: '📷 An Inspiration Board senden',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;

  const { serverUrl } = await chrome.storage.sync.get({ serverUrl: '' });

  if (!serverUrl) {
    chrome.action.openPopup();
    return;
  }

  const url = info.srcUrl;
  const apiUrl = serverUrl.replace(/\/$/, '') + '/api/images/url';

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (res.ok) {
      showNotification('✓ Bild zur Inbox hinzugefügt!', url);
    } else {
      const data = await res.json().catch(() => ({}));
      showNotification('Fehler: ' + (data.error || res.statusText), url);
    }
  } catch (e) {
    showNotification('Verbindungsfehler – ist die App erreichbar?', serverUrl);
  }
});

function showNotification(message, detail) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Inspiration Board',
    message,
    contextMessage: detail?.slice(0, 80),
  });
}
