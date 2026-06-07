// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// src/storage.js
import { generateUniqueId } from './shared/id.js';
import { browserApi } from './platform/browser-api.js';

export const STORAGE_KEY = 'ppc_analyzer_settings';

export const DEFAULT_PROVIDER_FIELDS = {
  mode:        { type: 'text',    labels: [] },
  pressionMin: { type: 'numeric', labels: [], unit: 'cmH2O' },
  pressionMax: { type: 'numeric', labels: [], unit: 'cmH2O' },
  pressionFixe: { type: 'numeric', labels: [], unit: 'cmH2O' },
  iah:         { type: 'numeric', labels: [], unit: '/h',    role: 'iah' },
  obs:         { type: 'numeric', labels: [], unit: 'h',     role: 'obs' },
  fuites:      { type: 'numeric', labels: [], unit: 'L/min', role: 'fuites' },
  ipap:        { type: 'numeric', labels: [], unit: 'cmH2O' },
  epap:        { type: 'numeric', labels: [], unit: 'cmH2O' }
};

function createDefaultSettings() {
  return {
    patterns: {},
    noteLibre: {},
    autoLockUrl: false,
    customCheckboxes: {},
    checkboxFamilies: [],
    organizationOrder: [],
    summaryMeta: { lastAutoLines: [] },
    pinnedOptions: { interpret: false, rodap: false },
    interpretation: {
      obsHours: null,
      iah: null,
      fuites: null,
      texts: {
        obs: { ge: '', lt: '' },
        iah: { ge: '', lt: '' },
        fuites: { ge: '', lt: '' }
      }
    }
  };
}

export let settings = createDefaultSettings();

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ensureObject(parent, key, fallback = {}) {
  if (!isObject(parent[key])) parent[key] = fallback;
  return parent[key];
}

function ensureArray(parent, key) {
  if (!Array.isArray(parent[key])) parent[key] = [];
  return parent[key];
}

