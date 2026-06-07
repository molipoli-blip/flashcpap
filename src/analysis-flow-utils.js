// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { getActiveNormalTab } from './platform/active-tab.js';

export async function getActiveTabContext({ setLastAnalyzedUrl, getLastAnalyzedUrl }) {
  const tab = await getActiveNormalTab();
  const currentUrl = tab?.url || null;
  const isUrlChanged = currentUrl !== getLastAnalyzedUrl();

  setLastAnalyzedUrl(currentUrl);

  return {
    currentUrl,
    isUrlChanged
  };
}

export function normalizePageTextResult(rawResult) {
  if (typeof rawResult === 'object' && rawResult !== null) {
    return {
      text: rawResult.text || '',
      isPdf: !!rawResult.isPdf
    };
  }

  return {
    text: rawResult || '',
    isPdf: false
  };
}
