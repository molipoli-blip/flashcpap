import assert from 'node:assert/strict';
import test from 'node:test';

const { parseTextMeta } = await import('../src/parsing.js');
const { generateSummary } = await import('../src/summary.js');
const { applyFieldEditorValues } = await import('../src/field-config-service.js');
const { applyInlineFieldChanges } = await import('../src/field-inline-editor-state.js');
const { renderLabelSubCard } = await import('../src/field-inline-editor-view.js');

function label(text, extra = {}) {
  return {
    text,
    range: { start: 1, end: 999 },
    excludeKeywords: [],
    priorityKeywords: [],
    labelExcludeKeywords: [],
    splitSeparators: [],
    ...extra
  };
}

function settingsWithFields(fields, fieldOrder = Object.keys(fields)) {
  return {
    patterns: {
      demo: {
        urls: [],
        fields,
        fieldOrder
      }
    },
    customCheckboxes: {},
    checkboxPhrases: {},
    organizationOrderByProvider: {},
    noteLibre: {},
    compactFields: {}
  };
}

const sourceText = [
  'Moy. Durée(heures)',
  '48min',
  'Moy. IAH(Ev./heures)',
  '6.73'
].join('\n');

test('a text field with the obs role does not consume the following IAH value', () => {
  const settings = settingsWithFields({
    observation: {
      type: 'text',
      role: 'obs',
      label: 'Obs',
      unit: 'h',
      labels: [label('Durée(heures)', { requireNextLine: true })]
    },
    iah: {
      type: 'numeric',
      role: 'iah',
      label: 'Iah',
      unit: '/h',
      labels: [label('IAH(Ev./heures)', { requireNextLine: true })]
    }
  });

  const { data } = parseTextMeta(sourceText, 'Demo', settings);

  assert.equal(data.observation, '48min');
  assert.equal(data.iah, '6.73');
  assert.match(generateSummary(data, 'Demo', false, false, {}, settings), /Obs 48min(?:\n|\/\/fld_fields>)/);
  assert.doesNotMatch(generateSummary(data, 'Demo', false, false, {}, settings), /Obs 48min h/);
});

test('a field named obs follows its explicit text type', () => {
  const settings = settingsWithFields({
    obs: {
      type: 'text',
      role: 'obs',
      label: 'Obs',
      labels: [label('Durée(heures)', { requireNextLine: true })]
    }
  });

  assert.equal(parseTextMeta(sourceText, 'Demo', settings).data.obs, '48min');
});

test('text extraction accepts a one-character value on a following line', () => {
  const nextLineSettings = settingsWithFields({
    shortValue: {
      type: 'text',
      label: 'Valeur',
      labels: [label('Valeur', { requireNextLine: true })]
    }
  });
  const defaultNextLineSettings = settingsWithFields({
    shortValue: {
      type: 'text',
      label: 'Valeur',
      labels: [label('Valeur')]
    }
  });

  assert.equal(parseTextMeta('Valeur\n6', 'Demo', nextLineSettings).data.shortValue, '6');
  assert.equal(parseTextMeta('Valeur\n6', 'Demo', defaultNextLineSettings).data.shortValue, '6');
});

test('labels without an explicit mode use only line +1', () => {
  const settings = settingsWithFields({
    value: {
      type: 'text',
      label: 'Valeur',
      labels: [label('Valeur')]
    }
  });

  assert.equal(parseTextMeta('Valeur: inline\nligne suivante', 'Demo', settings).data.value, 'ligne suivante');
  assert.equal(parseTextMeta('Valeur\n\nligne +2', 'Demo', settings).data.value, '?');
});

test('numeric and time fields also default to line +1 only', () => {
  const settings = settingsWithFields({
    metric: {
      type: 'numeric',
      label: 'Mesure',
      labels: [label('Mesure')]
    },
    duration: {
      type: 'time',
      label: 'Durée',
      tupleExtraction: { size: 2, mask: 'X X' },
      timeFormat: { raw: 'H M', display: 'h (convertir)' },
      labels: [label('Durée')]
    }
  });

  const { data } = parseTextMeta([
    'Mesure',
    '',
    '42',
    'Durée',
    '48min',
    '6.73'
  ].join('\n'), 'Demo', settings);

  assert.equal(data.metric, '?');
  assert.equal(data.duration, '?');
});

test('inline and custom following-line ranges remain explicit', () => {
  const inlineSettings = settingsWithFields({
    value: {
      type: 'text',
      label: 'Valeur',
      labels: [label('Valeur', { requireInline: true })]
    }
  });
  const lineTwoSettings = settingsWithFields({
    value: {
      type: 'text',
      label: 'Valeur',
      labels: [label('Valeur', { requireNextLine: true, nextLineRange: [2, 2] })]
    }
  });

  assert.equal(parseTextMeta('Valeur: inline\nligne suivante', 'Demo', inlineSettings).data.value, 'inline');
  assert.equal(parseTextMeta('Valeur\nligne +1\nligne +2', 'Demo', lineTwoSettings).data.value, 'ligne +2');
});

