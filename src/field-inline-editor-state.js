import { alertInline } from './ui-utils.js';
import { getFieldDisplayName } from './field-card-view.js';

export function getInlineEditorInitialState(fieldKey, definition) {
  const isNumeric = definition.type === 'numeric';
  const isTime = definition.type === 'time';
  const tupleInit = definition.tupleExtraction || null;
  const timeFormatInit = definition.timeFormat || null;
  const firstLabel = Array.isArray(definition.labels) && definition.labels[0] ? definition.labels[0] : null;
  const allLabels = Array.isArray(definition.labels) && definition.labels.length > 0
    ? definition.labels
    : [];

  return {
    isNumeric,
    isTime,
    nameInitial: getFieldDisplayName(fieldKey, definition),
    unitInitial: isNumeric ? (definition.unit || '') : '',
    suffixInitial: definition.suffix,
    roleInitial: definition.role || '',
    tupleInit,
    tupleSizeInit: (tupleInit && typeof tupleInit.size === 'number' && tupleInit.size >= 1 && tupleInit.size <= 7) ? tupleInit.size : 1,
    tupleMaskInit: tupleInit?.mask || '',
    timeFormatInit,
    timeRawInit: timeFormatInit?.raw || '',
    timeDisplayInit: timeFormatInit?.display || '',
    firstLabel,
    allLabels,
    lblTextInit: firstLabel?.text || '',
    lblStartInit: firstLabel?.range?.start ?? 1,
    lblEndInit: firstLabel?.range?.end ?? 999,
    lblLabelExclInit: (firstLabel?.labelExcludeKeywords || []).join(','),
    lblExcludeInit: (firstLabel?.excludeKeywords || []).join(','),
    lblPriorityInit: (firstLabel?.priorityKeywords || []).join(',')
  };
}

export function buildTupleMaskTokens(size) {
  const count = parseInt(size, 10);
  if (!count || count < 1 || count > 7) return [];
  if (count === 1) return ['X'];
  if (count === 7) return ['X X X X X X X'];

  const tokens = [];
  const max = 1 << count;
  for (let mask = 1; mask < max; mask += 1) {
    const parts = [];
    for (let index = 0; index < count; index += 1) {
      parts.push(((mask >> (count - 1 - index)) & 1) ? 'X' : '*');
    }
    tokens.push(parts.join(' '));
  }
  return tokens;
}

export function replaceSelectOptions(selectElement, options, selectedValue, placeholderLabel = '-- Choisir --') {
  if (!selectElement) return;

  selectElement.replaceChildren();
  if (placeholderLabel) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = placeholderLabel;
    selectElement.appendChild(placeholder);
  }

  options.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === selectedValue) option.selected = true;
    selectElement.appendChild(option);
  });
}

export function getTimeFormatOptionsByTupleCount(xCount) {
  const rawFormats = {
    1: [
      { value: 'H', label: 'H (heures)' },
      { value: 'M', label: 'M (minutes)' }
    ],
    2: [
      { value: 'H M', label: 'H M (heures minutes)' },
      { value: 'DD MM', label: 'DD MM (jour mois)' }
    ],
    3: [
      { value: 'DD MM YYYY', label: 'DD MM YYYY (date complète)' },
      { value: 'H M S', label: 'H M S (heures minutes secondes)' }
    ],
    4: [
      { value: 'DD MM YYYY H', label: 'DD MM YYYY H (date + heure)' }
    ],
    5: [
      { value: 'DD MM YYYY H M', label: 'DD MM YYYY H M (date + heure:min)' }
    ]
  };

  const displayFormats = {
    1: [
      { value: 'H', label: 'H (4)' },
      { value: 'Hh', label: 'Hh (4h)' }
    ],
    2: [
      { value: 'HhMMm', label: 'HhMMm (4h30m)' },
      { value: 'H:MM', label: 'H:MM (4:30)' },
      { value: 'h (convertir)', label: 'h (convertir) (4.5)' },
      { value: 'min (convertir)', label: 'min (convertir) (270)' },
      { value: 'DD/MM', label: 'DD/MM (12/01)' }
    ],
    3: [
      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (12/01/1988)' },
      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (01/12/1988)' },
      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (1988-01-12)' },
      { value: 'HhMMmSSs', label: 'HhMMmSSs (4h30m45s)' },
      { value: 'h (convertir)', label: 'h (convertir) (4.75)' },
      { value: 'min (convertir)', label: 'min (convertir) (285)' }
    ],
    4: [
      { value: 'DD/MM/YYYY HH', label: 'DD/MM/YYYY HH (12/01/1988 14)' }
    ],
    5: [
      { value: 'DD/MM/YYYY HH:MM', label: 'DD/MM/YYYY HH:MM (12/01/1988 14:30)' },
      { value: 'YYYY-MM-DD HH:MM', label: 'YYYY-MM-DD HH:MM (1988-01-12 14:30)' }
    ]
  };

  return {
    rawOptions: rawFormats[xCount] || [],
    displayOptions: displayFormats[xCount] || []
  };
}

