// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// Shared UI helpers: toasts, dialogs, and inline provider form.
import { t } from './i18n.js';

// Show a transient toast notification.
export function showToast(message, variant = 'info', timeout = 2200) {
  const existing = document.getElementById('toast-container');
  const container = existing || document.createElement('div');
  if (!existing) {
    container.id = 'toast-container';
    Object.assign(container.style, {
      position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10050,
      display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none'
    });
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const colors = {
    info: { bg: '#e1f5fe', border: '#4fc3f7', text: '#0277bd' },
    success: { bg: '#e8f5e8', border: '#4caf50', text: '#2e7d32' },
    error: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
    warning: { bg: '#fff3e0', border: '#ff9800', text: '#ef6c00' }
  };
  const color = colors[variant] || colors.info;
  Object.assign(toast.style, {
    background: color.bg, border: `1px solid ${color.border}`, color: color.text,
    padding: '8px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '500',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)', pointerEvents: 'auto'
  });
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { 
    try { 
      toast.remove(); 
      if (!container.children.length) container.remove(); 
    } catch {} 
  }, timeout);
}

// Accessible blocking confirm dialog used instead of native confirm().
export function confirmInline(anchorEl, message) {
  return new Promise((resolve) => {
    // Remove any existing modals
    try { document.querySelectorAll('.mini-confirm-overlay').forEach(n => n.remove()); } catch {}

    // Save currently focused element to restore later
    const previouslyFocused = document.activeElement;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'mini-confirm-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.35)', zIndex: 10050,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    // Prevent background scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.className = 'mini-confirm-dialog';
    Object.assign(dialog.style, {
      background: '#fff', border: '1px solid #ddd', borderRadius: '8px',
      boxShadow: '0 12px 28px rgba(0,0,0,0.25)', padding: '14px 16px',
      width: 'min(360px, 90vw)', maxWidth: '90vw', color: '#333',
    });

    const msg = document.createElement('div');
    msg.textContent = message;
    Object.assign(msg.style, { fontSize: '13px', lineHeight: '1.4', marginBottom: '12px' });

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' });

    const btnNo = document.createElement('button');
    btnNo.textContent = t('confirmNo');
    Object.assign(btnNo.style, { padding: '6px 10px' });

    const btnYes = document.createElement('button');
    btnYes.textContent = t('confirmYes');
    Object.assign(btnYes.style, { padding: '6px 10px', background: '#007acc', color: '#fff', border: 'none', borderRadius: '4px' });

    actions.appendChild(btnNo);
    actions.appendChild(btnYes);
    dialog.appendChild(msg);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus management: trap focus inside modal
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(dialog.querySelectorAll(focusableSelectors)).filter(el => !el.hasAttribute('disabled'));
    const focusables = getFocusable();
    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    if (firstEl) firstEl.focus();

    const cleanup = (val) => {
      try { overlay.remove(); } catch {}
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try { previouslyFocused.focus(); } catch {}
      }
      resolve(val);
    };

    // Handle keyboard events for accessibility and UX
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const focusables = getFocusable();
        const currentIndex = focusables.indexOf(document.activeElement);
        let nextIndex;
        if (e.shiftKey) {
          nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1;
        }
        if (focusables[nextIndex]) focusables[nextIndex].focus();
      } else if (e.key === 'Enter') {
        // Enter defaults to "Yes" if no specific button is focused
        e.preventDefault();
        if (document.activeElement === btnNo) {
          cleanup(false);
        } else {
          cleanup(true);
        }
      }
    };

    // Event listeners
    overlay.addEventListener('keydown', handleKeydown);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
    btnNo.addEventListener('click', () => cleanup(false));
    btnYes.addEventListener('click', () => cleanup(true));
  });
}

