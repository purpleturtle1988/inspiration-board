let lastImageUrl = null;

document.addEventListener('contextmenu', (e) => {
  lastImageUrl = null;

  let el = e.target;
  while (el && el !== document.documentElement) {
    if (el.tagName === 'IMG' && el.src && !el.src.startsWith('data:')) {
      // Prefer srcset largest image if available
      if (el.srcset) {
        const parts = el.srcset.split(',').map(s => s.trim().split(/\s+/));
        const largest = parts.sort((a, b) => {
          const wa = parseFloat(a[1]) || 0;
          const wb = parseFloat(b[1]) || 0;
          return wb - wa;
        })[0];
        lastImageUrl = largest?.[0] || el.src;
      } else {
        lastImageUrl = el.src;
      }
      break;
    }
    if (el.tagName === 'VIDEO' && el.poster) {
      lastImageUrl = el.poster;
      break;
    }
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (match?.[1] && !match[1].startsWith('data:')) {
        lastImageUrl = match[1];
        break;
      }
    }
    el = el.parentElement;
  }
}, true); // capture phase — runs before Instagram's handlers

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_IMAGE_URL') {
    sendResponse({ url: lastImageUrl });
    lastImageUrl = null;
  }
  return true;
});
