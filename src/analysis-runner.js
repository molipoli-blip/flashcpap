// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { logError, logFlow, logWarn } from './debug-logger.js';
import { getCheckboxInputId } from './checkbox-orchestrator.js';
import { browserApi } from './platform/browser-api.js';
import { getProviderConfig } from './domain/provider-rules.js';
import { applySplitSeparators } from './parsing.js';
import { applyTupleExtraction } from './analysis-tuples.js';
import { safeRun } from './error-handling.js';
import { ensureSettingsObject } from './storage-guards.js';
import { getActiveTabContext, normalizePageTextResult } from './analysis-flow-utils.js';
import { renderSourceWithHighlights, setupJumpSelect } from './analysis-highlight-renderer.js';

function setCheckedState(input, checked, { bubbles = false } = {}) {
  if (!input || input.checked === checked) return false;
  input.checked = checked;
  input.dispatchEvent(new Event('change', bubbles ? { bubbles: true } : undefined));
  return true;
}

function collectProviderSplitSeparators(settings, provider) {
  const cfg = getProviderConfig(settings, provider) || { fields: {} };
  const allSeparators = new Set();

  for (const def of Object.values(cfg.fields || {})) {
    for (const label of def.labels || []) {
      if (!label.splitSeparators?.length) continue;
      label.splitSeparators.forEach(separator => allSeparators.add(separator));
    }
  }

  return Array.from(allSeparators);
}

function ensureInterpretationPinned(settings, { bubbles = false } = {}) {
  if (!settings.pinnedOptions?.interpret) return;
  const interpretInput = document.getElementById('cb-interpret');
  setCheckedState(interpretInput, true, { bubbles });
}

function syncPinnedCustomCheckboxes(siteKey, settings, { resetFirst = false, bubbles = false } = {}) {
  const customCheckboxes = settings.customCheckboxes?.[siteKey] || [];

  if (resetFirst) {
    customCheckboxes.forEach(checkbox => {
      const input = document.getElementById(getCheckboxInputId(checkbox.id));
      setCheckedState(input, false, { bubbles });
    });
  }

  customCheckboxes.forEach(checkbox => {
    if (!checkbox.pinned) return;
    const input = document.getElementById(getCheckboxInputId(checkbox.id));
    setCheckedState(input, true, { bubbles });
  });
}

function prepareAnalysisText({
  text,
  isPdf,
  currentUrl,
  settings,
  detectProviderFromText,
  detectProviderFromUrl,
  refreshProviderUi,
  applySplitSeparatorsFn
}) {
  let preparedText = text;
  let detectedProvider = null;

  if (isPdf) detectedProvider = detectProviderFromText(preparedText);
  if (!detectedProvider && settings.autoLockUrl) {
    detectedProvider = detectProviderFromUrl(currentUrl || '', settings);
  }

  if (detectedProvider) {
    refreshProviderUi(detectedProvider);

    try {
      const separators = collectProviderSplitSeparators(settings, detectedProvider);
      if (separators.length) {
        preparedText = applySplitSeparatorsFn(preparedText, separators);
      }
    } catch (error) {
      logError('MAIN', 'Erreur application separateurs globaux', error);
    }
  }

  return {
    preparedText,
    detectedProvider
  };
}

