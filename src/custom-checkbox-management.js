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
  const AUTOSAVE_DELAY_MS = 500;
  resetCheckboxForm();

  const { favoriteBtn, addBtn: addCbBtn, cancelBtn } = getCheckboxFormElements();
  let autosaveTimer = null;
  let draftCheckboxId = null;
  let draftSite = null;

  const clearDraftTracking = () => {
    draftCheckboxId = null;
    draftSite = null;
  };

  const ensureCheckboxDraftSaved = async () => {
    const { text, value, family, favorite } = getCheckboxFormState();
    const site = getParameterProviderSiteKey();

    if (!site || !hasValidProvider(settings, site) || !text || !value) {
      return false;
    }

    if (!settings.customCheckboxes) settings.customCheckboxes = {};
    if (!settings.customCheckboxes[site]) settings.customCheckboxes[site] = [];

    let targetId = null;
    let existingCheckbox = null;

    if (isEditing()) {
      const editInfo = getEditingInfo();
      targetId = editInfo?.checkbox?.id || null;
      existingCheckbox = settings.customCheckboxes[site].find(checkbox => checkbox.id === targetId) || editInfo?.checkbox || null;
    } else {
      const sameSiteDraft = draftCheckboxId && draftSite === site;
      existingCheckbox = sameSiteDraft
        ? settings.customCheckboxes[site].find(checkbox => checkbox.id === draftCheckboxId) || null
        : null;

      if (!existingCheckbox) {
        targetId = generateUniqueId();
        existingCheckbox = { id: targetId, pinned: false };
        settings.customCheckboxes[site].push(existingCheckbox);
        draftCheckboxId = targetId;
        draftSite = site;
      } else {
        targetId = existingCheckbox.id;
      }
    }

    const nextCheckbox = {
      ...existingCheckbox,
      id: targetId,
      text,
      value,
      family,
      favorite,
      pinned: existingCheckbox?.pinned || false
    };

    const index = settings.customCheckboxes[site].findIndex(checkbox => checkbox.id === targetId);
    if (index === -1) settings.customCheckboxes[site].push(nextCheckbox);
    else settings.customCheckboxes[site][index] = nextCheckbox;

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
    return true;
  };

  const scheduleAutosave = () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      void ensureCheckboxDraftSaved();
    }, AUTOSAVE_DELAY_MS);
  };

  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', () => {
      const isFavorite = favoriteBtn.getAttribute('data-favorite') === 'true';
      setFavoriteButtonState(!isFavorite);
      scheduleAutosave();
    });
  }

  const { textInput, valueInput, familyInput } = getCheckboxFormElements();
  [textInput, valueInput, familyInput].forEach(input => {
    input?.addEventListener('input', () => {
      scheduleAutosave();
    });
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      clearTimeout(autosaveTimer);
      cancelEdit();
      clearDraftTracking();
    });
  }

  if (!addCbBtn) return;

  addCbBtn.addEventListener('click', async () => {
    clearTimeout(autosaveTimer);
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

    await ensureCheckboxDraftSaved();

    if (isEditing()) {
      cancelEdit();
    }

    clearDraftTracking();
    resetCheckboxForm();
  });
}
