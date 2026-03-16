// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// src/field-editor.js - Inline field editor functionality
import { settings, saveSettings } from './storage.js';
import { showToast } from './ui-utils.js';
import { ensureProviderConfig, getProviderConfig, toProviderKey } from './domain/provider-rules.js';
import { upsertFieldFromEditorValues } from './field-config-service.js';
import { populateMaskOptions, readFieldEditorValues } from './field-editor-state.js';
import { t } from './i18n.js';

let inlineEditor;
let inlineEditorHeader;
let inlineEditorBody;
let inlineEditorFooter;
let lastEditorContext = { siteLabel: null, fieldKey: null, mode: null };
let modalState = { mode: 'create', siteLabel: '', originalKey: null };
let renderSettingsUi = () => {};

// Utility function to get global editor elements (with fallback)
function getGlobalEditorElements() {
  return {
    name: document.getElementById('add-field-name'),
    typeRadios: document.querySelectorAll('input[name="add-field-type"]'),
    unit: document.getElementById('add-field-unit'),
    role: document.getElementById('add-field-role'),
    tupleRow: document.getElementById('add-field-tuple-row'),
    tupleSize: document.getElementById('add-field-tuple-size'),
    tupleMask: document.getElementById('add-field-tuple-mask'),
    submit: document.getElementById('add-field-submit'),
    cancel: document.getElementById('add-field-cancel'),
    close: document.getElementById('add-field-close')
  };
}

// Get editor elements from slot context (with field suffix)
function getSlotEditorElements(fieldKey) {
  const suffix = fieldKey ? `-${fieldKey}` : '';
  return {
    name: document.getElementById(`add-field-name${suffix}`),
    typeRadios: document.querySelectorAll(`input[name="add-field-type${suffix}"]`),
    unit: document.getElementById(`add-field-unit${suffix}`),
    role: document.getElementById(`add-field-role${suffix}`),
    tupleRow: document.getElementById(`add-field-tuple-row${suffix}`),
    tupleSize: document.getElementById(`add-field-tuple-size${suffix}`),
    tupleMask: document.getElementById(`add-field-tuple-mask${suffix}`),
    tupleDrop: document.getElementById(`add-field-tuple-drop${suffix}`),
    submit: document.getElementById(`inline-submit${suffix}`),
    cancel: document.getElementById(`inline-cancel${suffix}`)
  };
}

// Get appropriate editor elements based on context
function getCurrentEditorElements() {
  // Try slot context first (from lastEditorContext)
  if (lastEditorContext.fieldKey) {
    const slotElements = getSlotEditorElements(lastEditorContext.fieldKey);
    if (slotElements.name) {
      return slotElements;
    }
  }
  
  // Fallback to global elements
  return getGlobalEditorElements();
}

// Utility function to handle type change (unit enable/disable)
function setUnitEnabledFromType() {
  const elements = getGlobalEditorElements();
  const selected = Array.from(elements.typeRadios).find(r => r.checked)?.value || 'text';
  const isNumeric = selected === 'numeric';
  if (elements.unit) {
    elements.unit.disabled = !isNumeric;
    if (!isNumeric) elements.unit.value = '';
  }
  if (elements.tupleRow) elements.tupleRow.style.display = isNumeric ? '' : 'none';
}

