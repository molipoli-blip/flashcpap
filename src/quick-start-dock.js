// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { browserApi } from './platform/browser-api.js';
import { createQuickStartGuide } from './quick-start-guide.js';

const DEFAULT_GUIDE_WIDTH = 420;
const MIN_GUIDE_WIDTH = 280;
const MAX_GUIDE_WIDTH = 560;
const MIN_MAIN_WIDTH = 260;

let initialized = false;
let expandedWindow = null;

function getViewportWidth() {
  return Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) || 500;
}

function getSourceDockWidth() {
  if (!document.body.classList.contains('docked-right')) return 0;
  return document.getElementById('source-dock')?.getBoundingClientRect().width || 0;
}

function clampGuideWidth(target) {
  const available = Math.max(MIN_GUIDE_WIDTH, getViewportWidth() - MIN_MAIN_WIDTH - getSourceDockWidth());
  return Math.min(Math.max(MIN_GUIDE_WIDTH, target), Math.min(MAX_GUIDE_WIDTH, available));
}

async function expandAnalyzerWindow() {
  if (expandedWindow) return;

  try {
    const currentWindow = await browserApi.windows.getLastFocused({});
    if (!Number.isInteger(currentWindow?.id) || !Number.isFinite(currentWindow?.width)) return;

    const screenLeft = Number.isFinite(globalThis.screen?.availLeft) ? globalThis.screen.availLeft : 0;
    const screenRight = screenLeft + (globalThis.screen?.availWidth || 1920);
    const targetWidth = Math.min(screenRight - screenLeft, currentWindow.width + DEFAULT_GUIDE_WIDTH);
    const targetLeft = Math.max(screenLeft, Math.min(currentWindow.left || screenLeft, screenRight - targetWidth));

    expandedWindow = {
      id: currentWindow.id,
      left: currentWindow.left,
      width: currentWindow.width
    };

    await browserApi.windows.update(currentWindow.id, {
      left: targetLeft,
      width: targetWidth
    });
  } catch (error) {
    expandedWindow = null;
    console.warn('[QUICK_START_DOCK] Impossible d\'élargir la fenêtre', error);
  }
}

async function restoreAnalyzerWindow() {
  if (!expandedWindow) return;
  const previous = expandedWindow;
  expandedWindow = null;

  try {
    const updateInfo = { width: previous.width };
    if (Number.isFinite(previous.left)) updateInfo.left = previous.left;
    await browserApi.windows.update(previous.id, updateInfo);
  } catch (error) {
    console.warn('[QUICK_START_DOCK] Impossible de restaurer la largeur de la fenêtre', error);
  }
}

export function initQuickStartDock() {
  if (initialized) return;

  const dock = document.getElementById('quick-start-dock');
  const dockBody = document.getElementById('quick-start-dock-content');
  const resizer = document.getElementById('quick-start-dock-resizer');
  const closeButton = document.getElementById('btn-close-quick-start');
  if (!dock || !dockBody) return;

  dockBody.replaceChildren(createQuickStartGuide());
  closeButton?.addEventListener('click', () => closeQuickStartDock());

  if (resizer) {
    let resizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('pointerdown', event => {
      resizing = true;
      startX = event.clientX;
      startWidth = dock.getBoundingClientRect().width;
      resizer.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    resizer.addEventListener('pointermove', event => {
      if (!resizing) return;
      const width = clampGuideWidth(startWidth + startX - event.clientX);
      document.body.style.setProperty('--quick-start-dock-width', `${width}px`);
    });
    const stopResize = () => { resizing = false; };
    resizer.addEventListener('pointerup', stopResize);
    resizer.addEventListener('pointercancel', stopResize);
  }

  window.addEventListener('resize', () => {
    if (!document.body.classList.contains('guide-docked')) return;
    const width = clampGuideWidth(dock.getBoundingClientRect().width || DEFAULT_GUIDE_WIDTH);
    document.body.style.setProperty('--quick-start-dock-width', `${width}px`);
  });

  initialized = true;
}

export async function openQuickStartDock() {
  initQuickStartDock();
  if (document.body.classList.contains('guide-docked')) return;

  await expandAnalyzerWindow();
  const width = clampGuideWidth(DEFAULT_GUIDE_WIDTH);
  document.body.style.setProperty('--quick-start-dock-width', `${width}px`);
  document.body.classList.add('guide-docked');
}

export async function closeQuickStartDock() {
  document.body.classList.remove('guide-docked');
  document.body.style.removeProperty('--quick-start-dock-width');
  await restoreAnalyzerWindow();
}
