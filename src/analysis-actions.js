// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { executeAnalysisRun, resetAnalysisState } from './analysis-runner.js';

function bindResetAnalysisButton(button, setLastAnalyzedUrl) {
  if (!button) return;
  button.onclick = () => {
    resetAnalysisState(setLastAnalyzedUrl);
  };
}

function bindAnalyseButton(button, deps) {
  if (!button) return;
  button.onclick = async () => {
    await executeAnalysisRun(deps);
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
