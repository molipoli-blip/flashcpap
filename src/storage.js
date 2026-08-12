// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { generateUniqueId } from './shared/id.js';
import { browserApi } from './platform/browser-api.js';
import { ensureSettingsArray, ensureSettingsObject } from './storage-guards.js';
import { linkCustomCheckboxesForProvider, migrateCustomCheckboxesToGlobal } from './custom-checkbox-store.js';
import { isSafeFieldKey, isSafePropertyKey } from './domain/config-security.js';

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

const DEFAULT_CUSTOM_CHECKBOXES = [
  {
    id: 'cb_q93us4b98',
    text: 'Bonne tolérance',
    value: 'Le dispositif est bien toléré',
    family: 'tolérance',
    favorite: false,
    pinned: false
  },
  {
    id: 'cb_gyilpprbe',
    text: 'Mauvaise tolérance',
    value: 'Mauvaise tolérance du dispositif',
    family: 'tolérance',
    favorite: false,
    pinned: false
  },
  {
    id: 'cb_xik70xc53',
    text: 'Bénéfice ressenti',
    value: 'Ressent le bénéfice',
    family: 'Bénéfice',
    favorite: false,
    pinned: false
  },
  {
    id: 'cb_voham7c83',
    text: 'Pas de bénéfice',
    value: 'Ne ressent pas de bénéfice',
    family: 'Bénéfice',
    favorite: false,
    pinned: false
  },
  {
    id: 'cb_3savwm1pn',
    text: 'Horaires',
    value: 'Les horaires de sommeil sont :\nCoucher [xxx], lever [xxx]',
    family: 'horaires',
    favorite: false,
    pinned: false
  },
  {
    id: 'cb_x82rlrv7k',
    text: 'SDE résiduelle',
    value: "Persistance d'une somnolence résiduelle",
    family: 'SDE',
    favorite: false,
    pinned: false
  },
  {
    id: 'cb_d15rhvhke',
    text: 'Amélio SDE',
    value: 'Amélioration de la somnolence',
    family: 'SDE',
    favorite: false,
    pinned: false
  },
  {
    id: 'cb_pgt2tx2x5',
    text: 'Pas de SDE résiduelle',
    value: 'Absence de somnolence résiduelle',
    family: 'SDE',
    favorite: false,
    pinned: true
  }
];

const DEFAULT_CHECKBOX_PHRASES_BY_PROVIDER = {
  zz: [
    {
      id: 'phr-benefice-mri9erua',
      title: 'Groupe Bénéfice',
      family: 'Bénéfice',
      order: [
        'cb_xik70xc53',
        'cb_voham7c83',
        'cb_x82rlrv7k',
        'cb_d15rhvhke',
        'cb_pgt2tx2x5',
        'cb_q93us4b98',
        'cb_gyilpprbe'
      ],
      prefix: "Concernant l'efficacité et tolérance du dispositif : ",
      connector: '. ',
      lastConnector: '. ',
      suffix: '.'
    }
  ]
};

const DEFAULT_CHECKBOX_FAMILIES = ['tolérance', 'Bénéfice', 'horaires', 'SDE'];

function createDefaultSettings() {
  return {
    patterns: {},
    noteLibre: {},
    customCheckboxes: {
      __global__: JSON.parse(JSON.stringify(DEFAULT_CUSTOM_CHECKBOXES))
    },
    checkboxPhrases: JSON.parse(JSON.stringify(DEFAULT_CHECKBOX_PHRASES_BY_PROVIDER)),
    checkboxFamilies: [...DEFAULT_CHECKBOX_FAMILIES],
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
    return { text: label, range: { start: 1, end: 999 }, excludeKeywords: [], priorityKeywords: [], labelExcludeKeywords: [], requireNextLine: true, nextLineRange: [1, 1] };
  }

  if (!isObject(label)) {
    return { text: '', range: { start: 1, end: 999 }, excludeKeywords: [], priorityKeywords: [], labelExcludeKeywords: [], requireNextLine: true, nextLineRange: [1, 1], splitSeparators: [] };
  }

  const requireInline = label.requireInline === true;
  const rawStart = Number.parseInt(label.nextLineRange?.[0], 10);
  const rawEnd = Number.parseInt(label.nextLineRange?.[1], 10);
  const normalizedStart = Number.isInteger(rawStart) ? Math.min(20, Math.max(1, rawStart)) : 1;
  const normalizedEnd = Number.isInteger(rawEnd) ? Math.min(20, Math.max(1, rawEnd)) : 1;
  const nextLineRange = [
    normalizedStart,
    Math.max(normalizedStart, normalizedEnd)
  ];

  return {
    text: label.text || '',
    range: label.range || { start: 1, end: 999 },
    excludeKeywords: label.excludeKeywords || [],
    priorityKeywords: label.priorityKeywords || [],
    labelExcludeKeywords: label.labelExcludeKeywords || [],
    ...(requireInline ? { requireInline: true } : { requireNextLine: true, nextLineRange }),
    splitSeparators: label.splitSeparators || []
  };
}

