(function () {
'use strict';

const CAMPAIGNS = {
  beta: { id: 'beta', name: 'Beta' },
  official: { id: 'official', name: 'Official' },
};
const ACTIVE_KEY = 'koshi-active-campaign';
const LEGACY_KEYS = {
  saves: 'koshi-campaign-saves-v2',
  recent: 'koshi-campaign-recent-save',
  draft: 'koshi-level-editor-v1',
  selection: 'koshi-beta-level-selection',
};

function campaign(id) {
  if (!Object.hasOwn(CAMPAIGNS, id)) throw new Error(`Unknown game: ${id}. Choose Beta or Official.`);
  return CAMPAIGNS[id];
}

function resolveCampaign(search) {
  const explicit = new URLSearchParams(search).get('game');
  if (explicit !== null) return campaign(explicit);
  return CAMPAIGNS.beta;
}

function storageKey(kind, id = 'beta') {
  campaign(id);
  if (!Object.hasOwn(LEGACY_KEYS, kind)) throw new Error(`Unknown campaign storage kind: ${kind}`);
  return id === 'beta' ? LEGACY_KEYS[kind] : `koshi-official-${kind}-v1`;
}

function cutsceneKey(levelId, id = 'beta') {
  campaign(id);
  return `${id === 'beta' ? 'koshi-cutscene-viewed' : 'koshi-official-cutscene-viewed'}:${encodeURIComponent(levelId)}`;
}

function gameURL(path, hash = '', id = active.id) {
  campaign(id);
  return `${path}?game=${id}${hash}`;
}

let active = CAMPAIGNS.beta;
let startupError = null;
const browser = typeof module === 'undefined' || !module.exports;
if (browser) {
  try {
    active = resolveCampaign(location.search);
  } catch (error) {
    console.error('Game selection could not be restored:', error);
    startupError = error;
  }
}

function setup({ beforeSwitch = () => true, onSwitch = () => {}, reportError }) {
  document.body.dataset.campaign = active.id;
  document.title = `${active.name} - ${document.title}`;
  for (const label of document.querySelectorAll('[data-campaign-label]')) label.textContent = `${active.name} game`;
  for (const link of document.querySelectorAll('[data-game-link]')) {
    const url = new URL(link.getAttribute('href'), location.href);
    url.searchParams.set('game', active.id);
    link.href = url.href;
  }
  if (startupError) reportError(startupError);
  try {
    localStorage.setItem(ACTIVE_KEY, active.id);
  } catch (error) {
    console.error('Game selection could not be remembered:', error);
    reportError(error);
  }
  for (const select of document.querySelectorAll('[data-campaign-select]')) {
    select.value = active.id;
    select.addEventListener('change', () => {
      const id = select.value;
      select.value = active.id;
      if (id === active.id || !beforeSwitch(id)) return;
      try {
        campaign(id);
        localStorage.setItem(ACTIVE_KEY, id);
        const url = new URL(location.href);
        url.searchParams.set('game', id);
        url.hash = '';
        if (onSwitch() === false) {
          localStorage.setItem(ACTIVE_KEY, active.id);
          return;
        }
        location.assign(url.href);
      } catch (error) {
        console.error('Game could not be switched:', error);
        reportError(error);
      }
    });
  }
}

const api = { CAMPAIGNS, ACTIVE_KEY, active, resolveCampaign, storageKey, cutsceneKey, gameURL, setup };
if (!browser) module.exports = api;
else globalThis.KoshiCampaignMode = api;
})();