export function initFieldEditor({ renderSettingsUi: renderSettingsUiArg } = {}) {
  renderSettingsUi = typeof renderSettingsUiArg === 'function' ? renderSettingsUiArg : () => {};
  inlineEditor = mountInlineFieldEditor();
  inlineEditorHeader = inlineEditor ? inlineEditor.children[0] : null;
  inlineEditorBody = inlineEditor ? inlineEditor.children[1] : null;
  inlineEditorFooter = inlineEditor ? inlineEditor.children[2] : null;

  // Get all global editor elements
  const elements = getGlobalEditorElements();

  elements.typeRadios.forEach(r => r.addEventListener('change', setUnitEnabledFromType));
  elements.cancel?.addEventListener('click', () => closeAddFieldModal());
  elements.close?.addEventListener('click', () => closeAddFieldModal());

  // Wire global size->mask population
  if (elements.tupleSize) {
    const sizeClone = elements.tupleSize; // populated after open
    sizeClone.addEventListener('change', () => {
      populateMaskOptions(getGlobalEditorElements().tupleMask, sizeClone.value, '');
    });
  }

  function submitAddField() {
    try { console.log('[FE][submitAddField] ENTER', { modalState, lastEditorContext }); } catch {}

    // Determine editor context (slot vs global)
    const usingSlot = !!lastEditorContext.fieldKey && !!document.getElementById(`add-field-name-${lastEditorContext.fieldKey}`);
    const elements = getCurrentEditorElements();

    // Debug logs for elements and their values
    try {
      console.log('[FE][submitAddField] Context source =', usingSlot ? 'slot' : 'global', 'key =', lastEditorContext.fieldKey);
      console.log('[FE][submitAddField] Elements found:', {
        nameEl: elements.name?.id, nameValue: elements.name?.value,
        typeRadiosCount: elements.typeRadios?.length,
        checkedType: Array.from(elements.typeRadios || []).find(r => r.checked)?.value,
        unitEl: elements.unit?.id, unitValue: elements.unit?.value,
        roleEl: elements.role?.id, roleValue: elements.role?.value,
        tupleSize: elements.tupleSize?.value, tupleMask: elements.tupleMask?.value,
      });
    } catch {}
    
    const values = readFieldEditorValues({
      elements,
      fieldKey: lastEditorContext.fieldKey
    });

    // Debug label and core field values block
    try {
      console.log('[FE][submitAddField] Values snapshot', {
        context: usingSlot ? 'slot' : 'global', suffix: values.debugSuffix,
        label: values.label,
        type: values.type,
        unit: values.unit,
        role: values.role,
        tuple: { size: values.tupleSize, mask: values.tupleMask },
        labelData: {
          lblText: values.lblText,
          lblStart: values.lblStart,
          lblEnd: values.lblEnd,
          lblLabelExclude: values.lblLabelExclude,
          lblExclude: values.lblExclude,
          lblPriority: values.lblPriority
        }
      });
    } catch {}
    
    if (!values.label) { 
      try { console.warn('[FE][submitAddField] Missing label, abort.'); } catch {} 
      try { showToast(t('fieldEditorNameRequired'), 'error'); } catch {} 
      return; 
    }
    
    const site = toProviderKey(modalState.siteLabel);
    try { console.log('[FE][submitAddField] Computed site =', site, 'mode =', modalState.mode, 'fieldKey =', modalState.originalKey); } catch {}
    
    const cfg = ensureProviderConfig(settings, site, { labels: {} });
    if (!cfg) {
      try { showToast(t('fieldEditorProviderConfigMissing'), 'error'); } catch {}
      return;
    }
    try { console.log('[FE][submitAddField] Pre-save cfg keys:', Object.keys(cfg.fields || {})); } catch {}
    const result = upsertFieldFromEditorValues(cfg, {
      mode: modalState.mode,
      originalKey: modalState.originalKey,
      values
    });
    if (!result.ok) {
      try { showToast(t('fieldEditorFieldMissing'), 'error'); } catch {}
      return;
    }
    modalState.originalKey = result.fieldKey;
    try { console.log(`[FE][submitAddField] ${result.action === 'created' ? 'Created' : 'Updated'} field:`, result.fieldKey, cfg.fields[result.fieldKey]); } catch {}

    saveSettings();
    try { console.log('[FE][submitAddField] Saved. Now rendering settings for siteLabel =', modalState.siteLabel); } catch {}
    
    // Store current editor state before re-render
    const currentFieldKey = modalState.originalKey;
    const currentMode = modalState.mode;
    const currentSiteLabel = modalState.siteLabel;
    
    // Re-render and focus new/edited field
    renderSettingsUi(modalState.siteLabel);
    try { console.log('[FE][submitAddField] After render, deciding post-save behavior…', { currentMode, currentFieldKey }); } catch {}

    // Post-save behavior: after CREATE, open the new field inline for editing
    if (currentMode === 'create' && currentFieldKey) {
      setTimeout(() => {
        try {
          if (typeof window.rewireFieldEditorEvents === 'function') window.rewireFieldEditorEvents();
          if (typeof window.openAddFieldModal === 'function') {
            window.openAddFieldModal({ mode: 'edit', siteLabel: currentSiteLabel, fieldKey: currentFieldKey });
            try { showToast(t('fieldEditorCreated'), 'success'); } catch {}
            console.log('[FE][submitAddField] Re-opened editor for newly created field', currentFieldKey);
          }
        } catch (e) {
          console.warn('[FE][submitAddField] Post-create reopen failed:', e);
        }
      }, 100);
    } else if (currentMode === 'edit' && currentFieldKey) {
      // Edit from slot: do NOT reopen editor; keep slot placeholder and confirm save
      try { showToast(t('fieldEditorSavedChanges'), 'success'); } catch {}
      // Ensure events are wired for future actions
      setTimeout(() => { try { if (typeof window.rewireFieldEditorEvents === 'function') window.rewireFieldEditorEvents(); } catch {} }, 0);
    } else {
      // Close the modal after successful save
      ensureInlineEditorPosition();
      closeAddFieldModal();
    }
    
    // Focus the field group after render
    setTimeout(() => {
      const container = document.getElementById('patterns-container') || document.getElementById('settings-container');
      const groups = container?.querySelectorAll('.field-group');
      let target = null;
      if (groups && groups.length) {
        target = Array.from(groups).find(g => g.dataset && g.dataset.fieldName === currentFieldKey);
      }
      if (target) {
        const header = target.firstElementChild; // field header
        try { header?.click(); } catch {}
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        try { console.log('[FE][submitAddField] After render, target field group not found for key =', currentFieldKey); } catch {}
      }
    }, currentMode === 'edit' ? 200 : 0);
  }

  elements.submit?.addEventListener('click', submitAddField);
  elements.name?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitAddField(); } });

  // Wire label-card toggle and dynamic title updates
  function wireAddLabelCard() {
    const header = document.getElementById('add-label-card-header');
    const body = document.getElementById('add-label-card-body');
    const toggle = document.getElementById('add-label-card-toggle');
    const title = document.getElementById('add-label-card-title');
    const text = document.getElementById('add-label-text');
    const start = document.getElementById('add-label-start');
    const end = document.getElementById('add-label-end');
    if (!header || !body || !toggle || !title || !text || !start || !end) return;
    header.addEventListener('click', (e) => {
      // Avoid toggling when clicking inputs inside header (none for now)
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      toggle.textContent = isOpen ? '▼' : '▲';
    });
    const updateTitle = () => {
      const labelText = (text.value || t('fieldEditorEmptyKeyword'));
      const s = parseInt(start.value || '1', 10) || 1;
      const ed = parseInt(end.value || '999', 10) || 999;
      title.textContent = t('fieldEditorCardTitle', [labelText, String(s), String(ed)]);
    };
    text.addEventListener('input', updateTitle);
    start.addEventListener('input', updateTitle);
    end.addEventListener('input', updateTitle);
    // Initialize once
    updateTitle();
  }
  // Delay to ensure DOM moved inline is ready
  setTimeout(wireAddLabelCard, 0);

  // Expose modal opener globally for UI module hooks
  window.openAddFieldModal = openAddFieldModal;
  
  // Expose a function to re-wire events after DOM changes
  window.rewireFieldEditorEvents = function() {
    try {
      console.log('[FE][rewireFieldEditorEvents] Re-wiring global editor events after DOM change');
      const elements = getGlobalEditorElements();
      
      // Re-wire main buttons by cloning and replacing (removes old event listeners)
      if (elements.submit) {
        const newSubmit = elements.submit.cloneNode(true);
        elements.submit.parentNode.replaceChild(newSubmit, elements.submit);
        newSubmit.addEventListener('click', submitAddField);
      }
      
      if (elements.cancel) {
        const newCancel = elements.cancel.cloneNode(true);
        elements.cancel.parentNode.replaceChild(newCancel, elements.cancel);
        newCancel.addEventListener('click', () => closeAddFieldModal());
      }
      
      if (elements.close) {
        const newClose = elements.close.cloneNode(true);
        elements.close.parentNode.replaceChild(newClose, elements.close);
        newClose.addEventListener('click', () => closeAddFieldModal());
      }
      
      if (elements.name) {
        const newName = elements.name.cloneNode(true);
        elements.name.parentNode.replaceChild(newName, elements.name);
        newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitAddField(); } });
      }
      
      // Re-wire type change handlers
      document.querySelectorAll('input[name="add-field-type"]').forEach(r => {
        r.addEventListener('change', setUnitEnabledFromType);
      });
      // Re-wire size change and repopulate mask options
      const el = getGlobalEditorElements();
      if (el.tupleSize) {
        const newSize = el.tupleSize.cloneNode(true);
        el.tupleSize.parentNode.replaceChild(newSize, el.tupleSize);
        newSize.addEventListener('change', () => {
          populateMaskOptions(getGlobalEditorElements().tupleMask, newSize.value, '');
        });
        // Initialize once using current values (keep current mask if any)
        if (!newSize.value) newSize.value = '1';
        populateMaskOptions(getGlobalEditorElements().tupleMask, newSize.value, el.tupleMask?.value || '');
      }
      
      // Re-wire label card
      wireAddLabelCard();
      
    } catch (err) {
      console.warn('[FE][rewireFieldEditorEvents] Error re-wiring events:', err);
    }
  };

  return { ensureInlineEditorPosition };
}

