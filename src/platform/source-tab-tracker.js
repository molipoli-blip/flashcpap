// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { getActiveNormalTab } from './active-tab.js';
import { browserApi } from './browser-api.js';

let trackedSourceTab = null;
let listenersBound = false;

function isUsableSourceTab(tab) {
  const url = String(tab?.url || '');
  return /^https?:/i.test(url);
}

function normalizeSourceTab(tab) {
  if (!tab?.id || !isUsableSourceTab(tab)) return null;
  return {
    id: tab.id,
    url: String(tab.url || ''),
    title: String(tab.title || ''),
    windowId: Number.isInteger(tab.windowId) ? tab.windowId : null,
    capturedAt: Date.now()
  };
}

export function setTrackedSourceTab(tab) {
  trackedSourceTab = normalizeSourceTab(tab);
  return trackedSourceTab;
}

export function getTrackedSourceTab() {
  return trackedSourceTab;
}

export function clearTrackedSourceTab() {
  trackedSourceTab = null;
}

export async function refreshTrackedSourceTab() {
  try {
    const tab = await getActiveNormalTab();
    return setTrackedSourceTab(tab);
  } catch {
    clearTrackedSourceTab();
    return null;
  }
}

function maybeRefreshFromTab(tabId) {
  if (!trackedSourceTab || trackedSourceTab.id === tabId) {
    void refreshTrackedSourceTab();
  }
}

export async function initializeSourceTabTracking() {
  if (!listenersBound) {
    browserApi.tabs.onActivated?.addListener(() => {
      void refreshTrackedSourceTab();
    });

    browserApi.tabs.onUpdated?.addListener((tabId, changeInfo) => {
      if (!changeInfo || (changeInfo.status !== 'complete' && !changeInfo.url)) return;
      maybeRefreshFromTab(tabId);
    });

    browserApi.tabs.onRemoved?.addListener(tabId => {
      if (trackedSourceTab?.id === tabId) {
        clearTrackedSourceTab();
      }
    });

    browserApi.windows.onFocusChanged?.addListener(() => {
      void refreshTrackedSourceTab();
    });

    listenersBound = true;
  }

  return refreshTrackedSourceTab();
}
