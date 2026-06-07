// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

function safeWarn(message, error) {
  try {
    if (error !== undefined) console.warn(message, error);
    else console.warn(message);
  } catch {}
}

export function safeRun(fn, { context = 'UNKNOWN', fallback = undefined } = {}) {
  try {
    return fn();
  } catch (error) {
    safeWarn(`[SAFE][${context}]`, error);
    return fallback;
  }
}

export async function safeRunAsync(fn, { context = 'UNKNOWN', fallback = undefined } = {}) {
  try {
    return await fn();
  } catch (error) {
    safeWarn(`[SAFE][${context}]`, error);
    return fallback;
  }
}