// Accessible blocking alert dialog sized for the extension popup.
export function alertInline(message, variant = 'info') {
  return new Promise((resolve) => {
    // Remove any existing alert modals
    try { document.querySelectorAll('.mini-alert-overlay').forEach(n => n.remove()); } catch {}

    // Save currently focused element to restore later
    const previouslyFocused = document.activeElement;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'mini-alert-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.35)', zIndex: 10050,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    // Prevent background scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.className = 'mini-alert-dialog';
    
    // Variant colors
    const colors = {
      info: { bg: '#e3f2fd', border: '#2196f3', icon: 'ℹ️' },
      success: { bg: '#e8f5e9', border: '#4caf50', icon: '✓' },
      error: { bg: '#ffebee', border: '#f44336', icon: '⚠️' },
      warning: { bg: '#fff3e0', border: '#ff9800', icon: '⚠️' }
    };
    const color = colors[variant] || colors.info;
    
    Object.assign(dialog.style, {
      background: '#fff', border: `2px solid ${color.border}`, borderRadius: '8px',
      boxShadow: '0 12px 28px rgba(0,0,0,0.25)', padding: '16px 20px',
      width: 'min(380px, 90vw)', maxWidth: '90vw', color: '#333',
    });

    // Icon + Message container
    const content = document.createElement('div');
    Object.assign(content.style, { 
      display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' 
    });
    
    const icon = document.createElement('div');
    icon.textContent = color.icon;
    Object.assign(icon.style, { fontSize: '20px', lineHeight: '1' });
    
    const msg = document.createElement('div');
    msg.textContent = message;
    Object.assign(msg.style, { fontSize: '13px', lineHeight: '1.5', flex: '1' });
    
    content.appendChild(icon);
    content.appendChild(msg);

    // OK Button
    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end' });

    const btnOk = document.createElement('button');
    btnOk.textContent = t('ok');
    Object.assign(btnOk.style, { 
      padding: '7px 16px', background: color.border, color: '#fff', 
      border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
      fontWeight: '500'
    });

    actions.appendChild(btnOk);
    dialog.appendChild(content);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus the OK button
    btnOk.focus();

    const cleanup = () => {
      try { overlay.remove(); } catch {}
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try { previouslyFocused.focus(); } catch {}
      }
      resolve();
    };

    // Handle keyboard events
    const handleKeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        cleanup();
      }
    };

    // Event listeners
    overlay.addEventListener('keydown', handleKeydown);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });
    btnOk.addEventListener('click', cleanup);
  });
}

// Inline provider creation form used instead of prompt().
export function showProviderAddInlineForm(anchorEl, { onSubmit } = {}) {
  // Close existing form if any
  try { document.querySelectorAll('.mini-provider-form').forEach(n => n.remove()); } catch {}
  
  const form = document.createElement('div');
  form.className = 'mini-provider-form';
  Object.assign(form.style, {
    position: 'fixed', zIndex: 10000, background: '#fff', border: '1px solid #ddd', borderRadius: '6px',
    boxShadow: '0 6px 16px rgba(0,0,0,0.15)', padding: '8px', fontSize: '12px', color: '#333',
    display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
    width: 'min(420px, calc(100vw - 16px))', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box'
  });
  
  const label = document.createElement('span'); 
  label.textContent = t('labelProviderName');
  
  const input = document.createElement('input'); 
  input.type = 'text'; 
  input.placeholder = t('placeholderProviderName'); 
  Object.assign(input.style, {
    padding: '4px 6px',
    flex: '1 1 160px',
    minWidth: '120px',
    boxSizing: 'border-box'
  });
  
  const cancel = document.createElement('button'); 
  cancel.textContent = t('buttonCancel'); 
  cancel.style.padding = '4px 8px';
  
  const submit = document.createElement('button'); 
  submit.textContent = t('buttonCreate'); 
  submit.style.padding = '4px 8px'; 
  submit.style.background = '#007acc'; 
  submit.style.color = '#fff'; 
  submit.style.border = 'none'; 
  submit.style.borderRadius = '4px';
  
  form.append(label, input, cancel, submit);
  document.body.appendChild(form);
  
  const rect = anchorEl.getBoundingClientRect();
  const gap = 8;
  let left = Math.round(rect.left);
  let top = Math.round(rect.bottom + 6);

  // Keep the inline form fully visible inside the popup viewport.
  const maxLeft = window.innerWidth - form.offsetWidth - gap;
  left = Math.max(gap, Math.min(left, maxLeft));

  if (top + form.offsetHeight > window.innerHeight - gap) {
    top = Math.round(rect.top - form.offsetHeight - 6);
  }
  top = Math.max(gap, top);

  form.style.left = `${left}px`;
  form.style.top = `${top}px`;
  
  const cleanup = () => { try { form.remove(); } catch {} };
  
  cancel.onclick = (e) => { e.stopPropagation(); cleanup(); };
  
  submit.onclick = async (e) => {
    e.stopPropagation();
    const name = (input.value || '').trim();
    if (!name) { showToast(t('errorProviderNameRequired'), 'error'); return; }

    try {
      const result = await onSubmit?.(name);
      if (result === false) return;
      cleanup();
    } catch (err) {
      console.error('Error submitting provider form:', err);
      showToast(t('errorProviderCreate'), 'error');
    }
  };
  
  setTimeout(() => input.focus(), 0);
  
  const onDoc = (ev) => { 
    if (!form.contains(ev.target)) { 
      document.removeEventListener('mousedown', onDoc, true); 
      cleanup(); 
    } 
  };
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
}

// Create a generic locked-state message.
export function createLockedMessage(title, text) {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    padding: '20px', backgroundColor: '#f5f5f5', border: '2px solid #ddd',
    borderRadius: '8px', color: '#666', textAlign: 'center'
  });
  const h3 = document.createElement('h3');
  h3.textContent = title;
  const p = document.createElement('p');
  p.style.margin = '0';
  p.textContent = text;
  wrap.append(h3, p);
  return wrap;
}

