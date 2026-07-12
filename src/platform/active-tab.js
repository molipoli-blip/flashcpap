// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { browserApi } from './browser-api.js';

function hasUsableContentUrl(tab) {
  const url = String(tab?.url || '');
  return /^(https?:|file:)/i.test(url);
}

function appendCandidate(candidates, tab) {
  if (!tab?.id) return;
  if (candidates.some(existing => existing.id === tab.id)) return;
  candidates.push(tab);
}

export async function getActiveNormalTab() {
  const candidates = [];

  // Prefer the normal browser window currently focused by the user.
  try {
    const win = await browserApi.windows.getLastFocused({ windowTypes: ['normal'] });
    if (win?.id != null) {
      const tabs = await browserApi.tabs.query({ active: true, windowId: win.id });
      appendCandidate(candidates, tabs?.[0]);
    }
  } catch {}

  // In popup context, currentWindow may resolve to the extension popup.
  try {
    const currentWindowTabs = await browserApi.tabs.query({ active: true, currentWindow: true });
    appendCandidate(candidates, currentWindowTabs?.[0]);
  } catch {}

  // Collect active tabs across windows and choose the first usable content tab.
  try {
    const activeTabs = await browserApi.tabs.query({ active: true });
    for (const tab of activeTabs || []) {
      appendCandidate(candidates, tab);
    }
  } catch {}

  const usableTab = candidates.find(hasUsableContentUrl);
  if (usableTab) return usableTab;

  return candidates[0] || null;
}
