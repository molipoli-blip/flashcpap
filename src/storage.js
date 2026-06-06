// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
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

export let settings = { 
  patterns: {}, 
  noteLibre: {}, 
  autoLockUrl: false,
  customCheckboxes: {},
  checkboxFamilies: [], // Liste des familles utilisées pour autocomplétion
  organizationOrder: [], // Ordre d'affichage global des éléments
  summaryMeta: { lastAutoLines: [] }, // Métadonnées pour fusion intelligente du résumé
  // Options "pinnées" intégrées (toujours activées à l'analyse si true)
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

export function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  try {
    browserApi.storage?.local?.set({ [STORAGE_KEY]: settings });
  } catch {}
}

export function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    try { console.log('[STORAGE][LOAD] Raw settings loaded from localStorage'); } catch {}

    if (!parsed.patterns || typeof parsed.patterns !== 'object') parsed.patterns = {};

    for (let site in parsed.patterns) {
      const p = parsed.patterns[site];
      if (!p || typeof p !== 'object') {
        parsed.patterns[site] = { urls: [], fields: {}, fieldOrder: [] };
        continue;
      }

      if (!p.fields) {
        const urls = Array.isArray(p.urls) ? p.urls : [];
        const newFields = {};
        for (let k in p) if (k !== 'urls') newFields[k] = p[k];
        parsed.patterns[site] = { urls, fields: newFields };
      }

      if (!p.fieldOrder) {
        p.fieldOrder = Object.keys(p.fields || {});
      }

      for (let [f, def] of Object.entries(parsed.patterns[site].fields)) {
        if (Array.isArray(def.labels)) {
          def.labels = def.labels.map(l =>
            typeof l === 'string'
              ? { text: l, range: { start: 1, end: 999 }, excludeKeywords: [], priorityKeywords: [], labelExcludeKeywords: [] }
              : {
                  text: l.text || '',
                  range: l.range || { start: 1, end: 999 },
                  excludeKeywords: l.excludeKeywords || [],
                  priorityKeywords: l.priorityKeywords || [],
                  labelExcludeKeywords: l.labelExcludeKeywords || [],
                  // ✅ Conserver les options d'extraction
                  ...(l.requireInline ? { requireInline: l.requireInline } : {}),
                  ...(l.requireNextLine ? { requireNextLine: l.requireNextLine } : {}),
                  // ✅ Séparateurs de parsing personnalisés
                  splitSeparators: l.splitSeparators || []
                }
          );
        }
      }
    }

    // Ensure each field has a human label; compute from key if missing
    const toFriendlyLabel = (key) => {
      if (!key) return '';
      const spaced = key === key.toUpperCase() ? key : key.replace(/([a-z])([A-Z])/g, '$1 $2');
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    };

    // Normalize structure and hydrate labels
  settings = parsed;
  if (typeof settings.autoLockUrl !== 'boolean') settings.autoLockUrl = false;
  // Ensure pinnedOptions exists
  if (!settings.pinnedOptions) settings.pinnedOptions = { interpret: false, rodap: false };
  
  // Log pinned states
  try {
    console.log('[STORAGE][LOAD] Pinned Options:', settings.pinnedOptions);
    for (let site in settings.customCheckboxes || {}) {
      const pinned = (settings.customCheckboxes[site] || []).filter(cb => cb.pinned);
      if (pinned.length > 0) {
        console.log(`[STORAGE][LOAD] Site "${site}" - ${pinned.length} checkbox(es) épinglée(s):`, pinned.map(cb => cb.text));
      }
    }
  } catch {}
  
  if (!settings.summaryMeta) settings.summaryMeta = { lastAutoLines: [] };
  // Ensure global interpretation thresholds/texts shape exists
  if (!settings.interpretation) settings.interpretation = { obsHours: null, iah: null, fuites: null, texts: {} };
  if (settings.interpretation.obsHours === undefined) settings.interpretation.obsHours = null;
  if (settings.interpretation.iah === undefined) settings.interpretation.iah = null;
  if (settings.interpretation.fuites === undefined) settings.interpretation.fuites = null;
  const T = settings.interpretation.texts = settings.interpretation.texts || {};
  T.obs = T.obs || { ge: '', lt: '' };
  T.iah = T.iah || { ge: '', lt: '' };
  T.fuites = T.fuites || { ge: '', lt: '' };

    if (!settings.customCheckboxes) settings.customCheckboxes = {};

    // Normalize custom checkboxes to include id, family, favorite with backward compatibility
    for (let site in settings.patterns) {
      if (!settings.customCheckboxes[site]) settings.customCheckboxes[site] = [];
      
      // Ensure each checkbox has proper structure
      settings.customCheckboxes[site] = settings.customCheckboxes[site].map(checkbox => {
        if (typeof checkbox === 'object' && checkbox.text && checkbox.value) {
          return {
            id: checkbox.id || generateUniqueId(),
            text: checkbox.text,
            value: checkbox.value,
            family: checkbox.family || '',
            favorite: checkbox.favorite || false,
            pinned: checkbox.pinned || false  // ✅ PRÉSERVER L'ÉTAT DU PIN SWITCH
          };
        }
        return checkbox; // Keep as-is if already properly structured
      });
    }

    // Restore missing units from defaults and set default labels/roles if absent
    for (let site in settings.patterns) {
      for (let [fieldName, fieldDef] of Object.entries(settings.patterns[site].fields || {})) {
        const d = DEFAULT_PROVIDER_FIELDS[fieldName];
        if (d && d.unit && !fieldDef.unit) fieldDef.unit = d.unit;
        if (!fieldDef.label) fieldDef.label = toFriendlyLabel(fieldName);
        if (!fieldDef.role && d && d.role) fieldDef.role = d.role;
      }
    }

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
    // Aucun prestataire par défaut – l'utilisateur les crée manuellement

    // Ensure interpretation settings exist with empty values (placeholders in UI)
    if (!settings.interpretation) settings.interpretation = { obsHours: null, iah: null, fuites: null, texts: {} };
    if (settings.interpretation.obsHours === undefined) settings.interpretation.obsHours = null;
    if (settings.interpretation.iah === undefined) settings.interpretation.iah = null;
    if (settings.interpretation.fuites === undefined) settings.interpretation.fuites = null;
    if (!settings.interpretation.texts) settings.interpretation.texts = {};
    if (!settings.interpretation.texts.obs) settings.interpretation.texts.obs = { ge: '', lt: '' };
    if (!settings.interpretation.texts.iah) settings.interpretation.texts.iah = { ge: '', lt: '' };
    if (!settings.interpretation.texts.fuites) settings.interpretation.texts.fuites = { ge: '', lt: '' };
    // Initialize pinnedOptions for built-in toggles
    if (!settings.pinnedOptions) settings.pinnedOptions = { interpret: false, rodap: false };
    if (typeof settings.autoLockUrl !== 'boolean') settings.autoLockUrl = false;

    saveSettings();
    try { console.log('[STORAGE][INIT] Fresh default settings initialized'); } catch {}
  }
}