export function readInlineEditorFormState(contentWrap, fieldKey) {
  const safeFieldKey = CSS.escape(fieldKey);
  const nameElement = contentWrap.querySelector(`#add-field-name-${safeFieldKey}`);
  const firstSubCard = contentWrap.querySelector(`#add-labels-list-${safeFieldKey} > .label-subcard`);
  const typeElement = contentWrap.querySelector(`input[name="add-field-type-${safeFieldKey}"]:checked`);
  const unitElement = firstSubCard ? firstSubCard.querySelector('.label-subcard-unit') : null;
  const suffixElement = contentWrap.querySelector(`#add-field-suffix-${safeFieldKey}`);
  const roleElement = contentWrap.querySelector(`#add-field-role-${safeFieldKey}`);
  const isNumeric = typeElement?.value === 'numeric';
  const isTime = typeElement?.value === 'time';
  let suffixWanted = suffixElement ? suffixElement.value : undefined;
  if (suffixWanted === '__DEFAULT__') suffixWanted = undefined;

  const tupleSize = (firstSubCard?.querySelector(`#add-field-tuple-size-${safeFieldKey}-0`)?.value || '').trim();
  const tupleMask = (firstSubCard?.querySelector(`#add-field-tuple-mask-${safeFieldKey}-0`)?.value || '').trim();
  const tupleSelectedCount = (tupleMask.match(/X/g) || []).length;
  const tupleConnectors = [];
  for (let index = 0; index < tupleSelectedCount; index += 1) {
    const connectorElement = firstSubCard?.querySelector(`#add-field-tuple-connector-${safeFieldKey}-0-${index}`);
    tupleConnectors.push(connectorElement?.value || '');
  }

  const labelsList = contentWrap.querySelector(`#add-labels-list-${safeFieldKey}`);
  const subCards = labelsList ? Array.from(labelsList.querySelectorAll(':scope > .label-subcard')) : [];
  const labelsData = subCards.map((card) => {
    const idx = card.dataset.subcardIndex;
    const text = (card.querySelector('.label-subcard-keyword')?.value || '').trim();
    const start = parseInt(card.querySelector('.label-subcard-start')?.value || '1', 10) || 1;
    const end = parseInt(card.querySelector('.label-subcard-end')?.value || '999', 10) || 999;
    const labelExclude = (card.querySelector('.label-subcard-label-excl')?.value || '').trim();
    const contentExclude = (card.querySelector('.label-subcard-content-excl')?.value || '').trim();
    const priorityKeywords = (card.querySelector('.label-subcard-priority')?.value || '').trim();
    const splitSepsStr = (card.querySelector('.label-subcard-split-seps')?.value || '').trim();
    const splitSeparators = splitSepsStr ? splitSepsStr.split(',').map((v) => v.trim()).filter(Boolean) : [];
    const extractionMode = card.querySelector(`input[name="extraction-mode-${safeFieldKey}-${idx}"]:checked`)?.value || 'auto';
    const requireInline = extractionMode === 'inline';
    const requireNextLine = extractionMode === 'nextline';
    const nextLineMinEl = card.querySelector(`#add-label-nextline-min-${safeFieldKey}-${idx}`);
    const nextLineMaxEl = card.querySelector(`#add-label-nextline-max-${safeFieldKey}-${idx}`);
    const nextLineMin = parseInt(nextLineMinEl?.value || '1', 10);
    const nextLineMax = parseInt(nextLineMaxEl?.value || '3', 10);
    const nextLineRange = requireNextLine && !isNaN(nextLineMin) && !isNaN(nextLineMax) ? [nextLineMin, nextLineMax] : undefined;
    return { text, start, end, labelExclude, contentExclude, priorityKeywords, splitSeparators, requireInline, requireNextLine, nextLineRange };
  });
  const labelText = labelsData[0]?.text || '';
  const extractionMode = labelsData[0] ? (labelsData[0].requireInline ? 'inline' : labelsData[0].requireNextLine ? 'nextline' : 'auto') : 'auto';

  return {
    labelWanted: nameElement?.value || '',
    isNumeric,
    isTime,
    typeWanted: isTime ? 'time' : (isNumeric ? 'numeric' : 'text'),
    unitWanted: isNumeric ? ((unitElement?.value || '').trim()) : '',
    suffixWanted,
    tupleSize,
    tupleMask,
    tupleConnectors,
    timeRaw: firstSubCard?.querySelector(`#add-field-time-raw-${safeFieldKey}-0`)?.value || '',
    timeDisplay: firstSubCard?.querySelector(`#add-field-time-display-${safeFieldKey}-0`)?.value || '',
    roleWanted: (roleElement?.value || '').trim(),
    labelsData,
    labelText,
    extractionMode,
    requireInline: extractionMode === 'inline',
    requireNextLine: extractionMode === 'nextline'
  };
}

