import assert from 'node:assert/strict';
import test from 'node:test';

import { extractTextMeta } from '../src/parsing.js';

const nextLineLabel = {
  text: 'Mode de Ventilation',
  range: { start: 1, end: 999 },
  requireNextLine: true
};

test('extracts a short uppercase ventilation mode from the next line', () => {
  const text = [
    'Mode de Ventilation',
    'ST',
    'Depuis le',
    '27/01/2026',
    'Pression inspiratoire',
    '14 cm H2O'
  ].join('\n');

  const result = extractTextMeta(text, [nextLineLabel]);

  assert.equal(result.value, 'ST');
  assert.equal(result.match?.line, 2);
  assert.equal(result.match?.raw, 'ST');
});

test('ignores capitalized treatment-date context lines', () => {
  const text = [
    'Mode de Ventilation',
    'Depuis le',
    '27/01/2026'
  ].join('\n');

  const result = extractTextMeta(text, [nextLineLabel]);

  assert.equal(result.value, '?');
  assert.equal(result.match, null);
});