// Gestion des familles de checkboxes
export function addFamilyToSuggestions(familyName) {
  if (!familyName || typeof familyName !== 'string') return;
  
  const trimmedFamily = familyName.trim();
  if (trimmedFamily.length === 0) return;
  
  // Initialiser si nécessaire
  if (!settings.checkboxFamilies) settings.checkboxFamilies = [];
  
  // Ajouter seulement si pas déjà présent (insensible à la casse)
  const exists = settings.checkboxFamilies.some(family => 
    family.toLowerCase() === trimmedFamily.toLowerCase()
  );
  
  if (!exists) {
    settings.checkboxFamilies.push(trimmedFamily);
    settings.checkboxFamilies.sort(); // Garder la liste triée
    saveSettings();
    try { console.log('[FAMILY][ADD] Added new family suggestion:', trimmedFamily, 'All families now:', settings.checkboxFamilies); } catch {}
  }
}

export function getFamilySuggestions() {
  if (!settings.checkboxFamilies) settings.checkboxFamilies = [];
  return settings.checkboxFamilies;
}

export function updateFamilySuggestionsFromExistingCheckboxes() {
  // Collecter toutes les familles existantes dans les checkboxes
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
  
  // Ajouter toutes les familles trouvées
  allFamilies.forEach(family => addFamilyToSuggestions(family));
  try { console.log('[FAMILY][REFRESH] Families refreshed from existing checkboxes. Current suggestions:', settings.checkboxFamilies); } catch {}
}
