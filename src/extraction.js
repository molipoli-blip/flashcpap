// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { extractTextFromPDF } from '../lib/pdf-parser.js';
import { browserApi } from './platform/browser-api.js';
import { HostPermissionError } from './platform/site-root.js';

async function extractHtmlTextFromTab(tab) {
  let results;

  try {
    results = await browserApi.scripting.executeScript({
      tabId: tab.id,
      allFrames: true,
      func: () => {
        try {
          let text = (document && document.body && document.body.innerText) ? document.body.innerText : '';
          const isTop = window.top === window;
          const frameInfo = {
            url: location.href,
            title: document?.title || '',
            isTop,
            frameElementDesc: (() => {
              try { return window.frameElement ? (window.frameElement.id || window.frameElement.name || window.frameElement.tagName) : ''; } catch(_) { return ''; }
            })()
          };
          return { text, frameInfo };
        } catch(e) {
          return { text: '', frameInfo: { url: location.href, title: document?.title || '', isTop: window.top===window }, error: e?.message || String(e) };
        }
      }
    });
  } catch (error) {
    throw new HostPermissionError(
      'INJECTION_FAILED',
      'Injection impossible malgré l\'autorisation accordée.',
      { cause: error, tabUrl: tab?.url || '' }
    );
  }

  let finalText = '';
  let totalChars = 0;
  const sorted = results
    .map((r) => ({ frameId: r.frameId, result: r.result }))
    .sort((a, b) => {
      if (a.result?.frameInfo?.isTop && !b.result?.frameInfo?.isTop) return -1;
      if (!a.result?.frameInfo?.isTop && b.result?.frameInfo?.isTop) return 1;
      return a.frameId - b.frameId;
    });

  for (const { frameId, result } of sorted) {
    const info = result?.frameInfo || {};
    const text = (result?.text || '').trim();
    const header = info.isTop
      ? `=== FRAME PRINCIPALE ===\nURL: ${info.url}\nTitre: ${info.title}\n`
      : `=== SOUS-FRAME #${frameId} ===\nURL: ${info.url}\nTitre: ${info.title}${info.frameElementDesc ? `\nParent: ${info.frameElementDesc}` : ''}\n`;
    finalText += header;
    if (text) { finalText += text + '\n\n'; totalChars += text.length; }
    else { finalText += '(aucun texte)\n\n'; }
  }

  return { text: finalText, isPdf: false };
}

export async function getPageText(tab = null) {
  const pdfFileInput = document.getElementById('pdf-file-input');

  // PDF mode: extract from the uploaded file when present.
  if (pdfFileInput?.files?.length > 0) {
    const file = pdfFileInput.files[0];

    const arrayBuffer = await file.arrayBuffer();
    const text = await extractTextFromPDF(arrayBuffer);
    return { text: text || '[Aucun texte détecté dans le PDF]', isPdf: true };
  }

  if (!tab?.url) {
    throw new HostPermissionError('NO_NORMAL_TAB', 'Aucun onglet normal trouvé. Ouvrez une page Web dans une fenêtre normale puis relancez l\'analyse.');
  }

  try {
    return await extractHtmlTextFromTab(tab);
  } catch (error) {
    if (error instanceof HostPermissionError) {
      throw error;
    }

    throw new HostPermissionError(
      'INJECTION_FAILED',
      'Injection impossible malgré l\'autorisation accordée.',
      { cause: error, tabUrl: tab.url }
    );
  }
}
