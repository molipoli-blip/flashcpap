// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// Phrase group editor for checkbox combinations.
import { settings, saveSettings } from './storage.js';
import { alertInline, confirmInline } from './ui-utils.js';
import { createPhraseGroupId, normalizePhraseGroupId } from './shared/id.js';
import { t } from './i18n.js';
import { ensureProviderEntry, ensureSettingsObject } from './storage-guards.js';

// Shared selection-mode state.
let phrasePotState = { active: false, family: '', orderIds: [] };
let lastPhrasePotNoticeAt = 0;

export function isPhraseModePotActive() {
  return phrasePotState.active;
}

function resetPhrasePotState({ active = false } = {}) {
  phrasePotState = { active, family: '', orderIds: [] };
}

function createGroupConfigField({ key, index, labelText, value, width = '90px' }) {
  const label = document.createElement('label');
  label.style.display = 'inline-flex';
  label.style.gap = '4px';
  label.style.alignItems = 'center';

  const caption = document.createElement('span');
  caption.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'text';
  input.dataset.k = key;
  input.dataset.idx = String(index);
  input.value = value;
  input.style.width = width;

  label.appendChild(caption);
  label.appendChild(input);
  return label;
}

function createPhraseGroupInfoBlock(group, index, previewText) {
  const info = document.createElement('div');
  info.style.flex = '1';

  const title = document.createElement('div');
  title.style.fontWeight = '600';
  title.style.fontSize = '13px';
  title.style.color = '#1976d2';
  title.textContent = group.title || group.id;

  const family = document.createElement('div');
  family.style.fontSize = '11px';
  family.style.color = '#666';
  family.style.marginBottom = '6px';
  family.textContent = t('phraseFamilyLabel', group.family || '?');

  const controls = document.createElement('div');
  controls.style.fontSize = '11px';
  controls.style.color = '#444';
  controls.style.display = 'flex';
  controls.style.flexWrap = 'wrap';
  controls.style.gap = '6px';
  controls.style.alignItems = 'center';
  controls.appendChild(createGroupConfigField({ key: 'prefix', index, labelText: t('phraseConfigPrefix'), value: group.prefix ?? '' }));
  controls.appendChild(createGroupConfigField({ key: 'connector', index, labelText: t('phraseConfigConnector'), value: group.connector ?? ' + ' }));
  controls.appendChild(createGroupConfigField({ key: 'lastConnector', index, labelText: t('phraseConfigLastConnector'), value: group.lastConnector ?? (group.connector ?? ' + ') }));
  controls.appendChild(createGroupConfigField({ key: 'suffix', index, labelText: t('phraseConfigSuffix'), value: group.suffix ?? '' }));

  const preview = document.createElement('div');
  preview.style.fontSize = '11px';
  preview.style.color = '#888';
  preview.style.marginTop = '6px';
  preview.textContent = t('phrasePreviewLabel', previewText);

  info.appendChild(title);
  info.appendChild(family);
  info.appendChild(controls);
  info.appendChild(preview);
  return info;
}

function clearPhrasePotSelectionStyles(container) {
  container?.querySelectorAll('.pot-cb-item').forEach(el => {
    el.style.borderColor = '#e8e8e8';
    el.style.background = '#fff';
    el.style.fontWeight = 'normal';
  });
}

export function notifyPhrasePotBlocked(event) {
  event?.stopPropagation();
  const now = Date.now();
  if (now - lastPhrasePotNoticeAt < 1200) return;
  lastPhrasePotNoticeAt = now;
  alertInline(t('phraseBlockedWhileSelecting'), 'warning');
}

export function ensureCheckboxPhraseGroups(site) {
  ensureSettingsObject(settings, 'checkboxPhrases');
  ensureProviderEntry(settings, 'checkboxPhrases', site, []);

  let changed = false;
  settings.checkboxPhrases[site] = settings.checkboxPhrases[site].map(group => {
    if (!group || typeof group !== 'object') return group;
    const nextId = group.id
      ? normalizePhraseGroupId(group.id, group.family || site)
      : createPhraseGroupId(group.family || site);
    if (nextId !== group.id) {
      changed = true;
      return { ...group, id: nextId };
    }
    return group;
  });
  if (changed) saveSettings();
  return settings.checkboxPhrases[site];
}

