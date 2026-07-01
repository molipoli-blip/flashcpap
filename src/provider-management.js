// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { settings, saveSettings, loadSettings, DEFAULT_PROVIDER_FIELDS } from './storage.js';
import { showToast, confirmInline, showProviderAddInlineForm } from './ui-utils.js';
import { syncProviderSelects } from './provider-sync.js';
import { refreshCheckboxUIs } from './checkbox-refresh.js';
import { logDebug, logError, logFlow } from './debug-logger.js';
import { publishTemplate } from '../lib/share.js';
import { ensureProviderConfig, getAvailableProviderLabels, getFirstAvailableProviderLabel as getFirstAvailableProviderLabelFromRules, getProviderConfig, hasValidProvider, toProviderKey, toProviderLabel } from './domain/provider-rules.js';
import { t } from './i18n.js';
import { markProviderAsShared } from './copy-engagement.js';
import { ensureProviderEntry, ensureSettingsArray, ensureSettingsObject } from './storage-guards.js';

let _onRefreshSettings = null;

export function isValidProviderSelection(siteLabel) {
  return hasValidProvider(settings, siteLabel);
}

export function getFirstAvailableProviderLabel() {
  return getFirstAvailableProviderLabelFromRules(settings);
}

export function populatePrestataireSelects() {
  const A = document.getElementById('prestataire-select');
  const P = document.getElementById('prest-param');
  const O = document.getElementById('prest-organization');
  if (!A || !P) return;

  if (A) A.innerHTML = '';
  if (P) P.innerHTML = '';
  if (O) O.innerHTML = '';

  const labels = getAvailableProviderLabels(settings);

  const appendOption = (sel, label) => {
    if (!sel) return;
    const o = document.createElement('option');
    o.value = o.textContent = label;
    sel.append(o);
  };

  labels.forEach(label => {
    appendOption(A, label);
    appendOption(P, label);
    appendOption(O, label);
  });
}

export function createProvider(providerName) {
  const name = (providerName || '').trim();
  if (!name) {
    showToast(t('errorProviderNameRequired'), 'error');
    return '';
  }

  const key = name.toLowerCase().replace(/\s+/g, '_');
  if (hasValidProvider(settings, key)) {
    showToast(t('providerExists'), 'error');
    return '';
  }

  ensureProviderConfig(settings, key, {
    urls: [],
    fields: JSON.parse(JSON.stringify(DEFAULT_PROVIDER_FIELDS)),
    fieldOrder: Object.keys(DEFAULT_PROVIDER_FIELDS)
  });
  ensureSettingsObject(settings, 'noteLibre');
  ensureSettingsObject(settings, 'customCheckboxes');
  settings.noteLibre[key] = '';
  ensureProviderEntry(settings, 'customCheckboxes', key, []);
  saveSettings();
  populatePrestataireSelects();

  return toProviderLabel(key);
}

export function setupProviderButtons({ onProviderCreated, onRefreshSettings } = {}) {
  if (onRefreshSettings) _onRefreshSettings = onRefreshSettings;
  const add = document.getElementById('btn-add-provider');
  const rem = document.getElementById('btn-remove-provider');
  const A = document.getElementById('prestataire-select');
  const P = document.getElementById('prest-param');
  if (!add || !rem) return;

  add.onclick = () => {
    showProviderAddInlineForm(add, {
      onSubmit: async (name) => {
        const labelName = createProvider(name);
        if (!labelName) return false;
        if (typeof onProviderCreated === 'function') {
          await onProviderCreated(labelName);
        }
        showToast(t('providerCreated', labelName), 'success');
        return true;
      }
    });
  };

  rem.onclick = async () => {
    if (!P) return;
    const key = toProviderKey(P.value);
    const ok = await confirmInline(rem, t('providerDeleteConfirm', P.value));
    if (!ok) return;

    delete settings.patterns[key];
    if (settings.noteLibre) delete settings.noteLibre[key];
    if (settings.customCheckboxes) delete settings.customCheckboxes[key];
    saveSettings();
    populatePrestataireSelects();
    const firstRemaining = A?.querySelector('option')?.value || '';
    syncProviderSelects(firstRemaining);
    _onRefreshSettings?.(firstRemaining || '');
    setupImportExportUI();
  };
}



