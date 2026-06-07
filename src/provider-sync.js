// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { detectProviderFromUrl as detectProviderFromUrlByRules } from './domain/provider-rules.js';

const PROVIDER_SELECT_IDS = ['prestataire-select', 'prest-param', 'prest-organization'];

export function getProviderSelects() {
  return {
    analyse: document.getElementById('prestataire-select'),
    param: document.getElementById('prest-param'),
    organization: document.getElementById('prest-organization')
  };
}

export function getCurrentProviderSelection() {
  const selects = getProviderSelects();
  return selects.analyse?.value || selects.param?.value || selects.organization?.value || '';
}

export function syncProviderSelects(value) {
  const nextValue = typeof value === 'string' ? value : '';
  PROVIDER_SELECT_IDS.forEach(id => {
    const select = document.getElementById(id);
    if (select) select.value = nextValue;
  });
  return nextValue;
}

export function bindProviderSelects({ onProviderChanged } = {}) {
  const selects = Object.values(getProviderSelects()).filter(Boolean);

  const notify = value => {
    const nextValue = syncProviderSelects(value);
    if (typeof onProviderChanged === 'function') onProviderChanged(nextValue);
  };

  selects.forEach(select => {
    select.onchange = event => notify(event.target.value);
  });
}

export function detectProviderFromUrl(url, settings) {
  return detectProviderFromUrlByRules(url, settings);
}