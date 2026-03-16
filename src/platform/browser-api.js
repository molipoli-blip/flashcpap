// SPDX-License-Identifier: Apache-2.0

import { chromiumApi } from './chromium/api.js';
import { firefoxApi } from './firefox/api.js';

function detectApi() {
  if (typeof globalThis.browser !== 'undefined' && globalThis.browser?.runtime?.getURL) {
    return firefoxApi;
  }
  return chromiumApi;
}

export const browserApi = detectApi();

export function getBrowserTarget() {
  return browserApi.name;
}
