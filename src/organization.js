// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { settings, saveSettings } from './storage.js';
import { hasValidProvider, pickProviderLabel } from './domain/provider-rules.js';
import { createLockedMessage } from './ui-utils.js';
import { t } from './i18n.js';
import { safeRun } from './error-handling.js';
import { ensureProviderEntry, ensureSettingsObject } from './storage-guards.js';

export function setupFamilyOrganization() {
  try { console.log('[ORG][setupFamilyOrganization] Initializing family settings'); } catch {}
  if (!settings.familySettings) {
    settings.familySettings = {
      enabled: true,
      customFamilies: {},
      defaultOrder: ['Identification', 'Montants', 'Dates', 'Divers']
    };
    saveSettings();
  }
}

export function renderOrganizationInterface() {
  const container = document.getElementById('organization-container');
  if (!container) return;

  const prestOrg = document.getElementById('prest-organization');
  const analyseSel = document.getElementById('prestataire-select');
  const paramSel = document.getElementById('prest-param');
  const currentProvider = pickProviderLabel([
    prestOrg?.value,
    analyseSel?.value,
    paramSel?.value
  ], settings, { fallbackToFirstAvailable: false });
  if (prestOrg && currentProvider) prestOrg.value = currentProvider;

  if (!hasValidProvider(settings, currentProvider)) {
    container.innerHTML = '';
    container.appendChild(createLockedMessage(
      t('organizationLockTitle'),
      t('organizationLockDescription')
    ));

    const recalcBtn = document.getElementById('recalc-organization-order');
    if (recalcBtn) {
      recalcBtn.disabled = true;
      recalcBtn.style.opacity = '0.5';
      recalcBtn.style.cursor = 'not-allowed';
    }
    return;
  }

  let recalcBtn = document.getElementById('recalc-organization-order');
  if (recalcBtn) {
    recalcBtn.disabled = false;
    recalcBtn.style.opacity = '1';
    recalcBtn.style.cursor = 'pointer';
  }

  container.innerHTML = '';

  const organizationOrder = getOrganizationOrder(currentProvider);
  try { console.log('[ORG][RENDER] Rendering organization interface for provider:', currentProvider, 'with order:', organizationOrder); } catch {}

  organizationOrder.forEach((item, index) => {
    const orgItem = createOrganizationItem(item, index);
    container.appendChild(orgItem);
  });

  setupDragAndDrop(container, currentProvider);

  recalcBtn = document.getElementById('recalc-organization-order');
  if (recalcBtn) {
    recalcBtn.onclick = () => {
      try { console.log('[ORG][RECALC] Triggered manual recalculation of organization order for', currentProvider); } catch {}
      const added = recalcOrganizationOrder(currentProvider);
      if (added.length === 0) {
        try { console.log('[ORG][RECALC] No new families to add'); } catch {}
          recalcBtn.textContent = t('organizationRecalcNone');
          setTimeout(()=>{ recalcBtn.textContent = t('buttonRecalcOrganization'); }, 1600);
      } else {
        try { console.log('[ORG][RECALC] Added new families:', added); } catch {}
          recalcBtn.textContent = t('organizationRecalcAdded', String(added.length));
          setTimeout(()=>{ recalcBtn.textContent = t('buttonRecalcOrganization'); }, 1800);
      }
      renderOrganizationInterface();
    };
  }
}

export function recalcOrganizationOrder(provider = '') {
  const providerOrder = ensureProviderEntry(settings, 'organizationOrderByProvider', provider, []);

  const hasFieldsItem = providerOrder.some(item => item.type === 'fields');
  if (!hasFieldsItem) {
    providerOrder.unshift({
      type: 'fields',
      id: 'extracted-fields',
      title: 'Champs extraits',
      description: 'Les données extraites automatiquement (pression, IAH, observance, etc.)',
      icon: '📊'
    });
    saveSettings();
  }

  const existingFamilies = new Set(
    providerOrder
      .filter(item => item.type === 'family' && item.familyName)
      .map(item => item.familyName.trim().toLowerCase())
  );

  const discoveredFamilies = new Set();
  const siteKey = provider.toLowerCase();
  if (settings.customCheckboxes && settings.customCheckboxes[siteKey]) {
    (settings.customCheckboxes[siteKey] || []).forEach(cb => {
      if (cb.family && cb.family.trim()) {
        discoveredFamilies.add(cb.family.trim());
      }
    });
  }

  const toAdd = [];
  Array.from(discoveredFamilies).sort().forEach(fam => {
    if (!existingFamilies.has(fam.toLowerCase())) {
      const item = {
        type: 'family',
        id: `family-${fam.toLowerCase().replace(/\s+/g,'-')}`,
        title: `Famille: ${fam}`,
        description: `Checkboxes de la famille "${fam}"`,
        icon: '📁',
        familyName: fam
      };
      providerOrder.push(item);
      toAdd.push(fam);
    }
  });

  if (toAdd.length) saveSettings();
  try { console.log('[ORG][RECALC]', provider, '- Families discovered:', Array.from(discoveredFamilies), 'Existing:', Array.from(existingFamilies), 'Added:', toAdd); } catch {}
  return toAdd;
}