function mountInlineFieldEditor() {
  const patterns = document.getElementById('patterns-container');
  if (!patterns) return null;
  let mount = document.getElementById('field-editor-anchor') || patterns; // stable anchor just under patterns
  const modal = document.getElementById('add-field-modal');
  if (!modal) return null;
  const inline = document.createElement('div');
  inline.id = 'inline-field-editor';
  inline.style.marginTop = '10px';
  inline.style.maxWidth = '100%';
  inline.style.display = 'none'; // hidden by default; shown when opening editor
  // Move all children of modal into inline (header, body, footer)
  while (modal.firstChild) inline.appendChild(modal.firstChild);
  mount.appendChild(inline);
  // Remove modal wrapper and backdrop from DOM
  const backdrop = document.getElementById('modal-backdrop');
  try { backdrop?.remove(); } catch {}
  try { modal.remove(); } catch {}
  return inline;
}

function getFieldGroupByKey(fieldKey) {
  const patterns = document.getElementById('patterns-container');
  if (!patterns || !fieldKey) return null;
  const groups = Array.from(patterns.querySelectorAll('.field-group'));
  return groups.find(g => (g.dataset && g.dataset.fieldName === fieldKey)) || null;
}

function getFieldContentByKey(fieldKey) {
  const g = getFieldGroupByKey(fieldKey);
  if (!g) return null;
  // field structure: [header, content]
  return g.children && g.children[1] ? g.children[1] : null;
}