export function detectProviderFromText(text) {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  for (const siteKey in settings.patterns) {
    const config = getProviderConfig(settings, siteKey);
    if (!config.pdfKeywords || !Array.isArray(config.pdfKeywords)) continue;

    for (const keyword of config.pdfKeywords) {
      if (keyword && lowerText.includes(keyword.toLowerCase())) {
        logDebug('DETECT', 'Prestataire detecte via mot-cle PDF', {
          provider: siteKey,
          keywordLength: String(keyword).length
        });
        return toProviderLabel(siteKey);
      }
    }
  }
  return null;
}

function cloneJsonData(value, fallback = undefined) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function cloneArray(value) {
  return Array.isArray(value) ? cloneJsonData(value, []) : undefined;
}

function cloneObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? cloneJsonData(value, {})
    : undefined;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

function normalizeProviderImportPayload(jsonData) {
  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Format de fichier invalide');
  }

  const root = jsonData.json && typeof jsonData.json === 'object'
    ? jsonData.json
    : jsonData;

  let patterns = null;
  if (root.patterns && typeof root.patterns === 'object') {
    patterns = cloneJsonData(root.patterns, {});
  } else if (root.fields && typeof root.fields === 'object') {
    patterns = {
      urls: Array.isArray(root.urls) ? cloneJsonData(root.urls, []) : [],
      fields: cloneJsonData(root.fields, {}),
      fieldOrder: Array.isArray(root.fieldOrder)
        ? cloneJsonData(root.fieldOrder, [])
        : Object.keys(root.fields || {})
    };
  } else {
    throw new Error('Le fichier ne contient pas de configuration de patterns (ou fields)');
  }

  if (!Array.isArray(patterns.urls)) patterns.urls = [];
  if (!patterns.fields || typeof patterns.fields !== 'object') patterns.fields = {};
  if (!Array.isArray(patterns.fieldOrder)) patterns.fieldOrder = Object.keys(patterns.fields || {});

  if (Array.isArray(root.globalSeparators) && !Array.isArray(patterns.globalSeparators)) {
    patterns.globalSeparators = cloneJsonData(root.globalSeparators, []);
  }

  if (Array.isArray(root.pdfKeywords) && !Array.isArray(patterns.pdfKeywords)) {
    patterns.pdfKeywords = cloneJsonData(root.pdfKeywords, []);
  }

  const providerLabel = String(root.meta?.name || jsonData.meta?.name || '').trim();

  return {
    providerLabel,
    patterns,
    noteLibre: root.noteLibre === undefined ? undefined : String(root.noteLibre || ''),
    compactFields: root.compactFields === undefined ? undefined : !!root.compactFields,
    organizationOrder: Array.isArray(root.organizationOrder)
      ? cloneJsonData(root.organizationOrder, [])
      : undefined,
    customCheckboxes: cloneArray(root.customCheckboxes),
    checkboxPhrases: cloneArray(root.checkboxPhrases),
    exclusions: cloneArray(root.exclusions),
    familySettings: cloneObject(root.familySettings),
    pinnedOptions: root.pinnedOptions === undefined ? undefined : cloneJsonData(root.pinnedOptions)
  };
}

