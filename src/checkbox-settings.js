// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// Checkbox settings panel helpers.
import { settings, saveSettings, getFamilySuggestions } from './storage.js';
import { confirmInline, alertInline, createLockedMessage } from './ui-utils.js';
import { getParameterProviderSiteKey, updateCheckboxById } from './checkbox-orchestrator.js';
import { refreshCheckboxUIs } from './checkbox-refresh.js';
import { hasValidProvider } from './domain/provider-rules.js';
import { t } from './i18n.js';
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

  if (!settings.customCheckboxes) settings.customCheckboxes = {};
  const customCheckboxes = settings.customCheckboxes[site] || [];

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
          settings.customCheckboxes[site].splice(index, 1);
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
  const datalist = document.getElementById('family-suggestions');
  if (!datalist) return;
  datalist.innerHTML = '';
  const suggestions = getFamilySuggestions();
  for (const family of suggestions) {
    const option = document.createElement('option');
    option.value = family;
    datalist.appendChild(option);
  }
}