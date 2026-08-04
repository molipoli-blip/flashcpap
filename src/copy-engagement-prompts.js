// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// Rendering and effects for the single decision selected by the engagement engine.

import { t } from './i18n.js';
import { getSupportersConfig } from './supporters.js';
import { showMiniCtaPopup, showToast } from './ui-utils.js';
import {
  COPY_ENGAGEMENT_DECISIONS,
  markStoreLinkOpened,
  markSupportLinkOpened,
  registerSuccessfulCopy
} from './copy-engagement.js';
import { shareProviderToCommunity } from './provider-management.js';
import { browserApi } from './platform/browser-api.js';

const STORE_URLS = Object.freeze({
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/flashcpap/',
  chrome: 'https://chromewebstore.google.com/detail/pedibchhakipflddbcfckhgojjagoiim',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/flashcpap/poakfgkhfiamihmcbihhajkjbdndgilf'
});

function openExternalLink(url) {
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}

function getStoreUrl() {
  if (browserApi.name === 'firefox') return STORE_URLS.firefox;
  const userAgent = String(globalThis.navigator?.userAgent || '');
  return /Edg\//i.test(userAgent) ? STORE_URLS.edge : STORE_URLS.chrome;
}

function showReviewPopup(decision) {
  showMiniCtaPopup({
    id: `copy-review-${decision.promptNumber}`,
    title: t('copyReviewPopupTitle'),
    message: t('copyReviewPopupMessage'),
    actions: [
      {
        label: t('copyPromptLater'),
        kind: 'secondary'
      },
      {
        label: t('copyReviewPopupAction'),
        kind: 'primary',
        onClick: () => {
          if (openExternalLink(getStoreUrl())) void markStoreLinkOpened();
        }
      }
    ],
    timeout: 0
  });
}

function showSupportPopup(decision) {
  const supportUrl = getSupportersConfig()?.coffee?.link || 'https://ko-fi.com/flashcpap';
  showMiniCtaPopup({
    id: `copy-support-${decision.totalCopies}`,
    title: t('copySupportPopupTitle'),
    message: t('copySupportPopupMessage'),
    actions: [
      {
        label: t('copyPromptLater'),
        kind: 'secondary'
      },
      {
        label: t('copySupportPopupAction'),
        kind: 'primary',
        onClick: () => {
          if (openExternalLink(supportUrl)) void markSupportLinkOpened();
        }
      }
    ],
    timeout: 0
  });
}

function showProviderSharePopup(decision) {
  const providerLabel = decision.providerLabel;
  showMiniCtaPopup({
    id: `copy-provider-share-${decision.providerKey}-${decision.promptNumber}`,
    title: t('copyProviderSharePopupTitle', providerLabel),
    message: t('copyProviderSharePopupMessage', [
      providerLabel,
      String(decision.providerCopies)
    ]),
    actions: [
      {
        label: t('copyPromptLater'),
        kind: 'secondary'
      },
      {
        label: t('copyProviderSharePopupAction'),
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

export function renderCopyEngagementDecision(decision) {
  switch (decision?.type) {
    case COPY_ENGAGEMENT_DECISIONS.REVIEW:
      showReviewPopup(decision);
      break;
    case COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE:
      showProviderSharePopup(decision);
      break;
    case COPY_ENGAGEMENT_DECISIONS.SUPPORT:
      showSupportPopup(decision);
      break;
    default:
      break;
  }
}

export async function handleSuccessfulCopyEngagement(providerLabel) {
  const decision = await registerSuccessfulCopy(providerLabel);
  renderCopyEngagementDecision(decision);
  return decision;
}