function applyImportedProviderPayload(siteLabel, normalizedPayload) {
  const key = toProviderKey(siteLabel);
  const targetLabel = toProviderLabel(siteLabel);

  settings.patterns[key] = normalizedPayload.patterns || {};

  if (normalizedPayload.noteLibre !== undefined) {
    ensureSettingsObject(settings, 'noteLibre');
    settings.noteLibre[key] = normalizedPayload.noteLibre;
  }

  if (normalizedPayload.compactFields !== undefined) {
    ensureSettingsObject(settings, 'compactFields');
    settings.compactFields[key] = normalizedPayload.compactFields;
  }

  if (normalizedPayload.organizationOrder !== undefined) {
    ensureSettingsObject(settings, 'organizationOrderByProvider');
    settings.organizationOrderByProvider[targetLabel] = normalizedPayload.organizationOrder;
  }

  if (normalizedPayload.customCheckboxes !== undefined) {
    ensureSettingsObject(settings, 'customCheckboxes');
    settings.customCheckboxes[key] = normalizedPayload.customCheckboxes;
  }

  if (normalizedPayload.checkboxPhrases !== undefined) {
    ensureSettingsObject(settings, 'checkboxPhrases');
    settings.checkboxPhrases[key] = normalizedPayload.checkboxPhrases;
  }

  if (normalizedPayload.exclusions !== undefined) {
    ensureSettingsObject(settings, 'exclusionsByProvider');
    settings.exclusionsByProvider[key] = normalizedPayload.exclusions;
  }

  if (normalizedPayload.familySettings !== undefined) {
    ensureSettingsObject(settings, 'familySettings');
    settings.familySettings[key] = normalizedPayload.familySettings;
  }

  if (normalizedPayload.pinnedOptions !== undefined) {
    ensureSettingsObject(settings, 'pinnedOptions');
    settings.pinnedOptions[key] = normalizedPayload.pinnedOptions;
  }
}

function buildProviderExportPayload(site) {
  const key = toProviderKey(site);
  const patterns = cloneJsonData(getProviderConfig(settings, site) || {}, {});
  const meta = (patterns && patterns.meta) || {};

  return {
    version: 2,
    type: 'provider',
    provider: site,
    meta: {
      name: site,
      vendor: meta.vendor || '',
      model: meta.model || site
    },
    exportDate: new Date().toISOString(),
    patterns,
    noteLibre: settings.noteLibre?.[key] || '',
    compactFields: !!settings.compactFields?.[key],
    organizationOrder: cloneJsonData(
      settings.organizationOrderByProvider?.[site] || settings.organizationOrderByProvider?.[key] || [],
      []
    ),
    customCheckboxes: cloneJsonData(settings.customCheckboxes?.[key] || [], []),
    checkboxPhrases: cloneJsonData(settings.checkboxPhrases?.[key] || [], []),
    exclusions: cloneJsonData(settings.exclusionsByProvider?.[key] || [], []),
    globalSeparators: patterns.globalSeparators || [],
    familySettings: cloneJsonData(settings.familySettings?.[key] || {}, {}),
    pinnedOptions: cloneJsonData(settings.pinnedOptions?.[key] || [], [])
  };
}

