import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.chrome = {
  storage: {
    local: {
      async get() { return {}; },
      async set() { return undefined; }
    }
  }
};

const { computeCopyEngagementMilestone } = await import('../src/copy-engagement.js');

test('copy engagement triggers provider popup at first provider threshold', () => {
  let state = {
    totalCopies: 39,
    providerCopies: { orkyn_resmed: 39 },
    providerNextPromptAtCopies: {},
    providerPromptShownCount: {},
    providerAlreadyShared: {},
    supportDeferredUntilTotal: 0,
    providerDeferredUntilCopies: {}
  };

  const result = computeCopyEngagementMilestone(state, 'Orkyn_resmed');

  assert.equal(result.milestone.totalCopies, 40);
  assert.equal(result.milestone.providerCopies, 40);
  assert.equal(result.milestone.shouldShowProviderSharePrompt, true);
  assert.equal(result.state.providerNextPromptAtCopies.orkyn_resmed, 90);
});

test('copy engagement defers support prompt when provider prompt wins the same copy', () => {
  const state = {
    totalCopies: 49,
    providerCopies: { orkyn_resmed: 39 },
    providerNextPromptAtCopies: {},
    providerPromptShownCount: {},
    providerAlreadyShared: {},
    supportDeferredUntilTotal: 0,
    providerDeferredUntilCopies: {}
  };

  const result = computeCopyEngagementMilestone(state, 'Orkyn_resmed');

  assert.equal(result.milestone.totalCopies, 50);
  assert.equal(result.milestone.shouldShowProviderSharePrompt, true);
  assert.equal(result.milestone.shouldShowSupportPrompt, false);
  assert.equal(result.state.supportDeferredUntilTotal, 60);
});