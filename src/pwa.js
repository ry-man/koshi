// Registers the offline service worker when served over http(s), e.g. GitHub Pages.
// Opening the files directly (file://) keeps working without it.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline support unavailable:', error));
  });
}
