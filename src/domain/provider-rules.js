// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { logFlow } from '../debug-logger.js';

function getPatterns(source) {
  if (!source || typeof source !== 'object') return {};
  if (source.patterns && typeof source.patterns === 'object') return source.patterns;
  return source;
}

function getMutablePatterns(source) {
  if (!source || typeof source !== 'object') return null;
  if (source.patterns == null) {
    source.patterns = {};
    return source.patterns;
  }
  if (typeof source.patterns === 'object') return source.patterns;
  return typeof source === 'object' ? source : null;
}

export function normalizeProviderLabel(providerLabel) {
  return typeof providerLabel === 'string' ? providerLabel.trim() : '';
}

export function toProviderKey(providerLabel) {
  return normalizeProviderLabel(providerLabel).toLowerCase();
}

export function toProviderLabel(providerKey) {
  const key = typeof providerKey === 'string' ? providerKey.trim().toLowerCase() : '';
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function getAvailableProviderKeys(source) {
  return Object.keys(getPatterns(source) || {}).sort((a, b) => a.localeCompare(b));
}

export function getAvailableProviderLabels(source) {
  return getAvailableProviderKeys(source).map(toProviderLabel);
}

export function getFirstAvailableProviderLabel(source) {
  return toProviderLabel(getAvailableProviderKeys(source)[0] || '');
}

export function hasValidProvider(source, providerLabel) {
  const key = toProviderKey(providerLabel);
  return !!key && !!getPatterns(source)?.[key];
}

export function getProviderConfig(source, providerLabel) {
  const key = toProviderKey(providerLabel);
  if (!key) return null;
  return getPatterns(source)?.[key] || null;
}

export function ensureProviderConfig(source, providerLabel, defaults = {}) {
  const key = toProviderKey(providerLabel);
  if (!key) return null;

  const patterns = getMutablePatterns(source);
  if (!patterns) return null;

  if (!patterns[key] || typeof patterns[key] !== 'object') {
    patterns[key] = {
      urls: [],
      fields: {},
      fieldOrder: [],
      ...defaults
    };
  }

  return patterns[key];
}

export function resolveProviderLabel(providerLabel, source, { fallbackToFirstAvailable = true } = {}) {
  const normalized = normalizeProviderLabel(providerLabel);
  if (hasValidProvider(source, normalized)) return toProviderLabel(normalized);
  const fallbackLabel = fallbackToFirstAvailable ? getFirstAvailableProviderLabel(source) : '';
  if (fallbackLabel) {
    logFlow('FALLBACK', 'Prestataire resolu via premier disponible', {
      requestedProvider: normalized,
      resolvedProvider: fallbackLabel
    });
  }
  return fallbackLabel;
}

export function pickProviderLabel(candidates, source, { fallbackToFirstAvailable = false } = {}) {
  for (const candidate of candidates || []) {
    if (hasValidProvider(source, candidate)) return toProviderLabel(candidate);
  }
  const fallbackLabel = fallbackToFirstAvailable ? getFirstAvailableProviderLabel(source) : '';
  if (fallbackLabel) {
    logFlow('FALLBACK', 'Prestataire choisi via premier disponible', {
      candidateCount: Array.isArray(candidates) ? candidates.length : 0,
      resolvedProvider: fallbackLabel
    });
  }
  return fallbackLabel;
}

export function detectProviderFromUrl(url, source) {
  console.log('🔍 [Detection] URL:', url);
  let detected = null;

  try {
    const urlObj = new URL(url);
    const isFile = urlObj.protocol === 'file:';
    const host = urlObj.hostname.toLowerCase();
    const href = urlObj.href.toLowerCase();
    const patterns = getPatterns(source);

    for (const site of Object.keys(patterns || {})) {
      for (const raw of patterns[site].urls || []) {
        const rawLower = String(raw || '').toLowerCase();
        if (!rawLower) continue;

        if (isFile) {
          if (href.includes(rawLower)) {
            detected = toProviderLabel(site);
            break;
          }
          continue;
        }

        let patternHost;
        try {
          patternHost = new URL(raw).hostname.toLowerCase();
        } catch {
          patternHost = rawLower;
        }

        if (patternHost && host.includes(patternHost)) {
          detected = toProviderLabel(site);
          break;
        }
      }

      if (detected) break;
    }
  } catch (error) {
    console.error('Detection error', error);
  }

  if (detected) console.log('✅ [Detection] Found:', detected);
  else console.log('❌ [Detection] No match found');

  return detected;
}
