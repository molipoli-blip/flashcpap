// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
import { logDebug, logError, logFlow, logWarn } from './debug-logger.js';
import { getCheckboxInputId } from './checkbox-orchestrator.js';
import { getActiveNormalTab } from './platform/active-tab.js';
import { browserApi } from './platform/browser-api.js';
import { getProviderConfig } from './domain/provider-rules.js';
import { applySplitSeparators } from './parsing.js';
import { t } from './i18n.js';

function ensureInterpretationPinned(settings, { bubbles = false } = {}) {
  if (!settings.pinnedOptions?.interpret) return;
  const interpretInput = document.getElementById('cb-interpret');
  if (!interpretInput || interpretInput.checked) return;
  interpretInput.checked = true;
  interpretInput.dispatchEvent(new Event('change', bubbles ? { bubbles: true } : undefined));
}

function syncPinnedCustomCheckboxes(siteKey, settings, { resetFirst = false, bubbles = false } = {}) {
  const customCheckboxes = settings.customCheckboxes?.[siteKey] || [];

  if (resetFirst) {
    customCheckboxes.forEach(checkbox => {
      const input = document.getElementById(getCheckboxInputId(checkbox.id));
      if (!input || !input.checked) return;
      input.checked = false;
      input.dispatchEvent(new Event('change', bubbles ? { bubbles: true } : undefined));
    });
  }

  customCheckboxes.forEach(checkbox => {
    if (!checkbox.pinned) return;
    const input = document.getElementById(getCheckboxInputId(checkbox.id));
    if (!input || input.checked) return;
    input.checked = true;
    input.dispatchEvent(new Event('change', bubbles ? { bubbles: true } : undefined));
  });
}

async function getActiveTabContext({ setLastAnalyzedUrl, getLastAnalyzedUrl }) {
  const tab = await getActiveNormalTab();
  const currentUrl = tab?.url || null;
  const isUrlChanged = currentUrl !== getLastAnalyzedUrl();

  setLastAnalyzedUrl(currentUrl);

  return {
    currentUrl,
    isUrlChanged
  };
}

function normalizePageTextResult(rawResult) {
  if (typeof rawResult === 'object' && rawResult !== null) {
    return {
      text: rawResult.text || '',
      isPdf: !!rawResult.isPdf
    };
  }

  return {
    text: rawResult || '',
    isPdf: false
  };
}