function getFieldUlByKey(fieldKey) {
  const content = getFieldContentByKey(fieldKey);
  if (!content) return null;
  return content.querySelector('ul') || null;
}

function getPermanentEditorSlot(fieldKey) {
  const ul = getFieldUlByKey(fieldKey);
  if (!ul) return null;
  return ul.querySelector(`#inline-editor-slot-${CSS.escape(fieldKey)}`) || null;
}

function getPermanentEditorSlotContent(fieldKey) {
  const slot = getPermanentEditorSlot(fieldKey);
  if (!slot) return null;
  const mode = slot.querySelector(`#inline-editor-slot-mode-${CSS.escape(fieldKey)}`);
  if (!mode) return null;
  const slotContent = mode.querySelector('.inline-editor-slot-content');
  if (!slotContent) return null;
  // We now have two zones inside slotContent: .slot-placeholder (default UI) and .editor-content-zone (target for global editor)
  const editorZone = slotContent.querySelector('.editor-content-zone');
  return editorZone || slotContent;
}

function ensureEditorSlotLi(fieldKey) {
  const ul = getFieldUlByKey(fieldKey);
  if (!ul) return null;
  let li = ul.querySelector('#inline-field-editor-li');
  if (!li) {
    li = document.createElement('li');
    li.id = 'inline-field-editor-li';
    // Match label item look & feel
    li.style.marginBottom = '10px';
    li.style.border = '1px solid #ddd';
    li.style.borderRadius = '4px';
    li.style.padding = '8px';
    li.style.backgroundColor = '#f9f9f9';
    ul.appendChild(li);
  }
  return li;
}

function moveEditorBodyIntoField(fieldKey) {
  if (!inlineEditorBody) return;
  
  // First clean up any existing duplication in this field's slot
  cleanupSlotDuplication(fieldKey);
  
  const editorZone = getPermanentEditorSlotContent(fieldKey);
  const slot = getPermanentEditorSlot(fieldKey);
  const slotContent = slot ? slot.querySelector('.inline-editor-slot-content') : null;
  const placeholder = slotContent ? slotContent.querySelector('.slot-placeholder') : null;
  if (!editorZone) return;
  
  // Check if editor body is already in the correct location to avoid duplication
  if (inlineEditorBody.parentNode === editorZone) {
    try { console.log('[FE][moveEditorBodyIntoField] Editor body already in editor zone for', fieldKey); } catch {}
    // Ensure visibility states are correct
    try { if (placeholder) placeholder.style.display = 'none'; } catch {}
    try { editorZone.style.display = 'block'; } catch {}
    return;
  }
  
  // Ensure slot content is visible
  try { if (placeholder) placeholder.style.display = 'none'; } catch {}
  try { editorZone.style.display = 'block'; } catch {}
  
  // Move editor body only if it's not already there
  try { 
    editorZone.appendChild(inlineEditorBody);
    try {
      const parentId = inlineEditorBody.parentNode && inlineEditorBody.parentNode.className;
      console.log('[FE][moveEditorBodyIntoField] Moved editor body to field', fieldKey, 'into zone class=', parentId);
    } catch {}
  } catch (err) {
    try { console.warn('[FE][moveEditorBodyIntoField] Error moving editor body:', err); } catch {}
  }
  
  // Also ensure the overall field content panel is open
  try { const fieldContent = getFieldContentByKey(fieldKey); if (fieldContent) fieldContent.style.display = 'block'; } catch {}
}

