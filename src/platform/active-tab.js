// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { browserApi } from './browser-api.js';

export async function getActiveNormalTab() {
  // Prefer the normal browser window currently focused by the user.
  // This avoids keeping analysis pinned to the first source window when the popup stays open.
  try {
    const win = await browserApi.windows.getLastFocused({ windowTypes: ['normal'] });
    if (win?.id != null) {
      const tabs = await browserApi.tabs.query({ active: true, windowId: win.id });
      if (tabs?.[0]) return tabs[0];
    }
  } catch {}

  const currentWindowTabs = await browserApi.tabs.query({ active: true, currentWindow: true });
  return currentWindowTabs?.[0] || null;
}
