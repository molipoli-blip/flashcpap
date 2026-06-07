// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// src/checkbox-ui.js - Interface utilisateur des checkboxes pour l'onglet Analyse
import { settings, saveSettings } from './storage.js';
import {
  getAnalyseProviderSiteKey,
  getCheckboxInputElement,
  getCheckboxInputId,
  normalizeProviderSiteKey,
  updateCheckboxById,
  updateCheckboxPinned
} from './checkbox-orchestrator.js';
import { refreshCheckboxUIs } from './checkbox-refresh.js';
import { t } from './i18n.js';
import { ensureSettingsObject } from './storage-guards.js';

const CUSTOM_CHECKBOX_EVENT = 'custom-checkbox-changed';
const CUSTOM_CHIP_STYLE = {
  display: 'inline-block',
  margin: '2px',
  padding: '3px 6px',
  fontSize: '10px',
  border: '1px solid #ddd',
  borderRadius: '3px',
  cursor: 'pointer',
  backgroundColor: '#f9f9f9',
  transition: 'all 0.2s'
};
const BUILTIN_CHIP_STYLE = {
  display: 'inline-block',
  margin: '2px',
  padding: '4px 8px',
  fontSize: '11px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  cursor: 'pointer',
  backgroundColor: '#f9f9f9',
  transition: 'all 0.2s'
};
const CHIP_THEME = {
  uncheckedBackground: '#f9f9f9',
  checkedText: 'white',
  uncheckedText: 'black',
  uncheckedBorder: '#ddd',
  hoverBackground: '#e9e9e9',
  accent: '#4a90e2'
};

function getPinnedTitle(pinned) {
  return pinned ? t('checkboxPinnedOn') : t('checkboxPinnedOff');
}

function ensurePinnedOptions() {
  if (!settings.pinnedOptions) {
    settings.pinnedOptions = { interpret: false, rodap: false };
  }
  return settings.pinnedOptions;
}

function dispatchCustomCheckboxChanged(checkboxId) {
  document.dispatchEvent(new CustomEvent(CUSTOM_CHECKBOX_EVENT, {
    detail: { checkboxId }
  }));
}

function capturePreviousCheckboxStates(container) {
  const previousStates = new Map();
  if (!container?.children.length) return previousStates;

  const inputPrefix = getCheckboxInputId('');
  container.querySelectorAll('input[type="checkbox"]').forEach(input => {
    if (input.id.startsWith(inputPrefix)) {
      previousStates.set(input.id.slice(inputPrefix.length), input.checked);
    }
  });
  return previousStates;
}