// Render the phrase group management panel.
export function openPhraseManagementPanel(site) {
  const panel = document.getElementById('phrases-linker-content');
  if (!panel) {
    console.warn('[PHRASES] Panneau #phrases-linker-content introuvable');
    resetPhrasePotState();
    return;
  }

  panel.innerHTML = '';

  if (!site || !settings.patterns?.[site]) {
    resetPhrasePotState();
    const lockMessage = document.createElement('div');
    lockMessage.style.padding = '20px';
    lockMessage.style.textAlign = 'center';
    lockMessage.style.backgroundColor = '#f5f5f5';
    lockMessage.style.border = '2px solid #ddd';
    lockMessage.style.borderRadius = '8px';
    lockMessage.style.color = '#666';
    const lmH3 = document.createElement('h3');
    lmH3.textContent = t('checkboxNoProviderTitle');
    const lmP = document.createElement('p');
    lmP.textContent = t('phraseNoProviderDescription');
    lockMessage.appendChild(lmH3);
    lockMessage.appendChild(lmP);
    panel.appendChild(lockMessage);
    return;
  }

  const phraseGroups = ensureCheckboxPhraseGroups(site);

  function savePhraseGroups() {
    saveSettings();
  }

  function saveAndRenderPhraseGroups() {
    savePhraseGroups();
    renderExistingGroups();
  }

  const potSection = document.createElement('div');
  potSection.style.cssText = `
    border: 2px dashed #1976d2; border-radius: 8px; padding: 16px;
    background: #f2f7ff; margin-bottom: 20px;
  `;

  const potTitle = document.createElement('div');
  potTitle.textContent = t('phraseNewGroupTitle');
  potTitle.style.cssText = 'font-weight: 600; font-size: 14px; margin-bottom: 12px; color: #1976d2;';
  potSection.appendChild(potTitle);

  resetPhrasePotState();

  const potControls = document.createElement('div');
  potControls.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px;';

  const potToggle = document.createElement('button');
  potToggle.type = 'button';
  potToggle.style.cssText = 'padding:6px 10px; border-radius:6px; border:1px solid #1976d2; background:#1976d2; color:#fff; cursor:pointer; font-weight:600;';
  potToggle.textContent = t('phraseModeActivate');

  const potClear = document.createElement('button');
  potClear.type = 'button';
  potClear.style.cssText = 'padding:6px 10px; border-radius:6px; border:1px solid #888; background:#fff; color:#333; cursor:pointer; display:none;';
  potClear.textContent = t('phraseClearSelection');

  const potValidate = document.createElement('button');
  potValidate.type = 'button';
  potValidate.style.cssText = 'padding:6px 10px; border-radius:6px; border:1px solid #2e7d32; background:#2e7d32; color:#fff; cursor:pointer; font-weight:600; display:none;';
  potValidate.textContent = t('phraseCreateGroup');

  const potStatus = document.createElement('span');
  potStatus.style.cssText = 'font-size:12px; color:#555; margin-left:auto;';
  potStatus.textContent = t('phraseModeInactive');

  potControls.appendChild(potToggle);
  potControls.appendChild(potClear);
  potControls.appendChild(potValidate);
  potControls.appendChild(potStatus);
  potSection.appendChild(potControls);

  const checkboxGrid = document.createElement('div');
  checkboxGrid.id = 'panel-checkbox-grid';
  checkboxGrid.className = 'phr-grid';
  checkboxGrid.style.cssText = `
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px; max-height: 300px; overflow-y: auto;
  `;
  potSection.appendChild(checkboxGrid);

  function updatePotUI() {
    potToggle.textContent = phrasePotState.active ? t('phraseModeDeactivate') : t('phraseModeActivate');
    potToggle.style.background = phrasePotState.active ? '#ff9800' : '#1976d2';
    potToggle.style.borderColor = phrasePotState.active ? '#ff9800' : '#1976d2';
    potClear.style.display = phrasePotState.active ? 'inline-block' : 'none';
    potValidate.style.display = phrasePotState.active ? 'inline-block' : 'none';
    potStatus.textContent = phrasePotState.active
      ? (phrasePotState.family ? t('phraseStatusSelection', [phrasePotState.family, String(phrasePotState.orderIds.length)]) : t('phraseSelectFirstCheckbox'))
      : t('phraseModeInactive');
  }

  function clearPhrasePotSelection({ keepActive = false } = {}) {
    resetPhrasePotState({ active: keepActive && phrasePotState.active });
    clearPhrasePotSelectionStyles(checkboxGrid);
    updatePotUI();
  }

  function renderCheckboxesForPot() {
    checkboxGrid.innerHTML = '';
    const customCheckboxes = settings.customCheckboxes[site] || [];
    const byFamily = new Map();

    customCheckboxes.forEach(checkbox => {
      const family = (checkbox.family || '').trim() || t('checkboxNoFamily');
      if (!byFamily.has(family)) byFamily.set(family, []);
      byFamily.get(family).push(checkbox);
    });

    Array.from(byFamily.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([family, checkboxes]) => {
        const familyBlock = document.createElement('div');
        familyBlock.style.cssText = 'grid-column: 1 / -1; font-weight: 600; font-size: 12px; color: #1976d2; margin-top: 8px;';
        familyBlock.textContent = family;
        checkboxGrid.appendChild(familyBlock);

        checkboxes.forEach(checkbox => {
          const item = document.createElement('div');
          item.className = 'pot-cb-item';
          item.dataset.cbId = checkbox.id;
          item.dataset.family = family;
          item.style.cssText = `
            padding: 6px 10px; border: 1px solid #e8e8e8; border-radius: 6px;
            background: #fff; cursor: pointer; font-size: 12px;
            transition: all 0.2s;
          `;
          item.textContent = checkbox.text;

          item.onclick = () => {
            if (!phrasePotState.active) return;
            const itemFamily = item.dataset.family;
            if (!phrasePotState.family) phrasePotState.family = itemFamily;

            const selectedIndex = phrasePotState.orderIds.indexOf(checkbox.id);
            if (selectedIndex === -1) {
              phrasePotState.orderIds.push(checkbox.id);
              item.style.borderColor = '#1976d2';
              item.style.background = '#e3f2fd';
              item.style.fontWeight = '600';
            } else {
              phrasePotState.orderIds.splice(selectedIndex, 1);
              item.style.borderColor = '#e8e8e8';
              item.style.background = '#fff';
              item.style.fontWeight = 'normal';
            }

            updatePotUI();
          };

          checkboxGrid.appendChild(item);
        });
      });
  }

  potToggle.onclick = () => {
    if (phrasePotState.active) {
      clearPhrasePotSelection({ keepActive: false });
      return;
    }

    resetPhrasePotState({ active: true });
    updatePotUI();
  };

  potClear.onclick = () => {
    clearPhrasePotSelection({ keepActive: true });
  };

  potValidate.onclick = () => {
    if (!phrasePotState.active || !phrasePotState.family || phrasePotState.orderIds.length < 2) {
      alertInline(t('phraseSelectAtLeastTwo'), 'warning');
      return;
    }

    const payload = {
      id: createPhraseGroupId(phrasePotState.family),
      title: t('phraseGroupDefaultTitle', phrasePotState.family),
      family: phrasePotState.family,
      order: [...phrasePotState.orderIds],
      prefix: '',
      connector: ' + ',
      lastConnector: ' + ',
      suffix: ''
    };

    phraseGroups.push(payload);
    saveAndRenderPhraseGroups();
    clearPhrasePotSelection({ keepActive: true });
    alertInline(t('phraseGroupCreated'), 'success');
  };

  panel.appendChild(potSection);

  const groupsSection = document.createElement('div');
  groupsSection.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; padding: 16px; background: #fafafa;';

  const groupsTitle = document.createElement('div');
  groupsTitle.textContent = t('phraseExistingGroups');
  groupsTitle.style.cssText = 'font-weight: 600; font-size: 14px; margin-bottom: 12px; color: #333;';
  groupsSection.appendChild(groupsTitle);

  const groupsList = document.createElement('div');
  groupsList.id = 'panel-groups-list';
  groupsSection.appendChild(groupsList);

  function renderExistingGroups() {
    groupsList.innerHTML = '';
    if (phraseGroups.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'font-style:italic; color:#999; font-size:12px;';
      emptyMsg.textContent = t('phraseNoGroups');
      groupsList.appendChild(emptyMsg);
      return;
    }

    phraseGroups.forEach((group, index) => {
      const groupElement = document.createElement('div');
      groupElement.style.cssText = `
        padding: 10px; border: 1px solid #ddd; border-radius: 6px;
        background: #fff; margin-bottom: 8px; display: flex;
        align-items: center; justify-content: space-between;
      `;

      const checkboxValues = (group.order || []).map(id => {
        const checkbox = (settings.customCheckboxes[site] || []).find(item => item.id === id);
        return checkbox ? checkbox.value : `[${id}]`;
      });

      const prefix = group.prefix ?? '';
      const connector = group.connector ?? ' + ';
      const lastConnector = group.lastConnector ?? connector;
      const suffix = group.suffix ?? '';

      let previewCore = '';
      if (checkboxValues.length === 1) {
        previewCore = checkboxValues[0] || '';
      } else if (checkboxValues.length === 2) {
        previewCore = `${checkboxValues[0] || ''}${lastConnector}${checkboxValues[1] || ''}`;
      } else if (checkboxValues.length > 2) {
        previewCore = checkboxValues.slice(0, -1).join(connector) + lastConnector + (checkboxValues[checkboxValues.length - 1] || '');
      }

      const info = createPhraseGroupInfoBlock(group, index, prefix + previewCore + suffix);

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 6px;';

      const deleteButton = document.createElement('button');
      deleteButton.textContent = '🗑';
      deleteButton.title = t('phraseDeleteGroupTitle');
      deleteButton.style.cssText = 'border:none; background:transparent; cursor:pointer; font-size:16px;';
      deleteButton.onclick = async () => {
        const confirmed = await confirmInline(deleteButton, t('phraseDeleteGroupConfirm', group.title || group.id));
        if (!confirmed) return;
        phraseGroups.splice(index, 1);
        saveAndRenderPhraseGroups();
      };

      actions.appendChild(deleteButton);
      groupElement.appendChild(info);
      groupElement.appendChild(actions);
      groupsList.appendChild(groupElement);
    });

    groupsList.querySelectorAll('input[data-idx]').forEach(input => {
      input.addEventListener('change', event => {
        const target = event.target;
        const index = parseInt(target.getAttribute('data-idx'), 10);
        const key = target.getAttribute('data-k');
        if (!Number.isFinite(index) || !key || !phraseGroups[index]) return;

        phraseGroups[index][key] = target.value;
        saveAndRenderPhraseGroups();
      });
    });
  }

  panel.appendChild(groupsSection);

  renderCheckboxesForPot();
  renderExistingGroups();
  updatePotUI();
}
