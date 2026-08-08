import assert from 'node:assert/strict';
import test from 'node:test';

const { buildCommunityShareJson } = await import('../src/domain/community-share.js');

test('community sharing only includes configured fields, provider URLs and PDF keywords', () => {
  const patterns = {
    urls: ['https://provider.example/*'],
    fields: {
      iah: { label: 'IAH', labels: ['IAH'] }
    },
    fieldOrder: ['iah'],
    pdfKeywords: ['private detection keyword'],
    globalSeparators: ['private separator']
  };

  const json = buildCommunityShareJson({
    providerName: 'Provider',
    vendor: 'Vendor',
    model: 'Model',
    patterns
  });

  assert.deepEqual(json, {
    version: 2,
    meta: { name: 'Provider', vendor: 'Vendor', model: 'Model' },
    patterns: {
      urls: ['https://provider.example/*'],
      fields: {
        iah: { label: 'IAH', labels: ['IAH'] }
      },
      fieldOrder: ['iah'],
      pdfKeywords: ['private detection keyword']
    }
  });
  assert.equal('noteLibre' in json, false);
  assert.equal('customCheckboxes' in json, false);
  assert.equal('checkboxPhrases' in json, false);
  assert.equal('exclusions' in json, false);
  assert.equal('globalSeparators' in json.patterns, false);
});

test('community payload is detached from local settings', () => {
  const patterns = {
    urls: ['https://provider.example/*'],
    fields: { iah: { label: 'IAH' } }
  };

  const json = buildCommunityShareJson({
    providerName: 'Provider',
    vendor: 'Vendor',
    model: 'Model',
    patterns
  });

  patterns.urls[0] = 'https://changed.example/*';
  patterns.fields.iah.label = 'Changed';

  assert.deepEqual(json.patterns.urls, ['https://provider.example/*']);
  assert.equal(json.patterns.fields.iah.label, 'IAH');
  assert.deepEqual(json.patterns.fieldOrder, ['iah']);
  assert.deepEqual(json.patterns.pdfKeywords, []);
});
