import assert from 'node:assert/strict';
import test from 'node:test';

const storageData = {};

globalThis.chrome = {
  storage: {
    local: {
      async get(defaults = {}) {
        return { ...defaults, ...storageData };
      },
      async set(items) {
        Object.assign(storageData, items);
      }
    }
  }
};

const {
  COPY_ENGAGEMENT_DECISIONS,
  COPY_ENGAGEMENT_KEY,
  computeCopyEngagementDecision,
  migrateLegacyCopyEngagementState,
  normalizeCopyEngagementState,
  registerSuccessfulCopy
} = await import('../src/copy-engagement.js');

function stateWith(overrides = {}) {
  return normalizeCopyEngagementState({
    ...overrides,
    providerCopies: overrides.providerCopies || {},
    communityPromptCount: overrides.communityPromptCount || {},
    providerCopiesAtFirstCommunityPrompt: overrides.providerCopiesAtFirstCommunityPrompt || {},
    providerSharedSuccessfully: overrides.providerSharedSuccessfully || {}
  });
}

function copyMany(initialState, count, providerLabel = '') {
  let state = initialState;
  const decisions = [];
  for (let index = 0; index < count; index += 1) {
    const result = computeCopyEngagementDecision(state, providerLabel);
    state = result.state;
    decisions.push(result.decision);
  }
  return { state, decisions };
}

test('the tenth successful copy selects the first review and the eleventh selects nothing', () => {
  const firstNine = copyMany(stateWith(), 9);
  assert.ok(firstNine.decisions.every(decision => decision.type === COPY_ENGAGEMENT_DECISIONS.NONE));

  const tenth = computeCopyEngagementDecision(firstNine.state, '');
  assert.equal(tenth.decision.type, COPY_ENGAGEMENT_DECISIONS.REVIEW);
  assert.equal(tenth.decision.promptNumber, 1);
  assert.equal(tenth.state.reviewPromptCount, 1);
  assert.equal(tenth.state.lastPromptAt, 10);

  const eleventh = computeCopyEngagementDecision(tenth.state, '');
  assert.equal(eleventh.decision.type, COPY_ENGAGEMENT_DECISIONS.NONE);
});

test('the second review is selected at 30 through the sole initial spacing exception', () => {
  const throughTen = copyMany(stateWith(), 10).state;
  const result = copyMany(throughTen, 20);
  const selected = result.decisions.filter(decision => decision.type !== COPY_ENGAGEMENT_DECISIONS.NONE);

  assert.deepEqual(selected.map(decision => [decision.type, decision.promptNumber]), [
    [COPY_ENGAGEMENT_DECISIONS.REVIEW, 2]
  ]);
  assert.equal(result.state.lastPromptAt, 30);
  assert.equal(result.state.reviewPromptCount, 2);
});

test('opening the Store suppresses the second review permanently', () => {
  const firstReview = copyMany(stateWith(), 10).state;
  firstReview.storeLinkOpened = true;
  const result = copyMany(firstReview, 100);

  assert.equal(
    result.decisions.some(decision => decision.type === COPY_ENGAGEMENT_DECISIONS.REVIEW),
    false
  );
  assert.equal(result.state.reviewPromptCount, 1);
});

test('review wins at 30 and a non-selected provider event remains eligible', () => {
  const state = stateWith({
    totalCopies: 29,
    providerCopies: { provider_a: 29 },
    lastPromptAt: 10,
    reviewPromptCount: 1
  });

  const result = computeCopyEngagementDecision(state, 'Provider_a');
  assert.equal(result.decision.type, COPY_ENGAGEMENT_DECISIONS.REVIEW);
  assert.equal(result.state.communityPromptCount.provider_a, undefined);

  const delayed = copyMany(result.state, 40, 'Provider_a');
  const selected = delayed.decisions.filter(decision => decision.type !== COPY_ENGAGEMENT_DECISIONS.NONE);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].type, COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE);
  assert.equal(selected[0].providerCopies, 70);
});

test('provider sharing wins over Ko-fi when both are eligible', () => {
  const state = stateWith({
    totalCopies: 69,
    providerCopies: { provider_a: 69 },
    lastPromptAt: 30,
    reviewPromptCount: 2
  });

  const result = computeCopyEngagementDecision(state, 'Provider_a');
  assert.equal(result.decision.type, COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE);
  assert.equal(result.state.supportPromptShown, false);
  assert.equal(result.state.communityPromptCount.provider_a, 1);
});

test('a community request is only selected for the current provider', () => {
  const state = stateWith({
    totalCopies: 100,
    providerCopies: { provider_a: 30, provider_b: 0 },
    reviewPromptCount: 2,
    supportPromptShown: true
  });

  const providerB = computeCopyEngagementDecision(state, 'Provider B');
  assert.equal(providerB.decision.type, COPY_ENGAGEMENT_DECISIONS.NONE);
  assert.equal(providerB.state.communityPromptCount.provider_a, undefined);

  const providerA = computeCopyEngagementDecision(providerB.state, 'Provider_a');
  assert.equal(providerA.decision.type, COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE);
  assert.equal(providerA.decision.providerKey, 'provider_a');
});

