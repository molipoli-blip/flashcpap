// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// Centralized engagement state machine. Exactly one decision may be selected
// after a successful copy; rendering is handled separately.

import { toProviderKey } from './domain/provider-rules.js';
import { browserApi } from './platform/browser-api.js';

export const COPY_ENGAGEMENT_KEY = 'flashcpap_copy_engagement_v2';
export const LEGACY_COPY_ENGAGEMENT_KEY = 'flashcpap_copy_engagement_v1';

export const COPY_ENGAGEMENT_RULES = Object.freeze({
  reviewFirstAtTotal: 10,
  reviewSecondAtTotal: 30,
  providerFirstAtCopies: 30,
  providerSecondMinimumAtCopies: 60,
  providerCopiesAfterFirstPrompt: 30,
  supportAtTotal: 50,
  minimumPromptSpacing: 40
});

export const COPY_ENGAGEMENT_DECISIONS = Object.freeze({
  REVIEW: 'review',
  PROVIDER_SHARE: 'providerShare',
  SUPPORT: 'support',
  NONE: 'none'
});

const STATE_VERSION = 2;

function createDefaultState() {
  return {
    version: STATE_VERSION,
    totalCopies: 0,
    providerCopies: {},
    lastPromptAt: 0,
    reviewPromptCount: 0,
    reviewFirstEligibleAtTotal: COPY_ENGAGEMENT_RULES.reviewFirstAtTotal,
    reviewSecondEligibleAtTotal: COPY_ENGAGEMENT_RULES.reviewSecondAtTotal,
    reviewMigrationFirstPending: false,
    storeLinkOpened: false,
    supportPromptShown: false,
    supportLinkOpened: false,
    communityPromptCount: {},
    providerCopiesAtFirstCommunityPrompt: {},
    providerSharedSuccessfully: {}
  };
}

function asCount(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeCountRecord(value, maximum = Number.POSITIVE_INFINITY) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, count]) => [
      key,
      Math.min(maximum, asCount(Number(count)))
    ])
  );
}

function normalizeBooleanRecord(value) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, enabled]) => [key, !!enabled])
  );
}

export function normalizeCopyEngagementState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const reviewPromptCount = Math.min(2, asCount(source.reviewPromptCount));

  return {
    version: STATE_VERSION,
    totalCopies: asCount(source.totalCopies),
    providerCopies: normalizeCountRecord(source.providerCopies),
    lastPromptAt: asCount(source.lastPromptAt),
    reviewPromptCount,
    reviewFirstEligibleAtTotal: asCount(
      source.reviewFirstEligibleAtTotal,
      COPY_ENGAGEMENT_RULES.reviewFirstAtTotal
    ),
    reviewSecondEligibleAtTotal: asCount(
      source.reviewSecondEligibleAtTotal,
      COPY_ENGAGEMENT_RULES.reviewSecondAtTotal
    ),
    reviewMigrationFirstPending: !!source.reviewMigrationFirstPending && reviewPromptCount === 0,
    storeLinkOpened: !!source.storeLinkOpened,
    supportPromptShown: !!source.supportPromptShown,
    supportLinkOpened: !!source.supportLinkOpened,
    communityPromptCount: normalizeCountRecord(source.communityPromptCount, 2),
    providerCopiesAtFirstCommunityPrompt: normalizeCountRecord(source.providerCopiesAtFirstCommunityPrompt),
    providerSharedSuccessfully: normalizeBooleanRecord(source.providerSharedSuccessfully)
  };
}

export function migrateLegacyCopyEngagementState(value) {
  const legacy = value && typeof value === 'object' ? value : {};
  const state = createDefaultState();
  state.totalCopies = asCount(legacy.totalCopies);
  state.providerCopies = normalizeCountRecord(legacy.providerCopies);
  state.providerSharedSuccessfully = normalizeBooleanRecord(legacy.providerAlreadyShared);

  const legacyPromptCounts = normalizeCountRecord(legacy.providerPromptShownCount, 2);
  state.communityPromptCount = legacyPromptCounts;
  for (const [providerKey, promptCount] of Object.entries(legacyPromptCounts)) {
    if (promptCount === 1) {
      // The exact first display count did not exist in v1. Using the current
      // provider count schedules the final request conservatively 30 copies later.
      state.providerCopiesAtFirstCommunityPrompt[providerKey] = asCount(
        state.providerCopies[providerKey]
      );
    }
  }

  // v1 could show Ko-fi at every multiple of 50 but did not persist a definitive
  // shown flag. Avoid re-soliciting established users during migration.
  state.supportPromptShown = state.totalCopies >= COPY_ENGAGEMENT_RULES.supportAtTotal;

  if (state.totalCopies >= COPY_ENGAGEMENT_RULES.reviewFirstAtTotal) {
    state.reviewFirstEligibleAtTotal = state.totalCopies + 1;
    state.reviewMigrationFirstPending = true;
  }

  return normalizeCopyEngagementState(state);
}

