// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import test from 'node:test';
import assert from 'node:assert/strict';

import { blockExternalSummaryDrop } from '../src/preview-renderer.js';

test('the summary preview blocks external HTML drops', () => {
  let prevented = false;
  let propagationStopped = false;
  const dataTransfer = { dropEffect: 'copy' };
  const event = {
    dataTransfer,
    preventDefault() { prevented = true; },
    stopPropagation() { propagationStopped = true; }
  };

  assert.equal(blockExternalSummaryDrop(event), true);
  assert.equal(prevented, true);
  assert.equal(propagationStopped, true);
  assert.equal(dataTransfer.dropEffect, 'none');
});

test('the summary preview keeps its internal row drag available', () => {
  let prevented = false;
  const event = {
    preventDefault() { prevented = true; },
    stopPropagation() {}
  };

  assert.equal(blockExternalSummaryDrop(event, true), false);
  assert.equal(prevented, false);
});
