import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.DOMMatrix ??= class DOMMatrix {
  constructor() {
    this.a = this.d = 1;
    this.b = this.c = this.e = this.f = 0;
  }
};
globalThis.ImageData ??= class ImageData {};
globalThis.Path2D ??= class Path2D {};
Math.sumPrecise ??= values => Array.from(values).reduce((sum, value) => sum + value, 0);

globalThis.chrome = {
  runtime: {
    getURL(path) {
      return new URL(`../${path}`, import.meta.url).href;
    }
  }
};

const { extractTextFromPDF } = await import('../lib/pdf-parser.js');
const { parseTextMeta } = await import('../src/parsing.js');
const { detectProviderFromUrl } = await import('../src/domain/provider-rules.js');
const { detectProviderFromText } = await import('../src/provider-management.js');
const { settings } = await import('../src/storage.js');

function decodeHtmlEntities(text) {
  const namedEntities = {
    amp: '&',
    apos: "'",
    bull: '•',
    copy: '©',
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };

  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const radix = code[1]?.toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? code.slice(2) : code.slice(1);
      return String.fromCodePoint(Number.parseInt(digits, radix));
    }
    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function visibleTextFromHtml(html) {
  const blockTags = 'address|article|aside|blockquote|br|button|caption|div|footer|h[1-6]|header|li|main|nav|option|p|section|td|th|tr';
  const text = html
    .replace(/<!--.*?-->/gs, ' ')
    .replace(/<style\b[^>]*>.*?<\/style>/gis, ' ')
    .replace(/<script\b[^>]*>.*?<\/script>/gis, ' ')
    .replace(/<svg\b[^>]*>.*?<\/svg>/gis, ' ')
    .replace(new RegExp(`<\\/?(?:${blockTags})\\b[^>]*>`, 'gi'), '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(text)
    .replace(/\r/g, '')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n[\t ]+/g, '\n')
    .replace(/[\t ]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function label(text) {
  return {
    text,
    range: { start: 1, end: 999 },
    excludeKeywords: [],
    priorityKeywords: [],
    labelExcludeKeywords: [],
    splitSeparators: []
  };
}

function numericField(text, unit = '') {
  return { type: 'numeric', label: text, unit, labels: [label(text)] };
}

function textField(text) {
  return { type: 'text', label: text, labels: [label(text)] };
}

function parseQuietly(text, provider, fixtureSettings) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return parseTextMeta(text, provider, fixtureSettings).data;
  } finally {
    console.log = originalLog;
  }
}

const htmlFixtures = [
  {
    file: 'demo_ppc.html',
    provider: 'demo_portal',
    fields: {
      mode: textField('Mode'),
      pressure: numericField('Pression'),
      iah: numericField('IAH Résiduel'),
      leaks: numericField('Fuites (95e perc.)')
    },
    expected: { mode: 'APAP', pressure: '4', iah: '2.4', leaks: '14.0' }
  },
  {
    file: 'demo_ppc_2.html',
    provider: 'demo_respiratory_care',
    fields: {
      mode: textField('Mode de Traitement'),
      pressure: numericField('Pression Prescrite'),
      iah: numericField('IAH'),
      leaks: numericField('Fuites non intentionnelles (95%)')
    },
    expected: { mode: 'PPC Fixe', pressure: '8.5', iah: '8.5', leaks: '2.0' }
  },
  {
    file: 'demo_ppc_3.html',
    provider: 'demo_asozo2',
    fields: {
      mode: textField('Mode'),
      pressure95: numericField('Pression (95e)'),
      iah: numericField('IAH Moyen'),
      leaks95: numericField('Fuites (95e)')
    },
    expected: { mode: 'APAP (Auto)', pressure95: '11.5', iah: '2.1', leaks95: '18' }
  }
];

for (const fixture of htmlFixtures) {
  test(`HTML demo ${fixture.file} is detected and parsed`, async () => {
    const html = await readFile(new URL(fixture.file, import.meta.url), 'utf8');
    const text = visibleTextFromHtml(html);
    const fixtureSettings = {
      patterns: {
        [fixture.provider]: {
          urls: [fixture.file],
          fields: fixture.fields,
          fieldOrder: Object.keys(fixture.fields)
        }
      }
    };

    assert.equal(
      detectProviderFromUrl(`file:///fixtures/${fixture.file}`, fixtureSettings),
      fixture.provider.charAt(0).toUpperCase() + fixture.provider.slice(1)
    );
    assert.deepEqual(parseQuietly(text, fixture.provider, fixtureSettings), fixture.expected);
  });
}

test('PDF demo is extracted, detected and parsed by the extension pipeline', async () => {
  const bytes = await readFile(new URL('demo-ppc-report-pdf.pdf', import.meta.url));
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const text = await extractTextFromPDF(arrayBuffer);
  const provider = 'demo_pdf';
  const fields = {
    averageAhi: numericField('Average AHI'),
    pressure: numericField('CPAP Pressure'),
    usagePercent: numericField('Percent Days with Device Usage')
  };
  const fixtureSettings = {
    patterns: {
      [provider]: {
        urls: [],
        pdfKeywords: ['Compliance Summary', 'CPAP Summary'],
        fields,
        fieldOrder: Object.keys(fields)
      }
    }
  };

  settings.patterns = fixtureSettings.patterns;

  assert.match(text, /===== Page 1 \/ 1 =====/);
  assert.equal(detectProviderFromText(text), 'Demo_pdf');
  assert.deepEqual(parseQuietly(text, provider, fixtureSettings), {
    averageAhi: '4.7',
    pressure: '13',
    usagePercent: '96.7'
  });
});
