// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { browserApi } from './platform/browser-api.js';
import { buildSiteRootPattern } from './platform/site-root.js';

const frameSnapshots = new Map();

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isHttpUrl(parsed) {
  return parsed && /^https?:$/.test(parsed.protocol);
}

function getPermittableFrameOrigin(parsed) {
  if (isHttpUrl(parsed)) return parsed.origin;
  if (parsed?.protocol !== 'blob:') return null;

  const origin = parseUrl(parsed.origin);
  return isHttpUrl(origin) ? origin.origin : null;
}

function normalizeFrames(frames) {
  return (Array.isArray(frames) ? frames : [])
    .filter((frame) => Number.isInteger(frame?.frameId))
    .map((frame) => ({
      frameId: frame.frameId,
      parentFrameId: Number.isInteger(frame.parentFrameId) ? frame.parentFrameId : -1,
      frameType: String(frame.frameType || ''),
      url: String(frame.url || '')
    }));
}

export function buildAnalysisAccess(tab, frames) {
  const pageUrl = parseUrl(tab?.url);
  if (!tab?.id || !isHttpUrl(pageUrl)) {
    throw new Error('URL de l\'onglet source invalide ou non prise en charge.');
  }

  const normalizedFrames = normalizeFrames(frames);
  const frameIds = new Set([0]);
  const origins = new Set([buildSiteRootPattern(pageUrl.href)]);

  for (const frame of normalizedFrames) {
    if (frame.frameType === 'fenced_frame') continue;
    const parsed = parseUrl(frame.url);
    if (!parsed) continue;

    const origin = getPermittableFrameOrigin(parsed);
    if (origin) {
      frameIds.add(frame.frameId);
      origins.add(`${origin}/*`);
    }
  }

  // about:blank/srcdoc frames inherit access from their allowed parent frame.
  let changed = true;
  while (changed) {
    changed = false;
    for (const frame of normalizedFrames) {
      if (frame.frameType === 'fenced_frame') continue;
      if (frameIds.has(frame.frameId) || !frameIds.has(frame.parentFrameId)) continue;
      const parsed = parseUrl(frame.url);
      if (parsed && ['about:', 'data:'].includes(parsed.protocol)) {
        frameIds.add(frame.frameId);
        changed = true;
      }
    }
  }

  return {
    origins: [...origins],
    frameIds: [...frameIds].sort((a, b) => a - b)
  };
}

export function cacheFrameSnapshot(tab, frames) {
  if (!tab?.id || !tab?.url) return null;
  const snapshot = {
    tabId: tab.id,
    pageUrl: String(tab.url),
    frames: normalizeFrames(frames)
  };
  frameSnapshots.set(tab.id, snapshot);
  return snapshot;
}

export function clearFrameSnapshot(tabId = null) {
  if (Number.isInteger(tabId)) {
    frameSnapshots.delete(tabId);
    return;
  }
  frameSnapshots.clear();
}

export async function refreshFrameSnapshot(tab, api = browserApi) {
  if (!tab?.id || !tab?.url) return null;

  try {
    const frames = await api.webNavigation.getAllFrames({ tabId: tab.id });
    return cacheFrameSnapshot(tab, frames);
  } catch {
    clearFrameSnapshot(tab.id);
    return null;
  }
}

export function getCachedAnalysisAccess(tab) {
  const snapshot = frameSnapshots.get(tab?.id);
  const frames = snapshot?.pageUrl === String(tab?.url || '') ? snapshot.frames : [];
  return buildAnalysisAccess(tab, frames);
}

// This function must be invoked synchronously from a user-input handler.
// Do not add an await, permissions.contains(), or any other asynchronous work
// before permissions.request().
export function requestAnalysisPermissions(tab, api = browserApi) {
  const access = getCachedAnalysisAccess(tab);
  const permissionRequest = api.permissions.request({ origins: access.origins });

  return Promise.resolve(permissionRequest).then((granted) => ({
    ...access,
    granted: Boolean(granted)
  }));
}