function normalizeProviderPatterns(target) {
  const sourcePatterns = ensureObject(target, 'patterns');
  const safePatterns = Object.create(null);

  for (const [site, pattern] of Object.entries(sourcePatterns)) {
    if (isSafePropertyKey(site)) safePatterns[site] = pattern;
  }
  target.patterns = safePatterns;

  for (const site of Object.keys(target.patterns)) {
    const pattern = target.patterns[site];
    if (!isObject(pattern)) {
      target.patterns[site] = { urls: [], fields: {}, fieldOrder: [] };
      continue;
    }

    if (!pattern.fields) {
      const urls = Array.isArray(pattern.urls) ? pattern.urls : [];
      const newFields = Object.create(null);
      for (const [key, value] of Object.entries(pattern)) {
        if (key !== 'urls' && isSafeFieldKey(key)) newFields[key] = value;
      }
      target.patterns[site] = { urls, fields: newFields };
    }

    const normalizedPattern = target.patterns[site];
    if (!Array.isArray(normalizedPattern.urls)) normalizedPattern.urls = [];
    const normalizedUrls = normalizedPattern.urls
      .map(url => String(url || '').trim())
      .filter(Boolean);
    const hasLegacyGlobalPair = normalizedUrls.includes('http://*/*') && normalizedUrls.includes('https://*/*');
    if (hasLegacyGlobalPair || normalizedUrls.includes('*://*/*') || normalizedUrls.includes('<all_urls>')) {
      normalizedPattern.urls = ['<all_urls>'];
    } else {
      normalizedPattern.urls = normalizedUrls;
    }
    if (!isObject(normalizedPattern.fields)) normalizedPattern.fields = {};
    const safeFields = Object.create(null);
    for (const [fieldKey, fieldDefinition] of Object.entries(normalizedPattern.fields)) {
      if (isSafeFieldKey(fieldKey)) safeFields[fieldKey] = fieldDefinition;
    }
    normalizedPattern.fields = safeFields;
    normalizedPattern.fieldOrder = Array.isArray(normalizedPattern.fieldOrder)
      ? normalizedPattern.fieldOrder.filter(fieldKey => isSafeFieldKey(fieldKey) && Object.hasOwn(safeFields, fieldKey))
      : Object.keys(safeFields);

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
  const normalizeThresholdValue = value => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim().replace(',', '.');
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  };

  interpretation.obsHours = normalizeThresholdValue(interpretation.obsHours);
  interpretation.iah = normalizeThresholdValue(interpretation.iah);
  interpretation.fuites = normalizeThresholdValue(interpretation.fuites);

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

  for (const [key, value] of Object.entries(target.customCheckboxes)) {
    if (!Array.isArray(value)) continue;

    target.customCheckboxes[key] = value.map(checkbox => {
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

  const globalCustomCheckboxes = migrateCustomCheckboxesToGlobal(target);
  for (const site of Object.keys(target.patterns || {})) {
    linkCustomCheckboxesForProvider(target, site);
  }

  if (!Array.isArray(globalCustomCheckboxes)) {
    target.customCheckboxes = { __global__: [] };
  }
}

function normalizeSettings(target) {
  if (!isObject(target)) target = createDefaultSettings();

  normalizeProviderPatterns(target);
  ensureObject(target, 'noteLibre');
  ensureObject(target, 'checkboxPhrases');
  ensureArray(target, 'checkboxFamilies');
  ensureArray(target, 'organizationOrder');

  normalizePinnedOptions(target);
  normalizeSummaryMeta(target);
  normalizeInterpretationSettings(target);
  normalizeCustomCheckboxes(target);

  return target;
}

// Keep the exported object identity stable: analysis actions retain this
// reference for the lifetime of the popup, including after a JSON import.
function replaceSettingsContents(nextSettings) {
  if (nextSettings === settings) return settings;

  for (const key of Object.keys(settings)) {
    delete settings[key];
  }

  for (const [key, value] of Object.entries(nextSettings)) {
    if (isSafePropertyKey(key)) settings[key] = value;
  }

  return settings;
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
  const isFirstRun = !parsed;

  if (parsed) {
    try { console.log('[STORAGE][LOAD] Raw settings loaded from localStorage'); } catch {}
    replaceSettingsContents(normalizeSettings(parsed));

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
    replaceSettingsContents(normalizeSettings(createDefaultSettings()));

    saveSettings();
    try { console.log('[STORAGE][INIT] Fresh default settings initialized'); } catch {}
  }

  return { isFirstRun };
}

// Checkbox family suggestions.
export function addFamilyToSuggestions(familyName) {
  if (!familyName || typeof familyName !== 'string') return;

  const trimmedFamily = familyName.trim();
  if (trimmedFamily.length === 0) return;

  ensureSettingsArray(settings, 'checkboxFamilies');

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
  ensureSettingsArray(settings, 'checkboxFamilies');
  return settings.checkboxFamilies;
}

export function updateFamilySuggestionsFromExistingCheckboxes() {
  ensureSettingsObject(settings, 'customCheckboxes');

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