test('the second community threshold is based on the real first display count', () => {
  const beforeFirst = stateWith({
    totalCopies: 51,
    providerCopies: { provider_a: 51 },
    reviewPromptCount: 2,
    supportPromptShown: true
  });
  const first = computeCopyEngagementDecision(beforeFirst, 'Provider_a');
  assert.equal(first.decision.providerCopies, 52);
  assert.equal(first.state.providerCopiesAtFirstCommunityPrompt.provider_a, 52);

  const nextThirty = copyMany(first.state, 30, 'Provider_a');
  assert.equal(
    nextThirty.decisions.some(decision => decision.type === COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE),
    false
  );
  assert.equal(nextThirty.state.providerCopies.provider_a, 82);

  const afterGlobalSpacing = copyMany(nextThirty.state, 10, 'Provider_a');
  const selected = afterGlobalSpacing.decisions.filter(
    decision => decision.type === COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0].promptNumber, 2);
  assert.equal(selected[0].providerCopies, 92);
  assert.equal(afterGlobalSpacing.state.communityPromptCount.provider_a, 2);
});

test('a successful provider share suppresses all future community requests', () => {
  const state = stateWith({
    totalCopies: 500,
    providerCopies: { provider_a: 500 },
    reviewPromptCount: 2,
    supportPromptShown: true,
    providerSharedSuccessfully: { provider_a: true }
  });

  const result = copyMany(state, 100, 'Provider_a');
  assert.equal(
    result.decisions.some(decision => decision.type === COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE),
    false
  );
});

test('Ko-fi remains eligible when delayed and is selected only once', () => {
  const delayedState = stateWith({
    totalCopies: 69,
    lastPromptAt: 30,
    reviewPromptCount: 2
  });
  const atSeventy = computeCopyEngagementDecision(delayedState, '');
  assert.equal(atSeventy.decision.type, COPY_ENGAGEMENT_DECISIONS.SUPPORT);
  assert.equal(atSeventy.state.supportPromptShown, true);

  const later = copyMany(atSeventy.state, 500);
  assert.equal(
    later.decisions.some(decision => decision.type === COPY_ENGAGEMENT_DECISIONS.SUPPORT),
    false
  );
});

test('global spacing blocks a prompt shown at 45 until copy 85', () => {
  const state = stateWith({
    totalCopies: 84,
    providerCopies: { provider_a: 29 },
    lastPromptAt: 45,
    reviewPromptCount: 2,
    supportPromptShown: true
  });

  const atEightyFive = computeCopyEngagementDecision(state, 'Provider_a');
  assert.equal(atEightyFive.decision.type, COPY_ENGAGEMENT_DECISIONS.PROVIDER_SHARE);
  assert.equal(atEightyFive.decision.totalCopies, 85);
});

test('legacy migration preserves usage and delays the second late review by 40 copies', () => {
  const migrated = migrateLegacyCopyEngagementState({
    totalCopies: 184,
    providerCopies: { provider_a: 77 },
    providerPromptShownCount: { provider_a: 1 },
    providerAlreadyShared: { provider_b: true }
  });

  assert.equal(migrated.reviewFirstEligibleAtTotal, 185);
  assert.equal(migrated.reviewMigrationFirstPending, true);
  assert.equal(migrated.supportPromptShown, true);
  assert.equal(migrated.communityPromptCount.provider_a, 1);
  assert.equal(migrated.providerCopiesAtFirstCommunityPrompt.provider_a, 77);
  assert.equal(migrated.providerSharedSuccessfully.provider_b, true);

  const firstLateReview = computeCopyEngagementDecision(migrated, '');
  assert.equal(firstLateReview.decision.type, COPY_ENGAGEMENT_DECISIONS.REVIEW);
  assert.equal(firstLateReview.decision.totalCopies, 185);
  assert.equal(firstLateReview.state.reviewSecondEligibleAtTotal, 225);

  const untilSecond = copyMany(firstLateReview.state, 40);
  const selected = untilSecond.decisions.filter(
    decision => decision.type === COPY_ENGAGEMENT_DECISIONS.REVIEW
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0].totalCopies, 225);
});

test('concurrent successful-copy registrations are serialized without lost increments', async () => {
  delete storageData[COPY_ENGAGEMENT_KEY];
  await Promise.all([
    registerSuccessfulCopy('Provider_a'),
    registerSuccessfulCopy('Provider_a'),
    registerSuccessfulCopy('Provider_a'),
    registerSuccessfulCopy('Provider_a'),
    registerSuccessfulCopy('Provider_a')
  ]);

  assert.equal(storageData[COPY_ENGAGEMENT_KEY].totalCopies, 5);
  assert.equal(storageData[COPY_ENGAGEMENT_KEY].providerCopies.provider_a, 5);
});
