// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

// Browser API shim: Firefox exposes `browser`, Chromium exposes `chrome`.
const _browser = (typeof globalThis.browser !== 'undefined') ? globalThis.browser : globalThis.chrome;

const ANALYZER_WINDOW_ID_KEY = 'analyzerWindowId';
const TAG = '[FlashCPAP][BG]';

console.log(TAG, 'Service worker démarré');

async function getStoredAnalyzerWindowId() {
  try {
    const stored = await _browser.storage.local.get({ [ANALYZER_WINDOW_ID_KEY]: null });
    const id = Number.isInteger(stored?.[ANALYZER_WINDOW_ID_KEY]) ? stored[ANALYZER_WINDOW_ID_KEY] : null;
    console.log(TAG, 'getStoredAnalyzerWindowId ->', id);
    return id;
  } catch (err) {
    console.warn(TAG, 'getStoredAnalyzerWindowId erreur', err);
    return null;
  }
}

async function setStoredAnalyzerWindowId(windowId) {
  try {
    await _browser.storage.local.set({ [ANALYZER_WINDOW_ID_KEY]: windowId });
    console.log(TAG, 'setStoredAnalyzerWindowId ->', windowId);
  } catch (err) {
    console.warn(TAG, 'setStoredAnalyzerWindowId erreur', err);
  }
}

async function clearStoredAnalyzerWindowId() {
  try {
    await _browser.storage.local.remove(ANALYZER_WINDOW_ID_KEY);
    console.log(TAG, 'clearStoredAnalyzerWindowId: clé supprimée');
  } catch (err) {
    console.warn(TAG, 'clearStoredAnalyzerWindowId erreur', err);
  }
}

async function getSourceTab() {
  const tabs = await _browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs?.[0] || null;
  console.log(TAG, 'getSourceTab ->', tab ? `id=${tab.id} url=${tab.url}` : 'aucun onglet actif');
  return tab;
}

function buildPopupUrl() {
  const popupUrl = _browser.runtime.getURL('popup.html');
  console.log(TAG, 'buildPopupUrl ->', popupUrl);
  return popupUrl;
}

_browser.action.onClicked.addListener(async () => {
  console.log(TAG, 'action.onClicked: déclenchement');
  const analyzerWindowId = await getStoredAnalyzerWindowId();

  if (analyzerWindowId !== null) {
    console.log(TAG, 'tentative focus fenêtre existante', analyzerWindowId);
    try {
      await _browser.windows.update(analyzerWindowId, { focused: true });
      console.log(TAG, 'fenêtre existante refocalisée', analyzerWindowId);
      return;
    } catch (err) {
      console.warn(TAG, 'fenêtre introuvable (fermée?), réinitialisation ->', err?.message || err);
      await clearStoredAnalyzerWindowId();
    }
  }

  const popupUrl = buildPopupUrl();

  console.log(TAG, 'création nouvelle fenêtre popup');
  const createdWindow = await _browser.windows.create({
    url: popupUrl,
    type: 'popup',
    width: 360,
    height: 600
  });

  if (createdWindow?.id != null) {
    console.log(TAG, 'fenêtre créée id=', createdWindow.id);
    await setStoredAnalyzerWindowId(createdWindow.id);
  } else {
    console.error(TAG, 'windows.create n\'a pas retourné d\'id valide', createdWindow);
  }
});

_browser.windows.onRemoved.addListener(async windowId => {
  const analyzerWindowId = await getStoredAnalyzerWindowId();
  if (windowId === analyzerWindowId) {
    console.log(TAG, 'fenêtre analyzer fermée id=', windowId, ', nettoyage storage');
    await clearStoredAnalyzerWindowId();
  }
});
