// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { settings } from './storage.js';
import { buildCleanSummaryText } from './domain/summary-rules.js';
import { getActiveNormalTab } from './platform/active-tab.js';
import { browserApi } from './platform/browser-api.js';
import { t } from './i18n.js';

const errorBuffer = [];
const MAX_ERRORS = 50;

function pushError(entry) {
  try {
    errorBuffer.push({ time: new Date().toISOString(), ...entry });
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
  } catch {}
}

(function installErrorCapture() {
  if (window.__flashcpapFeedbackCaptureInstalled) return;
  window.__flashcpapFeedbackCaptureInstalled = true;

  const originalConsoleError = console.error;
  console.error = function (...args) {
    pushError({
      type: 'console',
      message: args.map(arg => String(arg)).join(' '),
      stack: args[0]?.stack || null
    });
    return originalConsoleError.apply(this, args);
  };

  window.addEventListener('error', event => {
    pushError({
      type: 'window',
      message: event.message,
      stack: event.error?.stack || null
    });
  });

  window.addEventListener('unhandledrejection', event => {
    pushError({
      type: 'promise',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || null
    });
  });
})();

async function sha256(value) {
  if (!value || !window.crypto?.subtle) return null;

  try {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

async function getActiveTabSnapshot() {
  try {
    const tab = await getActiveNormalTab();
    const url = tab?.url || '';
    const parsed = url ? new URL(url) : null;

    return {
      id: tab?.id ?? null,
      title: tab?.title || '',
      origin: parsed ? parsed.origin : '',
      urlHash: await sha256(url.replace(/\?.*/, '').toLowerCase())
    };
  } catch {
    return {
      id: null,
      title: '',
      origin: '',
      urlHash: null
    };
  }
}

function getSourceText() {
  const wrapper = document.getElementById('source-wrapper');
  if (!wrapper) return '';

  return Array.from(wrapper.querySelectorAll('.src-text'))
    .map(node => node.textContent || '')
    .join('\n');
}

function getSummaryText() {
  const preview = document.getElementById('résumé-preview');
  const rows = preview?.querySelectorAll('.pv-row .pv-content') || [];
  const raw = Array.from(rows).map(row => row.textContent || '').join('\n');
  return {
    raw,
    clean: buildCleanSummaryText(raw)
  };
}

function captureUIState() {
  return {
    activeTab: document.querySelector('#tabs .tab.active')?.getAttribute('data-tab') || 'analyse',
    activeProvider: document.getElementById('prestataire-select')?.value || '',
    settingsProvider: document.getElementById('prest-param')?.value || '',
    sourceVisible: document.body.classList.contains('docked-right'),
    customCheckboxesChecked: Array.from(document.querySelectorAll('#custom-checkboxes-container input[type="checkbox"]')).filter(input => input.checked).length,
    modalOpen: document.getElementById('report-problem-modal')?.style.display !== 'none'
  };
}

function snapshotSettings(provider) {
  const key = (provider || '').toLowerCase();
  return {
    hasProviderPatterns: !!settings.patterns?.[key],
    customCheckboxesCount: settings.customCheckboxes?.[key]?.length || 0,
    pinnedOptions: settings.pinnedOptions?.[key] || null,
    compactFields: !!settings.compactFields?.[key]
  };
}

async function buildFeedbackPayload({ userMessage, editedSourceText }) {
  const provider = document.getElementById('prestataire-select')?.value || '';
  const sourceText = editedSourceText || getSourceText();
  const summary = getSummaryText();

  return {
    meta: {
      timestamp: new Date().toISOString(),
      extensionVersion: browserApi.runtime?.getManifest?.().version || 'dev',
      provider,
      tab: await getActiveTabSnapshot()
    },
    message: userMessage || '',
    summary,
    source: {
      text: sourceText,
      lineCount: sourceText ? sourceText.split(/\r?\n/).length : 0
    },
    uiState: captureUIState(),
    settingsSnapshot: snapshotSettings(provider),
    errors: errorBuffer.slice(-30)
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function setupFeedbackUI() {
  const btn = document.getElementById('btn-report-problem');
  const modal = document.getElementById('report-problem-modal');
  const backdrop = document.getElementById('report-problem-backdrop');
  const closeBtn = document.getElementById('report-problem-close');
  const cancelBtn = document.getElementById('report-problem-cancel');
  const downloadBtn = document.getElementById('report-problem-send');
  const statusEl = document.getElementById('report-problem-status');
  const messageTA = document.getElementById('report-message');
  const sourceTA = document.getElementById('report-source');
  const undoBtn = document.getElementById('btn-anonymize-undo');

  if (!btn || !modal || !backdrop || !downloadBtn || !statusEl || !messageTA || !sourceTA) return;
  if (btn.dataset.feedbackBound === 'true') return;
  btn.dataset.feedbackBound = 'true';

  let isSelecting = false;
  const history = [];
  let lastSnapshot = null;

  const syncUndoState = () => {
    if (!undoBtn) return;
    const hasHistory = history.length > 0;
    undoBtn.disabled = !hasHistory;
    undoBtn.style.opacity = hasHistory ? '1' : '.55';
    undoBtn.style.cursor = hasHistory ? 'pointer' : 'not-allowed';
  };

  const pushHistory = label => {
    const currentValue = sourceTA.value;
    if (currentValue === lastSnapshot) return;
    history.push({ label, value: currentValue });
    if (history.length > 50) history.shift();
    lastSnapshot = currentValue;
    syncUndoState();
  };

  const undo = () => {
    const currentValue = sourceTA.value;
    let snapshot = history.pop();
    while (snapshot && snapshot.value === currentValue && history.length) {
      snapshot = history.pop();
    }
    if (!snapshot || snapshot.value === currentValue) {
      syncUndoState();
      return;
    }
    sourceTA.value = snapshot.value;
    lastSnapshot = snapshot.value;
    syncUndoState();
  };

  const anonymizeSelection = () => {
    const start = sourceTA.selectionStart;
    const end = sourceTA.selectionEnd;
    if (start == null || end == null || start === end) return;

    const from = Math.min(start, end);
    const to = Math.max(start, end);
    const value = sourceTA.value;
    const before = value.slice(0, from);
    const segment = value.slice(from, to);
    const after = value.slice(to);
    const anonymized = segment.replace(/[A-Za-z]/g, '$').replace(/[0-9]/g, '£');

    sourceTA.value = before + anonymized + after;
    try {
      sourceTA.setSelectionRange(from, to);
    } catch {}
  };

  const closeModal = () => {
    modal.style.display = 'none';
    backdrop.style.display = 'none';
    statusEl.style.display = 'none';
    history.length = 0;
    lastSnapshot = null;
    syncUndoState();
  };

  btn.addEventListener('click', () => {
    sourceTA.value = getSourceText();
    messageTA.value = '';
    statusEl.style.display = 'none';
    history.length = 0;
    lastSnapshot = null;
    pushHistory('initial');
    modal.style.display = 'flex';
    backdrop.style.display = 'block';
    setTimeout(() => messageTA.focus(), 0);
  });

  closeBtn.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  undoBtn?.addEventListener('click', undo);

  sourceTA.addEventListener('mousedown', () => {
    isSelecting = true;
    pushHistory('before-selection');
  });

  sourceTA.addEventListener('mouseup', () => {
    if (!isSelecting) return;
    isSelecting = false;
    anonymizeSelection();
  });

  sourceTA.addEventListener('mouseleave', () => {
    isSelecting = false;
  });

  sourceTA.addEventListener('input', () => {
    pushHistory('manual-edit');
  });

  sourceTA.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z') && history.length) {
      event.preventDefault();
      undo();
    }
  });

  downloadBtn.addEventListener('click', async () => {
    const userMessage = messageTA.value.trim();
    if (!userMessage) {
      statusEl.textContent = t('feedbackProblemRequired');
      statusEl.style.color = '#dc3545';
      statusEl.style.display = 'block';
      return;
    }

    statusEl.textContent = t('feedbackGeneratingReport');
    statusEl.style.color = '#007acc';
    statusEl.style.display = 'block';

    try {
      const payload = await buildFeedbackPayload({
        userMessage,
        editedSourceText: sourceTA.value.trim()
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJson(`rapport_ppc_${timestamp}.json`, payload);
      statusEl.textContent = t('feedbackReportDownloaded');
      statusEl.style.color = '#28a745';
      setTimeout(closeModal, 1200);
    } catch (error) {
      statusEl.textContent = t('feedbackErrorPrefix', String(error?.message || String(error)));
      statusEl.style.color = '#dc3545';
    }
  });

  syncUndoState();
}