// SPDX-License-Identifier: Apache-2.0

import { logFlow } from './debug-logger.js';
import { browserApi } from './platform/browser-api.js';

function normalizeUiLanguage(language) {
  return String(language || 'fr').trim() || 'fr';
}

function getBrowserLanguageSnapshot() {
  try {
    return {
      chromeUiLanguage: browserApi.i18n?.getUiLanguage?.() || null,
      navigatorLanguage: navigator?.language || null,
      navigatorLanguages: Array.isArray(navigator?.languages) ? navigator.languages : []
    };
  } catch {
    return {
      chromeUiLanguage: null,
      navigatorLanguage: null,
      navigatorLanguages: []
    };
  }
}

function detectEffectiveExtensionLanguage() {
  const analyzeLabel = t('buttonAnalyzePage');
  if (analyzeLabel === 'Analyze page') return 'en';
  if (analyzeLabel === 'Analyser la page') return 'fr';

  const popupTitle = t('popupTitle');
  if (popupTitle === 'FlashCPAP') {
    const lang = getUiLanguage().split('-')[0] || 'fr';
    return lang;
  }

  return 'unknown';
}

function logI18nState(root, uiLanguage) {
  const browserLanguageState = getBrowserLanguageSnapshot();
  const extensionLanguage = detectEffectiveExtensionLanguage();

  logFlow('I18N', 'Browser and extension language state', {
    root: root === document ? 'document' : 'fragment',
    chromeUiLanguage: browserLanguageState.chromeUiLanguage,
    normalizedUiLanguage: uiLanguage,
    navigatorLanguage: browserLanguageState.navigatorLanguage,
    navigatorLanguages: browserLanguageState.navigatorLanguages,
    effectiveExtensionLanguage: extensionLanguage,
    documentLanguage: document?.documentElement?.lang || null,
    sampleAnalyzeLabel: t('buttonAnalyzePage')
  });
}

export function getUiLanguage() {
  try {
    return normalizeUiLanguage(browserApi.i18n?.getUiLanguage?.());
  } catch {
    return 'fr';
  }
}

export function t(key, substitutions) {
  try {
    const message = browserApi.i18n?.getMessage?.(key, substitutions);
    return message || key;
  } catch {
    return key;
  }
}

function applyAttributeTranslation(root, attributeName, setter) {
  root.querySelectorAll(`[${attributeName}]`).forEach(element => {
    const key = element.getAttribute(attributeName);
    if (!key) return;
    setter(element, t(key));
  });
}

export function applyTranslations(root = document) {
  const uiLanguage = getUiLanguage();
  if (root === document && document?.documentElement) {
    document.documentElement.lang = uiLanguage.split('-')[0] || 'fr';
  }

  applyAttributeTranslation(root, 'data-i18n', (element, message) => {
    element.textContent = message;
  });
  applyAttributeTranslation(root, 'data-i18n-html', (element, message) => {
    element.innerHTML = message;
  });
  applyAttributeTranslation(root, 'data-i18n-title', (element, message) => {
    element.title = message;
  });
  applyAttributeTranslation(root, 'data-i18n-placeholder', (element, message) => {
    element.setAttribute('placeholder', message);
  });
  applyAttributeTranslation(root, 'data-i18n-aria-label', (element, message) => {
    element.setAttribute('aria-label', message);
  });

  logI18nState(root, uiLanguage);
}
