// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// Provider field settings rendering.
import { settings, saveSettings } from './storage.js';
import { confirmInline, showToast, alertInline } from './ui-utils.js';
import { getCheckboxProviderContext } from './checkbox-orchestrator.js';
import { refreshCheckboxUIs } from './checkbox-refresh.js';
import { addCurrentSiteRootToProviderConfig } from './platform/site-root.js';
import { ensureProviderConfig, getProviderConfig, hasValidProvider, toProviderKey } from './domain/provider-rules.js';
import { createNewFieldDraft, removeFieldFromConfig, saveInlineFieldChanges } from './field-config-service.js';
import { bindFieldCardInteractions } from './field-card-interactions.js';
import { createFieldGroupView } from './field-card-view.js';
import { createFieldContent } from './field-inline-editor-slot.js';
import { t } from './i18n.js';

// Render the full field settings UI for a provider.
export function renderSettingsUI(siteLabel, expandedFieldKey = null) {
  try { console.log('[UI][renderSettingsUI] called with siteLabel =', siteLabel); } catch {}
  const site = toProviderKey(siteLabel);
  try {
    const { analyseLabel: selAnalyse, paramLabel: selParam } = getCheckboxProviderContext();
    console.log('[UI][renderSettingsUI] normalized site =', site, 'current selects:', { analyse: selAnalyse, param: selParam });
  } catch {}
  const container = document.getElementById('patterns-container');
  if (!container) return;
  container.replaceChildren();
  const btnRem = document.getElementById('btn-remove-provider');
  if (btnRem) btnRem.style.display = site ? 'inline-block' : 'none';
  
  if (!hasValidProvider(settings, siteLabel)) {
    container.appendChild(createLockedProviderMessage());
    return;
  }
  const cfg = getProviderConfig(settings, siteLabel);
  container.appendChild(createUrlsFieldGroup(cfg));
  container.appendChild(createPdfKeywordsFieldGroup(cfg));
  
  if (hasValidProvider(settings, siteLabel)) {
    container.append(createAddFieldButton(siteLabel));
  }
  
  const fieldOrder = cfg.fieldOrder || Object.keys(cfg.fields || {});
  fieldOrder.forEach((f, index) => {
    const def = cfg.fields[f]; if (!def) return;
    
    const fieldGroup = createFieldGroup(f, def, index, site, siteLabel, cfg, expandedFieldKey);
    container.append(fieldGroup);
  });
  
  const taNote = document.getElementById('note-libre');
  taNote.value = settings.noteLibre[site] || '';
  taNote.onblur = () => { settings.noteLibre[site] = taNote.value; saveSettings(); };
  
  const cbCompact = document.getElementById('compact-fields-toggle');
  if (cbCompact) {
    if (!settings.compactFields) settings.compactFields = {};
    cbCompact.checked = !!settings.compactFields[site];
    cbCompact.onchange = () => {
      if (!settings.compactFields) settings.compactFields = {};
      settings.compactFields[site] = cbCompact.checked;
      saveSettings();
    };
  }

  refreshCheckboxUIs({ siteKey: site, refreshAnalyse: false });
}

function createLockedProviderMessage() {
  const lockMessage = document.createElement('div');
  lockMessage.style.padding = '20px';
  lockMessage.style.textAlign = 'center';
  lockMessage.style.backgroundColor = '#f5f5f5';
  lockMessage.style.border = '2px solid #ddd';
  lockMessage.style.borderRadius = '8px';
  lockMessage.style.color = '#666';
  lockMessage.style.marginTop = '15px';

  const title = document.createElement('h3');
  title.textContent = t('fieldLockTitle');
  const text = document.createElement('p');
  text.textContent = t('fieldLockDescription');

  lockMessage.append(title, text);
  return lockMessage;
}

function createUrlsFieldGroup(cfg) {
  const group = document.createElement('div');
  group.className = 'field-group';

  const labelRow = document.createElement('div');
  labelRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;';

  const label = document.createElement('label');
  label.textContent = t('fieldUrlsLabel');
  label.style.margin = '0';

  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.value = (cfg.urls || []).join('\n');
  textarea.onblur = () => {
    cfg.urls = textarea.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    saveSettings();
  };

  const button = createAddSiteRootButton(cfg, textarea);
  labelRow.append(label, button);
  group.append(labelRow, textarea);
  return group;
}

function createAddSiteRootButton(cfg, textarea) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = t('fieldAddSiteRoot');
  button.title = t('fieldAddSiteRootTitle');
  Object.assign(button.style, {
    padding: '2px 8px',
    border: 'none',
    borderRadius: '4px',
    background: '#e67e22',
    color: '#fff',
    fontSize: '11px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    flexShrink: '0'
  });
  button.addEventListener('mouseenter', () => {
    if (!button.disabled) button.style.filter = 'brightness(1.08)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.filter = '';
  });
  button.onclick = async () => {
    const initialLabel = button.textContent;
    button.disabled = true;
    button.textContent = t('fieldAddSiteRootPending');
    button.style.opacity = '0.8';
    button.style.cursor = 'wait';
    try {
      const { pattern, alreadyPresent, permissionGranted } = await addCurrentSiteRootToProviderConfig(cfg);
      if (alreadyPresent) {
        showToast(t('fieldSiteRootAlreadyPresent'), 'info');
        return;
      }

      textarea.value = cfg.urls.join('\n');
      saveSettings();

      if (permissionGranted) {
        showToast(t('fieldSiteRootAddedGranted', pattern), 'success', 2600);
      } else {
        showToast(t('fieldSiteRootAddedDenied'), 'warning', 3200);
      }
    } catch (err) {
      await alertInline(err?.message || t('fieldSiteRootAddError'), 'warning');
    } finally {
      button.disabled = false;
      button.textContent = initialLabel;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
  };
  return button;
}

