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
  url: 'https://portail.adiral.fr/report'
};

const frames = [
  { frameId: 0, parentFrameId: -1, url: sourceTab.url },
  { frameId: 2, parentFrameId: 0, url: 'https://portail.adiral.fr/help' },
  { frameId: 4, parentFrameId: 0, url: 'https://adiral.morpheos.fr/report/123' },
  { frameId: 5, parentFrameId: 0, url: 'https://www.youtube.com/embed/video' },
  { frameId: 7, parentFrameId: 4, url: 'about:blank' },
  { frameId: 9, parentFrameId: 0, url: 'http://adiral.morpheos.fr/insecure' },
  { frameId: 11, parentFrameId: 0, frameType: 'fenced_frame', url: 'https://portail.adiral.fr/ad' }
];

test('analysis access includes only the page, same-origin frames, and trusted HTTPS frames', () => {
  const access = buildAnalysisAccess(sourceTab, frames);

  assert.deepEqual(access.origins, [
    'https://portail.adiral.fr/*',
    'https://adiral.morpheos.fr/*'
  ]);
  assert.deepEqual(access.frameIds, [0, 2, 4, 7]);
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
        'https://portail.adiral.fr/*',
        'https://adiral.morpheos.fr/*'
      ]
    }
  }]);
  assert.equal(result.granted, true);
  assert.deepEqual(result.frameIds, [0, 2, 4, 7]);
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
  assert.deepEqual(getCachedAnalysisAccess(sourceTab).frameIds, [0, 2, 4, 7]);

  await refreshFrameSnapshot(sourceTab, {
    webNavigation: {
      async getAllFrames() {
        throw new Error('tab closed');
      }
    }
  });
  assert.deepEqual(getCachedAnalysisAccess(sourceTab).frameIds, [0]);
});
