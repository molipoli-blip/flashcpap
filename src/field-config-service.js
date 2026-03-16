import { applyInlineFieldChanges } from './field-inline-editor-state.js';

export function createFieldKeyFromLabel(label) {
  const base = (label || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!base) return 'champ';
  const parts = base.split(/\s+/);
  return parts.map((word, index) => index === 0
    ? word.toLowerCase()
    : (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())).join('') || 'champ';
}

export function createUniqueFieldKey(cfg, baseLabel = 'Nouveau champ') {
  const baseKey = createFieldKeyFromLabel(baseLabel);
  let uniqueKey = baseKey;
  let suffix = 2;
  while (cfg.fields?.[uniqueKey]) {
    uniqueKey = `${baseKey}${suffix}`;
    suffix += 1;
  }
  return uniqueKey;
}

export function createNewFieldDraft(cfg, baseLabel = 'Nouveau champ') {
  const uniqueKey = createUniqueFieldKey(cfg, baseLabel);

  return {
    uniqueKey,
    fieldDefinition: { type: 'text', unit: '', labels: [], label: '' }
  };
}

export function removeFieldFromConfig(cfg, fieldKey) {
  if (!cfg?.fields?.[fieldKey]) return false;
  delete cfg.fields[fieldKey];
  if (Array.isArray(cfg.fieldOrder)) {
    const orderIndex = cfg.fieldOrder.indexOf(fieldKey);
    if (orderIndex !== -1) {
      cfg.fieldOrder.splice(orderIndex, 1);
    }
  }
  return true;
}

export function saveInlineFieldChanges(cfg, fieldKey, state, firstLabelWanted) {
  const definition = cfg?.fields?.[fieldKey];
  if (!definition) return false;
  applyInlineFieldChanges(definition, state, firstLabelWanted);
  return true;
}

function buildTupleExtraction(type, tupleSize, tupleMask) {
  const size = parseInt(tupleSize, 10);
  if ((type !== 'numeric' && type !== 'time') || !size || size < 1 || size > 7) {
    return undefined;
  }

  return {
    size,
    ...(tupleMask ? { mask: tupleMask } : {})
  };
}

function buildLabelDefinition({ lblText, lblStart, lblEnd, lblExclude, lblPriority, lblLabelExclude }) {
  if (!lblText) return [];
  return [{
    text: lblText,
    range: { start: lblStart, end: lblEnd },
    excludeKeywords: lblExclude,
    priorityKeywords: lblPriority,
    labelExcludeKeywords: lblLabelExclude
  }];
}

export function applyFieldEditorValues(definition, values) {
  definition.label = values.label;
  definition.type = values.type;
  definition.unit = values.type === 'numeric' ? values.unit : '';

  if (values.role) definition.role = values.role;
  else delete definition.role;

  const tupleExtraction = buildTupleExtraction(values.type, values.tupleSize, values.tupleMask);
  if (tupleExtraction) definition.tupleExtraction = tupleExtraction;
  else delete definition.tupleExtraction;

  definition.labels = buildLabelDefinition(values);
}

export function upsertFieldFromEditorValues(cfg, { mode, originalKey, values }) {
  if (mode === 'edit') {
    const existing = cfg?.fields?.[originalKey];
    if (!existing) {
      return { ok: false, reason: 'missing-field' };
    }
    applyFieldEditorValues(existing, values);
    return { ok: true, fieldKey: originalKey, action: 'updated' };
  }

  const uniqueKey = createUniqueFieldKey(cfg, values.label || 'Nouveau champ');
  const fieldDefinition = { type: 'text', unit: '', labels: [], label: values.label || 'Nouveau champ' };
  applyFieldEditorValues(fieldDefinition, values);
  cfg.fields[uniqueKey] = fieldDefinition;
  cfg.fieldOrder = Array.isArray(cfg.fieldOrder) ? cfg.fieldOrder : [];
  cfg.fieldOrder.push(uniqueKey);

  return { ok: true, fieldKey: uniqueKey, action: 'created' };
}