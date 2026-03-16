import { buildInlineFieldEditorMarkup } from './field-inline-editor-view.js';
import {
  buildInlineFirstLabel,
  buildTupleMaskTokens,
  getInlineEditorInitialState,
  getTimeFormatOptionsByTupleCount,
  readInlineEditorFormState,
  replaceSelectOptions
} from './field-inline-editor-state.js';
import { t } from './i18n.js';

function setupInlineEditorHeaderToggle(header, modeWrap, toggle) {
  header.addEventListener('click', () => {
    const isOpen = modeWrap.style.display !== 'none';
    modeWrap.style.display = isOpen ? 'none' : 'block';
    toggle.textContent = isOpen ? '▼' : '▲';
  });
}

function setupInlineLabelCard(contentWrap, fieldKey) {
  const safeFieldKey = CSS.escape(fieldKey);
  const body = contentWrap.querySelector(`#add-label-card-body-${safeFieldKey}`);
  const header = contentWrap.querySelector(`#add-label-card-header-${safeFieldKey}`);
  const toggle = contentWrap.querySelector(`#add-label-card-toggle-${safeFieldKey}`);
  const title = contentWrap.querySelector(`#add-label-card-title-${safeFieldKey}`);
  const text = contentWrap.querySelector(`#add-label-text-${safeFieldKey}`);
  const start = contentWrap.querySelector(`#add-label-start-${safeFieldKey}`);
  const end = contentWrap.querySelector(`#add-label-end-${safeFieldKey}`);
  if (!header || !body || !toggle || !title || !text || !start || !end) return;

  header.addEventListener('click', () => {
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    toggle.textContent = isOpen ? '▼' : '▲';
  });

  const updateTitle = () => {
    const labelText = text.value || t('fieldEditorEmptyKeyword');
    const startLine = parseInt(start.value || '1', 10) || 1;
    const endLine = parseInt(end.value || '999', 10) || 999;
    title.textContent = t('fieldEditorCardTitle', [labelText, String(startLine), String(endLine)]);
  };

  ['input', 'change'].forEach((eventName) => {
    text.addEventListener(eventName, updateTitle);
    start.addEventListener(eventName, updateTitle);
    end.addEventListener(eventName, updateTitle);
  });
  updateTitle();
}

