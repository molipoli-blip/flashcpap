﻿// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// lib/share.js - Publication de templates

import { browserApi } from '../src/platform/browser-api.js';

export async function publishTemplate(payload) {
  try {
    const storage = await browserApi.storage.local.get(['install_id']);
    const installId = storage.install_id || '';
    const timestamp = Date.now().toString();

    const headers = {
      'Content-Type': 'application/json',
      'X-Install-ID': installId,
      'X-Request-Timestamp': timestamp,
      'X-Extension-Version': browserApi.runtime.getManifest().version
    };

    const response = await fetch('https://flashcpap.com/api/templates', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur serveur (${response.status}): ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[SHARE] Publish failed:', error);
    throw error;
  }
}


