// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap

import { hasValidProvider, toProviderKey } from './domain/provider-rules.js';
import { t } from './i18n.js';

function getInterpretationElements() {
  return {
    thObs: document.getElementById('th-obs'),
    thIah: document.getElementById('th-iah'),
    thFuites: document.getElementById('th-fuites'),
    thSave: document.getElementById('th-save'),
    thStatus: document.getElementById('th-status'),
    txtObsGe: document.getElementById('txt-obs-ge'),
    txtObsLt: document.getElementById('txt-obs-lt'),
    txtIahGe: document.getElementById('txt-iah-ge'),
    txtIahLt: document.getElementById('txt-iah-lt'),
    txtFuitesGe: document.getElementById('txt-fuites-ge'),
    txtFuitesLt: document.getElementById('txt-fuites-lt'),
    interpTexts: document.querySelector('.interp-texts')
  };
}

function setInterpretationInputsEnabled(enabled) {
  const {
    thObs,
    thIah,
    thFuites,
    thSave,
    txtObsGe,
    txtObsLt,
    txtIahGe,
    txtIahLt,
    txtFuitesGe,
    txtFuitesLt
  } = getInterpretationElements();

  [thObs, thIah, thFuites, txtObsGe, txtObsLt, txtIahGe, txtIahLt, txtFuitesGe, txtFuitesLt].forEach(element => {
    if (!element) return;
    element.disabled = !enabled;
    element.style.opacity = enabled ? '1' : '0.5';
    element.style.cursor = enabled ? '' : 'not-allowed';
  });

  if (thSave) {
    thSave.disabled = !enabled;
    thSave.style.opacity = enabled ? '1' : '0.5';
    thSave.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }
}

function updateInterpretationLockMessage(enabled) {
  const { interpTexts } = getInterpretationElements();
  const lockMessage = document.getElementById('interp-lock-message');

  if (enabled) {
    lockMessage?.remove();
    return;
  }

  if (!interpTexts || lockMessage) return;

  const nextLockMessage = document.createElement('div');
  nextLockMessage.id = 'interp-lock-message';
  nextLockMessage.style.padding = '15px';
  nextLockMessage.style.backgroundColor = '#f5f5f5';
  nextLockMessage.style.border = '2px solid #ddd';
  nextLockMessage.style.borderRadius = '8px';
  nextLockMessage.style.color = '#666';
  nextLockMessage.style.marginTop = '10px';
  nextLockMessage.innerHTML = `
    <h3 style="margin:0 0 10px 0; color:#333;">${t('interpretationLockTitle')}</h3>
    <p style="margin:0;">${t('interpretationLockDescription')}</p>
  `;
  interpTexts.parentElement?.insertBefore(nextLockMessage, interpTexts);
}

export function updateInterpretationControlsState({ settings, providerKey } = {}) {
  const providerSelect = document.getElementById('prest-param');
  const currentProvider = toProviderKey(providerKey || providerSelect?.value || '');
  const hasValidSelection = hasValidProvider(settings, currentProvider);

  setInterpretationInputsEnabled(hasValidSelection);
  updateInterpretationLockMessage(hasValidSelection);

  return hasValidSelection;
}

export function setupInterpretationThresholds({ settings, saveSettings, updateSummaryDisplay }) {
  const {
    thObs,
    thIah,
    thFuites,
    thSave,
    thStatus,
    txtObsGe,
    txtObsLt,
    txtIahGe,
    txtIahLt,
    txtFuitesGe,
    txtFuitesLt
  } = getInterpretationElements();

  if (!(thObs && thIah && thFuites)) return;

  try {
    thObs.value = settings.interpretation?.obsHours ?? '';
    thIah.value = settings.interpretation?.iah ?? '';
    thFuites.value = settings.interpretation?.fuites ?? '';
    const T = settings.interpretation?.texts || {};
    if (txtObsGe) txtObsGe.value = T.obs?.ge ?? '';
    if (txtObsLt) txtObsLt.value = T.obs?.lt ?? '';
    if (txtIahGe) txtIahGe.value = T.iah?.ge ?? '';
    if (txtIahLt) txtIahLt.value = T.iah?.lt ?? '';
    if (txtFuitesGe) txtFuitesGe.value = T.fuites?.ge ?? '';
    if (txtFuitesLt) txtFuitesLt.value = T.fuites?.lt ?? '';
  } catch {}

  updateInterpretationControlsState({ settings });

  thSave?.addEventListener('click', () => {
    const obs = parseFloat(thObs.value);
    const iah = parseFloat(thIah.value);
    const fuites = parseFloat(thFuites.value);

    if ([obs, iah, fuites].some(v => isNaN(v))) {
      if (thStatus) {
        thStatus.style.display = 'block';
        thStatus.style.color = '#b00020';
        thStatus.textContent = t('interpretationInvalidValues');
      }
      return;
    }

    const texts = {
      obs: {
        ge: (txtObsGe?.value || '').trim(),
        lt: (txtObsLt?.value || '').trim()
      },
      iah: {
        ge: (txtIahGe?.value || '').trim(),
        lt: (txtIahLt?.value || '').trim()
      },
      fuites: {
        ge: (txtFuitesGe?.value || '').trim(),
        lt: (txtFuitesLt?.value || '').trim()
      }
    };

    settings.interpretation = { obsHours: obs, iah, fuites, texts };
    saveSettings();

    if (thStatus) {
      thStatus.style.display = 'block';
      thStatus.style.color = '#0a7';
      thStatus.textContent = t('interpretationSaved');
      setTimeout(() => {
        thStatus.style.display = 'none';
      }, 1500);
    }

    try {
      updateSummaryDisplay();
    } catch {}
  });
}