function setupInlineTypeTupleControls({ contentWrap, fieldKey, tupleInit, tupleMaskInit, timeRawInit, timeDisplayInit }) {
  const safeFieldKey = CSS.escape(fieldKey);
  const typeRadios = contentWrap.querySelectorAll(`input[name="add-field-type-${safeFieldKey}"]`);
  const tupleRow = contentWrap.querySelector(`#add-field-tuple-row-${safeFieldKey}`);
  const unitInput = contentWrap.querySelector(`#add-field-unit-${safeFieldKey}`);
  const sizeSelect = contentWrap.querySelector(`#add-field-tuple-size-${safeFieldKey}`);
  const maskSelect = contentWrap.querySelector(`#add-field-tuple-mask-${safeFieldKey}`);
  const timeFormatWrap = contentWrap.querySelector(`#add-field-time-format-${safeFieldKey}`);
  const timeRawSelect = contentWrap.querySelector(`#add-field-time-raw-${safeFieldKey}`);
  const timeDisplaySelect = contentWrap.querySelector(`#add-field-time-display-${safeFieldKey}`);
  const extractionRadios = contentWrap.querySelectorAll(`input[name="extraction-mode-${safeFieldKey}"]`);
  const nextlineRangeConfig = contentWrap.querySelector(`#nextline-range-config-${safeFieldKey}`);

  const buildAllXMask = (size) => {
    const parsedSize = parseInt(size, 10);
    if (!parsedSize || parsedSize < 1 || parsedSize > 7) return '';
    return Array.from({ length: parsedSize }, () => 'X').join(' ');
  };

  const populateMaskOptions = (size, current) => {
    if (!maskSelect) return;
    const maskParent = maskSelect.parentElement;
    const isNir = parseInt(size, 10) === 7;
    if (maskParent) maskParent.style.display = isNir ? 'none' : '';
    if (isNir) {
      replaceSelectOptions(maskSelect, [{ value: 'X X X X X X X', label: 'X X X X X X X' }], 'X X X X X X X', '');
      return;
    }
    const values = buildTupleMaskTokens(size);
    const normalizedCurrent = String(current || '').trim();
    const fallbackAllX = buildAllXMask(size);
    const selectedValue = normalizedCurrent || fallbackAllX;
    replaceSelectOptions(maskSelect, values.map((value) => ({ value, label: value })), selectedValue, '');

    // Safety net: if selection did not stick, force a deterministic default.
    if (!maskSelect.value && values.length > 0) {
      maskSelect.value = values.includes(fallbackAllX) ? fallbackAllX : values[0];
    }
  };

  const renderConnectorInputs = () => {
    const connectorsContainer = contentWrap.querySelector(`#add-field-tuple-connectors-${safeFieldKey}`);
    const connectorsInputs = contentWrap.querySelector(`#add-field-tuple-connectors-inputs-${safeFieldKey}`);
    if (!connectorsContainer || !connectorsInputs) return;

    const mask = maskSelect?.value || '';
    const xCount = (mask.match(/X/g) || []).length;
    if (xCount < 2) {
      connectorsContainer.style.display = 'none';
      connectorsInputs.replaceChildren();
      return;
    }

    connectorsContainer.style.display = 'block';
    connectorsInputs.replaceChildren();
    const existingConnectors = tupleInit?.connectors || [];
    for (let index = 0; index < xCount; index += 1) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; align-items:center; gap:4px;';
      const label = document.createElement('span');
      label.textContent = `X${index + 1}`;
      label.style.cssText = 'font-size:11px; color:#666; min-width:20px;';
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `add-field-tuple-connector-${fieldKey}-${index}`;
      input.placeholder = index < xCount - 1 ? 'ex: kg' : 'ex: L';
      input.value = existingConnectors[index] || '';
      input.style.cssText = 'width:80px; padding:4px; font-size:11px; box-sizing:border-box;';
      wrap.appendChild(label);
      wrap.appendChild(input);
      connectorsInputs.appendChild(wrap);
    }
  };

  const populateTimeFormats = (xCount) => {
    if (!timeRawSelect || !timeDisplaySelect) return;
    const { rawOptions, displayOptions } = getTimeFormatOptionsByTupleCount(xCount);
    replaceSelectOptions(timeRawSelect, rawOptions, timeRawInit);
    replaceSelectOptions(timeDisplaySelect, displayOptions, timeDisplayInit);
  };

  const refreshTimeFormatsFromMask = () => {
    const checked = Array.from(typeRadios).find((radio) => radio.checked);
    if (checked?.value !== 'time') return;
    const mask = maskSelect?.value || '';
    const xCount = (mask.match(/X/g) || []).length;
    populateTimeFormats(xCount);
  };

  const updateTypeDisplay = () => {
    const checked = Array.from(typeRadios).find((radio) => radio.checked);
    const isNumeric = checked?.value === 'numeric';
    const isTime = checked?.value === 'time';
    if (unitInput) unitInput.disabled = !isNumeric;
    if (tupleRow) tupleRow.style.display = (isNumeric || isTime) ? 'block' : 'none';
    if (timeFormatWrap) timeFormatWrap.style.display = isTime ? 'block' : 'none';
    if (!isNumeric && unitInput) unitInput.value = '';
    if (isTime) refreshTimeFormatsFromMask();
  };

  const updateRangeState = () => {
    const selected = contentWrap.querySelector(`input[name="extraction-mode-${safeFieldKey}"]:checked`)?.value;
    if (nextlineRangeConfig) {
      nextlineRangeConfig.style.display = selected === 'inline' ? 'none' : 'block';
    }
  };

  updateTypeDisplay();
  populateMaskOptions(sizeSelect?.value || '1', maskSelect?.value || tupleMaskInit || '');
  renderConnectorInputs();
  refreshTimeFormatsFromMask();
  typeRadios.forEach((radio) => radio.addEventListener('change', updateTypeDisplay));
  extractionRadios.forEach((radio) => radio.addEventListener('change', updateRangeState));
  updateRangeState();

  if (sizeSelect) {
    sizeSelect.addEventListener('change', () => {
      populateMaskOptions(sizeSelect.value, '');
      renderConnectorInputs();
      refreshTimeFormatsFromMask();
    });
  }

  if (maskSelect) {
    maskSelect.addEventListener('change', () => {
      renderConnectorInputs();
      refreshTimeFormatsFromMask();
    });
  }
}

function createInlineEditorContainer(fieldKey) {
  const item = document.createElement('li');
  item.id = `inline-editor-slot-${fieldKey}`;
  item.className = 'inline-editor-slot';
  item.dataset.fieldName = fieldKey;
  item.style.marginBottom = '10px';
  item.style.border = '1px solid #ddd';
  item.style.borderRadius = '4px';
  item.style.padding = '8px';
  item.style.backgroundColor = '#f9f9f9';
  return item;
}

function createInlineEditorHeader() {
  const header = document.createElement('div');
  header.className = 'inline-editor-slot-header';
  header.style.cursor = 'pointer';
  header.style.fontWeight = 'bold';
  header.style.padding = '5px';
  header.style.backgroundColor = '#eee';
  header.style.borderRadius = '3px';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';

  const title = document.createElement('span');
  title.textContent = t('fieldEditorHeader');

  const toggle = document.createElement('span');
  toggle.textContent = '▲';
  toggle.style.fontSize = '12px';

  header.appendChild(title);
  header.appendChild(toggle);
  return { header, toggle };
}

function createInlineEditorModeWrap(fieldKey) {
  const modeWrap = document.createElement('div');
  modeWrap.id = `inline-editor-slot-mode-${fieldKey}`;
  modeWrap.className = 'inline-editor-slot-mode';
  modeWrap.style.marginTop = '8px';
  return modeWrap;
}

function createInlineEditorContentWrap() {
  const contentWrap = document.createElement('div');
  contentWrap.className = 'inline-editor-slot-content';
  return contentWrap;
}

