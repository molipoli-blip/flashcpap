import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.chrome = {
  i18n: {
    getMessage(key) {
      return key;
    },
    getUILanguage() {
      return 'fr';
    }
  },
  storage: {
    local: {
      async get() {
        return {};
      },
      async set() {}
    }
  }
};

const { setupCopyAction } = await import('../src/copy-action.js');

function installCopyUi({ text = 'Résumé', writeText, onSuccessfulCopy }) {
  const copyButton = {
    disabled: false,
    onclick: null,
    textContent: 'Copier'
  };
  const preview = {
    querySelectorAll() {
      return text === null ? [] : [{ textContent: text }];
    }
  };
  const provider = { value: 'Provider_a' };

  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  const previousSetTimeout = globalThis.setTimeout;

  globalThis.document = {
    getElementById(id) {
      if (id === 'btn-copy') return copyButton;
      if (id === 'résumé-preview') return preview;
      if (id === 'prestataire-select') return provider;
      return null;
    }
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText } }
  });
  globalThis.setTimeout = () => 0;

  setupCopyAction({
    buildCleanSummaryText: value => value,
    onSuccessfulCopy
  });

  return {
    copyButton,
    restore() {
      globalThis.document = previousDocument;
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: previousNavigator
      });
      globalThis.setTimeout = previousSetTimeout;
    }
  };
}

test('setting up the copy action does not increment engagement by itself', () => {
  let clipboardCalls = 0;
  let engagementCalls = 0;
  const ui = installCopyUi({
    writeText: async () => { clipboardCalls += 1; },
    onSuccessfulCopy: async () => { engagementCalls += 1; }
  });

  try {
    assert.equal(clipboardCalls, 0);
    assert.equal(engagementCalls, 0);
  } finally {
    ui.restore();
  }
});

test('an empty summary does not touch the clipboard or engagement counters', async () => {
  let clipboardCalls = 0;
  let engagementCalls = 0;
  const ui = installCopyUi({
    text: '   ',
    writeText: async () => { clipboardCalls += 1; },
    onSuccessfulCopy: async () => { engagementCalls += 1; }
  });

  try {
    await ui.copyButton.onclick();
    assert.equal(clipboardCalls, 0);
    assert.equal(engagementCalls, 0);
    assert.equal(ui.copyButton.textContent, 'copyEmpty');
  } finally {
    ui.restore();
  }
});

test('a clipboard failure does not increment engagement counters', async () => {
  let engagementCalls = 0;
  const ui = installCopyUi({
    writeText: async () => { throw new Error('clipboard unavailable'); },
    onSuccessfulCopy: async () => { engagementCalls += 1; }
  });

  try {
    await ui.copyButton.onclick();
    assert.equal(engagementCalls, 0);
    assert.equal(ui.copyButton.textContent, 'copyFailure');
    assert.equal(ui.copyButton.disabled, false);
  } finally {
    ui.restore();
  }
});

test('an engagement error never turns a successful copy into a copy failure', async () => {
  let clipboardCalls = 0;
  let engagementCalls = 0;
  const previousWarn = console.warn;
  console.warn = () => {};
  const ui = installCopyUi({
    writeText: async () => { clipboardCalls += 1; },
    onSuccessfulCopy: async providerLabel => {
      engagementCalls += 1;
      assert.equal(providerLabel, 'Provider_a');
      throw new Error('engagement unavailable');
    }
  });

  try {
    await ui.copyButton.onclick();
    assert.equal(clipboardCalls, 1);
    assert.equal(engagementCalls, 1);
    assert.equal(ui.copyButton.textContent, 'copySuccess');
    assert.equal(ui.copyButton.disabled, false);
  } finally {
    console.warn = previousWarn;
    ui.restore();
  }
});

test('a second click is ignored while the first clipboard write is pending', async () => {
  let releaseClipboard;
  let clipboardCalls = 0;
  let engagementCalls = 0;
  const clipboardPending = new Promise(resolve => { releaseClipboard = resolve; });
  const ui = installCopyUi({
    writeText: async () => {
      clipboardCalls += 1;
      await clipboardPending;
    },
    onSuccessfulCopy: async () => { engagementCalls += 1; }
  });

  try {
    const firstClick = ui.copyButton.onclick();
    const secondClick = ui.copyButton.onclick();
    assert.equal(clipboardCalls, 1);
    releaseClipboard();
    await Promise.all([firstClick, secondClick]);
    assert.equal(engagementCalls, 1);
  } finally {
    ui.restore();
  }
});