function buildInlineTupleExtraction(state) {
  if ((!state.isNumeric && !state.isTime) || !state.tupleSize) return null;

  const size = parseInt(state.tupleSize, 10);
  if (size < 1 || size > 7) return null;

  return {
    size,
    ...(state.tupleMask ? { mask: state.tupleMask } : {}),
    ...(state.tupleConnectors.some((value) => value) ? { connectors: state.tupleConnectors } : {})
  };
}

function buildInlineTimeFormat(state) {
  if (!state.isTime || !state.timeRaw || !state.timeDisplay) return null;
  return {
    raw: state.timeRaw,
    display: state.timeDisplay
  };
}

export function buildInlineLabels(fieldKey, state, { silent = false } = {}) {
  const labelsData = state.labelsData || [];
  const filtered = labelsData.filter((d) => d.text);

  if (filtered.length === 0) {
    console.log(`[FIELD-MGMT][WARNING] Champ "${fieldKey}" : aucun mot-clé défini.`);
    if (!silent && state.extractionMode && state.extractionMode !== 'auto') {
      alertInline(
        `Le mode d'extraction nécessite de définir au moins un "Mot-clé d'ancrage".`,
        'warning'
      );
    }
    return [];
  }

  const labels = filtered.map((d) => {
    const label = {
      text: d.text,
      range: { start: d.start, end: d.end },
      labelExcludeKeywords: d.labelExclude ? d.labelExclude.split(',').map((v) => v.trim()).filter(Boolean) : [],
      excludeKeywords: d.contentExclude ? d.contentExclude.split(',').map((v) => v.trim()).filter(Boolean) : [],
      priorityKeywords: d.priorityKeywords ? d.priorityKeywords.split(',').map((v) => v.trim()).filter(Boolean) : [],
      ...(d.splitSeparators && d.splitSeparators.length > 0 ? { splitSeparators: d.splitSeparators } : {})
    };
    if (d.requireInline) label.requireInline = true;
    if (d.requireNextLine) {
      label.requireNextLine = true;
      if (d.nextLineRange) label.nextLineRange = d.nextLineRange;
    }
    return label;
  });

  console.log(`[FIELD-MGMT][LABELS] Labels créés pour "${fieldKey}":`, labels);
  return labels;
}

// Alias de compatibilité
export function buildInlineFirstLabel(fieldKey, state) {
  const labels = buildInlineLabels(fieldKey, state);
  return labels.length > 0 ? labels[0] : null;
}

export function applyInlineFieldChanges(definition, state, firstLabelWanted) {
  definition.label = state.labelWanted;
  definition.type = state.typeWanted;
  definition.unit = state.unitWanted;

  if (state.suffixWanted !== undefined) definition.suffix = state.suffixWanted;
  else delete definition.suffix;

  const tupleWanted = buildInlineTupleExtraction(state);
  if (tupleWanted) definition.tupleExtraction = tupleWanted;
  else delete definition.tupleExtraction;

  const timeFormatWanted = buildInlineTimeFormat(state);
  if (timeFormatWanted) definition.timeFormat = timeFormatWanted;
  else delete definition.timeFormat;

  if (state.roleWanted) definition.role = state.roleWanted;
  else delete definition.role;

  definition.labels = Array.isArray(firstLabelWanted) ? firstLabelWanted : (firstLabelWanted ? [firstLabelWanted] : []);
}