test('the field editor removes automatic mode and defaults to line +1 only', () => {
  const markup = renderLabelSubCard('value', 0, null);

  assert.doesNotMatch(markup, /value="auto"/);
  assert.match(markup, /value="nextline" checked/);
  assert.match(markup, /add-label-nextline-min-value-0[^>]+value="1"/);
  assert.match(markup, /add-label-nextline-max-value-0[^>]+value="1"/);
});

test('observance interpretation understands minute and hour words', () => {
  const settings = settingsWithFields({
    obs: {
      type: 'text',
      role: 'obs',
      label: 'Obs',
      labels: []
    }
  });
  settings.interpretation = {
    obsHours: 1,
    texts: {
      obs: { ge: 'observance suffisante', lt: 'observance insuffisante' }
    }
  };

  for (const value of ['48m', '48min', '48 min', '48 minutes']) {
    const summary = generateSummary({ obs: value }, 'Demo', true, false, {}, settings);
    assert.match(summary, new RegExp(`Obs ${value} \\(observance insuffisante\\)`));
  }

  for (const value of ['6h45m', '6 h 45 min', '6 heure 45 minutes']) {
    const summary = generateSummary({ obs: value }, 'Demo', true, false, {}, settings);
    assert.match(summary, new RegExp(`Obs ${value} \\(observance suffisante\\)`));
  }
});

test('observance interpretation rejects a line containing another measurement', () => {
  const settings = settingsWithFields({
    obs: {
      type: 'text',
      role: 'obs',
      label: 'Obs',
      labels: []
    }
  });
  settings.interpretation = {
    obsHours: 1,
    texts: {
      obs: { ge: 'observance suffisante', lt: 'observance insuffisante' }
    }
  };

  const summary = generateSummary(
    { obs: '6 h 45 min 22 L/min' },
    'Demo',
    true,
    false,
    {},
    settings
  );

  assert.match(summary, /Obs 6 h 45 min 22 L\/min/);
  assert.doesNotMatch(summary, /observance (?:in)?suffisante/);
});

test('legacy numeric obs fields still use tuple extraction', () => {
  const settings = settingsWithFields({
    obs: {
      type: 'numeric',
      role: 'obs',
      label: 'Obs',
      unit: 'h',
      tupleExtraction: { size: 2, mask: 'X X', connectors: ['h', 'm'] },
      labels: [label('Durée(heures)', { requireNextLine: true })]
    }
  });

  const { data } = parseTextMeta('Durée(heures)\n6h 45m', 'Demo', settings);
  assert.equal(data.obs, '6h 45m');
});

test('the standard editor clears incompatible metadata when switching to text', () => {
  const definition = {
    type: 'time',
    unit: 'h',
    tupleExtraction: { size: 2, mask: 'X X' },
    timeFormat: { raw: 'H M', display: 'h (convertir)' },
    labels: []
  };

  applyFieldEditorValues(definition, {
    label: 'Obs',
    type: 'text',
    unit: 'h',
    role: 'obs',
    tupleSize: 2,
    tupleMask: 'X X',
    lblText: 'Durée(heures)',
    lblStart: 1,
    lblEnd: 999,
    lblExclude: [],
    lblPriority: [],
    lblLabelExclude: []
  });

  assert.equal(definition.unit, '');
  assert.equal(definition.type, 'text');
  assert.equal(definition.role, 'obs');
  assert.equal('tupleExtraction' in definition, false);
  assert.equal('timeFormat' in definition, false);
  assert.equal(definition.labels[0].requireNextLine, true);
  assert.deepEqual(definition.labels[0].nextLineRange, [1, 1]);
});

test('the inline editor clears incompatible metadata when switching to text', () => {
  const definition = {
    type: 'time',
    unit: 'h',
    tupleExtraction: { size: 2, mask: 'X X' },
    timeFormat: { raw: 'H M', display: 'h (convertir)' },
    labels: []
  };

  applyInlineFieldChanges(definition, {
    labelWanted: 'Obs',
    typeWanted: 'text',
    unitWanted: '',
    suffixWanted: undefined,
    isNumeric: false,
    isTime: false,
    tupleSize: 2,
    tupleMask: 'X X',
    tupleConnectors: [],
    timeRaw: '',
    timeDisplay: '',
    roleWanted: 'obs'
  }, [label('Durée(heures)', { requireNextLine: true })]);

  assert.equal(definition.unit, '');
  assert.equal(definition.type, 'text');
  assert.equal(definition.role, 'obs');
  assert.equal('tupleExtraction' in definition, false);
  assert.equal('timeFormat' in definition, false);
});
