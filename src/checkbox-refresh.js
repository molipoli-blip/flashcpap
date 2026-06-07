// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { renderCustomCheckboxSettings } from './checkbox-settings.js';
import { createCustomCheckboxesUI } from './checkbox-ui.js';
import { updateSummaryDisplay } from './events.js';
import {
  getAnalyseProviderLabel,
  isAnalyseProviderSite,
  normalizeProviderSiteKey
} from './checkbox-orchestrator.js';

export async function refreshCheckboxUIs({ providerLabel = '', siteKey = '', refreshAnalyse = true, refreshSummary = false } = {}) {
  const normalizedSiteKey = normalizeProviderSiteKey(siteKey || providerLabel);
  const analyseProvider = getAnalyseProviderLabel();
  const shouldRefreshAnalyse = refreshAnalyse && isAnalyseProviderSite(normalizedSiteKey);

  renderCustomCheckboxSettings(normalizedSiteKey);

  if (shouldRefreshAnalyse) {
    createCustomCheckboxesUI(analyseProvider);
  }

  if (refreshSummary) {
    await updateSummaryDisplay();
  }
}