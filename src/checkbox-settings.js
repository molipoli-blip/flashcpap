// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// Checkbox settings panel helpers.
import { settings, saveSettings, getFamilySuggestions } from './storage.js';
import { confirmInline, alertInline, createLockedMessage } from './ui-utils.js';
import { getParameterProviderSiteKey, updateCheckboxById } from './checkbox-orchestrator.js';
import { refreshCheckboxUIs } from './checkbox-refresh.js';
import { hasValidProvider } from './domain/provider-rules.js';
import { t } from './i18n.js';
import { ensureSettingsObject } from './storage-guards.js';
import { getCustomCheckboxes } from './custom-checkbox-store.js';
import {
  isPhraseModePotActive,
  notifyPhrasePotBlocked,
  ensureCheckboxPhraseGroups,
  openPhraseManagementPanel
} from './phrase-groups-editor.js';

function withPhraseGuard(event, fn) {
  if (isPhraseModePotActive()) { notifyPhrasePotBlocked(event); return; }
  return fn();
}

const familyAutocompleteState = {
  initialized: false,
  open: false,
  activeIndex: -1,
  bestCompletion: '',
  items: [],
  blurTimer: null
};

function normalizeFamilyText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sortFamilyEntries(a, b) {
  return a.localeCompare(b, 'fr', { sensitivity: 'base' });
}

function getFamilyAutocompleteElements() {
  return {
    wrapper: document.querySelector('.family-autocomplete'),
    input: document.getElementById('new-checkbox-family'),
    ghostText: document.getElementById('family-ghost-text'),
    panel: document.getElementById('family-suggestions-panel'),
    button: document.getElementById('family-dropdown-button')
  };
}

function getSortedFamilySuggestions() {
  return getFamilySuggestions().slice().sort(sortFamilyEntries);
}

function getFamilyCompletion(query, suggestions) {
  const normalizedQuery = normalizeFamilyText(query);
  if (!normalizedQuery) return '';
  return suggestions.find(family => normalizeFamilyText(family).startsWith(normalizedQuery)) || '';
}

function getFamilyMatches(query, suggestions) {
  const normalizedQuery = normalizeFamilyText(query);
  if (!normalizedQuery) return suggestions.slice();

  return suggestions
    .filter(family => normalizeFamilyText(family).includes(normalizedQuery))
    .sort((left, right) => {
      const leftStarts = normalizeFamilyText(left).startsWith(normalizedQuery);
      const rightStarts = normalizeFamilyText(right).startsWith(normalizedQuery);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return sortFamilyEntries(left, right);
    });
}

function closeFamilySuggestions({ clearGhost = false } = {}) {
  const { input, ghostText, panel, button } = getFamilyAutocompleteElements();

  familyAutocompleteState.open = false;
  familyAutocompleteState.activeIndex = -1;
  familyAutocompleteState.items = [];

  if (panel) {
    panel.style.display = 'none';
    panel.innerHTML = '';
  }

  if (input) {
    input.setAttribute('aria-expanded', 'false');
  }

  if (button) {
    button.setAttribute('aria-expanded', 'false');
  }

  if (clearGhost && ghostText) {
    ghostText.textContent = '';
    familyAutocompleteState.bestCompletion = '';
  }
}

function selectFamilySuggestion(value) {
  const { input } = getFamilyAutocompleteElements();
  if (!input) return;

  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  closeFamilySuggestions({ clearGhost: true });
}

