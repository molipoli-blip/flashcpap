// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { browserApi } from './platform/browser-api.js';

const SUMMARY_PREVIEW_HEIGHT_KEY = 'summaryPreviewHeight';
const MIN_PREVIEW_HEIGHT = 150;
const MIN_MAX_PREVIEW_HEIGHT = 200;
const HARD_MAX_PREVIEW_HEIGHT = 360;

function getViewportHeight() {
  return Math.max(
    document.documentElement?.clientHeight || 0,
    window.innerHeight || 0
  ) || 600;
}

export function getSafeSummaryPreviewMaxHeight(viewportHeight = 600) {
  const height = Number.isFinite(Number(viewportHeight)) && Number(viewportHeight) > 0
    ? Number(viewportHeight)
    : 600;
  const reservedForCheckboxes = height - 300;
  const proportionalLimit = height * 0.46;
  return Math.round(Math.max(
    MIN_MAX_PREVIEW_HEIGHT,
    Math.min(HARD_MAX_PREVIEW_HEIGHT, reservedForCheckboxes, proportionalLimit)
  ));
}

function clampHeight(height) {
  return Math.round(Math.max(
    MIN_PREVIEW_HEIGHT,
    Math.min(getSafeSummaryPreviewMaxHeight(getViewportHeight()), Number(height) || MIN_PREVIEW_HEIGHT)
  ));
}

function getRenderedHeight(preview) {
  const rendered = Number(preview?.getBoundingClientRect?.().height);
  if (Number.isFinite(rendered) && rendered > 0) return rendered;
  const inline = Number.parseFloat(preview?.style?.height || '');
  return Number.isFinite(inline) ? inline : MIN_PREVIEW_HEIGHT;
}

async function persistHeight(height) {
  try {
    await browserApi.storage.local.set({
      [SUMMARY_PREVIEW_HEIGHT_KEY]: Math.round(height)
    });
  } catch {}
}

export function growSummaryPreviewToContent(preview) {
  if (!preview || preview.style.display === 'none') return;
  const currentHeight = getRenderedHeight(preview);
  const contentHeight = Number(preview.scrollHeight) || currentHeight;
  const nextHeight = clampHeight(Math.max(currentHeight, contentHeight));
  if (nextHeight > currentHeight + 1) {
    preview.style.height = `${nextHeight}px`;
  }
}

export function centerRowInSummaryPreview(preview, row) {
  if (!preview || !row) return;
  const maxScrollTop = Math.max(0, preview.scrollHeight - preview.clientHeight);
  if (maxScrollTop <= 0) return;

  const target = row.offsetTop + (row.offsetHeight / 2) - (preview.clientHeight / 2);
  const top = Math.max(0, Math.min(maxScrollTop, target));
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  preview.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
}

export function initSummaryPreviewResize() {
  const preview = document.getElementById('résumé-preview');
  const resizer = document.getElementById('summary-preview-resizer');
  if (!preview || !resizer) return null;

  let activePointerId = null;
  let startY = 0;
  let startHeight = 0;

  const updateAria = () => {
    resizer.setAttribute('aria-valuemin', String(MIN_PREVIEW_HEIGHT));
    resizer.setAttribute(
      'aria-valuemax',
      String(getSafeSummaryPreviewMaxHeight(getViewportHeight()))
    );
    resizer.setAttribute('aria-valuenow', String(Math.round(getRenderedHeight(preview))));
  };

  const applyHeight = height => {
    preview.style.height = `${clampHeight(height)}px`;
    updateAria();
  };

  resizer.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    activePointerId = event.pointerId;
    startY = event.clientY;
    startHeight = getRenderedHeight(preview);
    applyHeight(startHeight);
    resizer.classList.add('is-resizing');
    resizer.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  resizer.addEventListener('pointermove', event => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    applyHeight(startHeight + event.clientY - startY);
  });

  const stopResizing = event => {
    if (activePointerId === null) return;
    if (event?.pointerId !== undefined && event.pointerId !== activePointerId) return;
    activePointerId = null;
    resizer.classList.remove('is-resizing');
    void persistHeight(getRenderedHeight(preview));
  };

  resizer.addEventListener('pointerup', stopResizing);
  resizer.addEventListener('pointercancel', stopResizing);
  resizer.addEventListener('lostpointercapture', stopResizing);

  resizer.addEventListener('keydown', event => {
    const current = getRenderedHeight(preview);
    let target = null;
    if (event.key === 'ArrowUp') target = current - 24;
    if (event.key === 'ArrowDown') target = current + 24;
    if (event.key === 'PageUp') target = current - 72;
    if (event.key === 'PageDown') target = current + 72;
    if (event.key === 'Home') target = MIN_PREVIEW_HEIGHT;
    if (event.key === 'End') target = getSafeSummaryPreviewMaxHeight(getViewportHeight());
    if (target === null) return;

    event.preventDefault();
    applyHeight(target);
    void persistHeight(getRenderedHeight(preview));
  });

  window.addEventListener('resize', () => {
    if (preview.style.height) applyHeight(getRenderedHeight(preview));
  });

  updateAria();
  browserApi.storage.local.get({ [SUMMARY_PREVIEW_HEIGHT_KEY]: null })
    .then(stored => {
      const savedHeight = Number(stored?.[SUMMARY_PREVIEW_HEIGHT_KEY]);
      if (Number.isFinite(savedHeight) && savedHeight > 0) applyHeight(savedHeight);
    })
    .catch(() => {});

  return { applyHeight };
}
