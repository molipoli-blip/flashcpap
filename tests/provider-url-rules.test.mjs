import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectProviderFromUrl,
  findProviderUrlConflict
} from '../src/domain/provider-rules.js';

function detectQuietly(url, settings) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    return detectProviderFromUrl(url, settings);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

test('URL detection selects the provider with the most specific matching path', () => {
  const settings = {
    patterns: {
      provider_a: { urls: ['https://adiral.fr/*'] },
      provider_b: { urls: ['https://adiral.fr/report/*'] }
    }
  };

  assert.equal(detectQuietly('https://adiral.fr/accueil', settings), 'Provider_a');
  assert.equal(detectQuietly('https://adiral.fr/report/123', settings), 'Provider_b');
});

test('URL detection ignores provider insertion order when one pattern is more specific', () => {
  const settings = {
    patterns: {
      provider_b: { urls: ['https://adiral.fr/report/*'] },
      provider_a: { urls: ['https://adiral.fr/*'] }
    }
  };

  assert.equal(detectQuietly('https://adiral.fr/report/123', settings), 'Provider_b');
});

test('URL detection refuses an equal-specificity ambiguity', () => {
  const settings = {
    patterns: {
      provider_a: { urls: ['https://adiral.fr/*'] },
      provider_b: { urls: ['https://adiral.fr/*'] }
    }
  };

  assert.equal(detectQuietly('https://adiral.fr/report/123', settings), null);
});

test('a specific URL pattern takes priority over the global fallback', () => {
  const settings = {
    patterns: {
      fallback_provider: { urls: ['<all_urls>'] },
      provider_b: { urls: ['https://adiral.fr/report/*'] }
    }
  };

  assert.equal(detectQuietly('https://adiral.fr/report/123', settings), 'Provider_b');
  assert.equal(detectQuietly('https://other.example/accueil', settings), 'Fallback_provider');
});

test('URL conflict detection blocks exact duplicates but allows more specific paths', () => {
  const settings = {
    patterns: {
      provider_a: { urls: ['https://adiral.fr/*'] },
      provider_b: { urls: [] }
    }
  };

  assert.deepEqual(
    findProviderUrlConflict(settings, 'Provider_b', [' HTTPS://ADIRAL.FR/* ']),
    {
      url: 'HTTPS://ADIRAL.FR/*',
      providerKey: 'provider_a',
      providerLabel: 'Provider_a'
    }
  );
  assert.equal(
    findProviderUrlConflict(settings, 'Provider_b', ['https://adiral.fr/report/*']),
    null
  );
  assert.equal(
    findProviderUrlConflict(settings, 'Provider_a', ['https://adiral.fr/*']),
    null
  );
});
