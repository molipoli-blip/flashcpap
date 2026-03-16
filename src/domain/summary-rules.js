// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap


export function buildCleanSummaryText(raw) {
  if (!raw || typeof raw !== 'string') return '';

  const tokens = [];
  const re = /<([a-z0-9_]+)=(.*?)\/\/\1>/gis;
  let last = 0;
  let match;
  while ((match = re.exec(raw)) !== null) {
    if (match.index > last) {
      const free = raw.slice(last, match.index);
      if (free.trim().length) tokens.push({ type: 'free', text: free });
    }
    tokens.push({ type: 'marker', id: match[1], inner: match[2] });
    last = re.lastIndex;
  }
  if (last < raw.length) {
    const tail = raw.slice(last);
    if (tail.trim().length) tokens.push({ type: 'free', text: tail });
  }

  const cbSuffix = new Map();
  for (const token of tokens) {
    if (token.type === 'marker' && token.id.startsWith('mx_cb_')) {
      const baseId = token.id.replace(/^mx_/, '');
      const inner = String(token.inner || '').replace(/\u000B/g, '\n');
      const suffixes = cbSuffix.get(baseId) || [];
      suffixes.push(inner);
      cbSuffix.set(baseId, suffixes);
    }
  }

  const outParts = [];
  for (const token of tokens) {
    if (token.type === 'free') {
      outParts.push(token.text.replace(/\u000B/g, '\n'));
      continue;
    }

    const id = token.id;
    const inner = String(token.inner || '').replace(/\u000B/g, '\n');

    if (id === 'fld_fields' || id.startsWith('cb_group_')) {
      outParts.push(inner);
      continue;
    }

    if (id.startsWith('cb_')) {
      const extras = (cbSuffix.get(id) || []).filter(Boolean).join(' ');
      outParts.push(extras ? inner + (inner && extras ? ' ' : '') + extras : inner);
      cbSuffix.delete(id);
      continue;
    }

    if (id.startsWith('mx_cb_')) {
      continue;
    }

    outParts.push(inner);
  }

  return outParts.join('\n')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}