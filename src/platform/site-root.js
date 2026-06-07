// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { getActiveNormalTab } from './active-tab.js';
import { browserApi } from './browser-api.js';

export function buildSiteRootPattern(url) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Seules les pages http/https sont prises en charge.');
  }
  return `${parsed.protocol}//${parsed.host}/*`;
}

export async function addCurrentSiteRootToProviderConfig(cfg) {
  const tab = await getActiveNormalTab();
  if (!tab?.url) {
    throw new Error('Impossible de lire l\'onglet actif.');
  }

  const pattern = buildSiteRootPattern(tab.url);
  const existing = Array.isArray(cfg?.urls) ? cfg.urls : [];

  if (existing.includes(pattern)) {
    return {
      pattern,
      alreadyPresent: true,
      permissionGranted: false
    };
  }

  cfg.urls = [...existing, pattern];

  let permissionGranted = false;
  try {
    permissionGranted = await browserApi.permissions.request({ origins: [pattern] });
  } catch {}

  return {
    pattern,
    alreadyPresent: false,
    permissionGranted
  };
}