function renderFamilySuggestionItems(query, { openAll = false } = {}) {
  const { input, ghostText, panel, button } = getFamilyAutocompleteElements();
  if (!input || !panel) return;

  const suggestions = getSortedFamilySuggestions();
  const normalizedQuery = normalizeFamilyText(query);
  const matches = openAll ? suggestions : getFamilyMatches(query, suggestions);
  const exactMatch = normalizedQuery
    ? suggestions.some(family => normalizeFamilyText(family) === normalizedQuery)
    : false;

  familyAutocompleteState.bestCompletion = getFamilyCompletion(query, suggestions);
  familyAutocompleteState.items = matches.map(value => ({ type: 'family', value }));

  if (query.trim() && !exactMatch) {
    familyAutocompleteState.items.push({ type: 'create', value: query.trim() });
  }

  if (ghostText) {
    ghostText.textContent = familyAutocompleteState.bestCompletion
      ? `${query}${familyAutocompleteState.bestCompletion.slice(query.length)}`
      : '';
  }

  panel.innerHTML = '';

  if (familyAutocompleteState.items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'family-suggestion-empty';
    empty.textContent = query.trim()
      ? `Aucune famille ne correspond à “${query.trim()}”.`
      : 'Aucune famille enregistrée pour le moment.';
    panel.appendChild(empty);
  } else {
    familyAutocompleteState.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'family-suggestion-item';
      row.setAttribute('role', 'option');
      row.dataset.index = String(index);

      const label = document.createElement('div');
      label.className = 'family-suggestion-label';
      label.textContent = item.type === 'create' ? `Créer « ${item.value} »` : item.value;

      const meta = document.createElement('div');
      meta.className = 'family-suggestion-meta';
      meta.textContent = item.type === 'create'
        ? 'Nouvelle famille'
        : (normalizeFamilyText(item.value).startsWith(normalizedQuery) ? 'Correspondance directe' : 'Résultat proche');

      row.appendChild(label);
      row.appendChild(meta);

      row.addEventListener('mousedown', event => {
        event.preventDefault();
        selectFamilySuggestion(item.value);
      });

      panel.appendChild(row);
    });
  }

  familyAutocompleteState.activeIndex = -1;
  familyAutocompleteState.open = true;
  panel.style.display = 'block';
  input.setAttribute('aria-expanded', 'true');
  if (button) button.setAttribute('aria-expanded', 'true');
}

function setActiveFamilySuggestion(nextIndex) {
  const { panel } = getFamilyAutocompleteElements();
  if (!panel) return;

  const rows = Array.from(panel.querySelectorAll('.family-suggestion-item'));
  if (rows.length === 0) return;

  familyAutocompleteState.activeIndex = ((nextIndex % rows.length) + rows.length) % rows.length;
  rows.forEach((row, index) => row.classList.toggle('active', index === familyAutocompleteState.activeIndex));

  const activeRow = rows[familyAutocompleteState.activeIndex];
  if (activeRow && typeof activeRow.scrollIntoView === 'function') {
    activeRow.scrollIntoView({ block: 'nearest' });
  }
}

function acceptBestFamilyCompletion() {
  const selectedRow = familyAutocompleteState.activeIndex >= 0
    ? familyAutocompleteState.items[familyAutocompleteState.activeIndex]
    : null;

  if (selectedRow?.value) {
    selectFamilySuggestion(selectedRow.value);
    return;
  }

  if (familyAutocompleteState.bestCompletion) {
    selectFamilySuggestion(familyAutocompleteState.bestCompletion);
    return;
  }

  closeFamilySuggestions({ clearGhost: true });
}

function refreshFamilyAutocompleteUi({ reopen = false } = {}) {
  const { input, ghostText, button } = getFamilyAutocompleteElements();
  if (!input || !ghostText) return;

  const query = input.value || '';
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    ghostText.textContent = '';
    familyAutocompleteState.bestCompletion = '';
    if (reopen) {
      renderFamilySuggestionItems('', { openAll: true });
    } else {
      closeFamilySuggestions({ clearGhost: false });
    }
    if (button) button.setAttribute('aria-expanded', reopen ? 'true' : 'false');
    return;
  }

  renderFamilySuggestionItems(trimmedQuery, { openAll: reopen && !familyAutocompleteState.open });
}

function bindFamilyAutocompleteUi() {
  const { wrapper, input, button } = getFamilyAutocompleteElements();
  if (!wrapper || !input || !button || familyAutocompleteState.initialized) return;

  familyAutocompleteState.initialized = true;

  input.addEventListener('input', () => {
    refreshFamilyAutocompleteUi();
  });

  input.addEventListener('focus', () => {
    window.clearTimeout(familyAutocompleteState.blurTimer);
    if (input.value.trim()) {
      refreshFamilyAutocompleteUi();
    }
  });

  input.addEventListener('blur', () => {
    window.clearTimeout(familyAutocompleteState.blurTimer);
    familyAutocompleteState.blurTimer = window.setTimeout(() => {
      if (!wrapper.contains(document.activeElement)) {
        closeFamilySuggestions({ clearGhost: false });
      }
    }, 120);
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!familyAutocompleteState.open) {
        refreshFamilyAutocompleteUi({ reopen: true });
      }
      setActiveFamilySuggestion(familyAutocompleteState.activeIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!familyAutocompleteState.open) {
        refreshFamilyAutocompleteUi({ reopen: true });
      }
      setActiveFamilySuggestion(familyAutocompleteState.activeIndex <= 0
        ? familyAutocompleteState.items.length - 1
        : familyAutocompleteState.activeIndex - 1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      acceptBestFamilyCompletion();
      return;
    }

    if ((event.key === 'Tab' || event.key === 'ArrowRight') && familyAutocompleteState.bestCompletion) {
      event.preventDefault();
      selectFamilySuggestion(familyAutocompleteState.bestCompletion);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeFamilySuggestions({ clearGhost: true });
    }
  });

  button.addEventListener('click', () => {
    if (familyAutocompleteState.open) {
      closeFamilySuggestions({ clearGhost: false });
      return;
    }

    refreshFamilyAutocompleteUi({ reopen: true });
    input.focus();
  });

  document.addEventListener('click', event => {
    if (!wrapper.contains(event.target)) {
      closeFamilySuggestions({ clearGhost: false });
    }
  });

  refreshFamilyAutocompleteUi();
}

