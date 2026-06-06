// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - copy engagement milestones (support + provider sharing)

const COPY_ENGAGEMENT_KEY = 'flashcpap_copy_engagement_v1';

export const COPY_ENGAGEMENT_RULES = {
  supportEveryCopies: 50,
  providerShareEveryCopies: 30,
  deferExtraCopiesOnConflict: 10
};

const DEFAULT_STATE = {
  totalCopies: 0,
  providerCopies: {},
  supportDeferredUntilTotal: 0,
  providerDeferredUntilCopies: {}
};

function normalizeProviderKey(providerLabel) {
  return String(providerLabel || '').trim().toLowerCase();
}

function cloneDefaultState() {
  return {
    totalCopies: DEFAULT_STATE.totalCopies,
    providerCopies: {},
    supportDeferredUntilTotal: DEFAULT_STATE.supportDeferredUntilTotal,
    providerDeferredUntilCopies: {}
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(COPY_ENGAGEMENT_KEY);
    if (!raw) return cloneDefaultState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return cloneDefaultState();

    return {
      totalCopies: Number.isFinite(parsed.totalCopies) ? Math.max(0, parsed.totalCopies) : 0,
      providerCopies: parsed.providerCopies && typeof parsed.providerCopies === 'object' ? parsed.providerCopies : {},
      supportDeferredUntilTotal: Number.isFinite(parsed.supportDeferredUntilTotal) ? Math.max(0, parsed.supportDeferredUntilTotal) : 0,
      providerDeferredUntilCopies: parsed.providerDeferredUntilCopies && typeof parsed.providerDeferredUntilCopies === 'object'
        ? parsed.providerDeferredUntilCopies
        : {}
    };
  } catch {
    return cloneDefaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(COPY_ENGAGEMENT_KEY, JSON.stringify(state));
  } catch {}
}

// Records a successful copy event and returns which prompts should be shown.
export function registerSuccessfulCopy(providerLabel) {
  const state = loadState();
  const providerKey = normalizeProviderKey(providerLabel);

  state.totalCopies += 1;

  if (providerKey) {
    const previousCount = Number(state.providerCopies[providerKey]) || 0;
    state.providerCopies[providerKey] = previousCount + 1;
  }

  const supportEvery = Math.max(1, Number(COPY_ENGAGEMENT_RULES.supportEveryCopies) || 20);
  const providerEvery = Math.max(1, Number(COPY_ENGAGEMENT_RULES.providerShareEveryCopies) || 10);
  const deferExtra = Math.max(1, Number(COPY_ENGAGEMENT_RULES.deferExtraCopiesOnConflict) || 10);

  const supportDueByPeriod = state.totalCopies >= supportEvery && (state.totalCopies % supportEvery === 0);
  const supportDeferredUntil = Number(state.supportDeferredUntilTotal) || 0;
  let shouldShowSupportPrompt = supportDueByPeriod && state.totalCopies >= supportDeferredUntil;

  let shouldShowProviderSharePrompt = false;
  let providerCount = 0;
  if (providerKey) {
    providerCount = Number(state.providerCopies[providerKey]) || 0;
    const providerDueByPeriod = providerCount >= providerEvery && (providerCount % providerEvery === 0);
    const providerDeferredUntil = Number(state.providerDeferredUntilCopies[providerKey]) || 0;
    shouldShowProviderSharePrompt = providerDueByPeriod && providerCount >= providerDeferredUntil;
  }

  // Never chain prompts: when both are due on the same copy, keep provider prompt now
  // and postpone support prompt by +N copies.
  if (shouldShowSupportPrompt && shouldShowProviderSharePrompt) {
    shouldShowSupportPrompt = false;
    state.supportDeferredUntilTotal = state.totalCopies + deferExtra;
  }

  saveState(state);

  return {
    totalCopies: state.totalCopies,
    providerCopies: providerKey ? Number(state.providerCopies[providerKey]) || 0 : 0,
    shouldShowSupportPrompt,
    shouldShowProviderSharePrompt,
    providerKey
  };
}
