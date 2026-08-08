// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

const BLOCKED_PROPERTY_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export const CONFIG_LIMITS = Object.freeze({
  providerKeyLength: 128,
  fieldCount: 200,
  fieldKeyLength: 64,
  labelsPerField: 100,
  keywordCount: 100,
  keywordLength: 256,
  patternStringLength: 2048
});

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isSafePropertyKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return !!key
    && key.length <= CONFIG_LIMITS.providerKeyLength
    && !BLOCKED_PROPERTY_KEYS.has(key);
}

export function assertSafePropertyKey(value, label = 'clé') {
  const key = String(value || '').trim().toLowerCase();
  if (!isSafePropertyKey(key)) {
    throw new Error(`${label} invalide ou réservée`);
  }
  return key;
}

export function isSafeFieldKey(value) {
  const key = String(value || '');
  return key.length <= CONFIG_LIMITS.fieldKeyLength
    && /^[A-Za-z][A-Za-z0-9_]*$/.test(key)
    && isSafePropertyKey(key);
}

export function assertSafeFieldKey(value) {
  const key = String(value || '');
  if (!isSafeFieldKey(key)) {
    throw new Error(`Identifiant de champ non autorisé : ${key || '(vide)'}`);
  }
  return key;
}

export function escapeRegexLiteral(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildLiteralKeywordRegex(values, flags = 'i') {
  if (!Array.isArray(values)) return null;

  const terms = values
    .slice(0, CONFIG_LIMITS.keywordCount)
    .map(value => String(value || '').trim())
    .filter(value => value && value.length <= CONFIG_LIMITS.keywordLength)
    .map(escapeRegexLiteral);

  return terms.length ? new RegExp(terms.join('|'), flags) : null;
}

function validateStringArray(value, label, {
  maxItems = CONFIG_LIMITS.keywordCount,
  maxLength = CONFIG_LIMITS.keywordLength
} = {}) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${label} doit contenir au maximum ${maxItems} éléments`);
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.length > maxLength) {
      throw new Error(`${label} contient une valeur invalide ou trop longue`);
    }
  }
}

function validateLabelDefinition(label, fieldKey) {
  if (typeof label === 'string') {
    if (label.length > CONFIG_LIMITS.patternStringLength) {
      throw new Error(`Libellé trop long pour le champ ${fieldKey}`);
    }
    return;
  }
  if (!isPlainRecord(label)) {
    throw new Error(`Définition de libellé invalide pour le champ ${fieldKey}`);
  }
  if (typeof label.text !== 'string' || label.text.length > CONFIG_LIMITS.patternStringLength) {
    throw new Error(`Texte de libellé invalide pour le champ ${fieldKey}`);
  }
  validateStringArray(label.excludeKeywords, `Mots-clés d’exclusion de ${fieldKey}`);
  validateStringArray(label.priorityKeywords, `Mots-clés prioritaires de ${fieldKey}`);
  validateStringArray(label.labelExcludeKeywords, `Mots-clés d’exclusion du libellé ${fieldKey}`);
  validateStringArray(label.splitSeparators, `Séparateurs de ${fieldKey}`);
}

export function validateProviderPatterns(patterns) {
  if (!isPlainRecord(patterns)) {
    throw new Error('Configuration de patterns invalide');
  }

  const fields = patterns.fields;
  if (!isPlainRecord(fields)) {
    throw new Error('La configuration fields doit être un objet');
  }

  const fieldEntries = Object.entries(fields);
  if (fieldEntries.length > CONFIG_LIMITS.fieldCount) {
    throw new Error(`La configuration dépasse ${CONFIG_LIMITS.fieldCount} champs`);
  }

  for (const [fieldKey, definition] of fieldEntries) {
    assertSafeFieldKey(fieldKey);
    if (!isPlainRecord(definition)) {
      throw new Error(`Définition invalide pour le champ ${fieldKey}`);
    }
    if (definition.labels !== undefined) {
      if (!Array.isArray(definition.labels) || definition.labels.length > CONFIG_LIMITS.labelsPerField) {
        throw new Error(`Trop de libellés pour le champ ${fieldKey}`);
      }
      definition.labels.forEach(label => validateLabelDefinition(label, fieldKey));
    }
  }

  if (!Array.isArray(patterns.fieldOrder) || patterns.fieldOrder.length > CONFIG_LIMITS.fieldCount) {
    throw new Error('Ordre des champs invalide');
  }
  for (const fieldKey of patterns.fieldOrder) {
    assertSafeFieldKey(fieldKey);
    if (!Object.hasOwn(fields, fieldKey)) {
      throw new Error(`Le champ ${fieldKey} de fieldOrder est absent de fields`);
    }
  }

  validateStringArray(patterns.urls, 'URLs', {
    maxItems: CONFIG_LIMITS.keywordCount,
    maxLength: CONFIG_LIMITS.patternStringLength
  });
  validateStringArray(patterns.pdfKeywords, 'Mots-clés PDF');
  validateStringArray(patterns.globalSeparators, 'Séparateurs globaux');

  return patterns;
}