function prepareAnalysisText({
  text,
  isPdf,
  currentUrl,
  settings,
  detectProviderFromText,
  detectProviderFromUrl,
  refreshProviderUi,
  applySplitSeparators
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
      const cfg = getProviderConfig(settings, detectedProvider) || { fields: {} };
      const allSeparators = new Set();
      for (const def of Object.values(cfg.fields || {})) {
        for (const label of def.labels || []) {
          if (!label.splitSeparators?.length) continue;
          label.splitSeparators.forEach(separator => allSeparators.add(separator));
        }
      }
      if (allSeparators.size) {
        preparedText = applySplitSeparators(preparedText, Array.from(allSeparators));
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

async function loadExclusionKeywords(siteKey, settings) {
  try {
    const stored = await browserApi.storage.local.get({ exclusionList: [], exclusions: [] });
    const exclusions = Array.isArray(stored.exclusionList) && stored.exclusionList.length
      ? stored.exclusionList
      : (Array.isArray(stored.exclusions) ? stored.exclusions : []);
    const normalized = exclusions.filter(value => typeof value === 'string' && value.trim());
    if (normalized.length) return normalized;
  } catch {}

  try {
    const cfg = settings.patterns?.[siteKey] || { fields: {} };
    const accumulator = new Set();
    for (const def of Object.values(cfg.fields || {})) {
      for (const label of def.labels || []) {
        const excludeKeywords = (label.excludeKeywords || []).filter(Boolean);
        const labelExcludeKeywords = (label.labelExcludeKeywords || []).filter(Boolean);
        for (const keyword of [...excludeKeywords, ...labelExcludeKeywords]) {
          accumulator.add(String(keyword));
        }
      }
    }
    return Array.from(accumulator).filter(value => value && value.trim());
  } catch {
    return [];
  }
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

function resetAnalysisState(setLastAnalyzedUrl) {
  setLastAnalyzedUrl(null);

  const textarea = document.getElementById('résumé');
  if (textarea) textarea.value = '';

  const preview = document.getElementById('résumé-preview');
  if (preview) preview.replaceChildren();
}

function preAlignText(text, provider, settings) {
  try {
    const cfg = getProviderConfig(settings, provider) || { fields: {} };
    const allSeparators = new Set();
    for (const def of Object.values(cfg.fields || {})) {
      for (const label of def.labels || []) {
        if (label.splitSeparators?.length) label.splitSeparators.forEach(s => allSeparators.add(s));
      }
    }
    if (allSeparators.size) return applySplitSeparators(text, Array.from(allSeparators));
  } catch {}
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
    applyTupleExtraction({ provider, settings, sourceLines, data, matches });
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

  if (!settings.customCheckboxes) settings.customCheckboxes = {};
  syncPinnedCustomCheckboxes((provider || '').toLowerCase(), settings, { resetFirst: true, bubbles: true });

  try {
    ensureInterpretationPinned(settings, { bubbles: true });
  } catch {}

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

async function executeAnalysisRun({
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
  document.getElementById('analyse-alert').style.display = 'none';

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
    applySplitSeparators
  }).preparedText;

  const wrapper = document.getElementById('source-wrapper');
  const exclusions = await loadExclusionKeywords((providerSelect.value || '').toLowerCase(), settings);
  const { data } = runParsingPipeline({
    text,
    provider: providerSelect.value,
    settings,
    wrapper,
    exclusions,
    parseTextMeta,
    setupHighlighting
  });

  setLastParsedData(data, providerSelect.value);

  await finalizeAnalysisState({
    provider: providerSelect.value,
    settings,
    isUrlChanged,
    setPinningInProgress,
    updateSummaryDisplay
  });
}

function linkBadgePayloadIds(wrapper, groupToValueId) {
  try {
    const badges = wrapper.querySelectorAll('.hl-badge');
    let setCount = 0;
    badges.forEach(badge => {
      if (badge.hasAttribute('data-hl-id')) return;
      const group = badge.getAttribute('data-hl-group');
      if (!group) return;
      const valueId = groupToValueId.get(group);
      if (valueId === undefined) return;
      badge.setAttribute('data-hl-id', String(valueId));
      setCount++;
    });
    logDebug('BADGE', 'Post-pass liaison badges terminee', { total: badges.length, newlySet: setCount });
  } catch {}
}

function enrichLabelPayloads(wrapper, groupToValueId) {
  try {
    if (!Array.isArray(wrapper.__hlMap) || !wrapper.__hlMap.length) return;
    wrapper.__hlMap.forEach((payload, index) => {
      if (!payload || payload.kind !== 'label' || !payload.group) return;
      const valueId = groupToValueId.get(payload.group);
      if (valueId === undefined) return;
      const valuePayload = wrapper.__hlMap[valueId];
      if (!valuePayload) return;

      payload.valueId = valueId;
      payload.valueRaw = valuePayload.raw;
      payload.valueLine = valuePayload.line;
      payload.valueType = valuePayload.type;
      if (typeof valuePayload.tupleSize === 'number') payload.tupleSize = valuePayload.tupleSize;

      logDebug('LABEL', 'Label enrichi avec sa valeur associee', {
        index,
        group: payload.group,
        valueId,
        line: valuePayload.line,
        hasTupleSize: typeof valuePayload.tupleSize === 'number'
      });
    });
  } catch {}
}

function createSourceLineNumberCell({ lineNumber, annotations, wrapper, lineIndex }) {
  const numberCell = document.createElement('div');
  numberCell.className = 'src-ln';
  numberCell.textContent = lineNumber;

  if (annotations.length) {
    numberCell.classList.add('gutter-hit');
    numberCell.title = annotations.map(annotation => `${annotation.label} → ${annotation.raw}`).join(' | ');
    numberCell.addEventListener('click', () => {
      try {
        wrapper.children[lineIndex * 2 + 1]?.scrollIntoView({ block: 'center' });
      } catch {}
    });
  }

  return numberCell;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildExclusionRegexes(exclusions) {
  return (exclusions || [])
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(term => ({
      term,
      re: new RegExp(escapeRegExp(term).replace(/\s+/g, '[\\s\u00A0\u202F\u2009\t\-]+'), 'giu')
    }));
}

function createHighlightGroupIdResolver() {
  let nextGroupId = 1;
  return payload => {
    if (!payload) return `g${nextGroupId++}`;
    if (payload.__hlGroupLink && payload.__hlGroupLink.__hlGroupId) {
      payload.__hlGroupId = payload.__hlGroupLink.__hlGroupId;
      return payload.__hlGroupId;
    }
    if (!payload.__hlGroupId) payload.__hlGroupId = `g${nextGroupId++}`;
    if (payload.__hlGroupLink && !payload.__hlGroupLink.__hlGroupId) {
      payload.__hlGroupLink.__hlGroupId = payload.__hlGroupId;
    }
    return payload.__hlGroupId;
  };
}

function buildLabelToFieldsMap(byLine, ensureGroupId) {
  const map = new Map();
  const seenPerLabel = new Map();

  for (const annotations of byLine.values()) {
    for (const annotation of annotations) {
      if (!annotation || !annotation.labelText || !annotation.field) continue;
      const key = String(annotation.labelText).toLowerCase();
      let seen = seenPerLabel.get(key);
      if (!seen) {
        seen = new Set();
        seenPerLabel.set(key, seen);
      }
      if (seen.has(annotation.field)) continue;
      seen.add(annotation.field);
      const entries = map.get(key) || [];
      entries.push({ field: annotation.field, group: ensureGroupId(annotation) });
      map.set(key, entries);
    }
  }

  logDebug('LABELMAP', 'Map label vers fields construite', {
    labelCount: map.size,
    sampleLabels: [...map.keys()].slice(0, 5)
  });

  return map;
}

function buildGroupToVariantMap(labelToFields) {
  const groupMap = new Map();
  for (const [, entries] of labelToFields.entries()) {
    entries.forEach((entry, index) => {
      if (entry.group) groupMap.set(entry.group, index + 1);
    });
  }
  return groupMap;
}

function createHighlightRenderContext(byLine, exclusions) {
  const ensureGroupId = createHighlightGroupIdResolver();
  const labelToFields = buildLabelToFieldsMap(byLine, ensureGroupId);
  const groupToVariant = buildGroupToVariantMap(labelToFields);
  const groupToValueId = new Map();
  const exclusionRegexes = buildExclusionRegexes(exclusions);
  const getVariantIndex = (labelKey, field) => {
    const entries = labelToFields.get(labelKey) || [];
    const index = entries.findIndex(entry => entry.field === field);
    return index >= 0 ? index + 1 : 1;
  };

  return {
    ensureGroupId,
    labelToFields,
    groupToVariant,
    groupToValueId,
    exclusionRegexes,
    getVariantIndex
  };
}

function createHighlightElement(tagName, className, textContent, attributes = {}) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined && textContent !== null) element.textContent = String(textContent);
  Object.entries(attributes).forEach(([name, value]) => {
    if (value === undefined || value === null || value === '') return;
    element.setAttribute(name, String(value));
  });
  return element;
}

function getWrappableTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node?.textContent) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('sup.hl-badge')) return NodeFilter.FILTER_REJECT;
      if (parent.closest('.hl')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }
  return nodes;
}