function createInlineEditorShell(fieldKey) {
  const item = createInlineEditorContainer(fieldKey);
  const { header, toggle } = createInlineEditorHeader();
  const modeWrap = createInlineEditorModeWrap(fieldKey);
  const contentWrap = createInlineEditorContentWrap();
  return { item, header, toggle, modeWrap, contentWrap };
}

function setupInlineEditorActions({
  contentWrap,
  modeWrap,
  toggle,
  fieldKey,
  unsavedIndicator,
  onSave,
  onSaveMissingField
}) {
  const safeFieldKey = CSS.escape(fieldKey);
  const inlineSubmit = contentWrap.querySelector(`#inline-submit-${safeFieldKey}`);
  const inlineCancel = contentWrap.querySelector(`#inline-cancel-${safeFieldKey}`);

  if (inlineSubmit) {
    inlineSubmit.addEventListener('click', (event) => {
      event.stopPropagation();
      const state = readInlineEditorFormState(contentWrap, fieldKey);
      const firstLabelWanted = buildInlineFirstLabel(fieldKey, state);
      const saved = onSave?.({ fieldKey, state, firstLabelWanted });
      if (saved === false) {
        onSaveMissingField?.({ fieldKey });
      }
    });
  }

  if (inlineCancel) {
    inlineCancel.addEventListener('click', (event) => {
      event.stopPropagation();
      modeWrap.style.display = 'none';
      toggle.textContent = '▼';
      requestAnimationFrame(() => {
        const card = modeWrap.closest('.field-group');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  const markUnsaved = () => { try { if (unsavedIndicator) unsavedIndicator.style.display = ''; } catch {} };
  modeWrap.addEventListener('input', markUnsaved, true);
  modeWrap.addEventListener('change', markUnsaved, true);
}

function createInlineEditorSlot({
  fieldKey,
  definition,
  siteLabel,
  unsavedIndicator,
  onSave,
  onSaveMissingField
}) {
  const { item: li, header, toggle, modeWrap, contentWrap } = createInlineEditorShell(fieldKey);

  const {
    isNumeric,
    isTime,
    nameInitial,
    unitInitial,
    suffixInitial,
    roleInitial,
    tupleInit,
    tupleSizeInit,
    timeRawInit,
    timeDisplayInit,
    firstLabel: lbl0,
    lblTextInit,
    lblStartInit,
    lblEndInit,
    lblLabelExclInit,
    lblExcludeInit,
    lblPriorityInit,
    tupleMaskInit
  } = getInlineEditorInitialState(fieldKey, definition);

  console.log(`[FIELD-MGMT][RENDER] Champ "${fieldKey}" - Label chargé:`, {
    text: lblTextInit,
    requireInline: lbl0?.requireInline,
    requireNextLine: lbl0?.requireNextLine,
    range: lbl0?.range,
    type: definition.type,
    unit: definition.unit,
    role: definition.role
  });

  const placeholder = document.createElement('div');
  placeholder.className = 'slot-placeholder';
  placeholder.innerHTML = buildInlineFieldEditorMarkup({
    fieldKey,
    siteLabel,
    initialState: {
      isNumeric,
      isTime,
      nameInitial,
      unitInitial,
      suffixInitial,
      roleInitial,
      tupleSizeInit,
      firstLabel: lbl0,
      lblTextInit,
      lblStartInit,
      lblEndInit,
      lblLabelExclInit,
      lblExcludeInit,
      lblPriorityInit
    }
  });

  const editorZone = document.createElement('div');
  editorZone.className = 'editor-content-zone';
  editorZone.style.display = 'none';

  contentWrap.appendChild(placeholder);
  contentWrap.appendChild(editorZone);
  modeWrap.appendChild(contentWrap);

  setupInlineEditorHeaderToggle(header, modeWrap, toggle);
  setupInlineLabelCard(contentWrap, fieldKey);
  setupInlineTypeTupleControls({ contentWrap, fieldKey, tupleInit, tupleMaskInit, timeRawInit, timeDisplayInit });
  setupInlineEditorActions({
    contentWrap,
    modeWrap,
    toggle,
    fieldKey,
    unsavedIndicator,
    onSave,
    onSaveMissingField
  });

  li.appendChild(header);
  li.appendChild(modeWrap);
  return li;
}

export function createFieldContent({
  fieldKey,
  definition,
  siteLabel,
  expandedFieldKey,
  unsavedIndicator,
  onSave,
  onSaveMissingField
}) {
  const fieldContent = document.createElement('div');
  fieldContent.style.display = fieldKey === expandedFieldKey ? 'block' : 'none';
  fieldContent.style.padding = '15px';
  fieldContent.style.backgroundColor = '#ffffff';
  fieldContent.style.borderRadius = '0 0 4px 4px';

  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.padding = '0';
  list.style.margin = '0';

  list.appendChild(createInlineEditorSlot({
    fieldKey,
    definition,
    siteLabel,
    unsavedIndicator,
    onSave,
    onSaveMissingField
  }));

  fieldContent.appendChild(list);
  return fieldContent;
}