function cloneState(value) {
  const normalized = normalizeCopyEngagementState(value);
  return {
    ...normalized,
    providerCopies: { ...normalized.providerCopies },
    communityPromptCount: { ...normalized.communityPromptCount },
    providerCopiesAtFirstCommunityPrompt: {
      ...normalized.providerCopiesAtFirstCommunityPrompt
    },
    providerSharedSuccessfully: { ...normalized.providerSharedSuccessfully }
  };
}

function normalizeProviderKey(providerLabel) {
  return toProviderKey(providerLabel);
}

function getReviewCandidate(state) {
  if (state.storeLinkOpened || state.reviewPromptCount >= 2) return null;

  if (
    state.reviewPromptCount === 0
    && state.totalCopies >= state.reviewFirstEligibleAtTotal
  ) {
    return { promptNumber: 1, isMigrationFirstPrompt: state.reviewMigrationFirstPending };
  }

  if (
    state.reviewPromptCount === 1
    && state.totalCopies >= state.reviewSecondEligibleAtTotal
  ) {
    return { promptNumber: 2, isMigrationFirstPrompt: false };
  }

  return null;
}

function getProviderCandidate(state, providerKey) {
  if (!providerKey || state.providerSharedSuccessfully[providerKey]) return null;

  const shownCount = Math.min(2, asCount(state.communityPromptCount[providerKey]));
  if (shownCount >= 2) return null;

  const providerCopies = asCount(state.providerCopies[providerKey]);
  if (shownCount === 0) {
    return providerCopies >= COPY_ENGAGEMENT_RULES.providerFirstAtCopies
      ? { promptNumber: 1, providerCopies }
      : null;
  }

  const firstPromptAt = asCount(state.providerCopiesAtFirstCommunityPrompt[providerKey]);
  const threshold = Math.max(
    COPY_ENGAGEMENT_RULES.providerSecondMinimumAtCopies,
    firstPromptAt + COPY_ENGAGEMENT_RULES.providerCopiesAfterFirstPrompt
  );
  return providerCopies >= threshold
    ? { promptNumber: 2, providerCopies, threshold }
    : null;
}

function isSupportCandidate(state) {
  return !state.supportPromptShown
    && !state.supportLinkOpened
    && state.totalCopies >= COPY_ENGAGEMENT_RULES.supportAtTotal;
}

function spacingAllowsPrompt(state, reviewCandidate) {
  if (state.lastPromptAt <= 0) return true;

  if (
    state.totalCopies === COPY_ENGAGEMENT_RULES.reviewSecondAtTotal
    && state.lastPromptAt === COPY_ENGAGEMENT_RULES.reviewFirstAtTotal
  ) {
    return true;
  }

  if (reviewCandidate?.isMigrationFirstPrompt) return true;

  return state.totalCopies >= state.lastPromptAt + COPY_ENGAGEMENT_RULES.minimumPromptSpacing;
}

function selectDecision({ state, providerKey, providerLabel, review, provider, support }) {
  if (!spacingAllowsPrompt(state, review)) {
    return { type: COPY_ENGAGEMENT_DECISIONS.NONE };
  }

  if (review) {
    return {
      type: COPY_ENGAGEMENT_DECISIONS.REVIEW,
      promptNumber: review.promptNumber,
      totalCopies: state.totalCopies
    };
  }

  if (provider) {
    return {
      type: COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE,
      promptNumber: provider.promptNumber,
      providerKey,
      providerLabel: String(providerLabel || ''),
      providerCopies: provider.providerCopies,
      totalCopies: state.totalCopies
    };
  }

  if (support) {
    return {
      type: COPY_ENGAGEMENT_DECISIONS.SUPPORT,
      totalCopies: state.totalCopies
    };
  }

  return { type: COPY_ENGAGEMENT_DECISIONS.NONE };
}

