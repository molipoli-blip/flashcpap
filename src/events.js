// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// src/events.js - Event handling and user interactions
import { settings } from './storage.js';
import { logError, logFlow, logWarn } from './debug-logger.js';
import { showToast } from './ui-utils.js';
import { setupPlaceholderNavigation } from './placeholder-navigation.js';
import { renderSummaryPreview } from './preview-renderer.js';
import { getCheckboxInputId } from './checkbox-orchestrator.js';
import { getActiveNormalTab } from './platform/active-tab.js';
import { browserApi } from './platform/browser-api.js';
import { toProviderKey } from './domain/provider-rules.js';
import { t } from './i18n.js';
import { ensureSettingsObject } from './storage-guards.js';

let lastParsedData = null;
let lastSelectedPrestataire = null;
let lastAnalyzedUrl = null;
let hasActiveAnalysisSession = false;
// Guards against re-entrant summary updates.
let __isUpdatingSummary = false;
let __pinningInProgress = false;
let __placeholderNavigationSetup = false;

export function setPinningInProgress(v) {
  __pinningInProgress = !!v;
}

export async function updateSummaryDisplay() {
  if (__pinningInProgress) {
    logFlow('SUMMARY', 'Mise a jour ignoree pendant le pinning');
    return;
  }
  if (__isUpdatingSummary) {
    logFlow('SUMMARY', 'Mise a jour ignoree car deja en cours');
    return;
  }
  __isUpdatingSummary = true;
  logFlow('SUMMARY', 'Debut mise a jour resume');

  if (!lastParsedData || !lastSelectedPrestataire) {
    logWarn('SUMMARY', 'Mise a jour impossible: donnees d analyse absentes', {
      hasParsedData: !!lastParsedData,
      hasProvider: !!lastSelectedPrestataire
    });
    showToast(t('warningRunAnalysisFirst'), 'warning');
    __isUpdatingSummary = false;
    return;
  }

  try {
    const cbI = document.getElementById('cb-interpret');

    const customCheckboxStates = {};
    ensureSettingsObject(settings, 'customCheckboxes');
    const customCheckboxes = settings.customCheckboxes[toProviderKey(lastSelectedPrestataire)] || [];
    let checkedCustomCount = 0;

    for (const checkbox of customCheckboxes) {
      const cbElement = document.getElementById(getCheckboxInputId(checkbox.id));
      if (cbElement) {
        customCheckboxStates[checkbox.id] = cbElement.checked;
        if (cbElement.checked) checkedCustomCount++;
      }
    }
    logFlow('SUMMARY', 'Etat options capture avant regeneration', {
      provider: lastSelectedPrestataire,
      interpret: !!cbI?.checked,
      customCheckboxCount: customCheckboxes.length,
      customCheckedCount: checkedCustomCount
    });

    const { generateSummary } = await import('./summary.js');
    const textarea = document.getElementById('résumé');
    const previous = textarea.value || '';
    const oldLines = previous.split(/\r?\n/);
    const newAuto = generateSummary(lastParsedData, lastSelectedPrestataire, cbI.checked, false, customCheckboxStates, settings, previous);
    const newAutoLines = newAuto.split(/\r?\n/);
    const changedLineCount = newAutoLines.reduce((n, l, i) => n + (l !== (oldLines[i] ?? '') ? 1 : 0), 0);
    logFlow('SUMMARY', 'Resume regenere', {
      previousLength: previous.length,
      nextLength: newAuto.length,
      previousLines: oldLines.length,
      nextLines: newAutoLines.length,
      changedLineCount
    });
    textarea.value = newAuto;
    logFlow('SUMMARY', 'Textarea mise a jour via marker system');

    const preview = document.getElementById('résumé-preview');
    const toggle = document.getElementById('toggle-preview');
    if (preview) {
      renderSummaryPreview(preview, toggle, textarea, newAuto);
    }

    if (!__placeholderNavigationSetup) {
      if (textarea) {
        setupPlaceholderNavigation(textarea);
        __placeholderNavigationSetup = true;
        logFlow('PLACEHOLDER', 'Navigation Tab activee sur textarea');
      }
    }
  } catch (error) {
    logError('SUMMARY', 'Echec mise a jour resume', error);
    showToast(t('errorSummaryUpdate', String(error.message || error)), 'error');
  } finally {
    __isUpdatingSummary = false;
  }
}

export function setupDOMEventListeners() {
  // Persist simple control state locally, excluding file inputs.
  const trackableElements = Array.from(document.querySelectorAll('input[id], select[id]'))
    .filter(el => el.type !== 'file');
  const saveState = async (element) => {
    const key = `state_${element.id}`;
    const value = element.type === 'checkbox' ? element.checked : element.value;
    await browserApi.storage.local.set({ [key]: value });
  };
  trackableElements.forEach(element => {
    const key = `state_${element.id}`;
    browserApi.storage.local.get([key]).then(result => {
      if (result[key] !== undefined) {
        if (element.type === 'checkbox') element.checked = result[key]; else element.value = result[key];
      }
    });
    element.addEventListener('change', () => {
      void saveState(element);
    });
  });

  try {
    const toggle = document.getElementById('toggle-preview');
    if (toggle) {
      toggle.addEventListener('change', () => {
        const textarea = document.getElementById('résumé');
        const preview = document.getElementById('résumé-preview');
        const showPreview = !!toggle.checked;
        if (preview && textarea) {
          preview.style.display = showPreview ? 'block' : 'none';
          textarea.style.display = showPreview ? 'none' : 'block';
          updateSummaryDisplay();
        }
      });
    }
  } catch {}
}

export function setupURLChangeMonitoring() {
  // Poll the active tab URL to surface stale analysis state.
  setInterval(async () => {
    try {
      const tab = await getActiveNormalTab();
      const current = tab?.url || '';

      if (current) {
        if (hasActiveAnalysisSession && lastAnalyzedUrl && current !== lastAnalyzedUrl) {

          const alertDiv = document.getElementById('analyse-alert');
          if (alertDiv) alertDiv.style.display = 'block';
        } else {
          const alertDiv = document.getElementById('analyse-alert');
          if (alertDiv) alertDiv.style.display = 'none';
        }
      }
    } catch (e) {
      logError('URL_MONITOR', 'Erreur pendant la surveillance URL', e);
    }
  }, 1200);
}



export function setLastParsedData(data, prestataire) {
  lastParsedData = data;
  lastSelectedPrestataire = prestataire;
  hasActiveAnalysisSession = !!data && !!prestataire;
}

export function getLastAnalyzedUrl() {
  return lastAnalyzedUrl;
}

export function setLastAnalyzedUrl(u) {
  lastAnalyzedUrl = u;
  if (!u) hasActiveAnalysisSession = false;
}

