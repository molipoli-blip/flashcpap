// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - copy engagement popup orchestration

import { t } from './i18n.js';
import { getSupportersConfig } from './supporters.js';
import { showMiniCtaPopup, showToast } from './ui-utils.js';
import { registerSuccessfulCopy } from './copy-engagement.js';
import { shareProviderToCommunity } from './provider-management.js';

function openSupportLink() {
  const supportUrl = getSupportersConfig()?.coffee?.link || 'https://ko-fi.com/flashcpap';
  try { window.open(supportUrl, '_blank', 'noopener,noreferrer'); } catch {}
}

function showSupportPopup(totalCopies) {
  showMiniCtaPopup({
    id: `copy-support-milestone-${totalCopies}`,
    title: t('copySupportPopupTitle'),
    message: t('copySupportPopupMessage', [String(totalCopies)]),
    actions: [
      {
        label: t('confirmNo'),
        kind: 'secondary'
      },
      {
        label: t('confirmYes'),
        kind: 'primary',
        onClick: () => openSupportLink()
      }
    ],
    timeout: 0
  });
}

function showProviderSharePopup(providerLabel, providerCopies) {
  showMiniCtaPopup({
    id: `copy-provider-share-${String(providerLabel).toLowerCase()}-${providerCopies}`,
    title: t('copyProviderSharePopupTitle', providerLabel),
    message: t('copyProviderSharePopupMessage', [providerLabel, String(providerCopies)]),
    actions: [
      {
        label: t('confirmNo'),
        kind: 'secondary'
      },
      {
        label: t('confirmYes'),
        kind: 'primary',
        onClick: async () => {
          try {
            await shareProviderToCommunity(providerLabel);
            showToast(t('providerShareSuccess'), 'success');
          } catch (error) {
            showToast(t('providerShareError', String(error?.message || error)), 'error');
          }
        }
      }
    ],
    timeout: 0
  });
}

export function handleSuccessfulCopyEngagement(providerLabel) {
  const milestone = registerSuccessfulCopy(providerLabel);

  if (milestone.shouldShowSupportPrompt) {
    showSupportPopup(milestone.totalCopies);
    return;
  }

  if (milestone.shouldShowProviderSharePrompt && providerLabel) {
    showProviderSharePopup(providerLabel, milestone.providerCopies);
  }
}