function restoreCheckboxState(chip, checkboxId, previousStates) {
  if (!previousStates.get(checkboxId)) return;
  const input = chip.querySelector('input[type="checkbox"]');
  if (!input || input.checked) return;
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function getProxyChips(container, checkboxId) {
  if (!container) return [];
  const selector = checkboxId
    ? `[data-cb-id="${checkboxId}"][data-proxy="1"]`
    : '[data-proxy="1"]';
  return Array.from(container.querySelectorAll(selector));
}

function syncProxyCheckboxVisuals(container, checkboxId = '') {
  getProxyChips(container, checkboxId).forEach(proxyChip => {
    const id = proxyChip.getAttribute('data-cb-id') || '';
    const checked = !!getCheckboxInputElement(id)?.checked;
    if (typeof proxyChip._setVisual === 'function') {
      proxyChip._setVisual(checked);
    }
  });
}

function syncCheckboxPinInputs(checkboxId, pinned, sourceInput = null) {
  document.querySelectorAll(`[data-cb-id="${checkboxId}"] .pin-switch`).forEach(pinInput => {
    if (pinInput === sourceInput) return;
    pinInput.checked = pinned;
    pinInput.title = getPinnedTitle(pinned);
  });
}

function ensureProxySyncListener(container) {
  if (!container || container.__proxySyncAttached) return;
  container.__proxySyncAttached = true;
  document.addEventListener(CUSTOM_CHECKBOX_EVENT, event => {
    syncProxyCheckboxVisuals(container, event?.detail?.checkboxId || '');
  });
}

function createPinSwitch({ checked, onToggle }) {
  const pinWrapper = document.createElement('span');
  pinWrapper.className = 'pin-switch-wrapper';
  pinWrapper.style.display = 'inline-flex';
  pinWrapper.style.alignItems = 'center';
  pinWrapper.style.cursor = 'pointer';

  const pinInput = document.createElement('input');
  pinInput.type = 'checkbox';
  pinInput.className = 'pin-switch';
  pinInput.checked = !!checked;
  pinInput.title = getPinnedTitle(pinInput.checked);

  const pinVisual = document.createElement('span');
  pinVisual.className = 'pin-switch-visual';

  pinInput.addEventListener('click', event => {
    event.stopPropagation();
    if (typeof onToggle === 'function') {
      onToggle(pinInput.checked, pinInput);
    }
    pinInput.title = getPinnedTitle(pinInput.checked);
  });

  pinWrapper.appendChild(pinInput);
  pinWrapper.appendChild(pinVisual);

  return { pinWrapper, pinInput };
}

function buildCheckboxGroupIndex(siteKey) {
  const index = new Map();
  const groups = settings.checkboxPhrases?.[siteKey] || [];
  groups.forEach(group => {
    (group.order || []).forEach(id => {
      if (!index.has(id)) index.set(id, []);
      index.get(id).push(group);
    });
  });
  return index;
}

function setChipVisual(chip, checked, accentColor) {
  chip.style.background = 'none';
  chip.style.backgroundColor = checked ? accentColor : CHIP_THEME.uncheckedBackground;
  chip.style.color = checked ? CHIP_THEME.checkedText : CHIP_THEME.uncheckedText;
  chip.style.borderColor = checked ? accentColor : CHIP_THEME.uncheckedBorder;
  chip.style.boxShadow = '';
}

function toggleBuiltInPinnedOption(key, pinned) {
  const pinnedOptions = ensurePinnedOptions();
  pinnedOptions[key] = pinned;
  saveSettings();
}

export function createCustomCheckboxesUI(prestataire) {
  const container = document.getElementById('custom-checkboxes-container');
  if (!container) return;

  const previousStates = capturePreviousCheckboxStates(container);
  container.innerHTML = '';
  ensureSettingsObject(settings, 'customCheckboxes');

  const siteKey = normalizeProviderSiteKey(prestataire);
  const customCheckboxes = settings.customCheckboxes[siteKey] || [];
  if (!customCheckboxes.length) return;

  const groupIndexByCb = buildCheckboxGroupIndex(siteKey);
  const favorites = customCheckboxes.filter(checkbox => !!checkbox.favorite);
  const families = {};

  customCheckboxes.forEach(checkbox => {
    const family = checkbox.family || t('checkboxNoFamily');
    if (!families[family]) families[family] = [];
    families[family].push(checkbox);
  });

  const toggleFavorite = (checkboxId, desired) => {
    const updatedCheckbox = updateCheckboxById(siteKey, checkboxId, checkbox => ({
      ...checkbox,
      favorite: typeof desired === 'boolean' ? desired : !checkbox.favorite
    }));
    if (updatedCheckbox) {
      refreshCheckboxUIs({ siteKey });
    }
  };

  if (favorites.length) {
    const favoriteSection = document.createElement('div');
    favoriteSection.className = 'chip-section';

    const favoriteTitle = document.createElement('div');
    favoriteTitle.className = 'chip-title favorites';
    favoriteTitle.textContent = 'Favoris';
    favoriteSection.appendChild(favoriteTitle);

    const favoriteContainer = document.createElement('div');
    favorites.forEach(checkbox => {
      const favoriteChip = createCheckboxChip(checkbox, CUSTOM_CHIP_STYLE, CHIP_THEME.accent, siteKey, {
        proxy: false,
        initialChecked: !!previousStates.get(checkbox.id),
        onToggleFavorite: newValue => toggleFavorite(checkbox.id, newValue),
        groupsForCheckbox: groupIndexByCb.get(checkbox.id) || []
      });
      favoriteChip.classList.add('chip-favorite');
      restoreCheckboxState(favoriteChip, checkbox.id, previousStates);
      favoriteContainer.appendChild(favoriteChip);
    });

    favoriteSection.appendChild(favoriteContainer);
    container.appendChild(favoriteSection);
  }

  Object.keys(families).sort().forEach(familyName => {
    const familySection = document.createElement('div');
    familySection.style.marginBottom = '6px';

    const familyTitle = document.createElement('div');
    familyTitle.textContent = familyName;
    familyTitle.style.fontSize = '10px';
    familyTitle.style.fontWeight = 'bold';
    familyTitle.style.color = '#666';
    familyTitle.style.marginBottom = '2px';
    familySection.appendChild(familyTitle);

    const familyContainer = document.createElement('div');
    familyContainer.style.lineHeight = '1.2';
    familyContainer.style.display = 'flex';
    familyContainer.style.flexWrap = 'wrap';
    familyContainer.style.alignItems = 'center';

    families[familyName].forEach(checkbox => {
      const isFavorite = !!checkbox.favorite;
      const chip = createCheckboxChip(checkbox, CUSTOM_CHIP_STYLE, CHIP_THEME.accent, siteKey, {
        proxy: isFavorite,
        initialChecked: isFavorite ? !!previousStates.get(checkbox.id) : false,
        onToggleFavorite: newValue => toggleFavorite(checkbox.id, newValue),
        groupsForCheckbox: groupIndexByCb.get(checkbox.id) || []
      });

      familyContainer.appendChild(chip);
      if (!isFavorite) {
        restoreCheckboxState(chip, checkbox.id, previousStates);
      }
    });

    familySection.appendChild(familyContainer);
    container.appendChild(familySection);
  });

  ensureProxySyncListener(container);
  syncProxyCheckboxVisuals(container);
}

function createCheckboxChip(checkbox, baseStyle, accentColor, siteKey, opts = {}) {
  const chip = document.createElement('label');
  const isProxy = !!opts.proxy;

  Object.assign(chip.style, baseStyle);
  setChipVisual(chip, false, accentColor);
  chip.dataset.cbId = checkbox.id;

  if (isProxy) {
    chip.setAttribute('data-proxy', '1');
  }

  const setVisual = checked => setChipVisual(chip, checked, accentColor);
  chip._setVisual = setVisual;

  let input = null;
  if (!isProxy) {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.id = getCheckboxInputId(checkbox.id);
    input.checked = !!opts.initialChecked;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      setVisual(input.checked);
      dispatchCustomCheckboxChanged(checkbox.id);
    });
  }

  chip.addEventListener('mouseenter', () => {
    const checked = input ? input.checked : !!getCheckboxInputElement(checkbox.id)?.checked;
    if (!checked) {
      chip.style.backgroundColor = CHIP_THEME.hoverBackground;
    }
  });

  chip.addEventListener('mouseleave', () => {
    const checked = input ? input.checked : !!getCheckboxInputElement(checkbox.id)?.checked;
    setVisual(checked);
  });

  const rowSpan = document.createElement('span');
  rowSpan.style.display = 'inline-flex';
  rowSpan.style.alignItems = 'center';
  rowSpan.style.gap = '4px';

  if (checkbox.pinned === undefined) checkbox.pinned = false;
  const { pinWrapper } = createPinSwitch({
    checked: checkbox.pinned,
    onToggle: (pinned, pinInput) => {
      if (isProxy) {
        const realPinInput = document.querySelector(`[data-cb-id="${checkbox.id}"]:not([data-proxy="1"]) .pin-switch`);
        if (realPinInput && realPinInput !== pinInput) {
          realPinInput.checked = pinned;
          realPinInput.dispatchEvent(new Event('click', { bubbles: true }));
        }
        return;
      }

      const currentSiteKey = getAnalyseProviderSiteKey() || siteKey;
      const updatedCheckbox = updateCheckboxPinned(currentSiteKey, checkbox.id, pinned);
      if (!updatedCheckbox) {
        pinInput.checked = !!checkbox.pinned;
        pinInput.title = getPinnedTitle(pinInput.checked);
        return;
      }

      checkbox.pinned = updatedCheckbox.pinned;
      pinInput.checked = checkbox.pinned;
      pinInput.title = getPinnedTitle(checkbox.pinned);
      syncCheckboxPinInputs(checkbox.id, checkbox.pinned, pinInput);
    }
  });

  const text = document.createElement('span');
  text.textContent = checkbox.text;
  text.style.maxWidth = '140px';
  text.style.overflow = 'hidden';
  text.style.textOverflow = 'ellipsis';
  text.style.whiteSpace = 'nowrap';

  try {
    const groups = Array.isArray(opts.groupsForCheckbox) ? opts.groupsForCheckbox : [];
    if (groups.length) {
      const dots = document.createElement('span');
      dots.style.display = 'inline-flex';
      dots.style.alignItems = 'center';
      dots.style.gap = '2px';
      dots.style.marginRight = '2px';

      const hashColor = value => {
        let hash = 0;
        for (let index = 0; index < value.length; index++) {
          hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
        }
        return `hsl(${hash % 360} 70% 45%)`;
      };

      groups.forEach(group => {
        const dot = document.createElement('span');
        dot.title = group.title || group.family || group.id || t('genericGroup');
        dot.style.display = 'inline-block';
        dot.style.width = '6px';
        dot.style.height = '6px';
        dot.style.borderRadius = '50%';
        dot.style.background = hashColor(group.id || String(group.title || ''));
        dot.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.06)';
        dots.appendChild(dot);
      });

      rowSpan.appendChild(dots);
    }
  } catch {}

  const star = document.createElement('button');
  star.type = 'button';
  star.textContent = checkbox.favorite ? '⭐' : '☆';
  star.title = checkbox.favorite ? t('checkboxFavoriteRemove') : t('checkboxFavoriteAdd');
  Object.assign(star.style, {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 2px'
  });
  star.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const desiredFavorite = !checkbox.favorite;
    if (typeof opts.onToggleFavorite === 'function') {
      opts.onToggleFavorite(desiredFavorite);
      return;
    }

    const currentSiteKey = getAnalyseProviderSiteKey() || siteKey;
    const updatedCheckbox = updateCheckboxById(currentSiteKey, checkbox.id, {
      favorite: desiredFavorite
    });
    if (updatedCheckbox) {
      refreshCheckboxUIs({ siteKey: currentSiteKey });
    }
  });

  rowSpan.appendChild(star);
  rowSpan.appendChild(pinWrapper);
  rowSpan.appendChild(text);

  if (input) {
    chip.appendChild(input);
  }
  chip.appendChild(rowSpan);

  if (isProxy) {
    const initialChecked = !!opts.initialChecked || !!getCheckboxInputElement(checkbox.id)?.checked;
    setVisual(initialChecked);
    chip.addEventListener('click', event => {
      if (event.target.closest('button') || event.target.closest('.pin-switch-wrapper')) return;
      const realInput = getCheckboxInputElement(checkbox.id);
      if (!realInput) return;
      realInput.checked = !realInput.checked;
      realInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  } else {
    setVisual(!!input?.checked);
  }

  return chip;
}

export function renderBuiltInOptionChips() {
  const cbInterpret = document.getElementById('cb-interpret');
  if (!cbInterpret) return;

  ensurePinnedOptions();

  const interpretFieldGroup = cbInterpret.closest('.field-group');
  if (!interpretFieldGroup) return;

  try {
    const interpretLabel = cbInterpret.closest('label');
    if (interpretLabel) interpretLabel.style.display = 'none';
  } catch {}

  let row = interpretFieldGroup.querySelector('.builtin-chips-row');
  if (!row) {
    row = document.createElement('div');
    row.className = 'builtin-chips-row';
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '6px';
    row.style.margin = '6px 0 4px 0';
    interpretFieldGroup.appendChild(row);
  } else {
    row.innerHTML = '';
  }

  const createBuiltInChip = ({ key, title, input, color, pinned }) => {
    const chip = document.createElement('label');
    Object.assign(chip.style, BUILTIN_CHIP_STYLE);

    const proxyInput = document.createElement('input');
    proxyInput.type = 'checkbox';
    proxyInput.style.display = 'none';
    proxyInput.checked = input.checked;
    proxyInput.addEventListener('change', () => {
      if (input.checked !== proxyInput.checked) {
        input.checked = proxyInput.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setChipVisual(chip, proxyInput.checked, color);
    });

    const rowSpan = document.createElement('span');
    rowSpan.style.display = 'inline-flex';
    rowSpan.style.alignItems = 'center';
    rowSpan.style.gap = '4px';

    const { pinWrapper } = createPinSwitch({
      checked: pinned,
      onToggle: value => toggleBuiltInPinnedOption(key, value)
    });

    const text = document.createElement('span');
    text.textContent = title;
    text.style.maxWidth = '160px';
    text.style.overflow = 'hidden';
    text.style.textOverflow = 'ellipsis';
    text.style.whiteSpace = 'nowrap';

    rowSpan.appendChild(pinWrapper);
    rowSpan.appendChild(text);
    chip.appendChild(proxyInput);
    chip.appendChild(rowSpan);

    proxyInput.dispatchEvent(new Event('change'));

    chip.addEventListener('click', event => {
      if (event.target.closest('.pin-switch-wrapper')) return;
      proxyInput.checked = !proxyInput.checked;
      proxyInput.dispatchEvent(new Event('change'));
    });

    return chip;
  };

  row.appendChild(createBuiltInChip({
    key: 'interpret',
    title: t('checkboxBuiltInInterpretation'),
    input: cbInterpret,
    color: CHIP_THEME.accent,
    pinned: !!settings.pinnedOptions?.interpret
  }));
}
