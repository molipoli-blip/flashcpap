// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { setupTabNavigation } from './navigation.js';
import { renderSettingsUI } from './field-management.js';
import { populatePrestataireSelects, setupProviderButtons, setupImportExportUI } from './provider-management.js';
import { getCurrentProviderSelection, syncProviderSelects } from './provider-sync.js';
import { createCustomCheckboxesUI, renderBuiltInOptionChips } from './checkbox-ui.js';
import { lockCustomCheckboxControls } from './checkbox-settings.js';
import { refreshCheckboxUIs } from './checkbox-refresh.js';
import { setupFamilyOrganization, renderOrganizationInterface, recalcOrganizationOrder } from './organization.js';
import { updateInterpretationControlsState } from './interpretation-thresholds.js';
import { showToast } from './ui-utils.js';
import { settings } from './storage.js';
import { hasValidProvider, resolveProviderLabel } from './domain/provider-rules.js';
import { t } from './i18n.js';
import { byId } from './dom-utils.js';
import { safeRun } from './error-handling.js';

function normalizeProvider(providerKey) {
  return resolveProviderLabel(providerKey, settings, { fallbackToFirstAvailable: true });
}

function isValidProvider(providerLabel) {
  return hasValidProvider(settings, providerLabel);
}

function isParameterPanelActive() {
  return !!byId('param')?.classList.contains('active');
}

function isOrganizationSubTabActive() {
  return !!byId('param-tab-organization')?.classList.contains('active');
}

function ensureProviderOrganizationState(providerLabel) {
  if (!isValidProvider(providerLabel)) return;
  recalcOrganizationOrder(providerLabel);
}

function applyProviderButtonState(isNoProvider) {
  const btnAnalyse = byId('btn-analyse');
  const cbInterpret = byId('cb-interpret');

  if (btnAnalyse) {
    btnAnalyse.disabled = isNoProvider;
    btnAnalyse.style.opacity = isNoProvider ? '0.5' : '1';
    btnAnalyse.style.cursor = isNoProvider ? 'not-allowed' : 'pointer';
    btnAnalyse.title = isNoProvider ? t('uiAnalyzeNeedsProvider') : t('buttonAnalyzePage');
  }

  if (cbInterpret) {
    cbInterpret.disabled = isNoProvider;
    cbInterpret.parentElement.style.opacity = isNoProvider ? '0.5' : '1';
  }
}

export function renderParameterViews(providerKey, { forceOrganization = false } = {}) {
  const provider = normalizeProvider(providerKey);
  renderSettingsUI(provider);
  setupImportExportUI({
    onRefreshSettings: nextProvider => refreshProviderUi(nextProvider, {
      renderSettings: true,
      renderOrganization: forceOrganization || isOrganizationSubTabActive()
    })
  });

  if (forceOrganization || isOrganizationSubTabActive()) {
    try {
      ensureProviderOrganizationState(provider);
      renderOrganizationInterface();
    } catch (error) {
      console.warn('[UI][renderParameterViews] Failed to render organization panel', error);
    }
  }

  return provider;
}

export function initializeUI() {
  console.log('[UI][initializeUI] Initializing modular UI system...');

  try {
    setupFamilyOrganization();

    setupTabNavigation({
      onMainTabActivated: tabName => {
        if (tabName === 'param') {
          renderParameterViews(getCurrentProvider());
        }
      },
      onSubTabActivated: subtab => {
        if (subtab === 'organization') {
          renderParameterViews(getCurrentProvider(), { forceOrganization: true });
        }
      }
    });

    setupProviderButtons({
      onProviderCreated: labelName => refreshProviderUi(labelName, { renderSettings: true }),
      onRefreshSettings: provider => refreshProviderUi(provider, {
        renderSettings: true,
        renderOrganization: isOrganizationSubTabActive()
      })
    });

    populatePrestataireSelects();
    syncProviderSelects(resolveProviderLabel(getCurrentProviderSelection(), settings, { fallbackToFirstAvailable: true }));

    displayDefaultInterface();

  console.log('[UI][initializeUI] Modular UI system initialized successfully');

  } catch (error) {
    console.error('[UI][initializeUI] Error initializing UI:', error);
    showToast(t('uiInitError'), 'error');
  }
}

function displayDefaultInterface() {
  try {
    const analyseTab = document.querySelector('button[data-tab="analyse"]');
    if (analyseTab) {
      analyseTab.click();
    }
  } catch (error) {
    console.error('[UI][displayDefaultInterface] Error:', error);
  }
}

export function updateUIForProvider(providerKey) {
  try {
    const prov = normalizeProvider(providerKey);
    console.log('[UI][updateUIForProvider] Updating UI for provider:', prov);

    const isNoProvider = !isValidProvider(prov);
    applyProviderButtonState(isNoProvider);

    const checkboxContainer = byId('custom-checkboxes-container');
    if (isNoProvider) {
      if (checkboxContainer) {
        checkboxContainer.innerHTML = '';
        const lockMessage = document.createElement('div');
        lockMessage.style.cssText = 'padding:20px;text-align:center;background:#f5f5f5;border:2px solid #ddd;border-radius:8px;color:#666;margin-top:10px';
        const h3 = document.createElement('h3');
        h3.textContent = t('checkboxNoProviderTitle');
        const p = document.createElement('p');
        p.textContent = t('uiNoProviderStartDescription');
        lockMessage.append(h3, p);
        checkboxContainer.appendChild(lockMessage);
      }
    } else {
      ensureProviderOrganizationState(prov);
      if (checkboxContainer) {
        createCustomCheckboxesUI(prov);
        safeRun(() => renderBuiltInOptionChips(), { context: 'UI_RENDER_BUILTIN_CHIPS' });
      }
    }

    const phrasesPanel = byId('phrases-linker-content');
    if (phrasesPanel) {
      refreshCheckboxUIs({ providerLabel: prov, refreshAnalyse: false });
    }

    return prov;

  } catch (error) {
    console.error('[UI][updateUIForProvider] Error updating UI for provider:', error);
    return normalizeProvider(providerKey);
  }
}

export function refreshProviderUi(providerKey, { renderSettings = false, renderOrganization = false } = {}) {
  const provider = normalizeProvider(providerKey);

  syncProviderSelects(provider);
  const activeProvider = updateUIForProvider(provider);

  safeRun(() => updateInterpretationControlsState({ settings, providerKey: activeProvider }), { context: 'UI_REFRESH_INTERPRETATION_STATE' });
  safeRun(() => lockCustomCheckboxControls(), { context: 'UI_LOCK_CUSTOM_CHECKBOX' });

  if (renderSettings || renderOrganization || isParameterPanelActive() || isOrganizationSubTabActive()) {
    renderParameterViews(activeProvider, {
      forceOrganization: renderOrganization || isOrganizationSubTabActive()
    });
  }

  return activeProvider;
}

export function getCurrentProvider() {
  try {
    return getCurrentProviderSelection();
  } catch (error) {
    console.error('[UI][getCurrentProvider] Error getting current provider:', error);
    return '';
  }
}

export default initializeUI;
