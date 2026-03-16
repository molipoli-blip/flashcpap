// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap

import { getProviderSelects } from './provider-sync.js';
import { settings, saveSettings } from './storage.js';

export function normalizeProviderSiteKey(value) {
  return String(value || '').trim().toLowerCase();
}

export function getCheckboxProviderContext() {
  const selects = getProviderSelects();
  const analyseLabel = selects.analyse?.value || '';
  const paramLabel = selects.param?.value || '';
  const organizationLabel = selects.organization?.value || '';

  return {
    analyseLabel,
    analyseSiteKey: normalizeProviderSiteKey(analyseLabel),
    paramLabel,
    paramSiteKey: normalizeProviderSiteKey(paramLabel),
    organizationLabel,
    organizationSiteKey: normalizeProviderSiteKey(organizationLabel)
  };
}

export function getAnalyseProviderLabel() {
  return getCheckboxProviderContext().analyseLabel;
}

export function getAnalyseProviderSiteKey() {
  return getCheckboxProviderContext().analyseSiteKey;
}

export function getParameterProviderSiteKey() {
  return getCheckboxProviderContext().paramSiteKey;
}

export function isAnalyseProviderSite(siteKey) {
  const normalizedSiteKey = normalizeProviderSiteKey(siteKey);
  return !!normalizedSiteKey && normalizedSiteKey === getAnalyseProviderSiteKey();
}

function getCheckboxList(siteKey) {
  const normalizedSiteKey = normalizeProviderSiteKey(siteKey);
  return settings.customCheckboxes?.[normalizedSiteKey] || [];
}

export function updateCheckboxById(siteKey, checkboxId, updater) {
  const normalizedSiteKey = normalizeProviderSiteKey(siteKey);
  const list = getCheckboxList(normalizedSiteKey);
  const index = list.findIndex(checkbox => checkbox.id === checkboxId);
  if (index === -1) return null;

  const currentCheckbox = list[index];
  const nextCheckbox = typeof updater === 'function'
    ? updater(currentCheckbox)
    : { ...currentCheckbox, ...updater };

  if (!nextCheckbox) return null;

  list[index] = nextCheckbox;
  saveSettings();
  return nextCheckbox;
}

export function updateCheckboxPinned(siteKey, checkboxId, pinned) {
  return updateCheckboxById(siteKey, checkboxId, checkbox => ({
    ...checkbox,
    pinned: typeof pinned === 'boolean' ? pinned : !checkbox.pinned
  }));
}

export function getCheckboxInputId(checkboxId) {
  return `custom-cb-${checkboxId}`;
}

export function getCheckboxInputElement(checkboxId) {
  return document.getElementById(getCheckboxInputId(checkboxId));
}