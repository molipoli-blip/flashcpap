// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - copy engagement milestones (support + provider sharing)

import { toProviderKey } from './domain/provider-rules.js';
import { browserApi } from './platform/browser-api.js';

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

async function loadStateAsync() {
  let storedState = null;

  try {
    const stored = await browserApi.storage?.local?.get?.({ [COPY_ENGAGEMENT_KEY]: null });
    storedState = stored?.[COPY_ENGAGEMENT_KEY] || null;
  } catch {}

  if (storedState && typeof storedState === 'object') {
    return {
      totalCopies: asStoredCount(storedState.totalCopies),
      providerCopies: asStoredRecord(storedState.providerCopies),
      providerNextPromptAtCopies: asStoredRecord(storedState.providerNextPromptAtCopies),
      providerPromptShownCount: asStoredRecord(storedState.providerPromptShownCount),
      providerAlreadyShared: asStoredRecord(storedState.providerAlreadyShared),
      supportDeferredUntilTotal: asStoredCount(storedState.supportDeferredUntilTotal),
      providerDeferredUntilCopies: asStoredRecord(storedState.providerDeferredUntilCopies)
    };
  }

  const migratedState = loadState();
  await saveStateAsync(migratedState);
  return migratedState;
}

function saveState(state) {
  try {
    localStorage.setItem(COPY_ENGAGEMENT_KEY, JSON.stringify(state));
  } catch {}
}

async function saveStateAsync(state) {
  saveState(state);
  try {
    await browserApi.storage?.local?.set?.({ [COPY_ENGAGEMENT_KEY]: state });
  } catch {}
}

export function computeCopyEngagementMilestone(state, providerLabel) {
  const nextState = {
    totalCopies: asStoredCount(state?.totalCopies),
    providerCopies: { ...asStoredRecord(state?.providerCopies) },
    providerNextPromptAtCopies: { ...asStoredRecord(state?.providerNextPromptAtCopies) },
    providerPromptShownCount: { ...asStoredRecord(state?.providerPromptShownCount) },
    providerAlreadyShared: { ...asStoredRecord(state?.providerAlreadyShared) },
    supportDeferredUntilTotal: asStoredCount(state?.supportDeferredUntilTotal),
    providerDeferredUntilCopies: { ...asStoredRecord(state?.providerDeferredUntilCopies) }
  };

  const providerKey = normalizeProviderKey(providerLabel);

  nextState.totalCopies += 1;

  if (providerKey) {
    const previousCount = Number(nextState.providerCopies[providerKey]) || 0;
    nextState.providerCopies[providerKey] = previousCount + 1;
  }

  const supportEvery = getPositiveRuleNumber(COPY_ENGAGEMENT_RULES.supportEveryCopies, 20);
  const providerFirst = getPositiveRuleNumber(COPY_ENGAGEMENT_RULES.providerFirstPromptCopies, 40);
  const deferExtra = getPositiveRuleNumber(COPY_ENGAGEMENT_RULES.deferExtraCopiesOnConflict, 10);

  const supportDueByPeriod = nextState.totalCopies >= supportEvery && (nextState.totalCopies % supportEvery === 0);
  const supportDeferredUntil = Number(nextState.supportDeferredUntilTotal) || 0;
  let shouldShowSupportPrompt = supportDueByPeriod && nextState.totalCopies >= supportDeferredUntil;

  let shouldShowProviderSharePrompt = false;
  if (providerKey) {
    const providerCount = Number(nextState.providerCopies[providerKey]) || 0;
    const alreadyShared = !!nextState.providerAlreadyShared[providerKey];
    const providerThreshold = Number(nextState.providerNextPromptAtCopies[providerKey]) || providerFirst;
    if (!nextState.providerNextPromptAtCopies[providerKey]) {
      nextState.providerNextPromptAtCopies[providerKey] = providerThreshold;
    }

    const providerDueByPeriod = providerCount >= providerThreshold;
    const providerDeferredUntil = Number(nextState.providerDeferredUntilCopies[providerKey]) || 0;
    shouldShowProviderSharePrompt = !alreadyShared && providerDueByPeriod && providerCount >= providerDeferredUntil;

    if (shouldShowProviderSharePrompt) {
      const shownCount = Number(nextState.providerPromptShownCount[providerKey]) || 0;
      const nextIncrement = getProviderStepIncrement(shownCount);
      nextState.providerPromptShownCount[providerKey] = shownCount + 1;
      nextState.providerNextPromptAtCopies[providerKey] = providerThreshold + nextIncrement;
    }
  }

  if (shouldShowSupportPrompt && shouldShowProviderSharePrompt) {
    shouldShowSupportPrompt = false;
    nextState.supportDeferredUntilTotal = nextState.totalCopies + deferExtra;
  }

  return {
    state: nextState,
    milestone: {
      totalCopies: nextState.totalCopies,
      providerCopies: providerKey ? Number(nextState.providerCopies[providerKey]) || 0 : 0,
      shouldShowSupportPrompt,
      shouldShowProviderSharePrompt,
      providerKey
    }
  };
}

// Records a successful copy event and returns which prompts should be shown.
export async function registerSuccessfulCopy(providerLabel) {
  const state = await loadStateAsync();
  const { state: nextState, milestone } = computeCopyEngagementMilestone(state, providerLabel);
  await saveStateAsync(nextState);
  return milestone;
}

export async function markProviderAsShared(providerLabel) {
  const providerKey = normalizeProviderKey(providerLabel);
  if (!providerKey) return;

  const state = await loadStateAsync();
  state.providerAlreadyShared[providerKey] = true;
  await saveStateAsync(state);
}
