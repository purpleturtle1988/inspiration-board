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
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Inspiration Board',
      message: 'Bitte zuerst die Server-URL im Plugin-Popup einstellen.',
    });
    return;
  }

  const apiUrl = serverUrl.replace(/\/$/, '') + '/api/images/url';

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: info.srcUrl }),
    });

    if (res.ok) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Inspiration Board',
        message: '✓ Bild zur Inbox hinzugefügt!',
      });
    } else {
      const data = await res.json().catch(() => ({}));
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Inspiration Board – Fehler',
        message: data.error || 'Unbekannter Fehler (' + res.status + ')',
      });
    }
  } catch (e) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Inspiration Board – Verbindungsfehler',
      message: 'App nicht erreichbar: ' + serverUrl,
    });
  }
});