function wrapTextMatches(root, pattern, createReplacement, { firstOnly = false } = {}) {
  const regex = pattern instanceof RegExp
    ? new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
    : new RegExp(escapeRegExp(pattern), 'gi');

  const matches = [];
  outer: for (const node of getWrappableTextNodes(root)) {
    let currentNode = node;
    while (currentNode?.parentNode) {
      const text = currentNode.textContent || '';
      regex.lastIndex = 0;
      const match = regex.exec(text);
      if (!match || !match[0]) break;

      const matchText = match[0];
      const start = match.index;
      const middleNode = currentNode.splitText(start);
      const tailNode = middleNode.splitText(matchText.length);
      const replacement = createReplacement(matchText, { match });
      middleNode.parentNode.replaceChild(replacement, middleNode);
      matches.push(matchText);
      currentNode = tailNode;

      if (firstOnly) break outer;
    }
  }

  return matches;
}

function createLabelBadgeCluster({ globalFieldEntries, localGroups, groupToValueId }) {
  const fragment = document.createDocumentFragment();
  globalFieldEntries.forEach((entry, index) => {
    const variantIndex = index + 1;
    const targetGroup = localGroups.get(entry.field) || entry.group;
    const valueId = groupToValueId.get(targetGroup);
    fragment.appendChild(createHighlightElement('sup', 'hl-badge', `(${variantIndex})`, {
      'data-hl-group': targetGroup,
      'data-hl-variant': variantIndex,
      'data-hl-field': entry.field,
      'data-hl-id': valueId,
      title: `${variantIndex}) ${entry.field}`,
      'aria-hidden': 'false'
    }));
  });
  return fragment;
}

