const input = document.getElementById('url');
const saveBtn = document.getElementById('save');
const status = document.getElementById('status');

chrome.storage.sync.get({ serverUrl: '' }, ({ serverUrl }) => {
  input.value = serverUrl;
});

saveBtn.addEventListener('click', async () => {
  const serverUrl = input.value.trim().replace(/\/$/, '');

  if (!serverUrl) {
    showStatus('Bitte URL eingeben', true);
    return;
  }

  try {
    new URL(serverUrl);
  } catch {
    showStatus('Ungültige URL', true);
    return;
  }

  await chrome.storage.sync.set({ serverUrl });
  showStatus('✓ Gespeichert');
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

function showStatus(msg, isError = false) {
  status.textContent = msg;
  status.className = 'status' + (isError ? ' error' : '');
  setTimeout(() => { status.textContent = ''; status.className = 'status'; }, 2000);
}