function parseStoredSettings(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toFriendlyLabel(key) {
  if (!key) return '';
  const spaced = key === key.toUpperCase() ? key : key.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function normalizeLabelDefinition(label) {
  if (typeof label === 'string') {
    return { text: label, range: { start: 1, end: 999 }, excludeKeywords: [], priorityKeywords: [], labelExcludeKeywords: [] };
  }

  if (!isObject(label)) {
    return { text: '', range: { start: 1, end: 999 }, excludeKeywords: [], priorityKeywords: [], labelExcludeKeywords: [], splitSeparators: [] };
  }

  return {
    text: label.text || '',
    range: label.range || { start: 1, end: 999 },
    excludeKeywords: label.excludeKeywords || [],
    priorityKeywords: label.priorityKeywords || [],
    labelExcludeKeywords: label.labelExcludeKeywords || [],
    ...(label.requireInline ? { requireInline: label.requireInline } : {}),
    ...(label.requireNextLine ? { requireNextLine: label.requireNextLine } : {}),
    splitSeparators: label.splitSeparators || []
  };
}

function normalizeProviderPatterns(target) {
  ensureObject(target, 'patterns');

  for (let site in target.patterns) {
    const pattern = target.patterns[site];
    if (!isObject(pattern)) {
      target.patterns[site] = { urls: [], fields: {}, fieldOrder: [] };
      continue;
    }

    if (!pattern.fields) {
      const urls = Array.isArray(pattern.urls) ? pattern.urls : [];
      const newFields = {};
      for (let key in pattern) if (key !== 'urls') newFields[key] = pattern[key];
      target.patterns[site] = { urls, fields: newFields };
    }

    const normalizedPattern = target.patterns[site];
    if (!Array.isArray(normalizedPattern.urls)) normalizedPattern.urls = [];
    if (!isObject(normalizedPattern.fields)) normalizedPattern.fields = {};
    if (!normalizedPattern.fieldOrder) normalizedPattern.fieldOrder = Object.keys(normalizedPattern.fields || {});

    for (let [fieldName, fieldDef] of Object.entries(normalizedPattern.fields)) {
      if (!isObject(fieldDef)) {
        normalizedPattern.fields[fieldName] = fieldDef = {};
      }

      if (Array.isArray(fieldDef.labels)) {
        fieldDef.labels = fieldDef.labels.map(normalizeLabelDefinition);
      }

      const defaultField = DEFAULT_PROVIDER_FIELDS[fieldName];
      if (defaultField && defaultField.unit && !fieldDef.unit) fieldDef.unit = defaultField.unit;
      if (!fieldDef.label) fieldDef.label = toFriendlyLabel(fieldName);
      if (!fieldDef.role && defaultField && defaultField.role) fieldDef.role = defaultField.role;
    }
  }
}

function normalizeInterpretationSettings(target) {
  const interpretation = ensureObject(target, 'interpretation', { obsHours: null, iah: null, fuites: null, texts: {} });
  if (interpretation.obsHours === undefined) interpretation.obsHours = null;
  if (interpretation.iah === undefined) interpretation.iah = null;
  if (interpretation.fuites === undefined) interpretation.fuites = null;

  const texts = ensureObject(interpretation, 'texts');
  if (!isObject(texts.obs)) texts.obs = { ge: '', lt: '' };
  if (!isObject(texts.iah)) texts.iah = { ge: '', lt: '' };
  if (!isObject(texts.fuites)) texts.fuites = { ge: '', lt: '' };
}

function normalizePinnedOptions(target) {
  if (!isObject(target.pinnedOptions)) {
    target.pinnedOptions = { interpret: false, rodap: false };
  }
}

function normalizeSummaryMeta(target) {
  const summaryMeta = ensureObject(target, 'summaryMeta', { lastAutoLines: [] });
  if (!Array.isArray(summaryMeta.lastAutoLines)) summaryMeta.lastAutoLines = [];
}

function normalizeCustomCheckboxes(target) {
  ensureObject(target, 'customCheckboxes');

  for (let site in target.patterns) {
    if (!Array.isArray(target.customCheckboxes[site])) target.customCheckboxes[site] = [];

    target.customCheckboxes[site] = target.customCheckboxes[site].map(checkbox => {
      if (isObject(checkbox) && checkbox.text && checkbox.value) {
        return {
          id: checkbox.id || generateUniqueId(),
          text: checkbox.text,
          value: checkbox.value,
          family: checkbox.family || '',
          favorite: checkbox.favorite || false,
          pinned: checkbox.pinned || false
        };
      }
      return checkbox;
    });
  }
}

function normalizeSettings(target) {
  if (!isObject(target)) target = createDefaultSettings();

  normalizeProviderPatterns(target);
  ensureObject(target, 'noteLibre');
  ensureArray(target, 'checkboxFamilies');
  ensureArray(target, 'organizationOrder');
  if (typeof target.autoLockUrl !== 'boolean') target.autoLockUrl = false;

  normalizePinnedOptions(target);
  normalizeSummaryMeta(target);
  normalizeInterpretationSettings(target);
  normalizeCustomCheckboxes(target);

  return target;
}

export function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  try {
    browserApi.storage?.local?.set({ [STORAGE_KEY]: settings });
  } catch {}
}

export function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = parseStoredSettings(raw);

  if (parsed) {
    try { console.log('[STORAGE][LOAD] Raw settings loaded from localStorage'); } catch {}
    settings = normalizeSettings(parsed);

    try {
      console.log('[STORAGE][LOAD] Pinned Options:', settings.pinnedOptions);
      for (let site in settings.customCheckboxes || {}) {
        const pinned = (settings.customCheckboxes[site] || []).filter(cb => cb.pinned);
        if (pinned.length > 0) {
          console.log(`[STORAGE][LOAD] Site "${site}" - ${pinned.length} checkbox(es) epinglee(s):`, pinned.map(cb => cb.text));
        }
      }
    } catch {}

    saveSettings();
    try {
      console.log('[STORAGE][LOAD] Final normalized settings:', {
        patterns: Object.keys(settings.patterns),
        customCheckboxSites: Object.keys(settings.customCheckboxes || {}),
        checkboxFamilies: settings.checkboxFamilies,
        organizationOrder: settings.organizationOrder
      });
    } catch {}
  } else {
    settings = normalizeSettings(createDefaultSettings());

    saveSettings();
    try { console.log('[STORAGE][INIT] Fresh default settings initialized'); } catch {}
  }
}

// Gestion des familles de checkboxes
export function addFamilyToSuggestions(familyName) {
  if (!familyName || typeof familyName !== 'string') return;

  const trimmedFamily = familyName.trim();
  if (trimmedFamily.length === 0) return;

  if (!settings.checkboxFamilies) settings.checkboxFamilies = [];

  const exists = settings.checkboxFamilies.some(family =>
    family.toLowerCase() === trimmedFamily.toLowerCase()
  );

  if (!exists) {
    settings.checkboxFamilies.push(trimmedFamily);
    settings.checkboxFamilies.sort();
    saveSettings();
    try { console.log('[FAMILY][ADD] Added new family suggestion:', trimmedFamily, 'All families now:', settings.checkboxFamilies); } catch {}
  }
}

export function getFamilySuggestions() {
  if (!settings.checkboxFamilies) settings.checkboxFamilies = [];
  return settings.checkboxFamilies;
}

export function updateFamilySuggestionsFromExistingCheckboxes() {
  if (!settings.customCheckboxes) return;

  const allFamilies = new Set();

  for (const site in settings.customCheckboxes) {
    const checkboxes = settings.customCheckboxes[site] || [];
    checkboxes.forEach(checkbox => {
      if (checkbox.family && checkbox.family.trim()) {
        allFamilies.add(checkbox.family.trim());
      }
    });
  }

  allFamilies.forEach(family => addFamilyToSuggestions(family));
  try { console.log('[FAMILY][REFRESH] Families refreshed from existing checkboxes. Current suggestions:', settings.checkboxFamilies); } catch {}
}
