// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// lib/pdf-parser.js - Extraction de texte PDF avec pdf.js
import { logError, logFlow } from '../src/debug-logger.js';
import { browserApi } from '../src/platform/browser-api.js';

/**
 * Extrait le texte complet d'un fichier PDF
 * @param {ArrayBuffer} arrayBuffer - Contenu binaire du PDF
 * @returns {Promise<string>} Texte extrait de toutes les pages
 */
export async function extractTextFromPDF(arrayBuffer) {
  try {
    // Import dynamique de pdf.js
    const pdfjsLib = await import(browserApi.runtime.getUrl('lib/pdf.mjs'));
    
    // Configuration du worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = browserApi.runtime.getUrl('lib/pdf.worker.mjs');

    // Chargement du document PDF
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    logFlow('PDF', 'Document PDF charge', { pageCount: pdf.numPages });

    let fullText = '';

    // Extraction page par page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Reconstruction du texte en préservant les sauts de ligne
      let pageText = '';
      let lastY = null;
      
      for (const item of textContent.items) {
        const currentY = item.transform[5];
        
        // Détecter changement de ligne (nouvelle position Y)
        if (lastY !== null && Math.abs(currentY - lastY) > 2) {
          pageText += '\n';
        } else if (pageText && !pageText.endsWith(' ')) {
          pageText += ' ';
        }
        
        pageText += (item.str || '').trim();
        lastY = currentY;
      }

      fullText += `\n\n===== Page ${pageNum} / ${pdf.numPages} =====\n`;
      fullText += pageText;

      logFlow('PDF', 'Page PDF extraite', { page: pageNum, totalPages: pdf.numPages, textLength: pageText.length });
    }

    logFlow('PDF', 'Extraction PDF terminee', { totalLength: fullText.length, pageCount: pdf.numPages });
    return fullText.trim();

  } catch (error) {
    logError('PDF', 'Erreur extraction PDF', error);
    throw new Error(`Échec de l'extraction PDF: ${error.message}`);
  }
}