function cleanupSlotDuplication(fieldKey) {
  // Clean up any global editor content that might have been duplicated in this specific slot
  const slot = getPermanentEditorSlot(fieldKey);
  if (!slot) return;
  
  try {
    // Look for global editor inputs (without field suffix) that shouldn't be in this slot
    const globalInputs = slot.querySelectorAll('#add-field-name:not([id$="-' + fieldKey + '"]), #add-field-unit:not([id$="-' + fieldKey + '"]), #add-field-role:not([id$="-' + fieldKey + '"])');
    globalInputs.forEach(input => {
      // Find the parent container of this global input and remove it
      let parentContainer = input;
      while (parentContainer && !parentContainer.style?.padding) {
        parentContainer = parentContainer.parentNode;
      }
      if (parentContainer && parentContainer.style?.padding === '10px 12px') {
        try {
          parentContainer.remove();
          try { console.log('[FE][cleanupSlotDuplication] Removed duplicated global content from slot', fieldKey); } catch {}
        } catch {}
      }
    });
  } catch (err) {
    try { console.warn('[FE][cleanupSlotDuplication] Error cleaning slot duplication:', err); } catch {}
  }
}

function restoreEditorBodyToInline() {
  if (!inlineEditor || !inlineEditorBody) return;
  
  // Check if editor body is already in the inline editor to avoid duplication
  if (inlineEditorBody.parentNode === inlineEditor) {
    try { console.log('[FE][restoreEditorBodyToInline] Editor body already in inline editor'); } catch {}
    return;
  }
  
  // Reinsert between header and footer for original order
  try { 
    inlineEditor.insertBefore(inlineEditorBody, inlineEditorFooter || null); 
    try { console.log('[FE][restoreEditorBodyToInline] Restored editor body to inline editor'); } catch {}
  } catch (err) {
    try { console.warn('[FE][restoreEditorBodyToInline] Error restoring editor body:', err); } catch {}
  }
  // When restoring to inline container, any open slot should show its placeholder and hide editor zone
  try {
    if (lastEditorContext.fieldKey) {
      const slot = getPermanentEditorSlot(lastEditorContext.fieldKey);
      const slotContent = slot ? slot.querySelector('.inline-editor-slot-content') : null;
      const placeholder = slotContent ? slotContent.querySelector('.slot-placeholder') : null;
      const editorZone = slotContent ? slotContent.querySelector('.editor-content-zone') : null;
      if (placeholder) placeholder.style.display = '';
      if (editorZone) editorZone.style.display = 'none';
      console.log('[FE][restoreInline] Toggled slot view back to placeholder for', lastEditorContext.fieldKey);
    }
  } catch {}
}

function positionInlineEditorFor(siteLabel, fieldKey, mode) {
  if (!inlineEditor) return;
  const patterns = document.getElementById('patterns-container');
  const anchor = document.getElementById('field-editor-anchor') || patterns;
  if (!patterns) return;
  let targetGroup = null;
  if (mode === 'edit' && fieldKey) {
    const groups = Array.from(patterns.querySelectorAll('.field-group'));
    targetGroup = groups.find(g => (g.dataset && g.dataset.fieldName === fieldKey)) || null;
  }
  if (!targetGroup) {
    // Fallback: park at anchor
    restoreEditorBodyToInline();
    if (anchor && inlineEditor.parentNode !== anchor) {
      try { anchor.appendChild(inlineEditor); } catch {}
    }
    return;
  }
  // For edit mode: move only the editor body inside the group's content panel
  moveEditorBodyIntoField(fieldKey);
}

function ensureInlineEditorPosition() {
  if (!inlineEditor) return;
  const isOpen = inlineEditor.style.display !== 'none';
  if (isOpen && (lastEditorContext.mode || lastEditorContext.fieldKey || lastEditorContext.siteLabel)) {
    positionInlineEditorFor(lastEditorContext.siteLabel, lastEditorContext.fieldKey, lastEditorContext.mode);
  } else {
    // When closed or without context, keep the body in its last slot (if any) but hide the inline editor container
    // For create mode or no context at all, restore to anchor so the UI remains reachable
    if (!lastEditorContext.fieldKey || lastEditorContext.mode === 'create') {
      restoreEditorBodyToInline();
      const anchor = document.getElementById('field-editor-anchor') || document.getElementById('patterns-container');
      if (anchor && inlineEditor.parentNode !== anchor) {
        try { anchor.appendChild(inlineEditor); } catch {}
      }
    }
  }
}

