import { buildInlineFieldEditorMarkup, renderLabelSubCard } from './field-inline-editor-view.js';
import {
  buildInlineFirstLabel,
  buildInlineLabels,
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

function setupInlineLabelCards(contentWrap, fieldKey, cardInit = {}) {
  const { tupleInit, tupleMaskInit, timeRawInit, timeDisplayInit } = cardInit;
  const safeFieldKey = CSS.escape(fieldKey);
  const labelsList = contentWrap.querySelector(`#add-labels-list-${safeFieldKey}`);
  const addBtn = contentWrap.querySelector(`#add-label-keyword-add-${safeFieldKey}`);
  if (!labelsList) return;

  const refreshRemoveButtons = () => {
    const cards = labelsList.querySelectorAll(':scope > .label-subcard');
    cards.forEach((card) => {
      const btn = card.querySelector('.label-subcard-remove');
      if (btn) btn.style.visibility = cards.length <= 1 ? 'hidden' : 'visible';
    });
  };

  const setupSubCard = (card, initOpts = {}) => {
    const si = card.dataset.subcardIndex;
    const header = card.querySelector('.label-subcard-header');
    const body = card.querySelector('.label-subcard-body');
    const toggle = card.querySelector('.label-subcard-toggle');
    const titleEl = card.querySelector('.label-subcard-title');
    const keywordInput = card.querySelector('.label-subcard-keyword');
    const startInput = card.querySelector('.label-subcard-start');
    const endInput = card.querySelector('.label-subcard-end');
    const removeBtn = card.querySelector('.label-subcard-remove');
    const unitInput = card.querySelector('.label-subcard-unit');
    const tupleRow = card.querySelector(`#add-field-tuple-row-${fieldKey}-${si}`);
    const sizeSelect = card.querySelector(`#add-field-tuple-size-${fieldKey}-${si}`);
    const maskSelect = card.querySelector(`#add-field-tuple-mask-${fieldKey}-${si}`);
    const timeFormatWrap = card.querySelector(`#add-field-time-format-${fieldKey}-${si}`);
    const timeRawSelect = card.querySelector(`#add-field-time-raw-${fieldKey}-${si}`);
    const timeDisplaySelect = card.querySelector(`#add-field-time-display-${fieldKey}-${si}`);
    const updateTitle = () => {
      if (!titleEl) return;
      const kw = keywordInput?.value.trim() || t('fieldEditorEmptyKeyword');
      const s = parseInt(startInput?.value || '1', 10) || 1;
      const e = parseInt(endInput?.value || '999', 10) || 999;
      titleEl.textContent = t('fieldEditorCardTitle', [kw, String(s), String(e)]);
    };

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
      if (!maskSelect.value && values.length > 0) {
        maskSelect.value = values.includes(fallbackAllX) ? fallbackAllX : values[0];
      }
    };

    const renderConnectorInputs = () => {
      const connectorsContainer = card.querySelector(`#add-field-tuple-connectors-${fieldKey}-${si}`);
      const connectorsInputs = card.querySelector(`#add-field-tuple-connectors-inputs-${fieldKey}-${si}`);
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
      const existingConnectors = initOpts.tupleInit?.connectors || [];
      for (let ci = 0; ci < xCount; ci += 1) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex; align-items:center; gap:4px;';
        const lbl = document.createElement('span');
        lbl.textContent = `X${ci + 1}`;
        lbl.style.cssText = 'font-size:11px; color:#666; min-width:20px;';
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `add-field-tuple-connector-${fieldKey}-${si}-${ci}`;
        input.placeholder = ci < xCount - 1 ? 'ex: kg' : 'ex: L';
        input.value = existingConnectors[ci] || '';
        input.style.cssText = 'width:80px; padding:4px; font-size:11px; box-sizing:border-box;';
        wrap.appendChild(lbl);
        wrap.appendChild(input);
        connectorsInputs.appendChild(wrap);
      }
    };

    const populateTimeFormats = (xCount) => {
      if (!timeRawSelect || !timeDisplaySelect) return;
      const { rawOptions, displayOptions } = getTimeFormatOptionsByTupleCount(xCount);
      replaceSelectOptions(timeRawSelect, rawOptions, initOpts.timeRawInit);
      replaceSelectOptions(timeDisplaySelect, displayOptions, initOpts.timeDisplayInit);
    };

    const refreshTimeFormatsFromMask = (type) => {
      const resolvedType = type ?? contentWrap.querySelector(`input[name="add-field-type-${fieldKey}"]:checked`)?.value;
      if (resolvedType !== 'time') return;
      const mask = maskSelect?.value || '';
      const xCount = (mask.match(/X/g) || []).length;
      populateTimeFormats(xCount);
    };

    const updateForType = (type) => {
      const isNum = type === 'numeric';
      const isTm = type === 'time';
      if (unitInput) unitInput.disabled = !isNum;
      if (unitInput && !isNum) unitInput.value = '';
      if (tupleRow) tupleRow.style.display = (isNum || isTm) ? 'block' : 'none';
      if (timeFormatWrap) timeFormatWrap.style.display = isTm ? 'block' : 'none';
      if (isTm) refreshTimeFormatsFromMask(type);
    };

    populateMaskOptions(sizeSelect?.value || '1', initOpts.tupleMaskInit || '');
    renderConnectorInputs();
    refreshTimeFormatsFromMask();

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

    if (header && body && toggle) {
      header.addEventListener('click', (ev) => {
        if (ev.target === removeBtn) return;
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        toggle.textContent = isOpen ? '▼' : '▲';
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cards = labelsList.querySelectorAll(':scope > .label-subcard');
        if (cards.length <= 1) return;
        card.remove();
        refreshRemoveButtons();
      });
    }

    [keywordInput, startInput, endInput].forEach((el) => {
      if (el) el.addEventListener('input', updateTitle);
    });

    updateTitle();
    return { updateForType };
  };

  // Wire existing sub-cards rendered from HTML
  const subCardUpdaters = [];
  labelsList.querySelectorAll(':scope > .label-subcard').forEach((card) => {
    const si = parseInt(card.dataset.subcardIndex, 10);
    const updater = setupSubCard(card, si === 0 ? { tupleInit, tupleMaskInit, timeRawInit, timeDisplayInit } : {});
    subCardUpdaters.push(updater);
  });
  refreshRemoveButtons();

  const globalTypeRadios = contentWrap.querySelectorAll(`input[name="add-field-type-${fieldKey}"]`);
  const getCheckedType = () => Array.from(globalTypeRadios).find((r) => r.checked)?.value || 'text';
  const applyTypeToAll = () => {
    const type = getCheckedType();
    subCardUpdaters.forEach((u) => u.updateForType(type));
  };
  globalTypeRadios.forEach((r) => r.addEventListener('change', applyTypeToAll));
  applyTypeToAll();

  if (addBtn) {
    addBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const index = labelsList.querySelectorAll(':scope > .label-subcard').length;
      const currentType = getCheckedType();
      const typeOpts = {
        isNumeric: currentType === 'numeric',
        isTime: currentType === 'time',
        unit: '',
        tupleSizeInit: 1
      };
      const div = document.createElement('div');
      div.innerHTML = renderLabelSubCard(fieldKey, index, null, typeOpts).trim();
      const newCard = div.firstElementChild;
      labelsList.appendChild(newCard);
      const updater = setupSubCard(newCard, {});
      subCardUpdaters.push(updater);
      updater.updateForType(currentType);
      refreshRemoveButtons();
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
      const labelsWanted = buildInlineLabels(fieldKey, state);
      const saved = onSave?.({ fieldKey, state, firstLabelWanted: labelsWanted });
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
    allLabels,
    tupleMaskInit
  } = getInlineEditorInitialState(fieldKey, definition);

  console.log(`[FIELD-MGMT][RENDER] Champ "${fieldKey}" - Labels chargés:`, {
    count: allLabels.length,
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
      allLabels
    }
  });

  const editorZone = document.createElement('div');
  editorZone.className = 'editor-content-zone';
  editorZone.style.display = 'none';

  contentWrap.appendChild(placeholder);
  contentWrap.appendChild(editorZone);
  modeWrap.appendChild(contentWrap);

  setupInlineEditorHeaderToggle(header, modeWrap, toggle);
  setupInlineLabelCards(contentWrap, fieldKey, { tupleInit, tupleMaskInit, timeRawInit, timeDisplayInit });
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