function getCheckboxActionElements() {
  return {
    btnImport: document.getElementById('btn-import-checkboxes'),
    btnExport: document.getElementById('btn-export-checkboxes'),
    addBtn: document.getElementById('add-custom-checkbox')
  };
}

export function getCheckboxFormElements() {
  return {
    textInput: document.getElementById('new-checkbox-text'),
    valueInput: document.getElementById('new-checkbox-value'),
    familyInput: document.getElementById('new-checkbox-family'),
    favoriteBtn: document.getElementById('new-checkbox-favorite'),
    addBtn: document.getElementById('add-custom-checkbox'),
    cancelBtn: document.getElementById('cancel-edit')
  };
}

function setElementEnabled(element, enabled, {
  enabledCursor = '',
  disabledCursor = 'not-allowed',
  enabledPointerEvents = '',
  disabledPointerEvents = ''
} = {}) {
  if (!element) return;
  element.disabled = !enabled;
  element.style.opacity = enabled ? '1' : '0.5';
  element.style.cursor = enabled ? enabledCursor : disabledCursor;
  if (enabledPointerEvents || disabledPointerEvents) {
    element.style.pointerEvents = enabled ? enabledPointerEvents : disabledPointerEvents;
  }
}

export function setFavoriteButtonState(isFavorite) {
  const { favoriteBtn } = getCheckboxFormElements();
  if (!favoriteBtn) return;
  favoriteBtn.setAttribute('data-favorite', String(!!isFavorite));
  favoriteBtn.textContent = isFavorite ? '⭐' : '☆';
  favoriteBtn.title = isFavorite ? t('checkboxFavoriteRemove') : t('checkboxFavoriteAdd');
}

export function resetCheckboxForm() {
  const { textInput, valueInput, familyInput, addBtn, cancelBtn } = getCheckboxFormElements();
  if (textInput) textInput.value = '';
  if (valueInput) valueInput.value = '';
  if (familyInput) familyInput.value = '';
  refreshFamilyAutocompleteUi();
  if (addBtn) {
    addBtn.textContent = t('checkboxButtonAddShort');
    addBtn.classList.remove('submit-btn-editing');
  }
  if (cancelBtn) cancelBtn.style.display = 'none';
  setFavoriteButtonState(false);
}

function updateCheckboxActionAvailability(isEnabled) {
  const { btnImport, btnExport, addBtn } = getCheckboxActionElements();
  setElementEnabled(btnImport, isEnabled, { enabledCursor: 'pointer' });
  setElementEnabled(btnExport, isEnabled, { enabledCursor: 'pointer' });
  setElementEnabled(addBtn, isEnabled, { enabledCursor: 'pointer' });
}

async function saveCheckboxSettingsAndRefresh(site, { refreshSummary = false } = {}) {
  saveSettings();
  await refreshCheckboxUIs({ siteKey: site, refreshSummary });
}

function createCheckboxInfoBlock(checkbox) {
  const info = document.createElement('div');
  info.style.flex = '1';

  const title = document.createElement('div');
  title.style.fontWeight = '600';
  title.style.fontSize = '13px';
  title.textContent = checkbox.favorite ? `${checkbox.text} ⭐` : checkbox.text;

  const value = document.createElement('div');
  value.style.color = '#666';
  value.style.fontSize = '11px';
  value.textContent = `→ "${checkbox.value}"`;

  info.appendChild(title);
  info.appendChild(value);
  return info;
}