async function loadExclusionKeywords() {
  try {
    const stored = await browserApi.storage.local.get({ exclusionList: [], exclusions: [] });
    const exclusions = Array.isArray(stored.exclusionList) && stored.exclusionList.length
      ? stored.exclusionList
      : (Array.isArray(stored.exclusions) ? stored.exclusions : []);
    const normalized = exclusions.filter(value => typeof value === 'string' && value.trim());
    if (normalized.length) return normalized;
  } catch (error) {
    logWarn('ANALYSE', 'Impossible de lire les exclusions globales', error);
  }

  // Keep masking scoped to explicit global exclusions only.
  // Field-level exclusions are handled during parsing per label/field.
  return [];
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskExclusions(input, exclusions) {
  if (!input || !Array.isArray(exclusions) || !exclusions.length) return input || '';
  let output = String(input);

  for (const raw of exclusions) {
    const term = String(raw || '').trim();
    if (!term) continue;
    const flexible = escapeRegExp(term).replace(/\s+/g, '[\\s\u00A0\u202F\u2009\t\-]+');
    const re = new RegExp(flexible, 'giu');
    output = output.replace(re, match => ' '.repeat(match.length));
  }

  return output;
}

function addSeparatorMatches(sourceLines, matches) {
  sourceLines.forEach((lineContent, index) => {
    if (!lineContent.includes('✂')) return;
    matches.push({
      line: index + 1,
      raw: '✂',
      role: 'separator',
      kind: 'separator',
      field: 'separator',
      label: 'Sép.',
      valueRaw: '✂'
    });
  });
}

function pushToLine(map, line, item) {
  if (!map.has(line)) map.set(line, []);
  map.get(line).push(item);
}

function buildMatchesByLine(matches) {
  const byLine = new Map();

  for (const match of matches) {
    pushToLine(byLine, match.line, match);
    logFlow('HL_LABEL', 'buildMatchesByLine: match enregistre', {
      field: match.field, line: match.line, labelLine: match.labelLine,
      labelText: match.labelText, hasLabelText: !!match.labelText
    });

    if (match.labelText && match.labelLine && match.labelLine !== match.line) {
      const shadow = {
        ...match,
        line: match.labelLine,
        onlyLabel: true,
        kind: (match.kind || 'value') + ':label-shadow',
        __hlGroupLink: match
      };
      pushToLine(byLine, shadow.line, shadow);
      logFlow('HL_LABEL', 'buildMatchesByLine: shadow cree', { field: match.field, shadowLine: match.labelLine });
    } else if (match.labelText && match.labelLine && match.labelLine === match.line) {
      logFlow('HL_LABEL', 'buildMatchesByLine: label inline (meme ligne, pas de shadow)', { field: match.field, line: match.line });
    } else {
      logFlow('HL_LABEL', 'buildMatchesByLine: pas de shadow (labelText ou labelLine manquant)', { field: match.field, labelText: match.labelText, labelLine: match.labelLine });
    }
  }

  return byLine;
}

export function resetAnalysisState(setLastAnalyzedUrl) {
  setLastAnalyzedUrl(null);

  const textarea = document.getElementById('résumé');
  if (textarea) textarea.value = '';

  const preview = document.getElementById('résumé-preview');
  if (preview) preview.replaceChildren();
}

function preAlignText(text, provider, settings) {
  try {
    const separators = collectProviderSplitSeparators(settings, provider);
    if (separators.length) return applySplitSeparators(text, separators);
  } catch (error) {
    logWarn('ANALYSE', 'Pre-alignement des separateurs impossible', error);
  }
  return text;
}

function runParsingPipeline({
  text,
  provider,
  settings,
  wrapper,
  exclusions,
  parseTextMeta,
  setupHighlighting
}) {
  const alignedText = preAlignText(text, provider, settings);
  const sourceLines = alignedText.split(/\r?\n/);
  wrapper.replaceChildren();

  const maskedText = maskExclusions(alignedText, exclusions);
  const { data, matches } = parseTextMeta(maskedText, provider, settings);

  addSeparatorMatches(sourceLines, matches);

  try {
    applyTupleExtraction({ provider, settings, sourceLines, matches });
  } catch (error) {
    logWarn('ANALYSE', 'Post-processing tuples en echec', error);
  }

  const byLine = buildMatchesByLine(matches);
  wrapper.__hlMap = [];

  const { colorClassFor } = setupHighlighting(wrapper, matches);
  renderSourceWithHighlights(sourceLines, byLine, wrapper, colorClassFor, exclusions);
  setupJumpSelect(matches, wrapper);

  return { data };
}

async function finalizeAnalysisState({
  provider,
  settings,
  isUrlChanged,
  setPinningInProgress,
  updateSummaryDisplay
}) {
  setPinningInProgress(true);

  ensureSettingsObject(settings, 'customCheckboxes');
  syncPinnedCustomCheckboxes((provider || '').toLowerCase(), settings, { resetFirst: true, bubbles: true });

  safeRun(() => ensureInterpretationPinned(settings, { bubbles: true }), { context: 'ANALYSIS_INTERPRET_PIN' });

  if (isUrlChanged) {
    const textarea = document.getElementById('résumé');
    if (textarea) textarea.value = '';
  }

  setPinningInProgress(false);
  try {
    await updateSummaryDisplay();
  } catch (error) {
    logWarn('ANALYSE', 'Erreur updateSummaryDisplay apres pinning', error);
  }
}

export async function executeAnalysisRun({
  providerSelect,
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
  const providerValue = providerSelect?.value || '';
  if (!providerValue) {
    logWarn('ANALYSE', 'Analyse ignoree: prestataire absent');
    return;
  }

  const analyseAlert = document.getElementById('analyse-alert');
  if (analyseAlert) analyseAlert.style.display = 'none';

  const { currentUrl, isUrlChanged } = await getActiveTabContext({
    setLastAnalyzedUrl,
    getLastAnalyzedUrl
  });

  const rawResult = await getPageText();
  let { text, isPdf } = normalizePageTextResult(rawResult);

  text = prepareAnalysisText({
    text,
    isPdf,
    currentUrl,
    settings,
    detectProviderFromText,
    detectProviderFromUrl,
    refreshProviderUi,
    applySplitSeparatorsFn: applySplitSeparators
  }).preparedText;

  const wrapper = document.getElementById('source-wrapper');
  if (!wrapper) {
    logWarn('ANALYSE', 'Analyse interrompue: #source-wrapper introuvable');
    return;
  }

  const exclusions = await loadExclusionKeywords();
  const { data } = runParsingPipeline({
    text,
    provider: providerValue,
    settings,
    wrapper,
    exclusions,
    parseTextMeta,
    setupHighlighting
  });

  setLastParsedData(data, providerValue);

  await finalizeAnalysisState({
    provider: providerValue,
    settings,
    isUrlChanged,
    setPinningInProgress,
    updateSummaryDisplay
  });
}
