// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneFallback(fallback) {
  if (Array.isArray(fallback)) return [...fallback];
  if (isPlainObject(fallback)) return { ...fallback };
  return fallback;
}

export function ensureSettingsObject(root, key, fallback = {}) {
  if (!isPlainObject(root[key])) root[key] = cloneFallback(fallback);
  return root[key];
}

export function ensureSettingsArray(root, key, fallback = []) {
  if (!Array.isArray(root[key])) root[key] = cloneFallback(fallback);
  return root[key];
}

export function ensureProviderEntry(root, mapKey, providerKey, fallback = {}) {
  const map = ensureSettingsObject(root, mapKey, {});
  const safeProviderKey = String(providerKey || '');

  if (Array.isArray(fallback)) {
    if (!Array.isArray(map[safeProviderKey])) map[safeProviderKey] = cloneFallback(fallback);
    return map[safeProviderKey];
  }

  if (!isPlainObject(map[safeProviderKey])) map[safeProviderKey] = cloneFallback(fallback);
  return map[safeProviderKey];
}
