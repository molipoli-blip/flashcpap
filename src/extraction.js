// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// src/extraction.js
import { extractTextFromPDF } from '../lib/pdf-parser.js';
import { getActiveNormalTab } from './platform/active-tab.js';
import { browserApi } from './platform/browser-api.js';

export async function getPageText() {
  const tab = await getActiveNormalTab();
  if (!tab) return '';
  
  // Mode PDF : extraction depuis fichier uploadé si présent
  const pdfFileInput = document.getElementById('pdf-file-input');
  
  if (pdfFileInput?.files?.length > 0) {
    const file = pdfFileInput.files[0];

    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = await extractTextFromPDF(arrayBuffer);
      return { text: text || '[Aucun texte détecté dans le PDF]', isPdf: true };
    } catch (error) {
      console.error('💥 [PDF] Erreur extraction:', error);
      return { text: `ERREUR: Impossible de lire le fichier PDF.\n\n${error.message}`, isPdf: true };
    }
  }
  
  // Extraction HTML classique
  // Modification pour autoriser les fichiers locaux (file://) pour les tests
  if (!/^(https?|file):/.test(tab.url)) return { text: '', isPdf: false };

  try {
    const results = await browserApi.scripting.executeScript({
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
  } catch (error) {
    console.error('💥 [getPageText] Erreur lors de l\'extraction du texte:', error);
    return { text: '', isPdf: false };
  }
}
