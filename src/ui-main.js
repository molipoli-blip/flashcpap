// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// src/ui-main.js - Point d'entrée principal pour le système UI modulaire
// Ce fichier orchestre l'initialisation de l'interface modulaire.

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

function normalizeProvider(providerKey) {
  return resolveProviderLabel(providerKey, settings, { fallbackToFirstAvailable: true });
}

function isValidProvider(providerLabel) {
  return hasValidProvider(settings, providerLabel);
}

function isParameterPanelActive() {
  return !!document.getElementById('param')?.classList.contains('active');
}

function isOrganizationSubTabActive() {
  return !!document.getElementById('param-tab-organization')?.classList.contains('active');
}

function ensureProviderOrganizationState(providerLabel) {
  if (!isValidProvider(providerLabel)) return;
  recalcOrganizationOrder(providerLabel);
}

/**
 * Applique l'état activé/verrouillé des contrôles principaux selon la validité du prestataire.
 * Isole les règles UI de verrouillage hors de la fonction de mise à jour générale.
 */
function applyProviderButtonState(isNoProvider) {
  const btnAnalyse = document.getElementById('btn-analyse');
  const cbInterpret = document.getElementById('cb-interpret');

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

/**
 * Fonction principale d'initialisation de l'interface utilisateur
 */
export function initializeUI() {
  console.log('[UI][initializeUI] Initializing modular UI system...');
  
  try {
    // 1. Configuration de l'organisation des familles
    setupFamilyOrganization();
    
    // 2. Configuration de la navigation principale
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
    
    // 3. Configuration des boutons de gestion des prestataires
    setupProviderButtons({
      onProviderCreated: labelName => refreshProviderUi(labelName, { renderSettings: true }),
      onRefreshSettings: provider => refreshProviderUi(provider, {
        renderSettings: true,
        renderOrganization: isOrganizationSubTabActive()
      })
    });
    
    // 4. Population initiale des selects (inclut Organisation maintenant)
    populatePrestataireSelects();
    syncProviderSelects(resolveProviderLabel(getCurrentProviderSelection(), settings, { fallbackToFirstAvailable: true }));
    
    // 5. Affichage de l'interface par défaut
    displayDefaultInterface();
    
  console.log('[UI][initializeUI] Modular UI system initialized successfully');
    
  } catch (error) {
    console.error('[UI][initializeUI] Error initializing UI:', error);
    showToast(t('uiInitError'), 'error');
  }
}

/**
 * Affiche l'interface par défaut (onglet Analyse)
 */
function displayDefaultInterface() {
  try {
    // S'assurer que l'onglet Analyse est activé par défaut
    const analyseTab = document.querySelector('button[data-tab="analyse"]');
    if (analyseTab) {
      analyseTab.click();
    }
  } catch (error) {
    console.error('[UI][displayDefaultInterface] Error:', error);
  }
}

/**
 * Fonction de mise à jour de l'interface quand le prestataire change
 * Appelée depuis les event listeners de sélection de prestataire
 */
export function updateUIForProvider(providerKey) {
  try {
    const prov = normalizeProvider(providerKey);
    console.log('[UI][updateUIForProvider] Updating UI for provider:', prov);

    const isNoProvider = !isValidProvider(prov);
    applyProviderButtonState(isNoProvider);

    const checkboxContainer = document.getElementById('custom-checkboxes-container');
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
        try { renderBuiltInOptionChips(); } catch (e) { console.warn('[UI] Failed to render built-in chips', e); }
      }
    }

    const phrasesPanel = document.getElementById('phrases-linker-content');
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

  try { updateInterpretationControlsState({ settings, providerKey: activeProvider }); } catch {}
  try { lockCustomCheckboxControls(); } catch {}

  if (renderSettings || renderOrganization || isParameterPanelActive() || isOrganizationSubTabActive()) {
    renderParameterViews(activeProvider, {
      forceOrganization: renderOrganization || isOrganizationSubTabActive()
    });
  }

  return activeProvider;
}

/**
 * Fonction utilitaire pour obtenir le prestataire actuellement sélectionné
 */
export function getCurrentProvider() {
  try {
    return getCurrentProviderSelection();
  } catch (error) {
    console.error('[UI][getCurrentProvider] Error getting current provider:', error);
    return '';
  }
}

export default initializeUI;