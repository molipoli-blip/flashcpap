import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.chrome = {
  storage: {
    local: {
      get() {
        return Promise.resolve({});
      },
      set() {
        return Promise.resolve();
      }
    }
  }
};

const textarea = {
  value: '',
  addEventListener() {},
  removeEventListener() {}
};
const interpretCheckbox = { checked: false };

globalThis.document = {
  getElementById(id) {
    if (id === 'résumé') return textarea;
    if (id === 'cb-interpret') return interpretCheckbox;
    return null;
  }
};

const { settings } = await import('../src/storage.js');
const {
  changeActiveAnalysisProvider,
  setLastParsedData,
  updateSummaryDisplay
} = await import('../src/events.js');

function providerPattern() {
  return {
    urls: [],
    fields: {
      iah: {
        type: 'numeric',
        label: 'IAH',
        unit: '/h',
        labels: []
      }
    },
    fieldOrder: ['iah']
  };
}

test('manual provider selection refreshes the active summary provider', async () => {
  settings.patterns = {
    ancien: providerPattern(),
    nouveau: providerPattern()
  };
  settings.customCheckboxes = {
    __global__: [],
    ancien: [],
    nouveau: []
  };
  settings.organizationOrder = [];

  const originalLog = console.log;
  console.log = () => {};
  try {
    setLastParsedData({ iah: '2.1' }, 'Ancien');
    await updateSummaryDisplay();
    assert.match(textarea.value, /Prestataire : Ancien/);

    const changed = await changeActiveAnalysisProvider('Nouveau');
    assert.equal(changed, true);
    assert.match(textarea.value, /Prestataire : Nouveau/);
    assert.doesNotMatch(textarea.value, /Prestataire : Ancien/);
  } finally {
    console.log = originalLog;
  }
});
