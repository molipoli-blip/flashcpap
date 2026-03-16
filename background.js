// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap

const ANALYZER_WINDOW_ID_KEY = 'analyzerWindowId';
const ANALYZER_SOURCE_TAB_KEY = 'analyzerSourceTabId';
const TAG = '[FlashCPAP][BG]';

console.log(TAG, 'Service worker démarré (MV3 Firefox)');

async function getStoredAnalyzerWindowId() {
  try {
    const stored = await browser.storage.local.get({ [ANALYZER_WINDOW_ID_KEY]: null });
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
    await browser.storage.local.set({ [ANALYZER_WINDOW_ID_KEY]: windowId });
    console.log(TAG, 'setStoredAnalyzerWindowId ->', windowId);
  } catch (err) {
    console.warn(TAG, 'setStoredAnalyzerWindowId erreur', err);
  }
}

async function clearStoredAnalyzerWindowId() {
  try {
    await browser.storage.local.remove(ANALYZER_WINDOW_ID_KEY);
    console.log(TAG, 'clearStoredAnalyzerWindowId: clé supprimée');
  } catch (err) {
    console.warn(TAG, 'clearStoredAnalyzerWindowId erreur', err);
  }
}

async function getStoredSourceTabId() {
  try {
    const stored = await browser.storage.local.get({ [ANALYZER_SOURCE_TAB_KEY]: null });
    const id = Number.isInteger(stored?.[ANALYZER_SOURCE_TAB_KEY]) ? stored[ANALYZER_SOURCE_TAB_KEY] : null;
    return id;
  } catch {
    return null;
  }
}

async function setStoredSourceTabId(tabId) {
  try {
    await browser.storage.local.set({ [ANALYZER_SOURCE_TAB_KEY]: tabId });
  } catch (err) {
    console.warn(TAG, 'setStoredSourceTabId erreur', err);
  }
}

async function clearStoredSourceTabId() {
  try {
    await browser.storage.local.remove(ANALYZER_SOURCE_TAB_KEY);
  } catch (err) {
    console.warn(TAG, 'clearStoredSourceTabId erreur', err);
  }
}

async function getSourceTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs?.[0] || null;
  console.log(TAG, 'getSourceTab ->', tab ? `id=${tab.id} url=${tab.url}` : 'aucun onglet actif');
  return tab;
}

function buildPopupUrl(sourceTab) {
  const popupUrl = new URL(browser.runtime.getURL('popup.html'));

  if (sourceTab?.id != null) {
    popupUrl.searchParams.set('sourceTabId', String(sourceTab.id));
  }
  if (sourceTab?.windowId != null) {
    popupUrl.searchParams.set('sourceWindowId', String(sourceTab.windowId));
  }

  console.log(TAG, 'buildPopupUrl ->', popupUrl.toString());
  return popupUrl.toString();
}

browser.action.onClicked.addListener(async () => {
  console.log(TAG, 'action.onClicked: déclenchement');
  const analyzerWindowId = await getStoredAnalyzerWindowId();

  if (analyzerWindowId !== null) {
    console.log(TAG, 'tentative focus fenêtre existante', analyzerWindowId);
    try {
      const sourceTab = await getSourceTab();
      const storedSourceTabId = await getStoredSourceTabId();

      if (sourceTab?.id != null && sourceTab.id !== storedSourceTabId) {
        // Nouvel onglet actif : recharger la popup sur ce nouvel onglet
        console.log(TAG, 'nouvel onglet détecté, rechargement popup', storedSourceTabId, '->', sourceTab.id);
        const newPopupUrl = buildPopupUrl(sourceTab);
        const popupTabs = await browser.tabs.query({ windowId: analyzerWindowId });
        if (popupTabs?.[0]?.id != null) {
          await browser.tabs.update(popupTabs[0].id, { url: newPopupUrl });
        }
        await browser.windows.update(analyzerWindowId, { focused: true });
        await setStoredSourceTabId(sourceTab.id);
      } else {
        // Même onglet : simple focus
        await browser.windows.update(analyzerWindowId, { focused: true });
        console.log(TAG, 'fenêtre existante refocalisée', analyzerWindowId);
      }
      return;
    } catch (err) {
      console.warn(TAG, 'fenêtre introuvable (fermée?), réinitialisation ->', err?.message || err);
      await clearStoredAnalyzerWindowId();
      await clearStoredSourceTabId();
    }
  }

  const sourceTab = await getSourceTab();
  const popupUrl = buildPopupUrl(sourceTab);

  console.log(TAG, 'création nouvelle fenêtre popup');
  const createdWindow = await browser.windows.create({
    url: popupUrl,
    type: 'popup',
    width: 360,
    height: 600
  });

  if (createdWindow?.id != null) {
    console.log(TAG, 'fenêtre créée id=', createdWindow.id);
    await setStoredAnalyzerWindowId(createdWindow.id);
    if (sourceTab?.id != null) {
      await setStoredSourceTabId(sourceTab.id);
    }
  } else {
    console.error(TAG, 'windows.create n\'a pas retourné d\'id valide', createdWindow);
  }
});

browser.windows.onRemoved.addListener(async windowId => {
  const analyzerWindowId = await getStoredAnalyzerWindowId();
  if (windowId === analyzerWindowId) {
    console.log(TAG, 'fenêtre analyzer fermée id=', windowId, ', nettoyage storage');
    await clearStoredAnalyzerWindowId();
    await clearStoredSourceTabId();
  }
});
