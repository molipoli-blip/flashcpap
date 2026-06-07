// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

export function byId(id, root = document) {
  if (!id || !root || typeof root.getElementById !== 'function') return null;
  return root.getElementById(id);
}
