// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap

import { browserApi } from './browser-api.js';

function getSourceTabIdFromLocation() {
  try {
    const tabId = new URL(window.location.href).searchParams.get('sourceTabId');
    return tabId ? Number(tabId) : null;
  } catch {
    return null;
  }
}

function getSourceWindowIdFromLocation() {
  try {
    const windowId = new URL(window.location.href).searchParams.get('sourceWindowId');
    return windowId ? Number(windowId) : null;
  } catch {
    return null;
  }
}

export async function getActiveNormalTab() {
  const sourceTabId = getSourceTabIdFromLocation();
  if (Number.isInteger(sourceTabId) && sourceTabId >= 0) {
    try {
      return await browserApi.tabs.get(sourceTabId);
    } catch {}
  }

  const sourceWindowId = getSourceWindowIdFromLocation();
  if (Number.isInteger(sourceWindowId) && sourceWindowId >= 0) {
    try {
      const sourceTabs = await browserApi.tabs.query({ active: true, windowId: sourceWindowId });
      if (sourceTabs?.[0]) return sourceTabs[0];
    } catch {}
  }

  try {
    const win = await browserApi.windows.getLastFocused({ windowTypes: ['normal'] });
    const tabs = await browserApi.tabs.query({ active: true, windowId: win.id });
    if (tabs?.[0]) return tabs[0];
  } catch {}

  const currentWindowTabs = await browserApi.tabs.query({ active: true, currentWindow: true });
  return currentWindowTabs?.[0] || null;
}