function cleanupDuplicatedEditorContent() {
  // Remove any duplicated editor body elements that might exist in slots
  if (!inlineEditorBody) return;
  
  try {
    // Find all slot contents that might contain the global editor body
    const slotContents = document.querySelectorAll('.inline-editor-slot-content');
    
    slotContents.forEach(slotContent => {
      // Look for the global editor content (without field suffix) inside this slot
      const globalEditorContent = slotContent.querySelector('#add-field-name:not([id$="-observance"]):not([id$="-iah"]):not([id$="-fuites"])');
      if (globalEditorContent) {
        // Found global editor content in a slot - this is likely a duplication
        // Find the parent div that contains the global editor and remove it
        let parentToRemove = globalEditorContent;
        while (parentToRemove && parentToRemove.parentNode !== slotContent) {
          parentToRemove = parentToRemove.parentNode;
        }
        if (parentToRemove && parentToRemove !== slotContent) {
          try {
            slotContent.removeChild(parentToRemove);
            try { console.log('[FE][cleanupDuplicatedEditorContent] Removed duplicated global editor content from slot'); } catch {}
          } catch {}
        }
      }
    });
    
    // Also ensure the editor body is in the right place
    if (inlineEditorBody && !inlineEditorBody.parentNode) {
      restoreEditorBodyToInline();
    }
  } catch (err) {
    try { console.warn('[FE][cleanupDuplicatedEditorContent] Error during cleanup:', err); } catch {}
  }
}

