// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { t } from './i18n.js';
import { handleSuccessfulCopyEngagement } from './copy-engagement-prompts.js';

export function setupCopyAction({
  buildCleanSummaryText,
  onSuccessfulCopy = handleSuccessfulCopyEngagement
}) {
  const copyButton = document.getElementById('btn-copy');
  if (!copyButton) return;
  let copyInProgress = false;

  copyButton.onclick = async () => {
    if (copyInProgress) return;

    const preview = document.getElementById('résumé-preview');
    const rows = preview?.querySelectorAll('.pv-row .pv-content') || [];
    const rawText = Array.from(rows).map(row => row.textContent).join('\n');

    const text = buildCleanSummaryText(rawText);
    const originalText = copyButton.textContent;

    if (!text.trim()) {
      copyButton.textContent = t('copyEmpty');
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 1200);
      return;
    }

    const markSuccess = () => {
      copyButton.textContent = t('copySuccess');
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 1500);
    };

    const markFail = () => {
      copyButton.textContent = t('copyFailure');
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 1800);
    };

    const providerLabel = document.getElementById('prestataire-select')?.value || '';
    copyInProgress = true;
    const wasDisabled = copyButton.disabled;
    copyButton.disabled = true;

    try {
      await navigator.clipboard.writeText(text);
      markSuccess();
    } catch (error) {
      markFail();
      return;
    } finally {
      copyInProgress = false;
      copyButton.disabled = wasDisabled;
    }

    try {
      await onSuccessfulCopy(providerLabel);
    } catch (error) {
      // Engagement is deliberately isolated from the clipboard result.
      console.warn('[COPY][ENGAGEMENT] La copie a réussi mais le gestionnaire a échoué', error);
    }
  };
}
