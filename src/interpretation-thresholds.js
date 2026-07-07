// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { hasValidProvider, toProviderKey } from './domain/provider-rules.js';
import { t } from './i18n.js';
import { settings as liveSettings } from './storage.js';

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
  const effectiveSettings = settings || liveSettings;
  const hasValidSelection = hasValidProvider(effectiveSettings, currentProvider);

  setInterpretationInputsEnabled(hasValidSelection);
  updateInterpretationLockMessage(hasValidSelection);
  refreshInterpretationInputValues();

  return hasValidSelection;
}

function refreshInterpretationInputValues() {
  const { thObs, thIah, thFuites, txtObsGe, txtObsLt, txtIahGe, txtIahLt, txtFuitesGe, txtFuitesLt } = getInterpretationElements();
  if (!thObs || !thIah || !thFuites) return;

  const parseMaybeNumber = rawValue => {
    const normalized = String(rawValue ?? '').replace(',', '.').trim();
    if (!normalized) return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  };

  try {
    const interp = liveSettings.interpretation || {};
    const obsThreshold = parseMaybeNumber(interp.obsHours);
    const iahThreshold = parseMaybeNumber(interp.iah);
    const fuitesThreshold = parseMaybeNumber(interp.fuites);
    thObs.value = obsThreshold === null ? '' : String(obsThreshold);
    thIah.value = iahThreshold === null ? '' : String(iahThreshold);
    thFuites.value = fuitesThreshold === null ? '' : String(fuitesThreshold);
    const T = interp.texts || {};
    if (txtObsGe) txtObsGe.value = T.obs?.ge ?? '';
    if (txtObsLt) txtObsLt.value = T.obs?.lt ?? '';
    if (txtIahGe) txtIahGe.value = T.iah?.ge ?? '';
    if (txtIahLt) txtIahLt.value = T.iah?.lt ?? '';
    if (txtFuitesGe) txtFuitesGe.value = T.fuites?.ge ?? '';
    if (txtFuitesLt) txtFuitesLt.value = T.fuites?.lt ?? '';
  } catch {}
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
      liveSettings.interpretation = payload;
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
    const obsThreshold = parseMaybeNumber(settings.interpretation?.obsHours);
    const iahThreshold = parseMaybeNumber(settings.interpretation?.iah);
    const fuitesThreshold = parseMaybeNumber(settings.interpretation?.fuites);
    thObs.value = obsThreshold === null ? '' : String(obsThreshold);
    thIah.value = iahThreshold === null ? '' : String(iahThreshold);
    thFuites.value = fuitesThreshold === null ? '' : String(fuitesThreshold);
    thObs.placeholder = t('interpretationObsThresholdPlaceholder');
    thIah.placeholder = t('interpretationIahThresholdPlaceholder');
    thFuites.placeholder = t('interpretationLeaksThresholdPlaceholder');
    const T = settings.interpretation?.texts || {};
    if (txtObsGe) txtObsGe.value = T.obs?.ge ?? '';
    if (txtObsLt) txtObsLt.value = T.obs?.lt ?? '';
    if (txtIahGe) txtIahGe.value = T.iah?.ge ?? '';
    if (txtIahLt) txtIahLt.value = T.iah?.lt ?? '';
    if (txtFuitesGe) txtFuitesGe.value = T.fuites?.ge ?? '';
    if (txtFuitesLt) txtFuitesLt.value = T.fuites?.lt ?? '';
    if (txtObsGe) txtObsGe.placeholder = '';
    if (txtObsLt) txtObsLt.placeholder = '';
    if (txtIahGe) txtIahGe.placeholder = '';
    if (txtIahLt) txtIahLt.placeholder = '';
    if (txtFuitesGe) txtFuitesGe.placeholder = '';
    if (txtFuitesLt) txtFuitesLt.placeholder = '';
    lastSerializedPayload = JSON.stringify(buildInterpretationPayload());
  } catch {}

  updateInterpretationControlsState({ settings });

  [thObs, thIah, thFuites, txtObsGe, txtObsLt, txtIahGe, txtIahLt, txtFuitesGe, txtFuitesLt].forEach(element => {
    element?.addEventListener('input', () => persistInterpretation());
    element?.addEventListener('change', () => persistInterpretation({ immediate: true }));
  });

}