export async function shareProviderToCommunity(siteLabel) {
  const site = siteLabel;
  const key = toProviderKey(site);
  if (!isValidProviderSelection(site)) {
    throw new Error(t('providerShareNeedsValid'));
  }

  const patterns = getProviderConfig(settings, site) || {};
  const meta = (patterns && patterns.meta) || {};
  const vendor = (meta.vendor || 'N/A').toString();
  const model = (meta.model || site).toString();
  const payload = {
    name: site,
    description: t('providerShareDescription', [site, vendor, model]),
    type: 'provider',
    vendor: vendor,
    model: model,
    submitted_by: 'User',
    json: {
      version: 2,
      meta: { name: site, vendor, model },
      patterns: patterns,
      customCheckboxes: settings.customCheckboxes?.[key] || [],
      checkboxPhrases: settings.checkboxPhrases?.[key] || [],
      noteLibre: settings.noteLibre?.[key] || '',
      compactFields: settings.compactFields?.[key] || false,
      organizationOrder: settings.organizationOrderByProvider?.[site] || settings.organizationOrderByProvider?.[key] || [],
      exclusions: settings.exclusionsByProvider?.[key] || [],
      globalSeparators: patterns.globalSeparators || [],
      familySettings: settings.familySettings?.[key] || {},
      pinnedOptions: settings.pinnedOptions?.[key] || []
    }
  };
  logFlow('SHARE', 'Publication communaute demandee', {
    provider: site,
    vendor,
    model,
    fieldCount: Object.keys(patterns.fields || {}).length,
    checkboxCount: (settings.customCheckboxes?.[key] || []).length,
    phraseCount: (settings.checkboxPhrases?.[key] || []).length,
    organizationCount: (settings.organizationOrderByProvider?.[site] || settings.organizationOrderByProvider?.[key] || []).length,
    exclusionCount: (settings.exclusionsByProvider?.[key] || []).length,
    separatorCount: (patterns.globalSeparators || []).length,
    pinnedOptionCount: (settings.pinnedOptions?.[key] || []).length
  });

  const result = await publishTemplate(payload);
  markProviderAsShared(site);
  logFlow('SHARE', 'Publication communaute terminee', {
    provider: site,
    hasTemplateId: !!(result && (result.id || result.template_id)),
    status: result?.status || result?.state || 'ok'
  });

  return result;
}

export function exportProviderConfig(site) {
  const key = toProviderKey(site);

  if (!isValidProviderSelection(site)) {
    showToast(t('providerNoValidExport'), 'error');
    return;
  }

  // Export providers using the current extension schema.
  const exportData = buildProviderExportPayload(site);

  downloadJson(`${key}_config_${new Date().toISOString().slice(0, 10)}.json`, exportData);

  showToast(t('providerExportSuccess', site), 'success');
  logDebug('EXPORT', 'Configuration prestataire exportee', {
    provider: key,
    fieldCount: Object.keys(exportData.patterns?.fields || {}).length,
    hasNoteLibre: !!exportData.noteLibre,
    hasCompactFields: !!exportData.compactFields,
    organizationCount: exportData.organizationOrder?.length || 0
  });

}

export function importProviderConfig(site, jsonData) {
  const key = toProviderKey(site);

  if (!isValidProviderSelection(site)) {
    showToast(t('providerSelectBeforeImport'), 'error');
    return false;
  }

  try {
    const normalizedImport = normalizeProviderImportPayload(jsonData);
    applyImportedProviderPayload(site, normalizedImport);
    saveSettings();
    loadSettings();
    showToast(t('providerImportSuccess', site), 'success');
    logDebug('IMPORT', 'Configuration prestataire importee', {
      provider: key,
      fieldCount: Object.keys(normalizedImport.patterns?.fields || {}).length,
      hasNoteLibre: normalizedImport.noteLibre !== undefined,
      hasCompactFields: normalizedImport.compactFields !== undefined,
      organizationCount: normalizedImport.organizationOrder?.length || 0
    });

    _onRefreshSettings?.(site);

    return true;
  } catch (error) {
    showToast(t('providerImportError', String(error.message)), 'error');
    logError('IMPORT', 'Erreur import configuration prestataire', error);
    return false;
  }
}

