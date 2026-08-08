import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CURRENT_ONBOARDING_REVISION,
  markCurrentOnboardingSeen,
  shouldShowCurrentOnboarding
} from '../src/first-run-onboarding.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test('the current guide revision reaches fresh and existing installations exactly once', () => {
  const previousStorage = globalThis.localStorage;
  try {
    globalThis.localStorage = new MemoryStorage();
    assert.equal(shouldShowCurrentOnboarding(), true, 'fresh install');

    globalThis.localStorage = new MemoryStorage({
      'flashcpap:onboarding-completed': '1'
    });
    assert.equal(shouldShowCurrentOnboarding(), true, 'existing install with legacy completion flag');

    markCurrentOnboardingSeen();
    assert.equal(
      globalThis.localStorage.getItem('flashcpap:onboarding-seen-revision'),
      CURRENT_ONBOARDING_REVISION
    );
    assert.equal(globalThis.localStorage.getItem('flashcpap:onboarding-completed'), null);
    assert.equal(globalThis.localStorage.getItem('flashcpap:onboarding-pending'), null);
    assert.equal(shouldShowCurrentOnboarding(), false, 'same guide revision is not repeated');

    globalThis.localStorage.setItem('flashcpap:onboarding-seen-revision', 'older-guide');
    assert.equal(shouldShowCurrentOnboarding(), true, 'a future guide revision can be surfaced again');
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
