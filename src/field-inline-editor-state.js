import { alertInline } from './ui-utils.js';
import { getFieldDisplayName } from './field-card-view.js';

export function getInlineEditorInitialState(fieldKey, definition) {
  const isNumeric = definition.type === 'numeric';
  const isTime = definition.type === 'time';
  const tupleInit = definition.tupleExtraction || null;
  const timeFormatInit = definition.timeFormat || null;
  const firstLabel = Array.isArray(definition.labels) && definition.labels[0] ? definition.labels[0] : null;

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
  const typeElement = contentWrap.querySelector(`input[name="add-field-type-${safeFieldKey}"]:checked`);
  const unitElement = contentWrap.querySelector(`#add-field-unit-${safeFieldKey}`);
  const suffixElement = contentWrap.querySelector(`#add-field-suffix-${safeFieldKey}`);
  const roleElement = contentWrap.querySelector(`#add-field-role-${safeFieldKey}`);

  const isNumeric = typeElement?.value === 'numeric';
  const isTime = typeElement?.value === 'time';
  let suffixWanted = suffixElement ? suffixElement.value : undefined;
  if (suffixWanted === '__DEFAULT__') suffixWanted = undefined;

  const tupleSize = (contentWrap.querySelector(`#add-field-tuple-size-${safeFieldKey}`)?.value || '').trim();
  const tupleMask = (contentWrap.querySelector(`#add-field-tuple-mask-${safeFieldKey}`)?.value || '').trim();
  const tupleSelectedCount = (tupleMask.match(/X/g) || []).length;
  const tupleConnectors = [];
  for (let index = 0; index < tupleSelectedCount; index += 1) {
    const connectorElement = contentWrap.querySelector(`#add-field-tuple-connector-${safeFieldKey}-${index}`);
    tupleConnectors.push(connectorElement?.value || '');
  }

  const labelText = (contentWrap.querySelector(`#add-label-text-${safeFieldKey}`)?.value || '').trim();
  const labelStart = parseInt(contentWrap.querySelector(`#add-label-start-${safeFieldKey}`)?.value || '1', 10) || 1;
  const labelEnd = parseInt(contentWrap.querySelector(`#add-label-end-${safeFieldKey}`)?.value || '999', 10) || 999;
  const labelExclude = (contentWrap.querySelector(`#add-label-label-exclude-${safeFieldKey}`)?.value || '').trim();
  const contentExclude = (contentWrap.querySelector(`#add-label-exclude-${safeFieldKey}`)?.value || '').trim();
  const priorityKeywords = (contentWrap.querySelector(`#add-label-priority-${safeFieldKey}`)?.value || '').trim();
  const splitSeparatorsStr = (contentWrap.querySelector(`#add-label-split-separators-${safeFieldKey}`)?.value || '').trim();
  const splitSeparators = splitSeparatorsStr
    ? splitSeparatorsStr.split(',').map((value) => value.trim()).filter(Boolean)
    : [];

  const extractionMode = contentWrap.querySelector(`input[name="extraction-mode-${safeFieldKey}"]:checked`)?.value || 'auto';
  const requireInline = extractionMode === 'inline';
  const requireNextLine = extractionMode === 'nextline';
  const nextLineMin = parseInt(contentWrap.querySelector(`#add-label-nextline-min-${safeFieldKey}`)?.value || '1', 10);
  const nextLineMax = parseInt(contentWrap.querySelector(`#add-label-nextline-max-${safeFieldKey}`)?.value || '3', 10);
  const nextLineRange = requireNextLine && !isNaN(nextLineMin) && !isNaN(nextLineMax)
    ? [nextLineMin, nextLineMax]
    : undefined;

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
    timeRaw: contentWrap.querySelector(`#add-field-time-raw-${safeFieldKey}`)?.value || '',
    timeDisplay: contentWrap.querySelector(`#add-field-time-display-${safeFieldKey}`)?.value || '',
    roleWanted: (roleElement?.value || '').trim(),
    labelText,
    labelStart,
    labelEnd,
    labelExclude,
    contentExclude,
    priorityKeywords,
    splitSeparators,
    extractionMode,
    requireInline,
    requireNextLine,
    nextLineRange
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

export function buildInlineFirstLabel(fieldKey, state) {
  console.log(`[FIELD-MGMT][SUBMIT] Champ "${fieldKey}":`, {
    labelText: state.labelText,
    extractionMode: state.extractionMode,
    requireInline: state.requireInline,
    requireNextLine: state.requireNextLine,
    nextLineRange: state.nextLineRange,
    splitSeparators: state.splitSeparators,
    typeWanted: state.typeWanted,
    unitWanted: state.unitWanted,
    roleWanted: state.roleWanted
  });

  if (!state.labelText) {
    console.log(`[FIELD-MGMT][WARNING] Champ "${fieldKey}" : labelText est vide, le label ne sera pas créé, donc les flags requireInline/requireNextLine seront ignorés.`);
    if (state.extractionMode !== 'auto') {
      alertInline(
        `Le mode d'extraction "${state.extractionMode === 'inline' ? 'Ligne du label uniquement' : 'Lignes suivantes uniquement'}" nécessite de définir un "Mot-clé d'ancrage".`,
        'warning'
      );
    }
    return null;
  }

  const firstLabelWanted = {
    text: state.labelText,
    range: { start: state.labelStart, end: state.labelEnd },
    labelExcludeKeywords: state.labelExclude ? state.labelExclude.split(',').map((value) => value.trim()).filter(Boolean) : [],
    excludeKeywords: state.contentExclude ? state.contentExclude.split(',').map((value) => value.trim()).filter(Boolean) : [],
    priorityKeywords: state.priorityKeywords ? state.priorityKeywords.split(',').map((value) => value.trim()).filter(Boolean) : [],
    ...(state.splitSeparators.length > 0 ? { splitSeparators: state.splitSeparators } : {})
  };

  if (state.requireInline) {
    firstLabelWanted.requireInline = true;
  }
  if (state.requireNextLine) {
    firstLabelWanted.requireNextLine = true;
    if (state.nextLineRange) {
      firstLabelWanted.nextLineRange = state.nextLineRange;
    }
  }

  console.log(`[FIELD-MGMT][LABEL] Label créé pour "${fieldKey}":`, firstLabelWanted);
  return firstLabelWanted;
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

  definition.labels = firstLabelWanted ? [firstLabelWanted] : [];
}