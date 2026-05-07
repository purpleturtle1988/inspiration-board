let lastImageUrl = null;

function getBestSrc(img) {
  if (img.srcset) {
    const entries = img.srcset.split(',').map(s => {
      const parts = s.trim().split(/\s+/);
      return { url: parts[0], w: parseFloat(parts[1]) || 0 };
    });
    entries.sort((a, b) => b.w - a.w);
    if (entries[0]?.url) return entries[0].url;
  }
  return img.src;
}

function findImageUrl(target) {
  let el = target;
  while (el && el !== document.documentElement) {
    // Check the element itself
    if (el.tagName === 'IMG' && el.src && !el.src.startsWith('data:')) {
      return getBestSrc(el);
    }
    if (el.tagName === 'VIDEO' && el.poster) {
      return el.poster;
    }
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (match?.[1] && !match[1].startsWith('data:')) return match[1];
    }

    // Also search for img children within this ancestor
    // (Instagram wraps <img> in many divs — the right-click lands on a div)
    if (el !== target) {
      const imgs = el.querySelectorAll('img');
      for (const img of imgs) {
        if (img.src && !img.src.startsWith('data:') && img.naturalWidth > 50) {
          return getBestSrc(img);
        }
      }
    }

    el = el.parentElement;
  }
  return null;
}

document.addEventListener('contextmenu', (e) => {
  lastImageUrl = findImageUrl(e.target);
}, true); // capture phase — runs before Instagram's handlers

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_IMAGE_URL') {
    sendResponse({ url: lastImageUrl });
    lastImageUrl = null;
  }
  return true;
});
