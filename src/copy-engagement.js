// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - copy engagement milestones (support + provider sharing)

import { toProviderKey } from './domain/provider-rules.js';

const COPY_ENGAGEMENT_KEY = 'flashcpap_copy_engagement_v1';

export const COPY_ENGAGEMENT_RULES = {
  supportEveryCopies: 50,
  providerFirstPromptCopies: 40,
  providerStepIncrements: [50, 60, 70],
  deferExtraCopiesOnConflict: 10
};

const DEFAULT_STATE = {
  totalCopies: 0,
  providerCopies: {},
  providerNextPromptAtCopies: {},
  providerPromptShownCount: {},
  providerAlreadyShared: {},
  supportDeferredUntilTotal: 0,
  providerDeferredUntilCopies: {}
};

function normalizeProviderKey(providerLabel) {
  return toProviderKey(providerLabel);
}

function cloneDefaultState() {
  return {
    totalCopies: DEFAULT_STATE.totalCopies,
    providerCopies: {},
    providerNextPromptAtCopies: {},
    providerPromptShownCount: {},
    providerAlreadyShared: {},
    supportDeferredUntilTotal: DEFAULT_STATE.supportDeferredUntilTotal,
    providerDeferredUntilCopies: {}
  };
}

function getProviderStepIncrement(promptShownCount) {
  const configured = Array.isArray(COPY_ENGAGEMENT_RULES.providerStepIncrements)
    ? COPY_ENGAGEMENT_RULES.providerStepIncrements
    : [50, 60, 70];
  const normalized = configured
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0);
  const steps = normalized.length ? normalized : [50, 60, 70];
  const index = Math.min(Math.max(0, Number(promptShownCount) || 0), steps.length - 1);
  return steps[index];
}

function asStoredCount(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function asStoredRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getPositiveRuleNumber(value, fallback) {
  return Math.max(1, Number(value) || fallback);
}

function loadState() {
  try {
    const raw = localStorage.getItem(COPY_ENGAGEMENT_KEY);
    if (!raw) return cloneDefaultState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return cloneDefaultState();

    return {
      totalCopies: asStoredCount(parsed.totalCopies),
      providerCopies: asStoredRecord(parsed.providerCopies),
      providerNextPromptAtCopies: asStoredRecord(parsed.providerNextPromptAtCopies),
      providerPromptShownCount: asStoredRecord(parsed.providerPromptShownCount),
      providerAlreadyShared: asStoredRecord(parsed.providerAlreadyShared),
      supportDeferredUntilTotal: asStoredCount(parsed.supportDeferredUntilTotal),
      providerDeferredUntilCopies: asStoredRecord(parsed.providerDeferredUntilCopies)
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

  const supportEvery = getPositiveRuleNumber(COPY_ENGAGEMENT_RULES.supportEveryCopies, 20);
  const providerFirst = getPositiveRuleNumber(COPY_ENGAGEMENT_RULES.providerFirstPromptCopies, 40);
  const deferExtra = getPositiveRuleNumber(COPY_ENGAGEMENT_RULES.deferExtraCopiesOnConflict, 10);

  const supportDueByPeriod = state.totalCopies >= supportEvery && (state.totalCopies % supportEvery === 0);
  const supportDeferredUntil = Number(state.supportDeferredUntilTotal) || 0;
  let shouldShowSupportPrompt = supportDueByPeriod && state.totalCopies >= supportDeferredUntil;

  let shouldShowProviderSharePrompt = false;
  let providerCount = 0;
  if (providerKey) {
    providerCount = Number(state.providerCopies[providerKey]) || 0;
    const alreadyShared = !!state.providerAlreadyShared[providerKey];
    const providerThreshold = Number(state.providerNextPromptAtCopies[providerKey]) || providerFirst;
    if (!state.providerNextPromptAtCopies[providerKey]) {
      state.providerNextPromptAtCopies[providerKey] = providerThreshold;
    }

    const providerDueByPeriod = providerCount >= providerThreshold;
    const providerDeferredUntil = Number(state.providerDeferredUntilCopies[providerKey]) || 0;
    shouldShowProviderSharePrompt = !alreadyShared && providerDueByPeriod && providerCount >= providerDeferredUntil;

    if (shouldShowProviderSharePrompt) {
      const shownCount = Number(state.providerPromptShownCount[providerKey]) || 0;
      const nextIncrement = getProviderStepIncrement(shownCount);
      state.providerPromptShownCount[providerKey] = shownCount + 1;
      state.providerNextPromptAtCopies[providerKey] = providerThreshold + nextIncrement;
    }
  }

  // Never chain prompts: keep provider prompt now and defer support eligibility.
  // The support prompt still only appears on configured support milestones.
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

export function markProviderAsShared(providerLabel) {
  const providerKey = normalizeProviderKey(providerLabel);
  if (!providerKey) return;

  const state = loadState();
  state.providerAlreadyShared[providerKey] = true;
  saveState(state);
}
