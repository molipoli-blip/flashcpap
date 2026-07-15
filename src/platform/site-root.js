// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { getActiveNormalTab } from './active-tab.js';
import { browserApi } from './browser-api.js';

export class HostPermissionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'HostPermissionError';
    this.code = code;
    Object.assign(this, details);
  }
}

function requireHttpOrHttpsUrl(url) {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new HostPermissionError('UNSUPPORTED_URL', 'URL invalide ou non prise en charge. Ouvrez une page http/https ou utilisez le mode PDF.');
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new HostPermissionError(
      'UNSUPPORTED_URL',
      'Les pages internes du navigateur et les protocoles non pris en charge sont refusés. Ouvrez une page http/https dans une fenêtre normale ou utilisez le mode PDF.'
    );
  }

  return parsed;
}

export function buildSiteRootPattern(url) {
  const parsed = requireHttpOrHttpsUrl(url);
  return `${parsed.protocol}//${parsed.host}/*`;
}

async function hasPersistentHostPermission(pattern) {
  try {
    return !!(await browserApi.permissions.contains({ origins: [pattern] }));
  } catch {
    return false;
  }
}

export async function ensurePersistentHostPermissionForUrl(url, {
  requestPermission = true,
  throwOnDenied = true
} = {}) {
  const pattern = buildSiteRootPattern(url);
  const alreadyGranted = await hasPersistentHostPermission(pattern);

  if (alreadyGranted) {
    return {
      pattern,
      alreadyGranted: true,
      permissionGranted: true,
      requested: false
    };
  }

  if (!requestPermission) {
    return {
      pattern,
      alreadyGranted: false,
      permissionGranted: false,
      requested: false
    };
  }

  const permissionGranted = !!(await browserApi.permissions.request({ origins: [pattern] }));
  if (!permissionGranted && throwOnDenied) {
    throw new HostPermissionError('PERMISSION_DENIED', `Autorisation d'hôte refusée pour ${pattern}.`, { pattern });
  }

  return {
    pattern,
    alreadyGranted: false,
    permissionGranted,
    requested: true
  };
}

export async function ensurePersistentHostPermissionForTab(tab, options = {}) {
  if (!tab?.url) {
    throw new HostPermissionError('NO_NORMAL_TAB', 'Aucun onglet normal trouvé. Ouvrez une page Web dans une fenêtre normale puis relancez l\'analyse.');
  }

  return ensurePersistentHostPermissionForUrl(tab.url, options);
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
    const permissionResult = await ensurePersistentHostPermissionForUrl(tab.url, {
      requestPermission: true,
      throwOnDenied: false
    });
    permissionGranted = !!permissionResult.permissionGranted;
  } catch {}

  return {
    pattern,
    alreadyPresent: false,
    permissionGranted
  };
}
