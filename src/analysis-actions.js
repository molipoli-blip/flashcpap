// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { executeAnalysisRun, resetAnalysisState } from './analysis-runner.js';
import { flushPendingInlineFieldChanges } from './field-inline-editor-slot.js';
import { requestAnalysisPermissions } from './iframe-permissions.js';
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

    // Keep permissions.request() synchronous with the click. Firefox rejects
    // permission requests made after any awaited asynchronous operation.
    let access;
    try {
      const permissionRequest = requestAnalysisPermissions(sourceTab);
      access = await permissionRequest;
    } catch (error) {
      await alertInline(error?.message || 'Impossible de demander les autorisations nécessaires.', 'error');
      return;
    }

    if (!access.granted) {
      await alertInline('L\'autorisation nécessaire pour lire la page et son rapport intégré a été refusée.', 'warning');
      return;
    }

    await executeAnalysisRun({
      ...deps,
      sourceTab: {
        ...sourceTab,
        analysisFrameIds: access.frameIds
      }
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