function applyExclusionHighlights(lineDiv, exclusionRegexes, lineNumber, wrapper) {
  for (const { re, term } of exclusionRegexes) {
    wrapTextMatches(lineDiv, re, matchText => {
      const payload = { kind: 'exclusion', line: lineNumber, raw: matchText, term };
      let payloadId = -1;
      try { payloadId = wrapper.__hlMap.push(payload) - 1; } catch {}
      return createHighlightElement('span', 'hl hl-excl', matchText, {
        'data-hl-id': payloadId >= 0 ? payloadId : undefined,
        title: `Exclu: ${String(term).replace(/["<>]/g, '')}`
      });
    });
  }
}

function applyLabelHighlights({
  lineDiv,
  annotations,
  lineNumber,
  wrapper,
  ensureGroupId,
  colorClassFor,
  labelToFields,
  groupToValueId,
  getVariantIndex
}) {
  const labelAnnotations = annotations.filter(annotation => annotation && annotation.labelText && annotation.labelLine === lineNumber);
  logFlow('HL_LABEL', 'applyLabelHighlights', {
    lineNumber,
    totalAnnotations: annotations.length,
    labelAnnotationsCount: labelAnnotations.length,
    annotationSummary: annotations.map(a => ({ field: a.field, labelText: a.labelText, labelLine: a.labelLine, onlyLabel: a.onlyLabel }))
  });
  if (!labelAnnotations.length) return;

  const seen = new Set();
  for (const annotation of labelAnnotations) {
    const tokenKey = String(annotation.labelText || '').toLowerCase();
    if (!tokenKey || seen.has(tokenKey)) continue;
    seen.add(tokenKey);

    const groupId = ensureGroupId(annotation);
    const colorClass = colorClassFor(annotation);
    const variantIndex = getVariantIndex(tokenKey, annotation.field);
    const payload = {
      kind: 'label',
      line: lineNumber,
      raw: annotation.labelText,
      label: annotation.labelText,
      field: annotation.field,
      role: annotation.role,
      type: 'label',
      unit: '',
      group: groupId,
      labelText: annotation.labelText,
      labelRange: annotation.labelRange
    };

    let payloadId = -1;
    try { payloadId = wrapper.__hlMap.push(payload) - 1; } catch {}

    const globalFieldEntries = labelToFields.get(tokenKey) || [];
    const localGroups = new Map();
    for (const localAnnotation of labelAnnotations) {
      if (!localAnnotation) continue;
      if (String(localAnnotation.labelText || '').toLowerCase() !== tokenKey) continue;
      localGroups.set(localAnnotation.field, ensureGroupId(localAnnotation));
    }

    logDebug('LABEL', 'Mappings label prepares', {
      line: lineNumber,
      labelKey: tokenKey,
      localFieldCount: localGroups.size,
      globalFieldCount: globalFieldEntries.length
    });

    const allGroupsForLabel = new Set(globalFieldEntries.map(entry => entry.group));
    localGroups.forEach(group => allGroupsForLabel.add(group));
    const groupsCsv = Array.from(allGroupsForLabel).join(',');
    let isFirstOccurrence = true;

    const WORD = 'A-Za-z0-9_À-ÖØ-öø-ÿĀ-ſƀ-ɏ';
    const labelBoundaryRe = new RegExp(
      `(?:^|(?<=[^${WORD}]))${escapeRegExp(annotation.labelText)}(?=[^${WORD}]|$)`,
      'gi'
    );
    logFlow('HL_LABEL', 'wrapTextMatches label appele', {
      field: annotation.field,
      labelText: annotation.labelText,
      regexSource: labelBoundaryRe.source,
      lineDivText: lineDiv.textContent?.slice(0, 80)
    });
    wrapTextMatches(lineDiv, labelBoundaryRe, matchText => {
      const fragment = document.createDocumentFragment();
      fragment.appendChild(createHighlightElement(
        'span',
        isFirstOccurrence ? `hl hl-label ${colorClass}` : `hl hl-label-ghost ${colorClass}`,
        matchText,
        {
          'data-hl-id': payloadId >= 0 ? payloadId : undefined,
          'data-hl-group': groupId,
          'data-hl-groups': groupsCsv,
          'data-hl-variant': variantIndex,
          title: String(annotation.labelText || '').replace(/["<>]/g, '')
        }
      ));

      if (globalFieldEntries.length >= 2) {
        fragment.appendChild(createLabelBadgeCluster({
          globalFieldEntries,
          localGroups,
          groupToValueId
        }));
      }

      isFirstOccurrence = false;
      return fragment;
    });
  }
}

function createMaskedTupleFragment({
  text,
  maskedTuple,
  lineNumber,
  wrapper,
  ensureGroupId,
  colorClassFor,
  groupToVariant,
  groupToValueId,
  getVariantIndex
}) {
  const fragment = document.createDocumentFragment();
  const selected = Array.isArray(maskedTuple.selectedIndices) ? new Set(maskedTuple.selectedIndices) : new Set();
  const numRe = /\d+(?:[.,]\d+)?/g;
  const groupId = ensureGroupId(maskedTuple);
  const labelKey = String(maskedTuple.labelText || '').toLowerCase();
  let lastIndex = 0;
  let numericIndex = 0;
  let numericMatch = numRe.exec(text);

  while (numericMatch) {
    if (numericMatch.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, numericMatch.index)));
    }

    const rawValue = numericMatch[0];
    if (selected.has(numericIndex)) {
      const tupleRaw = maskedTuple.tupleRaw || text;
      const payload = {
        label: maskedTuple.label || maskedTuple.field,
        field: maskedTuple.field,
        role: (maskedTuple.role || '').toLowerCase(),
        type: maskedTuple.type || 'numeric',
        unit: maskedTuple.unit || '',
        line: lineNumber,
        raw: tupleRaw,
        sourceRaw: tupleRaw,
        tokenRaw: rawValue,
        labelText: maskedTuple.labelText,
        labelRange: maskedTuple.labelRange,
        group: groupId,
        tupleSize: typeof maskedTuple.size === 'number' ? maskedTuple.size : undefined
      };
      let payloadId = -1;
      try { payloadId = wrapper.__hlMap.push(payload) - 1; } catch {}
      const variantIndex = getVariantIndex(labelKey, maskedTuple.field);
      if (payloadId >= 0 && !groupToValueId.has(groupId)) {
        groupToValueId.set(groupId, payloadId);
        logDebug('G2VID', 'Mapping groupe vers valeur enregistre (masked tuple)', {
          group: groupId,
          payloadId,
          line: lineNumber
        });
      }

      fragment.appendChild(createHighlightElement('span', `hl ${colorClassFor(maskedTuple)}`, rawValue, {
        'data-hl-id': payloadId >= 0 ? payloadId : undefined,
        'data-hl-group': groupId,
        'data-hl-variant': variantIndex,
        title: String(payload.label || '').replace(/["<>]/g, '')
      }));
    } else {
      const payload = {
        kind: 'masked',
        line: lineNumber,
        raw: rawValue,
        field: maskedTuple.field,
        label: maskedTuple.label || maskedTuple.field,
        type: 'numeric',
        unit: '',
        labelText: maskedTuple.labelText,
        labelRange: maskedTuple.labelRange,
        group: groupId,
        tupleSize: typeof maskedTuple.size === 'number' ? maskedTuple.size : undefined
      };
      let payloadId = -1;
      try { payloadId = wrapper.__hlMap.push(payload) - 1; } catch {}
      const variantIndex = groupToVariant.get(groupId) || getVariantIndex(labelKey, maskedTuple.field);
      fragment.appendChild(createHighlightElement('span', 'hl hl-excl', rawValue, {
        'data-hl-id': payloadId >= 0 ? payloadId : undefined,
        'data-hl-group': groupId,
        'data-hl-variant': variantIndex,
        title: t('analysisMaskedBySelection')
      }));
    }

    lastIndex = numericMatch.index + rawValue.length;
    numericIndex += 1;
    numericMatch = numRe.exec(text);
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

function applyMaskedTupleHighlights({
  lineDiv,
  annotations,
  lineNumber,
  wrapper,
  ensureGroupId,
  colorClassFor,
  groupToVariant,
  groupToValueId,
  getVariantIndex
}) {
  const maskedTuples = annotations.filter(annotation => annotation && annotation.kind === 'masked-tuple' && annotation.tupleRaw);
  for (const maskedTuple of maskedTuples) {
    wrapTextMatches(lineDiv, maskedTuple.tupleRaw, matchText => createMaskedTupleFragment({
      text: matchText,
      maskedTuple,
      lineNumber,
      wrapper,
      ensureGroupId,
      colorClassFor,
      groupToVariant,
      groupToValueId,
      getVariantIndex
    }), { firstOnly: true });
  }
}

function buildValuePayload(annotation, lineNumber, groupId) {
  const payload = {
    label: annotation.label,
    field: annotation.field,
    role: annotation.role,
    type: annotation.type,
    unit: annotation.unit,
    line: annotation.line,
    raw: annotation.raw,
    sourceRaw: annotation.sourceRaw,
    labelText: annotation.labelText,
    labelRange: annotation.labelRange,
    group: groupId
  };

  try {
    if (typeof annotation.__tupleSize === 'number' && annotation.__tupleSize >= 2) payload.tupleSize = annotation.__tupleSize;
    else if (annotation.type !== 'text') {
      const numbers = String(annotation.raw || '').match(/\d+(?:[.,]\d+)?/g);
      if (numbers && numbers.length >= 2) payload.tupleSize = numbers.length;
    }
  } catch {}

  return payload;
}

function applyValueHighlights({ lineDiv, annotations, lineNumber, wrapper, colorClassFor, renderContext }) {
  const sorted = [...annotations].sort((left, right) => (right.raw?.length || 0) - (left.raw?.length || 0));
  for (const annotation of sorted) {
    if (!annotation?.raw || annotation.onlyLabel || annotation.kind === 'masked-tuple') continue;
    const matchText = annotation.sourceRaw || annotation.raw;
    if (!matchText) continue;

    const groupId = renderContext.ensureGroupId(annotation);
    const payload = buildValuePayload(annotation, lineNumber, groupId);
    const variantIndex = renderContext.groupToVariant.get(groupId)
      || renderContext.getVariantIndex(String(annotation.labelText || '').toLowerCase(), annotation.field);

    if (typeof payload.tupleSize === 'number' && payload.tupleSize >= 2) {
      wrapTextMatches(lineDiv, matchText, matchedText => createMaskedTupleFragment({
        text: matchedText,
        maskedTuple: {
          ...annotation,
          size: payload.tupleSize,
          tupleRaw: matchedText,
          selectedIndices: Array.from({ length: payload.tupleSize }, (_, index) => index),
          __hlGroupId: groupId
        },
        lineNumber,
        wrapper,
        ensureGroupId: renderContext.ensureGroupId,
        colorClassFor,
        groupToVariant: renderContext.groupToVariant,
        groupToValueId: renderContext.groupToValueId,
        getVariantIndex: renderContext.getVariantIndex
      }), { firstOnly: true });
      continue;
    }

    let payloadId = -1;
    try { payloadId = wrapper.__hlMap.push(payload) - 1; } catch { payloadId = -1; }

    if (payloadId >= 0 && !renderContext.groupToValueId.has(groupId)) {
      renderContext.groupToValueId.set(groupId, payloadId);
      logDebug('G2VID', 'Mapping groupe vers valeur enregistre', {
        group: groupId,
        payloadId,
        line: lineNumber,
        field: annotation.field
      });
    }

    const createValueSpan = (matchedText) => createHighlightElement('span', `hl ${colorClassFor(annotation)}`, matchedText, {
      'data-hl-id': payloadId >= 0 ? payloadId : undefined,
      'data-hl-group': groupId,
      'data-hl-variant': variantIndex,
      title: String(annotation.label || '').replace(/["<>]/g, '')
    });

    const wrapped = wrapTextMatches(lineDiv, matchText, createValueSpan, { firstOnly: true });

    // For text fields: if the full raw wasn't found (DOM may be split by other highlights),
    // try with just the first whitespace-delimited token of the value as a fallback.
    if (!wrapped.length && annotation.type === 'text' && matchText.includes(' ')) {
      const firstToken = matchText.split(/\s+/)[0].trim();
      if (firstToken) wrapTextMatches(lineDiv, firstToken, createValueSpan, { firstOnly: true });
    }
  }
}

function renderHighlightedSourceLine({
  line,
  lineNumber,
  annotations,
  wrapper,
  colorClassFor,
  renderContext
}) {
  wrapper.appendChild(createSourceLineNumberCell({
    lineNumber,
    annotations,
    wrapper,
    lineIndex: lineNumber - 1
  }));

  const lineDiv = document.createElement('div');
  lineDiv.className = 'src-text';
  lineDiv.textContent = line;

  if (renderContext.exclusionRegexes.length) {
    applyExclusionHighlights(lineDiv, renderContext.exclusionRegexes, lineNumber, wrapper);
  }

  if (annotations.length) {
    logDebug('RENDER', 'Annotations sur ligne', { line: lineNumber, annotationCount: annotations.length });
    applyLabelHighlights({
      lineDiv,
      annotations,
      lineNumber,
      wrapper,
      ensureGroupId: renderContext.ensureGroupId,
      colorClassFor,
      labelToFields: renderContext.labelToFields,
      groupToValueId: renderContext.groupToValueId,
      getVariantIndex: renderContext.getVariantIndex
    });
    applyMaskedTupleHighlights({
      lineDiv,
      annotations,
      lineNumber,
      wrapper,
      ensureGroupId: renderContext.ensureGroupId,
      colorClassFor,
      groupToVariant: renderContext.groupToVariant,
      groupToValueId: renderContext.groupToValueId,
      getVariantIndex: renderContext.getVariantIndex
    });
    applyValueHighlights({
      lineDiv,
      annotations,
      lineNumber,
      wrapper,
      colorClassFor,
      renderContext
    });
  }

  wrapper.appendChild(lineDiv);
}

function applyTupleExtraction({ provider, settings, sourceLines, data, matches }) {
  const cfg = getProviderConfig(settings, provider) || { fields: {} };
  if (!cfg.fields || !Array.isArray(matches)) return;

  const parseMaskToIndices = (mask, size) => {
    if (!mask) return Array.from({ length: size }, (_, index) => index);
    const trimmedMask = String(mask).trim();
    if (!trimmedMask) return Array.from({ length: size }, (_, index) => index);
    if (/^\d+(\s*,\s*\d+)*$/.test(trimmedMask)) {
      const indices = trimmedMask
        .split(',')
        .map(value => parseInt(value.trim(), 10) - 1)
        .filter(index => index >= 0 && index < size);
      return indices.length ? indices : Array.from({ length: size }, (_, index) => index);
    }
    const tokens = trimmedMask.split(/\s+/).filter(Boolean);
    const output = [];
    for (let index = 0; index < Math.min(tokens.length, size); index += 1) {
      if (/^(x|X|1|✔)$/.test(tokens[index])) output.push(index);
    }
    return output.length ? output : Array.from({ length: size }, (_, index) => index);
  };

  const buildTupleRawFromLine = (lineText, tupleSize) => {
    const matchesOnLine = Array.from(String(lineText || '').matchAll(/\d+(?:[.,]\d+)?/g));
    if (matchesOnLine.length < tupleSize || tupleSize < 2) return null;
    const slice = matchesOnLine.slice(0, tupleSize);
    const start = slice[0].index ?? 0;
    const last = slice[slice.length - 1];
    const end = (last.index ?? 0) + String(last[0] || '').length;
    return String(lineText || '').slice(start, end);
  };

  matches.slice().forEach(match => {
    if (!match?.field || typeof match.line !== 'number') return;
    const definition = cfg.fields?.[match.field];
    const tupleConfig = definition?.tupleExtraction;
    if (!tupleConfig || typeof tupleConfig.size !== 'number' || tupleConfig.size < 2) return;

    const lineText = sourceLines[match.line - 1] || '';
    const tupleRaw = buildTupleRawFromLine(lineText, tupleConfig.size);
    match.__tupleSize = tupleConfig.size;

    if (!tupleRaw) return;

    const selectedIndices = parseMaskToIndices(tupleConfig.mask, tupleConfig.size);
    if (selectedIndices.length >= tupleConfig.size) return;

    matches.push({
      ...match,
      kind: 'masked-tuple',
      tupleRaw,
      size: tupleConfig.size,
      selectedIndices,
      __hlGroupLink: match
    });
  });
}

function renderSourceWithHighlights(sourceLines, byLine, wrapper, colorClassFor, exclusions) {
  const renderContext = createHighlightRenderContext(byLine, exclusions);

  sourceLines.forEach((line, index) => {
    renderHighlightedSourceLine({
      line,
      lineNumber: index + 1,
      annotations: byLine.get(index + 1) || [],
      wrapper,
      colorClassFor,
      renderContext
    });
  });

  linkBadgePayloadIds(wrapper, renderContext.groupToValueId);
  enrichLabelPayloads(wrapper, renderContext.groupToValueId);
}

function setupJumpSelect(matches, wrapper) {
  const jump = document.getElementById('jump-select');
  if (!jump) return;

  jump.replaceChildren();
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = t('jumpSelectPlaceholderShort');
  jump.appendChild(placeholderOption);
  matches.forEach((match, index) => {
    if (match && match.kind === 'masked-tuple') return;
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${match.label || match.field} (L${match.line})`;
    jump.appendChild(option);
  });

  const collapsible = document.getElementById('source-collapsible');
  const open = collapsible?.classList.contains('open');
  jump.style.display = matches.length && open ? 'inline-block' : 'none';
  jump.onchange = () => {
    const value = jump.value;
    if (!value) return;
    const match = matches[parseInt(value, 10)];
    if (!match) return;

    const cell = wrapper.children[(match.line - 1) * 2 + 1];
    if (cell) {
      const previousLeft = wrapper.scrollLeft;
      try { cell.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {}
      wrapper.scrollLeft = previousLeft;
    }

    const lineCell = wrapper.children[(match.line - 1) * 2 + 1];
    if (lineCell) {
      const span = lineCell.querySelector('[data-hl-id]');
      if (span && Array.isArray(wrapper.__hlMap)) {
        span.click();
      }
    }
  };
}

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
