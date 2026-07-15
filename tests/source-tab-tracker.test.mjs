import assert from 'node:assert/strict';
import test from 'node:test';

const mockBrowser = {
  tabs: {
    onActivated: { addListener() {} },
    onUpdated: { addListener() {} },
    onRemoved: { addListener() {} }
  },
  windows: {
    onFocusChanged: { addListener() {} }
  }
};

globalThis.browser = mockBrowser;

const tracker = await import('../src/platform/source-tab-tracker.js');

test('tracker stores and clears source tab state', () => {
  tracker.setTrackedSourceTab({ id: 8, url: 'https://example.com/report', title: 'Report', windowId: 3 });
  assert.equal(tracker.getTrackedSourceTab()?.id, 8);
  assert.equal(tracker.getTrackedSourceTab()?.url, 'https://example.com/report');

  tracker.clearTrackedSourceTab();
  assert.equal(tracker.getTrackedSourceTab(), null);
});
