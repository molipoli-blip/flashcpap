// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { getProviderConfig } from './domain/provider-rules.js';

function parseMaskToIndices(mask, size) {
  if (!mask) return Array.from({ length: size }, (_, index) => index);
  const trimmedMask = String(mask).trim();
  if (!trimmedMask) return Array.from({ length: size }, (_, index) => index);
  if (/^\d+(\s*,\s*\d+)*$/.test(trimmedMask)) {
    const indices = trimmedMask
      .split(',')
      .map(value => parseInt(value.trim(), 10) - 1)
      .filter(index => index >= 0 && index < size);
    return indices.length ? indices : Array.from({ length: size }, (_, index) => index);
  }
  const tokens = trimmedMask.split(/\s+/).filter(Boolean);
  const output = [];
  for (let index = 0; index < Math.min(tokens.length, size); index += 1) {
    if (/^(x|X|1|✔)$/.test(tokens[index])) output.push(index);
  }
  return output.length ? output : Array.from({ length: size }, (_, index) => index);
}

function buildTupleRawFromLine(lineText, tupleSize) {
  const matchesOnLine = Array.from(String(lineText || '').matchAll(/\d+(?:[.,]\d+)?/g));
  if (matchesOnLine.length < tupleSize || tupleSize < 2) return null;
  const slice = matchesOnLine.slice(0, tupleSize);
  const start = slice[0].index ?? 0;
  const last = slice[slice.length - 1];
  const end = (last.index ?? 0) + String(last[0] || '').length;
  return String(lineText || '').slice(start, end);
}

export function applyTupleExtraction({ provider, settings, sourceLines, matches }) {
  const cfg = getProviderConfig(settings, provider) || { fields: {} };
  if (!cfg.fields || !Array.isArray(matches)) return;

  matches.slice().forEach(match => {
    if (!match?.field || typeof match.line !== 'number') return;
    const definition = cfg.fields?.[match.field];
    const tupleConfig = definition?.tupleExtraction;
    if (!tupleConfig || typeof tupleConfig.size !== 'number' || tupleConfig.size < 2) return;

    const lineText = sourceLines[match.line - 1] || '';
    const tupleRaw = buildTupleRawFromLine(lineText, tupleConfig.size);
    match.__tupleSize = tupleConfig.size;

    if (!tupleRaw) return;

    const selectedIndices = parseMaskToIndices(tupleConfig.mask, tupleConfig.size);
    if (selectedIndices.length >= tupleConfig.size) return;

    matches.push({
      ...match,
      kind: 'masked-tuple',
      tupleRaw,
      size: tupleConfig.size,
      selectedIndices,
      __hlGroupLink: match
    });
  });
}