export function importProviderConfigAsNew(jsonData, options = {}) {
  try {
    const normalizedImport = normalizeProviderImportPayload(jsonData);

    if (!normalizedImport.providerLabel) {
      throw new Error('Le fichier JSON doit contenir meta.name pour nommer le prestataire');
    }

    const baseLabel = (normalizedImport.providerLabel || 'Nouveau').toString();
    let label = baseLabel;
    const existing = new Set(Object.keys(settings.patterns).map(k => k.toLowerCase()));
    let candidate = label.toLowerCase();
    let idx = 1;
    while (existing.has(candidate)) {
      label = `${baseLabel}${++idx}`;
      candidate = label.toLowerCase();
    }

    const key = candidate;

    applyImportedProviderPayload(label, normalizedImport);

    ensureSettingsObject(settings, 'customCheckboxes');
    ensureProviderEntry(settings, 'customCheckboxes', key, []);
    ensureSettingsObject(settings, 'checkboxPhrases');
    ensureProviderEntry(settings, 'checkboxPhrases', key, []);

    saveSettings();
    loadSettings();

    populatePrestataireSelects();
    const labelCap = toProviderLabel(label);
    syncProviderSelects(labelCap);
    _onRefreshSettings?.(labelCap);
    setupImportExportUI();

    showToast(t('providerImportNewSuccess', label), 'success');
    logDebug('IMPORT', 'Nouveau prestataire cree depuis import', {
      provider: key,
      fieldCount: Object.keys(normalizedImport.patterns?.fields || {}).length,
      hasNoteLibre: normalizedImport.noteLibre !== undefined,
      hasCompactFields: normalizedImport.compactFields !== undefined,
      organizationCount: normalizedImport.organizationOrder?.length || 0
    });
    return true;
  } catch (error) {
    showToast(t('providerImportNewError', String(error.message)), 'error');
    logError('IMPORT', 'Erreur import nouveau prestataire', error);
    return false;
  }
}

export function setupImportExportUI({ onRefreshSettings } = {}) {
  if (onRefreshSettings) _onRefreshSettings = onRefreshSettings;
  const importBtn = document.getElementById('btn-import-provider');
  const importInput = document.getElementById('import-provider-input');
  const exportBtn = document.getElementById('btn-export-provider');
  const importCbBtn = document.getElementById('btn-import-checkboxes');
  const importCbInput = document.getElementById('import-checkboxes-input');
  const exportCbBtn = document.getElementById('btn-export-checkboxes');
  const P = document.getElementById('prest-param');
  if (!P) return;

  // Import stays visible because it creates a new provider.
  if (importBtn && importInput) {
    importBtn.onclick = () => importInput.click();
    importInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const jsonData = await readJsonFile(file);
        importProviderConfigAsNew(jsonData, { fileName: file.name });
      } catch (error) {
        showToast(t('providerFileReadError', String(error.message)), 'error');
        logError('IMPORT', 'Erreur lecture fichier prestataire', error);
      }
      importInput.value = '';
    };
  }

  // Export is available only for a valid provider.
  if (exportBtn) {
    const site = P.value;
    const canExport = isValidProviderSelection(site);
    exportBtn.style.display = canExport ? 'inline-flex' : 'none';
    exportBtn.onclick = () => { if (canExport) exportProviderConfig(site); };
  }

  let shareBtn = document.getElementById('btn-share-provider');
  if (!shareBtn) {
    shareBtn = document.createElement('button');
    shareBtn.id = 'btn-share-provider';
    shareBtn.textContent = t('providerShareButton');
    shareBtn.style.cssText = 'padding:6px 12px; background:#0ea5e9; color:#fff; border:none; border-radius:4px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; margin-left:8px;';
    // Place it next to export when possible.
    exportBtn?.parentElement?.appendChild(shareBtn);
  }
  {
    const site = P.value;
    shareBtn.style.display = isValidProviderSelection(site) ? 'inline-flex' : 'none';
  }
  shareBtn.onclick = async () => {
    try {
      const site = P.value;
      if (!isValidProviderSelection(site)) { showToast(t('providerShareNeedsValid'), 'error'); return; }
      await shareProviderToCommunity(site);
      showToast(t('providerShareSuccess'), 'success');
    } catch (e) {
      showToast(t('providerShareError', String(e.message || e)), 'error');
      logError('SHARE', 'Erreur publication communaute', e);
    }
  };

  // --- Dedicated Checkboxes Import/Export (dissociated) ---
  if (importCbBtn && importCbInput) {
    importCbBtn.onclick = () => importCbInput.click();
    importCbInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const jsonData = await readJsonFile(file);
        const site = P.value;
        const ok = importProviderCheckboxes(site, jsonData);
        if (ok) {
          await refreshCheckboxUIs({ providerLabel: site, refreshSummary: true });
        }
      } catch (error) {
        showToast(t('providerFileReadError', String(error.message)), 'error');
        logError('IMPORT', 'Erreur lecture fichier checkboxes', error);
      }
      importCbInput.value = '';
    };
  }

  if (exportCbBtn) {
    const site = P.value;
    const canExport = isValidProviderSelection(site);
    exportCbBtn.style.display = canExport ? 'inline-flex' : 'none';
    exportCbBtn.onclick = () => { if (canExport) exportProviderCheckboxes(site); };
  }
}

