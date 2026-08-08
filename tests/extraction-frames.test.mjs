import assert from 'node:assert/strict';
import test from 'node:test';

const { extractHtmlTextFromTab } = await import('../src/extraction.js');

test('HTML extraction targets only the prepared frame IDs', async () => {
  let injection;
  const api = {
    scripting: {
      async executeScript(options) {
        injection = options;
        return [
          {
            frameId: 0,
            result: {
              text: 'Page principale',
              frameInfo: { url: 'https://portal.example/report', title: 'Portail', isTop: true }
            }
          },
          {
            frameId: 4,
            result: {
              text: 'Rapport intégré',
              frameInfo: { url: 'https://reports.vendor.example/report/123', title: 'Rapport', isTop: false }
            }
          }
        ];
      }
    }
  };

  const result = await extractHtmlTextFromTab({
    id: 42,
    url: 'https://portal.example/report',
    analysisFrameIds: [0, 4]
  }, api);

  assert.equal(injection.tabId, 42);
  assert.deepEqual(injection.frameIds, [0, 4]);
  assert.equal('allFrames' in injection, false);
  assert.match(result.text, /Page principale/);
  assert.match(result.text, /Rapport intégré/);
});
