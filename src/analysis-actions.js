// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { executeAnalysisRun, resetAnalysisState } from './analysis-runner.js';
import { flushPendingInlineFieldChanges } from './field-inline-editor-slot.js';
import { browserApi } from './platform/browser-api.js';
import { buildSiteRootPattern } from './platform/site-root.js';
import { getTrackedSourceTab } from './platform/source-tab-tracker.js';
import { alertInline } from './ui-utils.js';

function bindResetAnalysisButton(button, setLastAnalyzedUrl) {
  if (!button) return;
  button.onclick = () => {
    resetAnalysisState(setLastAnalyzedUrl);
  };
}

function bindAnalyseButton(button, deps) {
  if (!button) return;
  button.onclick = async () => {
    flushPendingInlineFieldChanges();

    const pdfFileInput = document.getElementById('pdf-file-input');
    const hasPdfFile = Boolean(pdfFileInput?.files?.length);

    if (hasPdfFile) {
      await executeAnalysisRun(deps);
      return;
    }

    const sourceTab = getTrackedSourceTab();
    if (!sourceTab?.id || !sourceTab?.url) {
      await alertInline('Aucun onglet Web source n\'a été mémorisé. Reprenez un onglet Web, puis revenez dans FlashCPAP.', 'warning');
      return;
    }

    let originPattern;
    try {
      originPattern = buildSiteRootPattern(sourceTab.url);
    } catch (error) {
      await alertInline(error?.message || 'URL non prise en charge.', 'warning');
      return;
    }

    let granted = false;
    try {
      granted = !!(await browserApi.permissions.request({ origins: [originPattern] }));
    } catch (error) {
      await alertInline(error?.message || 'Autorisation d\'hôte refusée.', 'error');
      return;
    }

    if (!granted) {
      await alertInline(`Autorisation d'hôte refusée pour ${originPattern}.`, 'warning');
      return;
    }

    await executeAnalysisRun({
      ...deps,
      sourceTab
    });
  };
}

export function setupAnalysisActions({
  A,
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
}) {
  bindResetAnalysisButton(document.getElementById('btn-reset-analysis'), setLastAnalyzedUrl);
  bindAnalyseButton(document.getElementById('btn-analyse'), {
    providerSelect: A,
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
}
