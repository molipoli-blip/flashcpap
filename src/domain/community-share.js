// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

function cloneArray(value) {
  if (!Array.isArray(value)) return [];
  return JSON.parse(JSON.stringify(value));
}

function cloneObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

export function buildCommunityShareJson({ providerName, vendor, model, patterns }) {
  const fields = cloneObject(patterns?.fields);
  const configuredOrder = cloneArray(patterns?.fieldOrder);

  // Keep this allowlist explicit: local free-form settings must never be shared.
  return {
    version: 2,
    meta: { name: providerName, vendor, model },
    patterns: {
      urls: cloneArray(patterns?.urls),
      fields,
      fieldOrder: configuredOrder.length ? configuredOrder : Object.keys(fields),
      pdfKeywords: cloneArray(patterns?.pdfKeywords)
    }
  };
}
