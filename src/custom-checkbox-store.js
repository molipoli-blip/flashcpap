// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { ensureSettingsObject } from './storage-guards.js';

export const GLOBAL_CUSTOM_CHECKBOXES_KEY = '__global__';

function normalizeProviderKey(providerKey) {
  return String(providerKey || '').trim().toLowerCase();
}

function buildCheckboxSignature(checkbox) {
  const text = String(checkbox?.text || '').trim().toLowerCase();
  const value = String(checkbox?.value || '').trim().toLowerCase();
  const family = String(checkbox?.family || '').trim().toLowerCase();
  return `${text}::${value}::${family}`;
}

function mergeCheckboxesIntoMap(map, sourceList) {
  if (!Array.isArray(sourceList)) return;

  sourceList.forEach(checkbox => {
    if (!checkbox || typeof checkbox !== 'object') return;
    const text = String(checkbox.text || '').trim();
    const value = String(checkbox.value || '').trim();
    if (!text || !value) return;

    const signature = buildCheckboxSignature(checkbox);
    const existing = map.get(signature);
    if (!existing) {
      map.set(signature, { ...checkbox, text, value });
      return;
    }

    existing.favorite = !!(existing.favorite || checkbox.favorite);
    existing.pinned = !!(existing.pinned || checkbox.pinned);
    if (!existing.family && checkbox.family) existing.family = checkbox.family;
  });
}

export function getGlobalCustomCheckboxes(settings) {
  ensureSettingsObject(settings, 'customCheckboxes');
  if (!Array.isArray(settings.customCheckboxes[GLOBAL_CUSTOM_CHECKBOXES_KEY])) {
    settings.customCheckboxes[GLOBAL_CUSTOM_CHECKBOXES_KEY] = [];
  }
  return settings.customCheckboxes[GLOBAL_CUSTOM_CHECKBOXES_KEY];
}

export function linkCustomCheckboxesForProvider(settings, providerKey) {
  const normalizedProviderKey = normalizeProviderKey(providerKey);
  const globalCheckboxes = getGlobalCustomCheckboxes(settings);

  if (normalizedProviderKey) {
    settings.customCheckboxes[normalizedProviderKey] = globalCheckboxes;
  }

  return globalCheckboxes;
}

export function getCustomCheckboxes(settings, providerKey = '') {
  return linkCustomCheckboxesForProvider(settings, providerKey);
}

export function migrateCustomCheckboxesToGlobal(settings) {
  ensureSettingsObject(settings, 'customCheckboxes');

  const globalCheckboxes = getGlobalCustomCheckboxes(settings);
  const entries = Object.entries(settings.customCheckboxes)
    .filter(([key, value]) => key !== GLOBAL_CUSTOM_CHECKBOXES_KEY && Array.isArray(value));

  if (entries.length > 0) {
    const mergedMap = new Map();
    mergeCheckboxesIntoMap(mergedMap, globalCheckboxes);
    entries.forEach(([, list]) => mergeCheckboxesIntoMap(mergedMap, list));

    if (mergedMap.size > 0) {
      settings.customCheckboxes[GLOBAL_CUSTOM_CHECKBOXES_KEY] = Array.from(mergedMap.values());
    }
  }

  const linkedGlobalCheckboxes = getGlobalCustomCheckboxes(settings);
  entries.forEach(([providerKey]) => {
    settings.customCheckboxes[providerKey] = linkedGlobalCheckboxes;
  });

  return linkedGlobalCheckboxes;
}