function consumeDecision(state, decision) {
  if (decision.type === COPY_ENGAGEMENT_DECISIONS.NONE) return;

  state.lastPromptAt = state.totalCopies;

  if (decision.type === COPY_ENGAGEMENT_DECISIONS.REVIEW) {
    const wasMigrationFirstPrompt = state.reviewMigrationFirstPending
      && decision.promptNumber === 1;
    state.reviewPromptCount = Math.min(2, decision.promptNumber);
    state.reviewMigrationFirstPending = false;
    if (decision.promptNumber === 1) {
      state.reviewSecondEligibleAtTotal = wasMigrationFirstPrompt
        ? state.totalCopies + COPY_ENGAGEMENT_RULES.minimumPromptSpacing
        : COPY_ENGAGEMENT_RULES.reviewSecondAtTotal;
    }
    return;
  }

  if (decision.type === COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE) {
    state.communityPromptCount[decision.providerKey] = Math.min(2, decision.promptNumber);
    if (decision.promptNumber === 1) {
      state.providerCopiesAtFirstCommunityPrompt[decision.providerKey] = decision.providerCopies;
    }
    return;
  }

  if (decision.type === COPY_ENGAGEMENT_DECISIONS.SUPPORT) {
    state.supportPromptShown = true;
  }
}

export function computeCopyEngagementDecision(value, providerLabel) {
  const state = cloneState(value);
  const providerKey = normalizeProviderKey(providerLabel);

  state.totalCopies += 1;
  if (providerKey) {
    state.providerCopies[providerKey] = asCount(state.providerCopies[providerKey]) + 1;
  }

  const review = getReviewCandidate(state);
  const provider = getProviderCandidate(state, providerKey);
  const support = isSupportCandidate(state);
  const decision = selectDecision({
    state,
    providerKey,
    providerLabel,
    review,
    provider,
    support
  });

  consumeDecision(state, decision);
  return { state, decision };
}

function parseLocalState(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function loadStateAsync() {
  let storedV2 = null;
  let storedV1 = null;

  try {
    const stored = await browserApi.storage?.local?.get?.({
      [COPY_ENGAGEMENT_KEY]: null,
      [LEGACY_COPY_ENGAGEMENT_KEY]: null
    });
    storedV2 = stored?.[COPY_ENGAGEMENT_KEY] || null;
    storedV1 = stored?.[LEGACY_COPY_ENGAGEMENT_KEY] || null;
  } catch {}

  const current = storedV2 || parseLocalState(COPY_ENGAGEMENT_KEY);
  if (current) return normalizeCopyEngagementState(current);

  const legacy = storedV1 || parseLocalState(LEGACY_COPY_ENGAGEMENT_KEY);
  const initialState = legacy
    ? migrateLegacyCopyEngagementState(legacy)
    : createDefaultState();
  await saveStateAsync(initialState);
  return initialState;
}

async function saveStateAsync(state) {
  const normalized = normalizeCopyEngagementState(state);
  try {
    localStorage.setItem(COPY_ENGAGEMENT_KEY, JSON.stringify(normalized));
  } catch {}
  try {
    await browserApi.storage?.local?.set?.({ [COPY_ENGAGEMENT_KEY]: normalized });
  } catch {}
  return normalized;
}

let stateMutationQueue = Promise.resolve();

function enqueueStateMutation(operation) {
  const result = stateMutationQueue.then(operation, operation);
  stateMutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

// Records one successful, non-empty clipboard copy. The selected prompt is
// persisted before its decision is returned to the rendering layer.
export function registerSuccessfulCopy(providerLabel) {
  return enqueueStateMutation(async () => {
    const state = await loadStateAsync();
    const result = computeCopyEngagementDecision(state, providerLabel);
    await saveStateAsync(result.state);
    return result.decision;
  });
}

export function markStoreLinkOpened() {
  return enqueueStateMutation(async () => {
    const state = await loadStateAsync();
    state.storeLinkOpened = true;
    return saveStateAsync(state);
  });
}

export function markSupportLinkOpened() {
  return enqueueStateMutation(async () => {
    const state = await loadStateAsync();
    state.supportLinkOpened = true;
    return saveStateAsync(state);
  });
}

export function markProviderAsShared(providerLabel) {
  const providerKey = normalizeProviderKey(providerLabel);
  if (!providerKey) return Promise.resolve();

  return enqueueStateMutation(async () => {
    const state = await loadStateAsync();
    state.providerSharedSuccessfully[providerKey] = true;
    return saveStateAsync(state);
  });
}
