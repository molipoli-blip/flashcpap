// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

const DEBUG_FLAG_KEY = 'flashcpap_debug';
const DEBUG_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug']);

function sanitizeValue(value) {
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length <= 40 && !/[\r\n]/.test(value)
      ? value
      : { length: value.length };
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return { count: value.length };
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = sanitizeValue(entry);
    }
    return out;
  }
  return String(value);
}

function formatArgs(scope, message, meta) {
  const prefix = `[${scope}] ${message}`;
  if (meta === undefined) return [prefix];
  return [prefix, sanitizeValue(meta)];
}

export function isDebugLoggingEnabled() {
  try {
    const raw = String(localStorage.getItem(DEBUG_FLAG_KEY) || '').trim().toLowerCase();
    return DEBUG_TRUE_VALUES.has(raw);
  } catch {
    return false;
  }
}

export function logFlow(scope, message, meta) {
  try {
    console.log(...formatArgs(scope, message, meta));
  } catch {}
}

export function logDebug(scope, message, meta) {
  if (!isDebugLoggingEnabled()) return;
  try {
    console.log(...formatArgs(scope, message, meta));
  } catch {}
}

export function logWarn(scope, message, meta) {
  try {
    console.warn(...formatArgs(scope, message, meta));
  } catch {}
}

export function logError(scope, message, error) {
  try {
    console.error(...formatArgs(scope, message, error));
  } catch {}
}
