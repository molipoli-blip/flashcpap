// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { t } from './i18n.js';
import { handleSuccessfulCopyEngagement } from './copy-engagement-prompts.js';

export function setupCopyAction({ buildCleanSummaryText }) {
  const copyButton = document.getElementById('btn-copy');
  if (!copyButton) return;

  copyButton.onclick = async () => {
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

    try {
      try {
        await navigator.clipboard.writeText('');
      } catch (_) {}
      await navigator.clipboard.writeText(text);
      markSuccess();

      const providerLabel = document.getElementById('prestataire-select')?.value || '';
      handleSuccessfulCopyEngagement(providerLabel);
    } catch (_) {
      markFail();
    }
  };
}