export function exportProviderCheckboxes(site) {
  const key = toProviderKey(site);
  if (!isValidProviderSelection(site)) { showToast(t('providerNoValidExport'), 'error'); return; }

  // Build minimal, dedicated payload
  const exportData = {
    version: '1.0',
    type: 'checkboxes',
    provider: site,
    exportDate: new Date().toISOString(),
    customCheckboxes: settings.customCheckboxes?.[key] || [],
    checkboxPhrases: settings.checkboxPhrases?.[key] || [],
    // Local families used by this provider
    checkboxFamilies: Array.from(new Set((settings.customCheckboxes?.[key] || []).map(cb => cb.family).filter(Boolean))),
    organizationOrder: (settings.organizationOrder || []).filter(item => {
      if (item.type === 'family') {
        const checkboxes = settings.customCheckboxes?.[key] || [];
        return checkboxes.some(cb => cb.family === item.id);
      }
      if (item.type === 'checkbox') {
        const checkboxes = settings.customCheckboxes?.[key] || [];
        return checkboxes.some(cb => cb.id === item.id);
      }
      return false;
    })
  };

  downloadJson(`${key}_checkboxes_${new Date().toISOString().slice(0, 10)}.json`, exportData);
  showToast(t('checkboxExportSuccess', site), 'success');
}

export function importProviderCheckboxes(site, jsonData) {
  const key = toProviderKey(site);
  if (!isValidProviderSelection(site)) { showToast(t('checkboxImportSelectProvider'), 'error'); return false; }
  try {
    if (!jsonData || typeof jsonData !== 'object') throw new Error('Format invalide');
    // Accept both dedicated and legacy payloads
    const cbList = Array.isArray(jsonData.customCheckboxes) ? jsonData.customCheckboxes : [];
    const phrases = Array.isArray(jsonData.checkboxPhrases) ? jsonData.checkboxPhrases : [];
    const org = Array.isArray(jsonData.organizationOrder) ? jsonData.organizationOrder : [];
    const families = Array.isArray(jsonData.checkboxFamilies) ? jsonData.checkboxFamilies : [];

    ensureSettingsObject(settings, 'customCheckboxes');
    settings.customCheckboxes[key] = cbList;
    ensureSettingsObject(settings, 'checkboxPhrases');
    settings.checkboxPhrases[key] = phrases;

    // Merge families global list
    ensureSettingsArray(settings, 'checkboxFamilies');
    families.forEach(f => { if (f && !settings.checkboxFamilies.includes(f)) settings.checkboxFamilies.push(f); });
    settings.checkboxFamilies.sort();

    // Merge organizationOrder items without duplicates
    ensureSettingsArray(settings, 'organizationOrder');
    const existingIds = new Set(settings.organizationOrder.map(o => o.id));
    org.forEach(item => { if (item && !existingIds.has(item.id)) settings.organizationOrder.push(item); });

    saveSettings();
    showToast(t('checkboxImportSuccess', site), 'success');
    return true;
  } catch (e) {
    showToast(t('checkboxImportError', String(e.message)), 'error');
    logError('IMPORT', 'Erreur import checkboxes', e);
    return false;
  }
}
