import assert from 'node:assert/strict';
import test from 'node:test';

const storedValues = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storedValues.get(key) ?? null;
  },
  setItem(key, value) {
    storedValues.set(key, String(value));
  }
};

globalThis.chrome = {
  storage: {
    local: {
      set() {
        return Promise.resolve();
      }
    }
  }
};

const storageModule = await import('../src/storage.js');
const { detectProviderFromUrl } = await import('../src/domain/provider-rules.js');
const { parseTextMeta } = await import('../src/parsing.js');

function label(text) {
  return {
    text,
    range: { start: 1, end: 999 },
    excludeKeywords: [],
    priorityKeywords: [],
    labelExcludeKeywords: [],
    splitSeparators: []
  };
}

test('loadSettings preserves references captured before a provider import', () => {
  const capturedSettings = storageModule.settings;

  localStorage.setItem(storageModule.STORAGE_KEY, JSON.stringify({
    patterns: {
      demo_iframe: {
        urls: ['http://127.0.0.1:*/*'],
        fields: {
          iah: {
            type: 'numeric',
            label: 'IAH Moyen',
            unit: '/h',
            labels: [label('IAH Moyen')]
          }
        },
        fieldOrder: ['iah']
      }
    }
  }));

  const originalLog = console.log;
  console.log = () => {};
  try {
    storageModule.loadSettings();
  } finally {
    console.log = originalLog;
  }

  assert.strictEqual(storageModule.settings, capturedSettings);
  assert.equal(
    detectProviderFromUrl('http://127.0.0.1:8765/demo_iframe.html', capturedSettings),
    'Demo_iframe'
  );
  assert.deepEqual(
    parseTextMeta('IAH Moyen\n2.1 /h', 'Demo_iframe', capturedSettings).data,
    { iah: '2.1' }
  );
});