function createPdfKeywordsFieldGroup(cfg) {
  const group = document.createElement('div');
  group.className = 'field-group';

  const label = document.createElement('label');
  label.textContent = t('fieldPdfKeywordsLabel');
  label.title = t('fieldPdfKeywordsTitle');

  const textarea = document.createElement('textarea');
  textarea.rows = 2;
  textarea.placeholder = t('fieldPdfKeywordsPlaceholder');
  textarea.value = (cfg.pdfKeywords || []).join('\n');
  textarea.onblur = () => {
    cfg.pdfKeywords = textarea.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    saveSettings();
  };

  group.append(label, textarea);
  return group;
}

function createAddFieldButton(siteLabel) {
  const button = document.createElement('button');
  button.textContent = t('fieldAddButton');
  button.onclick = () => {
    try {
      const cfg = ensureProviderConfig(settings, siteLabel);
      if (!cfg) {
        showToast(t('fieldConfigLoadError'), 'error');
        return;
      }

      const { uniqueKey, fieldDefinition } = createNewFieldDraft(cfg);
      cfg.fields[uniqueKey] = fieldDefinition;
      cfg.fieldOrder = Array.isArray(cfg.fieldOrder) ? cfg.fieldOrder : [];
      cfg.fieldOrder.push(uniqueKey);
      saveSettings();
      renderSettingsUI(siteLabel, uniqueKey);

      try {
        if (typeof window.openAddFieldModal === 'function') {
          window.openAddFieldModal({ mode: 'edit', siteLabel, fieldKey: uniqueKey });
        }
        document.getElementById(`add-field-name-${uniqueKey}`)?.focus();
        try { showToast(t('fieldAddedSuccess'), 'success'); } catch {}
      } catch (error) {
        try { console.warn('[UI][AddField] Post-render open inline failed:', error); } catch {}
      }
    } catch (err) {
      try { console.error('[UI][AddField] Error creating field inline:', err); } catch {}
      showToast(t('fieldAddError'), 'error');
    }
  };
  return button;
}

// Build one field card with its inline editor content.
function createFieldGroup(f, def, index, site, siteLabel, cfg, expandedFieldKey = null) {
  const { card: g, fieldHeader, fieldToggleIcon, fieldContent } = createFieldGroupView({
    fieldKey: f,
    definition: def,
    index,
    expandedFieldKey,
    canDelete: hasValidProvider(settings, siteLabel),
    onDelete: async event => {
      event.stopPropagation();
      const button = event.currentTarget;
      const ok = await confirmInline(button, t('fieldDeleteConfirm', f));
      if (!ok) return;
      removeFieldFromConfig(cfg, f);
      saveSettings();
      renderSettingsUI(siteLabel);
    },
    buildContent: unsavedIndicator => createFieldContent({
      fieldKey: f,
      definition: def,
      siteLabel,
      siteKey: site,
      expandedFieldKey,
      unsavedIndicator,
      onSave: ({ fieldKey, state, firstLabelWanted }) => {
        const cfgLocal = getProviderConfig(settings, site);
        if (!saveInlineFieldChanges(cfgLocal, fieldKey, state, firstLabelWanted)) {
          try { console.warn('[UI][InlineSubmit] Field not found in settings for save:', { siteKey: site, f: fieldKey }); } catch {}
          return false;
        }

        console.log(`[FIELD-MGMT][SAVE] Configuration finale pour "${fieldKey}":`, cfgLocal.fields[fieldKey]);
        saveSettings();
        renderSettingsUI(siteLabel);
        requestAnimationFrame(() => {
          const cont = document.getElementById('patterns-container');
          const card = cont?.querySelector(`[data-field-name="${CSS.escape(fieldKey)}"]`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        try { showToast(t('fieldSaved'), 'success'); } catch {}
        return true;
      },
      onSaveMissingField: () => {
        showToast(t('fieldSaveError'), 'error');
      }
    })
  });

  bindFieldCardInteractions({
    card: g,
    header: fieldHeader,
    content: fieldContent,
    toggleIcon: fieldToggleIcon,
    fieldKey: f,
    siteKey: site,
    fieldOrder: cfg.fieldOrder,
    hasProviderConfig: () => !!getProviderConfig(settings, site),
    onPersistReorder: () => saveSettings(),
    onRefresh: () => renderSettingsUI(siteLabel)
  });

  return g;
}