function getOrganizationOrder(provider = '') {
  ensureSettingsObject(settings, 'organizationOrderByProvider');

  if (settings.organizationOrderByProvider[provider] && settings.organizationOrderByProvider[provider].length > 0) {
    try { console.log('[ORG][ORDER]', provider, '- Using existing organizationOrder (length =', settings.organizationOrderByProvider[provider].length, ')'); } catch {}
    return settings.organizationOrderByProvider[provider];
  }

  const defaultOrder = [
    {
      type: 'fields',
      id: 'extracted-fields',
      title: 'Champs extraits',
      description: 'Les données extraites automatiquement (pression, IAH, observance, etc.)',
      icon: '📊'
    }
  ];

  const allFamilies = new Set();
  const siteKey = provider.toLowerCase();

  if (settings.customCheckboxes && settings.customCheckboxes[siteKey]) {
    settings.customCheckboxes[siteKey].forEach(cb => {
      if (cb.family && cb.family.trim()) {
        allFamilies.add(cb.family.trim());
      }
    });
  }

  Array.from(allFamilies).sort().forEach(family => {
    defaultOrder.push({
      type: 'family',
      id: `family-${family.toLowerCase().replace(/\s+/g, '-')}`,
      title: `Famille: ${family}`,
      description: `Checkboxes de la famille "${family}"`,
      icon: '📁',
      familyName: family
    });
  });

  ensureProviderEntry(settings, 'organizationOrderByProvider', provider, []);
  settings.organizationOrderByProvider[provider] = defaultOrder;
  saveSettings();
  try { console.log('[ORG][ORDER]', provider, '- Initialized default organizationOrder:', defaultOrder); } catch {}

  return defaultOrder;
}

function createOrganizationItem(item, index) {
  const div = document.createElement('div');
  div.className = 'organization-item';
  div.draggable = true;
  div.dataset.index = index;
  div.dataset.type = item.type;
  div.dataset.id = item.id;

  const icon = document.createElement('div');
  icon.className = 'org-item-icon';
  icon.textContent = item.icon;

  const content = document.createElement('div');
  content.className = 'org-item-content';

  const title = document.createElement('div');
  title.className = 'org-item-title';
  title.textContent = item.title;

  const description = document.createElement('div');
  description.className = 'org-item-description';
  description.textContent = item.description;

  content.appendChild(title);
  content.appendChild(description);

  const handle = document.createElement('div');
  handle.className = 'org-item-handle';
  handle.textContent = '⋮⋮';

  div.appendChild(icon);
  div.appendChild(content);
  div.appendChild(handle);

  return div;
}

function setupDragAndDrop(container, provider = '') {
  let draggedElement = null;
  let draggedIndex = null;

  container.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('organization-item')) {
      draggedElement = e.target;
      draggedIndex = parseInt(e.target.dataset.index);
      e.target.classList.add('dragging');
      container.classList.add('drag-active');
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  container.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('organization-item')) {
      e.target.classList.remove('dragging');
      container.classList.remove('drag-active');

      container.querySelectorAll('.organization-item').forEach(item => {
        item.classList.remove('drag-over');
      });

      draggedElement = null;
      draggedIndex = null;
    }
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const afterElement = getDragAfterElement(container, e.clientY);
    const dragging = container.querySelector('.dragging');

    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  });

  container.addEventListener('dragenter', (e) => {
    if (e.target.classList.contains('organization-item') && e.target !== draggedElement) {
      e.target.classList.add('drag-over');
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (e.target.classList.contains('organization-item')) {
      e.target.classList.remove('drag-over');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();

    if (draggedElement) {
      const items = Array.from(container.querySelectorAll('.organization-item'));
      const currentOrder = settings.organizationOrderByProvider[provider] || [];
      const newOrder = items.map(item => {
        const index = parseInt(item.dataset.index);
        return currentOrder[index];
      });

      newOrder.forEach((item, index) => {
        items[index].dataset.index = index;
      });

      ensureSettingsObject(settings, 'organizationOrderByProvider');
      settings.organizationOrderByProvider[provider] = newOrder;
      saveSettings();

      console.log('Nouvel ordre d\'organisation pour', provider, 'sauvegardé:', newOrder);
      safeRun(() => console.log('[ORG][DROP]', provider, '- Saved new organizationOrder:', newOrder.map(o => o.id)), { context: 'ORG_DROP_LOG' });
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.organization-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}
