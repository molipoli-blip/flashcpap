// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// Popup entry point.
import { loadSettings, saveSettings, settings, addFamilyToSuggestions, updateFamilySuggestionsFromExistingCheckboxes } from './storage.js';
import { logDebug } from './debug-logger.js';
import { initializeUI, refreshProviderUi, getCurrentProvider } from './ui-main.js';
import { detectProviderFromText } from './provider-management.js';
import { alertInline } from './ui-utils.js';
import { generateUniqueId } from './shared/id.js';
import { isEditing, getEditingInfo, cancelEdit, updateFamilySuggestionsList } from './checkbox-settings.js';
import { renderOrganizationInterface } from './organization.js';
import { getPageText } from './extraction.js';
import { parseTextMeta, applySplitSeparators } from './parsing.js';
import { setupDOMEventListeners, setupURLChangeMonitoring, updateSummaryDisplay, setLastAnalyzedUrl, setLastParsedData, setPinningInProgress, getLastAnalyzedUrl } from './events.js';
import { setupHighlighting } from './highlighting.js';
import { initFieldEditor } from './field-editor.js';
import { renderSettingsUI } from './field-management.js';
import { initDock } from './dock.js';
import { setupFeedbackUI } from './feedback.js';
import { setupInterpretationThresholds } from './interpretation-thresholds.js';
import { detectProviderFromUrl, bindProviderSelects, getProviderSelects } from './provider-sync.js';
import { setupCopyAction } from './copy-action.js';
import { setupAnalysisActions } from './analysis-actions.js';
import { setupCustomCheckboxManagement } from './custom-checkbox-management.js';
import { applyTranslations } from './i18n.js';
import { initSupportersUI } from './supporters.js';
import { buildCleanSummaryText } from './domain/summary-rules.js';
import { browserApi } from './platform/browser-api.js';

window.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  setupDOMEventListeners();
  init();
});

setupURLChangeMonitoring();

function initializeCoreUi() {
  initializeUI();
  initSupportersUI();

  const { ensureInlineEditorPosition } = initFieldEditor({ renderSettingsUi: renderSettingsUI });
  initDock();

  const initialProvider = getCurrentProvider();
  refreshProviderUi(initialProvider);
  ensureInlineEditorPosition();

  return getProviderSelects().analyse;
}

function setupInterpretationAndProviderBindings() {
  setupInterpretationThresholds({ settings, saveSettings, updateSummaryDisplay });

  bindProviderSelects({
    onProviderChanged: value => {
      refreshProviderUi(value);
    }
  });

  document.getElementById('cb-interpret')?.addEventListener('change', updateSummaryDisplay);
  document.addEventListener('custom-checkbox-changed', updateSummaryDisplay);
}

function setupPdfFeedbackLogging() {
  const pdfFileInput = document.getElementById('pdf-file-input');
  if (!pdfFileInput) return;
  const pdfClearBtn = document.getElementById('pdf-clear-btn');

  const syncClearBtn = () => {
    if (pdfClearBtn) pdfClearBtn.style.display = pdfFileInput.files?.length ? 'inline-block' : 'none';
  };

  pdfFileInput.addEventListener('change', event => {
    const file = event.target.files?.[0];
    syncClearBtn();
    if (file) {
      logDebug('PDF', 'Fichier sélectionné', { name: file.name, size: `${(file.size / 1024).toFixed(1)} Ko` });
      return;
    }
    logDebug('PDF', 'Aucun fichier sélectionné (retour mode HTML)');
  });

  pdfClearBtn?.addEventListener('click', () => {
    pdfFileInput.value = '';
    syncClearBtn();
    logDebug('PDF', 'Fichier vidé (retour mode HTML)');
  });
}

function setupCheckboxFeatures() {
  setupCustomCheckboxManagement({
    settings,
    saveSettings,
    addFamilyToSuggestions,
    renderOrganizationInterface,
    alertInline,
    isEditing,
    getEditingInfo,
    cancelEdit,
    generateUniqueId
  });

  updateFamilySuggestionsFromExistingCheckboxes();
  updateFamilySuggestionsList();
}

function setupAutoLockUrlToggle() {
  const toggle = document.getElementById('autolock-url-toggle');
  if (!toggle) return;

  const applyValue = value => {
    const normalized = !!value;
    toggle.checked = normalized;
    settings.autoLockUrl = normalized;
  };

  applyValue(settings.autoLockUrl);

  browserApi.storage.local.get(['state_autolock-url-toggle']).then(result => {
    const stored = result['state_autolock-url-toggle'];
    if (typeof stored !== 'boolean') return;
    applyValue(stored);
    saveSettings();
  }).catch(() => {});

  toggle.addEventListener('change', () => {
    settings.autoLockUrl = !!toggle.checked;
    saveSettings();
  });
}

function setupActionFeatures(analysisSelect) {
  setupAnalysisActions({
    A: analysisSelect,
    settings,
    setLastAnalyzedUrl,
    getLastAnalyzedUrl,
    getPageText,
    detectProviderFromText,
    detectProviderFromUrl,
    refreshProviderUi,
    applySplitSeparators,
    parseTextMeta,
    setupHighlighting,
    setLastParsedData,
    setPinningInProgress,
    updateSummaryDisplay
  });

  setupCopyAction({ buildCleanSummaryText });

  try {
    setupFeedbackUI();
  } catch (error) {
    console.warn('[FEEDBACK][INIT] échec initialisation UI', error);
  }
}

function init() {
  loadSettings();
  try {
    const manifest = browser.runtime.getManifest();
    console.log(`[INIT] FlashCPAP v${manifest.version}`);
    console.log('[INIT] Settings loaded. Families:', settings.checkboxFamilies, 'OrgOrder length:', (settings.organizationOrder||[]).length);
  } catch {}
  const analysisSelect = initializeCoreUi();
  setupInterpretationAndProviderBindings();
  setupPdfFeedbackLogging();
  setupCheckboxFeatures();
  setupAutoLockUrlToggle();
  setupActionFeatures(analysisSelect);
}






