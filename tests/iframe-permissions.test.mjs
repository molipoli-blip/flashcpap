import assert from 'node:assert/strict';
import test from 'node:test';

const {
  buildAnalysisAccess,
  cacheFrameSnapshot,
  clearFrameSnapshot,
  getCachedAnalysisAccess,
  refreshFrameSnapshot,
  requestAnalysisPermissions
} = await import('../src/iframe-permissions.js');

const sourceTab = {
  id: 42,
  url: 'https://portal.example/report'
};

const frames = [
  { frameId: 0, parentFrameId: -1, url: sourceTab.url },
  { frameId: 2, parentFrameId: 0, url: 'https://portal.example/help' },
  { frameId: 4, parentFrameId: 0, url: 'https://reports.vendor.example/report/123' },
  { frameId: 5, parentFrameId: 0, url: 'https://www.youtube.com/embed/video' },
  { frameId: 6, parentFrameId: 0, url: 'https://reports.vendor.example/report/456' },
  { frameId: 7, parentFrameId: 4, url: 'about:blank' },
  { frameId: 8, parentFrameId: 7, url: 'data:text/html,Inherited' },
  { frameId: 9, parentFrameId: 0, url: 'http://legacy.example/report' },
  { frameId: 10, parentFrameId: 0, url: 'blob:https://files.example/1234' },
  { frameId: 11, parentFrameId: 0, url: 'about:srcdoc' },
  { frameId: 12, parentFrameId: 0, url: 'blob:null/opaque' },
  { frameId: 13, parentFrameId: 12, url: 'about:blank' },
  { frameId: 14, parentFrameId: 0, url: 'chrome://settings' },
  { frameId: 15, parentFrameId: 0, frameType: 'fenced_frame', url: 'https://ads.example/ad' },
  { frameId: 16, parentFrameId: 4, url: 'https://nested.example/report' }
];

test('analysis access includes every injectable web iframe origin without a domain allowlist', () => {
  const access = buildAnalysisAccess(sourceTab, frames);

  assert.deepEqual(access.origins, [
    'https://portal.example/*',
    'https://reports.vendor.example/*',
    'https://www.youtube.com/*',
    'http://legacy.example/*',
    'https://files.example/*',
    'https://nested.example/*'
  ]);
  assert.deepEqual(access.frameIds, [0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 16]);
});

test('permission request is the first API call and requests all required origins once', async () => {
  clearFrameSnapshot();
  cacheFrameSnapshot(sourceTab, frames);
  const calls = [];
  const api = {
    permissions: {
      request(options) {
        calls.push({ method: 'request', options });
        return Promise.resolve(true);
      }
    }
  };

  const result = await requestAnalysisPermissions(sourceTab, api);

  assert.deepEqual(calls, [{
    method: 'request',
    options: {
      origins: [
        'https://portal.example/*',
        'https://reports.vendor.example/*',
        'https://www.youtube.com/*',
        'http://legacy.example/*',
        'https://files.example/*',
        'https://nested.example/*'
      ]
    }
  }]);
  assert.equal(result.granted, true);
  assert.deepEqual(result.frameIds, [0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 16]);
});

test('permission refusal is reported without changing the prepared frame selection', async () => {
  clearFrameSnapshot();
  cacheFrameSnapshot(sourceTab, frames);

  const result = await requestAnalysisPermissions(sourceTab, {
    permissions: {
      request() {
        return Promise.resolve(false);
      }
    }
  });

  assert.equal(result.granted, false);
  assert.deepEqual(result.frameIds, [0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 16]);
});

test('cached access falls back safely to the main frame when the page URL changed', () => {
  clearFrameSnapshot();
  cacheFrameSnapshot(sourceTab, frames);

  const changedTab = { ...sourceTab, url: 'https://another.example/report' };
  assert.deepEqual(getCachedAnalysisAccess(changedTab), {
    origins: ['https://another.example/*'],
    frameIds: [0]
  });
});

test('frame snapshots use webNavigation frame IDs and tolerate unavailable tabs', async () => {
  clearFrameSnapshot();
  const api = {
    webNavigation: {
      async getAllFrames(details) {
        assert.deepEqual(details, { tabId: 42 });
        return frames;
      }
    }
  };

  await refreshFrameSnapshot(sourceTab, api);
  assert.deepEqual(getCachedAnalysisAccess(sourceTab).frameIds, [0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 16]);

  await refreshFrameSnapshot(sourceTab, {
    webNavigation: {
      async getAllFrames() {
        throw new Error('tab closed');
      }
    }
  });
  assert.deepEqual(getCachedAnalysisAccess(sourceTab).frameIds, [0]);
});