// Render custom checkboxes grouped by family in the settings panel.
export function renderCustomCheckboxSettings(site) {
  site = (site || '').toLowerCase();
  const container = document.getElementById('custom-checkbox-list');
  if (!container) return;
  container.innerHTML = '';
  if (!hasValidProvider(settings, site)) {
    container.appendChild(createLockedMessage(
      t('checkboxNoProviderTitle'),
      t('checkboxNoProviderDescription')
    ));
    updateCheckboxActionAvailability(false);
    return;
  }

  updateCheckboxActionAvailability(true);
  ensureCheckboxPhraseGroups(site);
  openPhraseManagementPanel(site);

  ensureSettingsObject(settings, 'customCheckboxes');
  const customCheckboxes = getCustomCheckboxes(settings, site);

  if (customCheckboxes.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.style.fontStyle = 'italic';
    emptyMessage.style.color = '#999';
    emptyMessage.style.fontSize = '12px';
    emptyMessage.textContent = t('checkboxEmptyState');
    container.appendChild(emptyMessage);
    return;
  }

  const defaultFamilyLabel = t('checkboxNoFamily');
  const groups = new Map();
  for (const checkbox of customCheckboxes) {
    const family = (checkbox.family || '').trim();
    const key = family ? family.toLowerCase() : '__none__';
    if (!groups.has(key)) groups.set(key, { title: family || defaultFamilyLabel, items: [] });
    groups.get(key).items.push(checkbox);
  }

  const orderedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.title === defaultFamilyLabel && b.title !== defaultFamilyLabel) return -1;
    if (b.title === defaultFamilyLabel && a.title !== defaultFamilyLabel) return 1;
    return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
  });

  for (const group of orderedGroups) {
    const wrap = document.createElement('div');
    wrap.className = 'cb-family-wrapper';

    const title = document.createElement('div');
    title.className = 'cb-family-title';
    title.textContent = group.title;
    wrap.appendChild(title);

    const list = document.createElement('div');
    list.className = 'cb-family-list';

    group.items.forEach(checkbox => {
      const item = document.createElement('div');
      item.className = 'custom-checkbox-item';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '10px';
      item.style.marginBottom = '6px';
      item.style.padding = '8px';
      item.style.border = '1px solid #e8e8e8';
      item.style.borderRadius = '6px';
      item.style.background = '#fff';
      item.dataset.cbId = checkbox.id;
      item.dataset.family = checkbox.family || '';
      item.setAttribute('data-selected', '0');

      const info = createCheckboxInfoBlock(checkbox);

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.gap = '6px';
      controls.style.alignItems = 'center';

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.title = t('checkboxEditTitle');
      editBtn.style.border = 'none';
      editBtn.style.background = 'transparent';
      editBtn.style.cursor = 'pointer';
      editBtn.style.fontSize = '14px';
      editBtn.onclick = (event) => withPhraseGuard(event, () =>
        editCheckboxInForm(checkbox, site, customCheckboxes.indexOf(checkbox))
      );

      const favoriteBtn = document.createElement('button');
      favoriteBtn.textContent = checkbox.favorite ? '⭐' : '☆';
      favoriteBtn.title = checkbox.favorite ? t('checkboxFavoriteRemove') : t('checkboxFavoriteAdd');
      favoriteBtn.style.border = 'none';
      favoriteBtn.style.background = 'transparent';
      favoriteBtn.style.cursor = 'pointer';
      favoriteBtn.style.fontSize = '16px';
      favoriteBtn.onclick = (event) => withPhraseGuard(event, async () => {
        const updatedCheckbox = updateCheckboxById(site, checkbox.id, currentCheckbox => ({
          ...currentCheckbox,
          favorite: !currentCheckbox.favorite
        }));
        if (updatedCheckbox) {
          await refreshCheckboxUIs({ siteKey: site });
        }
      });

      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove-custom-checkbox';
      removeBtn.textContent = '🗑';
      removeBtn.title = t('checkboxDeleteTitle');
      removeBtn.style.cursor = 'pointer';
      removeBtn.onclick = (event) => withPhraseGuard(event, async () => {
        const confirmed = await confirmInline(removeBtn, t('checkboxDeleteConfirm', checkbox.text));
        if (!confirmed) return;

        const index = customCheckboxes.indexOf(checkbox);
        if (index !== -1) {
          customCheckboxes.splice(index, 1);
          await saveCheckboxSettingsAndRefresh(site, { refreshSummary: true });
        }
      });

      controls.appendChild(editBtn);
      controls.appendChild(favoriteBtn);
      controls.appendChild(removeBtn);

      item.appendChild(info);
      item.appendChild(controls);
      list.appendChild(item);
    });

    wrap.appendChild(list);
    container.appendChild(wrap);
  }
}

