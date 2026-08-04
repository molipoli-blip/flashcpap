// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { getActiveNormalTab } from './active-tab.js';
import { browserApi } from './browser-api.js';
import { clearFrameSnapshot, refreshFrameSnapshot } from '../iframe-permissions.js';

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
  const nextTrackedSourceTab = normalizeSourceTab(tab);
  if (trackedSourceTab?.id && trackedSourceTab.id !== nextTrackedSourceTab?.id) {
    clearFrameSnapshot(trackedSourceTab.id);
  }
  trackedSourceTab = nextTrackedSourceTab;
  return trackedSourceTab;
}

export function getTrackedSourceTab() {
  return trackedSourceTab;
}

export function clearTrackedSourceTab() {
  if (trackedSourceTab?.id) clearFrameSnapshot(trackedSourceTab.id);
  trackedSourceTab = null;
}

export async function refreshTrackedSourceTab() {
  try {
    const tab = await getActiveNormalTab();
    const tracked = setTrackedSourceTab(tab);
    if (tracked) await refreshFrameSnapshot(tracked);
    return tracked;
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

    browserApi.webNavigation.onCompleted?.addListener((details) => {
      if (trackedSourceTab?.id !== details?.tabId) return;
      void refreshFrameSnapshot(trackedSourceTab);
    });

    listenersBound = true;
  }

  return refreshTrackedSourceTab();
}
