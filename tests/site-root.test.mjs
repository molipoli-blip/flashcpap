import assert from 'node:assert/strict';
import test from 'node:test';

const mockBrowser = {
  permissions: {
    contains: async () => false,
    request: async () => false
  },
  runtime: {
    getURL: () => 'moz-extension://test/popup.html'
  }
};

globalThis.browser = mockBrowser;

const siteRoot = await import('../src/platform/site-root.js');

test('buildSiteRootPattern keeps the exact origin for http(s) URLs', () => {
  assert.equal(siteRoot.buildSiteRootPattern('https://sub.example.com/path?x=1'), 'https://sub.example.com/*');
  assert.equal(siteRoot.buildSiteRootPattern('http://example.org/report'), 'http://example.org/*');
});

test('buildSiteRootPattern rejects internal or unsupported URLs', () => {
  assert.throws(() => siteRoot.buildSiteRootPattern('chrome://extensions'), (error) => {
    return error instanceof siteRoot.HostPermissionError && error.code === 'UNSUPPORTED_URL';
  });
});

test('ensurePersistentHostPermissionForUrl reuses existing permission without prompting', async () => {
  let containsCalls = 0;
  let requestCalls = 0;
  mockBrowser.permissions.contains = async ({ origins }) => {
    containsCalls += 1;
    assert.deepEqual(origins, ['https://example.com/*']);
    return true;
  };
  mockBrowser.permissions.request = async () => {
    requestCalls += 1;
    return false;
  };

  const result = await siteRoot.ensurePersistentHostPermissionForUrl('https://example.com/report', {
    requestPermission: true
  });

  assert.equal(result.pattern, 'https://example.com/*');
  assert.equal(result.alreadyGranted, true);
  assert.equal(result.permissionGranted, true);
  assert.equal(result.requested, false);
  assert.equal(containsCalls, 1);
  assert.equal(requestCalls, 0);
});

test('ensurePersistentHostPermissionForUrl requests missing permission and reports denial', async () => {
  let containsCalls = 0;
  let requestCalls = 0;
  mockBrowser.permissions.contains = async () => {
    containsCalls += 1;
    return false;
  };
  mockBrowser.permissions.request = async ({ origins }) => {
    requestCalls += 1;
    assert.deepEqual(origins, ['https://example.com/*']);
    return false;
  };

  const result = await siteRoot.ensurePersistentHostPermissionForUrl('https://example.com/report', {
    requestPermission: true,
    throwOnDenied: false
  });

  assert.equal(result.pattern, 'https://example.com/*');
  assert.equal(result.alreadyGranted, false);
  assert.equal(result.permissionGranted, false);
  assert.equal(result.requested, true);
  assert.equal(containsCalls, 1);
  assert.equal(requestCalls, 1);
});
