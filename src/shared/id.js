// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

export function generateUniqueId() {
  return 'cb_' + Math.random().toString(36).substr(2, 9);
}

export function sanitizeIdentifierPart(value, fallback = 'item') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return normalized || fallback;
}

export function normalizePhraseGroupId(id, familyName = 'group') {
  const fallback = `phr-${sanitizeIdentifierPart(familyName, 'group')}`;
  const safe = sanitizeIdentifierPart(id, fallback);
  return safe.startsWith('phr-') ? safe : `phr-${safe}`;
}

export function createPhraseGroupId(familyName = 'group') {
  return `phr-${sanitizeIdentifierPart(familyName, 'group')}-${Date.now().toString(36)}`;
}
