// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
import { getParameterProviderSiteKey } from './checkbox-orchestrator.js';
import { refreshCheckboxUIs } from './checkbox-refresh.js';
import { getCheckboxFormElements, resetCheckboxForm, setFavoriteButtonState, updateFamilySuggestionsList } from './checkbox-settings.js';
import { hasValidProvider } from './domain/provider-rules.js';
import { t } from './i18n.js';

function getCheckboxFormState() {
  const { textInput, valueInput, familyInput, favoriteBtn } = getCheckboxFormElements();
  return {
    text: (textInput?.value || '').trim(),
    value: (valueInput?.value || '').trim(),
    family: (familyInput?.value || '').trim(),
    favorite: favoriteBtn?.getAttribute('data-favorite') === 'true'
  };
}

export function setupCustomCheckboxManagement({
  settings,
  saveSettings,
  addFamilyToSuggestions,
  renderOrganizationInterface,
  alertInline,
  isEditing,
  getEditingInfo,
  cancelEdit,
  generateUniqueId
}) {
  resetCheckboxForm();

  const { favoriteBtn, addBtn: addCbBtn, cancelBtn } = getCheckboxFormElements();

  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', () => {
      const isFavorite = favoriteBtn.getAttribute('data-favorite') === 'true';
      setFavoriteButtonState(!isFavorite);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      cancelEdit();
    });
  }

  if (!addCbBtn) return;

  addCbBtn.addEventListener('click', async () => {
    const { text, value, family, favorite } = getCheckboxFormState();
    const site = getParameterProviderSiteKey();

    if (!text || !value) {
      alertInline(t('checkboxFormMissingFields'), 'warning');
      return;
    }
    if (!site) {
      alertInline(t('checkboxProviderSelect'), 'warning');
      return;
    }
    if (!hasValidProvider(settings, site)) {
      alertInline(t('checkboxProviderInvalid'), 'error');
      return;
    }

    if (!settings.customCheckboxes) settings.customCheckboxes = {};
    if (!settings.customCheckboxes[site]) settings.customCheckboxes[site] = [];

    if (isEditing()) {
      const editInfo = getEditingInfo();
      const updatedCheckbox = {
        id: editInfo.checkbox.id,
        text,
        value,
        family,
        favorite,
        pinned: editInfo.checkbox.pinned || false
      };
      settings.customCheckboxes[site].push(updatedCheckbox);
      cancelEdit();
    } else {
      const newCheckbox = { id: generateUniqueId(), text, value, family, favorite, pinned: false };
      settings.customCheckboxes[site].push(newCheckbox);
    }

    if (family) {
      addFamilyToSuggestions(family);
      updateFamilySuggestionsList();
      const orgPanel = document.getElementById('param-organization-panel');
      if (orgPanel && orgPanel.classList.contains('active')) {
        renderOrganizationInterface();
      }
    }

    saveSettings();

    await refreshCheckboxUIs({ siteKey: site, refreshSummary: true });

    resetCheckboxForm();
  });
}
