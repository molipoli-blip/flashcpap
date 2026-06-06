// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - copy engagement popup orchestration

import { t } from './i18n.js';
import { getSupportersConfig } from './supporters.js';
import { confirmInline, showToast } from './ui-utils.js';
import { registerSuccessfulCopy } from './copy-engagement.js';
import { shareProviderToCommunity } from './provider-management.js';

function openSupportLink() {
  const supportUrl = getSupportersConfig()?.coffee?.link || 'https://ko-fi.com/flashcpap';
  try { window.open(supportUrl, '_blank', 'noopener,noreferrer'); } catch {}
}

async function showSupportPopup(totalCopies) {
  const shouldOpen = await confirmInline(
    document.getElementById('btn-copy') || document.body,
    `${t('copySupportPopupTitle')}\n\n${t('copySupportPopupMessage', [String(totalCopies)])}`
  );
  if (shouldOpen) openSupportLink();
}

async function showProviderSharePopup(providerLabel, providerCopies) {
  const shouldShare = await confirmInline(
    document.getElementById('btn-copy') || document.body,
    `${t('copyProviderSharePopupTitle', providerLabel)}\n\n${t('copyProviderSharePopupMessage', [providerLabel, String(providerCopies)])}`
  );

  if (!shouldShare) return;

  try {
    await shareProviderToCommunity(providerLabel);
    showToast(t('providerShareSuccess'), 'success');
  } catch (error) {
    showToast(t('providerShareError', String(error?.message || error)), 'error');
  }
}

export function handleSuccessfulCopyEngagement(providerLabel) {
  const milestone = registerSuccessfulCopy(providerLabel);

  if (milestone.shouldShowSupportPrompt) {
    void showSupportPopup(milestone.totalCopies);
    return;
  }

  if (milestone.shouldShowProviderSharePrompt && providerLabel) {
    void showProviderSharePopup(providerLabel, milestone.providerCopies);
  }
}