let editingState = {
  isEditing: false,
  editingCheckbox: null,
  editingIndex: -1,
  editingSite: null
};

export function isEditing() {
  return editingState.isEditing;
}

export function getEditingInfo() {
  return editingState.isEditing ? {
    checkbox: editingState.editingCheckbox,
    index: editingState.editingIndex,
    site: editingState.editingSite
  } : null;
}

export function cancelEdit() {
  if (!editingState.isEditing) return;
  const siteForRestore = editingState.editingSite;

  resetCheckboxForm();

  editingState = {
    isEditing: false,
    editingCheckbox: null,
    editingIndex: -1,
    editingSite: null
  };

  if (siteForRestore) {
    refreshCheckboxUIs({ siteKey: siteForRestore, refreshSummary: true });
  }
}

// Load an existing checkbox into the form for editing.
export function editCheckboxInForm(checkbox, site, index) {
  const { textInput, valueInput, familyInput, addBtn, cancelBtn } = getCheckboxFormElements();

  if (!textInput || !valueInput || !familyInput || !addBtn || !cancelBtn) {
    console.warn('[EditCheckbox] Required form elements not found');
    return;
  }

  editingState = {
    isEditing: true,
    editingCheckbox: { ...checkbox },
    editingIndex: index,
    editingSite: site
  };

  textInput.value = checkbox.text || '';
  valueInput.value = checkbox.value || '';
  familyInput.value = checkbox.family || '';
  refreshFamilyAutocompleteUi();
  setFavoriteButtonState(!!checkbox.favorite);

  if (addBtn) {
    addBtn.textContent = t('checkboxButtonValidateEdit');
    addBtn.classList.add('submit-btn-editing');
  }

  if (cancelBtn) {
    cancelBtn.style.display = 'block';
  }

  const form = document.querySelector('.custom-checkbox-controls');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Disable creation controls when no valid provider is selected.
export function lockCustomCheckboxControls() {
  try {
    const currentProvider = getParameterProviderSiteKey();

    const isNoProvider = !hasValidProvider(settings, currentProvider);
    const { textInput, valueInput, familyInput, favoriteBtn, addBtn, cancelBtn } = getCheckboxFormElements();

    const controlsContainer = document.querySelector('.custom-checkbox-controls');

    if (isNoProvider) {
      [textInput, valueInput, familyInput].forEach(el => setElementEnabled(el, false));
      setElementEnabled(favoriteBtn, false, { disabledCursor: 'not-allowed', disabledPointerEvents: 'none' });
      setElementEnabled(addBtn, false);
      setElementEnabled(cancelBtn, false);

      if (controlsContainer) {
        let lockMsg = document.getElementById('checkbox-controls-lock-message');
        if (!lockMsg) {
          lockMsg = document.createElement('div');
          lockMsg.id = 'checkbox-controls-lock-message';
          lockMsg.style.padding = '15px';
          lockMsg.style.backgroundColor = '#f5f5f5';
          lockMsg.style.border = '2px solid #ddd';
          lockMsg.style.borderRadius = '8px';
          lockMsg.style.color = '#666';
          lockMsg.style.marginBottom = '10px';
          const lmH3 = document.createElement('h3');
          lmH3.style.cssText = 'margin:0 0 10px 0; color:#333;';
          lmH3.textContent = t('checkboxLockTitle');
          const lmP = document.createElement('p');
          lmP.style.margin = '0';
          lmP.textContent = t('checkboxLockDescription');
          lockMsg.appendChild(lmH3);
          lockMsg.appendChild(lmP);
          controlsContainer.insertBefore(lockMsg, controlsContainer.firstChild);
        }
      }
    } else {
      [textInput, valueInput, familyInput].forEach(el => setElementEnabled(el, true));
      setElementEnabled(favoriteBtn, true, { enabledCursor: 'pointer', enabledPointerEvents: '' });
      setElementEnabled(addBtn, true, { enabledCursor: 'pointer' });
      setElementEnabled(cancelBtn, true, { enabledCursor: 'pointer' });

      const lockMsg = document.getElementById('checkbox-controls-lock-message');
      if (lockMsg) lockMsg.remove();
    }
  } catch (e) {
    console.warn('[CHECKBOX-CONTROLS][LOCK] Error:', e);
  }
}

// Refresh the family suggestions datalist from stored checkbox families.
export function updateFamilySuggestionsList() {
  refreshFamilyAutocompleteUi();
}

export function initFamilySuggestionsUi() {
  bindFamilyAutocompleteUi();
  updateFamilySuggestionsList();
}
