import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildLiteralKeywordRegex,
  isSafeFieldKey,
  isSafePropertyKey,
  validateProviderPatterns
} from '../src/domain/config-security.js';
import {
  ensureProviderConfig,
  getProviderConfig,
  hasValidProvider,
  toProviderKey
} from '../src/domain/provider-rules.js';
import { extractTextMeta } from '../src/parsing.js';

test('configured keywords are treated as literals instead of executable regex patterns', () => {
  const maliciousPattern = '(a+)+$';
  const regex = buildLiteralKeywordRegex([maliciousPattern]);

  assert.equal(regex.test(`${'a'.repeat(20_000)}!`), false);
  assert.equal(regex.test(`préfixe ${maliciousPattern} suffixe`), true);

  const result = extractTextMeta(`Valeur ${'a'.repeat(20_000)}!`, [{
    text: 'Valeur',
    labelExcludeKeywords: [maliciousPattern]
  }]);
  assert.notEqual(result.value, '?');
});

test('provider import validation rejects unsafe field identifiers', () => {
  const safePatterns = {
    urls: [],
    fields: { pressionMin: { type: 'numeric', labels: [] } },
    fieldOrder: ['pressionMin']
  };
  assert.equal(validateProviderPatterns(safePatterns), safePatterns);

  const injectedFields = {
    'unsafe"><img src="https://example.invalid/audit">': { type: 'text', labels: [] }
  };
  assert.throws(() => validateProviderPatterns({
    urls: [],
    fields: injectedFields,
    fieldOrder: Object.keys(injectedFields)
  }), /Identifiant de champ non autorisé/);

  const prototypeFields = JSON.parse('{"__proto__":{"type":"text","labels":[]}}');
  assert.throws(() => validateProviderPatterns({
    urls: [],
    fields: prototypeFields,
    fieldOrder: ['__proto__']
  }), /Identifiant de champ non autorisé/);
});

test('inline field markup refuses an unsafe field key before using innerHTML', async () => {
  globalThis.chrome = {
    i18n: {
      getMessage: key => key,
      getUILanguage: () => 'fr'
    },
    runtime: { getManifest: () => ({}) }
  };

  const { buildInlineFieldEditorMarkup } = await import('../src/field-inline-editor-view.js');
  const initialState = {
    isNumeric: false,
    isTime: false,
    nameInitial: '',
    unitInitial: '',
    suffixInitial: '',
    roleInitial: '',
    tupleSizeInit: 1,
    allLabels: []
  };

  assert.throws(() => buildInlineFieldEditorMarkup({
    fieldKey: 'unsafe"><img src=x>',
    siteLabel: 'audit',
    initialState
  }), /Identifiant de champ non autorisé/);
  assert.equal(isSafeFieldKey('pressionMin'), true);
});

test('reserved provider keys cannot resolve or mutate a provider dictionary', () => {
  const patterns = {};
  Object.defineProperty(patterns, '__proto__', {
    value: { fields: { injected: {} } },
    enumerable: true,
    configurable: true
  });
  const source = { patterns };

  assert.equal(isSafePropertyKey('__proto__'), false);
  assert.equal(toProviderKey('__proto__'), '');
  assert.equal(hasValidProvider(source, '__proto__'), false);
  assert.equal(getProviderConfig(source, '__proto__'), null);
  assert.equal(ensureProviderConfig(source, '__proto__'), null);
  assert.equal(Object.getPrototypeOf(patterns), Object.prototype);
});

test('vendored PDF.js is patched and dynamic evaluation is explicitly disabled', async () => {
  const [pdfSource, parserSource] = await Promise.all([
    readFile(new URL('../lib/pdf.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../lib/pdf-parser.js', import.meta.url), 'utf8')
  ]);

  assert.match(pdfSource, /pdfjsVersion = 6\.1\.200/);
  assert.match(parserSource, /isEvalSupported:\s*false/);
});

test('updated PDF.js extracts text with evaluation disabled', async () => {
  globalThis.DOMMatrix ??= class DOMMatrix {
    constructor() {
      this.a = this.d = 1;
      this.b = this.c = this.e = this.f = 0;
    }
  };
  globalThis.ImageData ??= class ImageData {};
  globalThis.Path2D ??= class Path2D {};

  const pdfjs = await import('../lib/pdf.mjs');
  const encoder = new TextEncoder();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length 44 >>\nstream\nBT /F1 18 Tf 50 80 Td (FlashCPAP) Tj ET\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  let source = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(encoder.encode(source).length);
    source += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(source).length;
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(offset => {
    source += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const loadingTask = pdfjs.getDocument({
    data: encoder.encode(source),
    isEvalSupported: false
  });
  const document = await loadingTask.promise;
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const extractedText = content.items.map(item => item.str).join(' ');
  await loadingTask.destroy();

  assert.equal(pdfjs.version, '6.1.200');
  assert.equal(extractedText, 'FlashCPAP');
});
