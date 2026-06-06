// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap

import { hasValidProvider, toProviderKey } from './domain/provider-rules.js';
import { t } from './i18n.js';

const DEFAULT_INTERPRETATION_VALUES = {
  obsHours: 4,
  iah: 5,
  fuites: 24,
  texts: {
    obs: { ge: 'bonne observance', lt: 'observance non satisfaisante' },
    iah: { ge: 'non efficace', lt: 'efficace' },
    fuites: { ge: 'fuites significatives', lt: 'pas de fuites' }
  }
};

function getInterpretationElements() {
  return {
    thObs: document.getElementById('th-obs'),
    thIah: document.getElementById('th-iah'),
    thFuites: document.getElementById('th-fuites'),
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
    thStatus,
    txtObsGe,
    txtObsLt,
    txtIahGe,
    txtIahLt,
    txtFuitesGe,
    txtFuitesLt
  } = getInterpretationElements();

  if (!(thObs && thIah && thFuites)) return;

  const parseMaybeNumber = rawValue => {
    const normalized = String(rawValue ?? '').replace(',', '.').trim();
    if (!normalized) return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  };

  const buildInterpretationPayload = () => {
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
    return {
      obsHours: parseMaybeNumber(thObs.value),
      iah: parseMaybeNumber(thIah.value),
      fuites: parseMaybeNumber(thFuites.value),
      texts
    };
  };

  const showStatus = (message, color = '#0a7') => {
    if (!thStatus) return;
    thStatus.style.display = 'block';
    thStatus.style.color = color;
    thStatus.textContent = message;
    setTimeout(() => {
      thStatus.style.display = 'none';
    }, 1200);
  };

  let autosaveTimer = null;
  let lastSerializedPayload = '';

  const persistInterpretation = ({ immediate = false } = {}) => {
    const commit = () => {
      const payload = buildInterpretationPayload();
      const serialized = JSON.stringify(payload);
      if (serialized === lastSerializedPayload) return;

      settings.interpretation = payload;
      saveSettings();
      lastSerializedPayload = serialized;

      try {
        updateSummaryDisplay();
      } catch {}

      showStatus(t('interpretationSaved'));
    };

    if (immediate) {
      clearTimeout(autosaveTimer);
      commit();
      return;
    }

    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(commit, 450);
  };

  try {
    thObs.value = Number.isFinite(Number(settings.interpretation?.obsHours)) ? String(settings.interpretation?.obsHours) : '';
    thIah.value = Number.isFinite(Number(settings.interpretation?.iah)) ? String(settings.interpretation?.iah) : '';
    thFuites.value = Number.isFinite(Number(settings.interpretation?.fuites)) ? String(settings.interpretation?.fuites) : '';
    thObs.placeholder = String(DEFAULT_INTERPRETATION_VALUES.obsHours);
    thIah.placeholder = String(DEFAULT_INTERPRETATION_VALUES.iah);
    thFuites.placeholder = String(DEFAULT_INTERPRETATION_VALUES.fuites);
    const T = settings.interpretation?.texts || {};
    if (txtObsGe) txtObsGe.value = T.obs?.ge ?? '';
    if (txtObsLt) txtObsLt.value = T.obs?.lt ?? '';
    if (txtIahGe) txtIahGe.value = T.iah?.ge ?? '';
    if (txtIahLt) txtIahLt.value = T.iah?.lt ?? '';
    if (txtFuitesGe) txtFuitesGe.value = T.fuites?.ge ?? '';
    if (txtFuitesLt) txtFuitesLt.value = T.fuites?.lt ?? '';
    if (txtObsGe && !txtObsGe.placeholder) txtObsGe.placeholder = DEFAULT_INTERPRETATION_VALUES.texts.obs.ge;
    if (txtObsLt && !txtObsLt.placeholder) txtObsLt.placeholder = DEFAULT_INTERPRETATION_VALUES.texts.obs.lt;
    if (txtIahGe && !txtIahGe.placeholder) txtIahGe.placeholder = DEFAULT_INTERPRETATION_VALUES.texts.iah.ge;
    if (txtIahLt && !txtIahLt.placeholder) txtIahLt.placeholder = DEFAULT_INTERPRETATION_VALUES.texts.iah.lt;
    if (txtFuitesGe && !txtFuitesGe.placeholder) txtFuitesGe.placeholder = DEFAULT_INTERPRETATION_VALUES.texts.fuites.ge;
    if (txtFuitesLt && !txtFuitesLt.placeholder) txtFuitesLt.placeholder = DEFAULT_INTERPRETATION_VALUES.texts.fuites.lt;
    lastSerializedPayload = JSON.stringify(buildInterpretationPayload());
  } catch {}

  updateInterpretationControlsState({ settings });

  [thObs, thIah, thFuites, txtObsGe, txtObsLt, txtIahGe, txtIahLt, txtFuitesGe, txtFuitesLt].forEach(element => {
    element?.addEventListener('input', () => persistInterpretation());
    element?.addEventListener('change', () => persistInterpretation({ immediate: true }));
  });

}
