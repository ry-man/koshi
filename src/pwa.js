'use strict';

// Registers the offline service worker when served over http(s), e.g. GitHub Pages.
// Opening the files directly (file://) keeps working without it.
// On the game page it also powers the "Install app" panel, which shows players
// what the browser reports about installation so they can troubleshoot on the phone.
(() => {
  const canUseWorker = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
  let installPrompt = null;
  let installedThisVisit = false;
  let workerError = null;

  if (canUseWorker) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        workerError = error;
        console.warn('Offline support unavailable:', error);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installedThisVisit = true;
    refresh();
  });

  const $ = id => document.getElementById(id);
  const dialog = $('install-dialog');
  if (!dialog) return;
  const openButton = $('install-button');
  const installButton = $('install-now');
  let report = '';

  const standalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches || navigator.standalone === true;

  function browserName() {
    const ua = navigator.userAgent;
    if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
    if (/EdgA?\//.test(ua)) return 'Microsoft Edge';
    if (/OPR\/|Opera/.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/; wv\)/.test(ua)) return 'In-app browser';
    if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Unknown';
  }

  function imageSize(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(`${image.naturalWidth}x${image.naturalHeight}`);
      image.onerror = () => resolve('failed to load');
      image.src = src;
    });
  }

  async function diagnose() {
    const checks = [];
    const add = (label, ok, detail) => checks.push({ label, ok, detail });
    const browser = browserName();
    const android = /Android/.test(navigator.userAgent);
    add('Browser', browser === 'Chrome' || !android, `${browser}${android ? ' on Android' : ''}`);
    add('Opened as installed app', standalone() ? true : null, standalone() ? 'yes' : 'no (in a browser tab)');
    add('Secure connection', window.isSecureContext, location.origin);

    const link = document.querySelector('link[rel="manifest"]');
    let manifest = null;
    try {
      const response = await fetch(link.href, { cache: 'no-store' });
      manifest = await response.json();
      add('App manifest', response.ok, `${response.status} ${response.headers.get('content-type') || ''}`.trim());
    } catch (error) {
      add('App manifest', false, String(error));
    }
    if (manifest) {
      const resolve = value => new URL(value, link.href).href;
      add('App id / start page', true, `${resolve(manifest.id || manifest.start_url)} → ${resolve(manifest.start_url)}`);
      for (const icon of manifest.icons.filter(item => item.type === 'image/png')) {
        const size = await imageSize(resolve(icon.src));
        add(`Icon ${icon.sizes} ${icon.purpose || 'any'}`, size === icon.sizes, size);
      }
    }

    if (!canUseWorker) {
      add('Offline support', false, 'service workers unavailable here');
    } else {
      const registration = await navigator.serviceWorker.getRegistration();
      const state = registration && (registration.active || registration.waiting || registration.installing);
      add('Offline support', workerError ? false : Boolean(registration && registration.active),
        workerError ? String(workerError) : state ? `${state.state}${navigator.serviceWorker.controller ? ', controlling page' : ', not yet controlling page'}` : 'not registered yet');
      if ('caches' in window) {
        const keys = (await caches.keys()).filter(key => key.startsWith('koshi-'));
        add('Offline cache', keys.length > 0, keys.join(', ') || 'empty');
      }
    }

    let related = 'not supported by this browser';
    let installed = installedThisVisit;
    if ('getInstalledRelatedApps' in navigator) {
      try {
        const apps = await navigator.getInstalledRelatedApps();
        installed = installed || apps.length > 0;
        related = apps.length ? `yes (${apps.map(app => app.platform).join(', ')})` : 'no';
      } catch (error) {
        related = String(error);
      }
    }
    add('Browser reports app installed', installed ? true : null, installedThisVisit ? 'yes (just installed)' : related);
    add('Install prompt available', installPrompt ? true : null, installPrompt ? 'yes' : 'no');
    return { checks, browser, android, installed };
  }

  function help(steps) {
    $('install-help').replaceChildren(...steps.map(text => Object.assign(document.createElement('li'), { textContent: text })));
  }

  async function refresh() {
    if (!dialog.open) return;
    const result = await diagnose();
    const summary = $('install-summary');
    installButton.hidden = !installPrompt;
    if (standalone()) {
      summary.textContent = 'You are already playing in the installed app. Have fun!';
      help([]);
    } else if (result.installed) {
      summary.textContent = 'This phone already has Koshi\'s Quest installed. It appears as "Koshi" with Koshi\'s head as the icon.';
      help([
        'Open Settings → Apps → See all apps, then tap Koshi → Open.',
        'If your home screen hides new apps, long-press the home screen → Settings and turn on "Add new apps to Home screen". Then drag Koshi from the app drawer.',
        'Still missing? Uninstall Koshi in Settings → Apps, reopen this page in Chrome, and tap Install app again.',
      ]);
    } else if (installPrompt) {
      summary.textContent = 'Ready to install. Tap the button below.';
      help([]);
    } else if (result.android && result.browser !== 'Chrome') {
      summary.textContent = `You're using ${result.browser}. Installing works most reliably from Chrome.`;
      help(['Open https://ry-man.github.io/koshi/ in Chrome.', 'Tap ⋮ → Install app (or Add to Home screen → Install).']);
    } else {
      summary.textContent = 'Chrome hasn\'t offered to install the app on this visit.';
      help([
        'Use Chrome\'s menu: ⋮ → Install app (or Add to Home screen → Install). Choose Install, not Create shortcut.',
        'If Chrome says it\'s already installed, check Settings → Apps → See all apps for "Koshi". Open it from there if it\'s listed.',
        'If Koshi isn\'t listed: Chrome ⋮ → Settings → Site settings → All sites → ry-man.github.io → Delete & reset. Then fully close Chrome, reopen this page, wait a few seconds, and check again.',
        'Private (Incognito) tabs, Lite/data saver modes, and work profiles can block installs.',
      ]);
    }
    $('install-checks').replaceChildren(...result.checks.map(check => {
      const item = document.createElement('li');
      item.dataset.status = check.ok === true ? 'ok' : check.ok === false ? 'bad' : 'info';
      item.append(Object.assign(document.createElement('span'), { textContent: check.label }),
        Object.assign(document.createElement('strong'), { textContent: check.detail }));
      return item;
    }));
    report = [
      `Koshi install report — ${new Date().toISOString()}`,
      `Page: ${location.href}`,
      `Summary: ${summary.textContent}`,
      ...result.checks.map(check => `${check.ok === false ? '✗' : check.ok ? '✓' : '·'} ${check.label}: ${check.detail}`),
      `User agent: ${navigator.userAgent}`,
    ].join('\n');
  }

  openButton.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
    refresh();
  });
  $('install-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    $('install-summary').textContent = choice.outcome === 'accepted'
      ? 'Installing… Look for "Koshi" on your home screen or app drawer in a minute.'
      : 'Install cancelled. You can try again from Chrome\'s ⋮ menu.';
    installButton.hidden = true;
  });
  $('install-copy').addEventListener('click', async event => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(report);
      button.textContent = 'Copied!';
    } catch {
      $('install-checks').closest('details').open = true;
      button.textContent = 'Copy failed: screenshot instead';
    }
    setTimeout(() => { button.textContent = 'Copy report'; }, 2500);
  });
  if (standalone()) openButton.hidden = true;
  if (location.hash === '#install') window.addEventListener('load', () => openButton.click());
})();