function openAddFieldModal({ mode = 'create', siteLabel = '', fieldKey = null } = {}) {
  try { console.log('[FE][openAddFieldModal] ENTER', { mode, siteLabel, fieldKey }); } catch {}
  
  // Clean up any duplicated editor content first
  cleanupDuplicatedEditorContent();
  
  modalState = { mode, siteLabel, originalKey: fieldKey };
  
  // Get global editor elements and ensure they're available
  let elements = getGlobalEditorElements();
  try { console.log('[FE][openAddFieldModal] Global elements snapshot', {
    name: !!elements.name,
    typeRadios: elements.typeRadios?.length,
    unit: !!elements.unit,
    role: !!elements.role
  }); } catch {}
  // If we're editing and the body is already in the right slot, skip any restore attempts
  if (mode === 'edit' && fieldKey) {
    // Per-slot edit path: do not move global editor body; operate on slot inputs only
    lastEditorContext = { siteLabel, fieldKey, mode };
    try {
      const slot = getPermanentEditorSlot(fieldKey);
      const modeWrap = slot ? slot.querySelector(`#inline-editor-slot-mode-${CSS.escape(fieldKey)}`) : null;
      const slotContent = slot ? slot.querySelector('.inline-editor-slot-content') : null;
      const placeholder = slotContent ? slotContent.querySelector('.slot-placeholder') : null;
      const editorZone = slotContent ? slotContent.querySelector('.editor-content-zone') : null;
      if (modeWrap && modeWrap.style.display === 'none') {
        modeWrap.style.display = 'block';
        const toggle = slot ? slot.querySelector('.inline-editor-slot-header span:nth-child(2)') : null;
        if (toggle) toggle.textContent = '▲';
      }
      if (placeholder) placeholder.style.display = '';
      if (editorZone) editorZone.style.display = 'none';
      console.log('[FE][openAddFieldModal] Edit-mode: using slot inputs, showing placeholder and hiding editor zone for', fieldKey);
    } catch {}
    if (inlineEditor) inlineEditor.style.display = 'none';
    // Ensure main editor events are wired (submit button handler)
    if (typeof window.rewireFieldEditorEvents === 'function') {
      try { window.rewireFieldEditorEvents(); } catch {}
    }
    // Focus slot name input
    setTimeout(() => {
      try { document.getElementById(`add-field-name-${fieldKey}`)?.focus(); } catch {}
    }, 0);
    return;
  }
  
  // If global editor elements are missing, try restoring the editor body to inline container (only if it's not already there)
  if (!elements.name || !elements.typeRadios.length) {
    try {
      console.log('[FE][openAddFieldModal] Global editor elements not found yet, attempting inline restore');
      if (inlineEditorBody && inlineEditor && inlineEditorBody.parentNode !== inlineEditor) {
        restoreEditorBodyToInline();
      }
      // Re-query after potential restoration
      elements = getGlobalEditorElements();
      try { console.log('[FE][openAddFieldModal] After restore, global elements snapshot', {
        name: !!elements.name, typeRadios: elements.typeRadios?.length, unit: !!elements.unit, role: !!elements.role
      }); } catch {}
    } catch (err) {
      try { console.warn('[FE][openAddFieldModal] Error restoring global editor:', err); } catch {}
    }
  }
  
  // Remember desired context and position editor (create-mode or no field)
  lastEditorContext = { siteLabel, fieldKey, mode };
  try { console.log('[FE][openAddFieldModal] Positioning inline editor for', { siteLabel, fieldKey, mode }); positionInlineEditorFor(siteLabel, fieldKey, mode); } catch (err) { 
    try { console.warn('[FE][openAddFieldModal] positionInlineEditorFor error:', err); } catch {} 
  }
  
  // Set default values for create/edit mode
  let type = 'text';
  let unit = '';
  let role = '';
  let tupleExtraction = null;
  
  // Only prefill in edit mode, keep placeholders for create mode
  if (mode === 'edit' && siteLabel && fieldKey) {
    const site = toProviderKey(siteLabel);
    const cfg = getProviderConfig(settings, site);
    const def = cfg?.fields?.[fieldKey];
    try { console.log('[FE][openAddFieldModal] Prefill lookup', { site, fieldKey, hasCfg: !!cfg, hasDef: !!def }); } catch {}
    if (def) {
      // Prefill field data
      const friendly = fieldKey === fieldKey.toUpperCase() ? fieldKey : 
        (fieldKey.replace(/([a-z])([A-Z])/g, '$1 $2')).replace(/^./, c => c.toUpperCase());
      try { console.log('[FE][openAddFieldModal] Prefilling field UI', { label: def.label, type: def.type, unit: def.unit, role: def.role }); } catch {}
      if (elements.name) elements.name.value = def.label || friendly;
      type = def.type || 'text';
      unit = def.unit || '';
      role = def.role || '';
      tupleExtraction = def.tupleExtraction || null;
      
      // Prefill tuple fields
      if (elements.tupleSize) elements.tupleSize.value = (tupleExtraction?.size && tupleExtraction.size >=1 && tupleExtraction.size <=7) ? String(tupleExtraction.size) : '1';
      if (elements.tupleMask) elements.tupleMask.value = tupleExtraction?.mask || '';
      // Populate mask options based on current size/mask
      if (elements.tupleSize) {
        populateGlobalMaskOptions(elements.tupleSize.value, elements.tupleMask?.value || '');
      }
      if (elements.tupleDrop) elements.tupleDrop.checked = !!(tupleExtraction && tupleExtraction.dropOriginal);
      
      // Prefill label fields if there's a first label
      if (def.labels && def.labels.length > 0) {
        const firstLabel = def.labels[0];
        try { console.log('[FE][openAddFieldModal] Prefilling label UI', firstLabel); } catch {}
        const lblElements = {
          text: document.getElementById('add-label-text'),
          start: document.getElementById('add-label-start'),
          end: document.getElementById('add-label-end'),
          labelExclude: document.getElementById('add-label-label-exclude'),
          exclude: document.getElementById('add-label-exclude'),
          priority: document.getElementById('add-label-priority')
        };
        if (lblElements.text) lblElements.text.value = firstLabel.text || '';
        if (lblElements.start) lblElements.start.value = firstLabel.range?.start || 1;
        if (lblElements.end) lblElements.end.value = firstLabel.range?.end || 999;
        if (lblElements.labelExclude) lblElements.labelExclude.value = (firstLabel.labelExcludeKeywords || []).join(',');
        if (lblElements.exclude) lblElements.exclude.value = (firstLabel.excludeKeywords || []).join(',');
        if (lblElements.priority) lblElements.priority.value = (firstLabel.priorityKeywords || []).join(',');
      }
    }
  }
  
  // Apply field values to UI
  if (elements.name && mode === 'create') elements.name.value = '';
  elements.typeRadios.forEach(r => r.checked = (r.value === type));
  if (elements.unit) elements.unit.value = unit;
  if (elements.role) elements.role.value = role || '';
  try { console.log('[FE][openAddFieldModal] Applied UI values', { type, unit, role, mode }); } catch {}
  
  // Clear fields in create mode
  if (mode === 'create') {
    try { console.log('[FE][openAddFieldModal] Clearing UI for CREATE mode'); } catch {}
  if (elements.tupleSize) elements.tupleSize.value = '1';
  if (elements.tupleMask) elements.tupleMask.value = '';
  // Initialize mask options for size=1 (disabled X)
  populateGlobalMaskOptions('1', '');
    if (elements.tupleDrop) elements.tupleDrop.checked = false;
    
    // Clear all label fields
    const lblElements = ['add-label-text', 'add-label-start', 'add-label-end', 'add-label-label-exclude', 'add-label-exclude', 'add-label-priority'];
    lblElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = (id.includes('start') ? '1' : id.includes('end') ? '999' : '');
    });
    
    // Reset label card title to default
    const titleEl = document.getElementById('add-label-card-title');
    if (titleEl) titleEl.textContent = t('fieldEditorCardTitle', [t('fieldEditorEmptyKeyword'), '1', '999']);
    
    try { console.log('[FE][openAddFieldModal] CREATE mode: cleared all fields for blank template'); } catch {}
  }
  
  setUnitEnabledFromType();
  try { console.log('[FE][openAddFieldModal] setUnitEnabledFromType applied'); } catch {}
  
  // Ensure all events are properly wired
  if (typeof window.rewireFieldEditorEvents === 'function') {
    window.rewireFieldEditorEvents();
    try { console.log('[FE][openAddFieldModal] rewireFieldEditorEvents done'); } catch {}
  }
  
  if (inlineEditor) {
    // In edit mode, the body is inside the slot: keep the outer inline container hidden to avoid #inline-field-editor showing
    if (mode === 'edit' && fieldKey) {
      inlineEditor.style.display = 'none';
      try { console.log('[FE][openAddFieldModal] Hiding inline container in EDIT mode'); } catch {}
    } else {
      inlineEditor.style.display = 'block';
      try { console.log('[FE][openAddFieldModal] Showing inline container in CREATE mode'); } catch {}
    }
    try {
      // If editing, scroll to the group content hosting the body; else to the inline container
      if (mode === 'edit' && fieldKey) {
        const slot = getPermanentEditorSlot(fieldKey);
        const headerSpan = slot ? slot.querySelector('.inline-editor-slot-header span:nth-child(2)') : null;
        // Ensure the whole mode wrapper is visible (open the wrapper)
        const mode = slot ? slot.querySelector(`#inline-editor-slot-mode-${CSS.escape(fieldKey)}`) : null;
        if (mode && mode.style.display === 'none') {
          mode.style.display = 'block';
          // Update toggle icon to reflect open state
          const toggle = slot ? slot.querySelector('.inline-editor-slot-header span:nth-child(2)') : null;
          if (toggle) toggle.textContent = '▲';
        }
        // Ensure placeholder is hidden and editor zone visible for this slot
        try {
          const slotContent = slot ? slot.querySelector('.inline-editor-slot-content') : null;
          const placeholder = slotContent ? slotContent.querySelector('.slot-placeholder') : null;
          const editorZone = slotContent ? slotContent.querySelector('.editor-content-zone') : null;
          if (placeholder) placeholder.style.display = 'none';
          if (editorZone) editorZone.style.display = 'block';
          console.log('[FE][openAddFieldModal] Activated editor zone for', fieldKey);
        } catch {}
        (headerSpan || slot || inlineEditor).scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        inlineEditor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      inlineEditor.style.outline = '2px solid #7cb1ff';
      setTimeout(() => { inlineEditor.style.outline = ''; }, 600);
    } catch {}
  }
  // Focus correct input per mode
  setTimeout(() => {
    try {
      if (mode === 'edit' && fieldKey) {
        const nm = document.getElementById(`add-field-name-${fieldKey}`);
        if (nm) { nm.focus(); return; }
      }
      const nm = document.getElementById('add-field-name');
      nm && nm.focus();
    } catch {}
  }, 0);
}

function closeAddFieldModal() {
  try { console.log('[FE][closeAddFieldModal] ENTER', { modalState, lastEditorContext }); } catch {}
  // Restore body back into inline container and hide
  try { /* Keep the body in-place inside its slot to preserve structure; do not move back unless in create mode */
    if (!lastEditorContext.fieldKey || lastEditorContext.mode === 'create') restoreEditorBodyToInline();
  } catch {}
  if (inlineEditor) inlineEditor.style.display = 'none';
}

export { ensureInlineEditorPosition, openAddFieldModal, closeAddFieldModal };