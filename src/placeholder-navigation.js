// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// src/placeholder-navigation.js - Navigation automatique dans les placeholders [xxx]

/**
 * Sélectionne un texte dans un élément contenteditable
 * @param {HTMLElement} element - L'élément contenteditable
 * @param {string} textToSelect - Le texte exact à sélectionner
 * @returns {boolean} True si la sélection a réussi
 */
function selectTextInContentEditable(element, textToSelect) {
  if (!element) return false;
  
  try {
    const text = element.textContent || element.innerText;
    const index = text.indexOf(textToSelect);
    
    if (index === -1) return false;
    
    // Créer un range pour sélectionner le texte
    const range = document.createRange();
    const selection = window.getSelection();
    
    // Trouver le nœud texte contenant notre texte
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let currentPos = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLength = node.textContent.length;
      
      if (currentPos + nodeLength > index && !startNode) {
        startNode = node;
        startOffset = index - currentPos;
      }
      
      if (currentPos + nodeLength >= index + textToSelect.length) {
        endNode = node;
        endOffset = index + textToSelect.length - currentPos;
        break;
      }
      
      currentPos += nodeLength;
    }
    
    if (startNode && endNode) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Focus sur l'élément
      element.focus();
      
      console.log(`[PLACEHOLDER][PREVIEW] Sélectionné: "${textToSelect}" dans contenteditable`);
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('[PLACEHOLDER][PREVIEW] Erreur de sélection:', e);
    return false;
  }
}

/**
 * Trouve tous les placeholders [xxx] dans un texte (exactement [xxx], pas d'autres variantes)
 * @param {string} text - Le texte à analyser
 * @returns {Array<{start: number, end: number, text: string}>} Liste des positions des placeholders
 */
function findPlaceholders(text) {
  const placeholders = [];
  // Pattern: exactement [xxx] (sensible à la casse)
  const regex = /\[xxx\]/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    placeholders.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      content: 'xxx'
    });
  }
  
  return placeholders;
}

/**
 * Sélectionne un placeholder dans une textarea
 * @param {HTMLTextAreaElement} textarea 
 * @param {number} start - Position de début
 * @param {number} end - Position de fin
 */
function selectPlaceholder(textarea, start, end) {
  if (!textarea) return;
  
  try {
    textarea.focus();
    textarea.setSelectionRange(start, end);
    
    // Log pour debug
    console.log(`[PLACEHOLDER] Sélection: ${start}-${end} => "${textarea.value.substring(start, end)}"`);
  } catch (e) {
    console.error('[PLACEHOLDER] Erreur de sélection:', e);
  }
}

/**
 * Trouve le prochain placeholder après la position actuelle du curseur
 * @param {HTMLTextAreaElement} textarea 
 * @param {Array} placeholders 
 * @param {boolean} backward - Si true, cherche en arrière (Shift+Tab)
 * @returns {Object|null} Le placeholder trouvé ou null
 */
function findNextPlaceholder(textarea, placeholders, backward = false) {
  const cursorPos = textarea.selectionStart;
  
  if (backward) {
    // Chercher en arrière
    for (let i = placeholders.length - 1; i >= 0; i--) {
      if (placeholders[i].start < cursorPos) {
        return placeholders[i];
      }
    }
    // Si rien trouvé, boucler au dernier
    return placeholders.length > 0 ? placeholders[placeholders.length - 1] : null;
  } else {
    // Chercher en avant
    for (let i = 0; i < placeholders.length; i++) {
      if (placeholders[i].start >= cursorPos) {
        return placeholders[i];
      }
    }
    // Si rien trouvé, boucler au premier
    return placeholders.length > 0 ? placeholders[0] : null;
  }
}

/**
 * Configure la navigation par Tab dans les placeholders pour une textarea
 * @param {HTMLTextAreaElement} textarea 
 */
export function setupPlaceholderNavigation(textarea) {
  if (!textarea) return;
  
  // État interne pour tracking
  let lastPlaceholders = [];
  let currentPlaceholderIndex = -1;
  
  // Fonction pour mettre à jour la liste des placeholders
  const updatePlaceholders = () => {
    lastPlaceholders = findPlaceholders(textarea.value);
    console.log(`[PLACEHOLDER] ${lastPlaceholders.length} placeholder(s) détecté(s)`);
    return lastPlaceholders;
  };
  
  // Sélectionner automatiquement le premier placeholder quand le texte change
  const autoSelectFirstPlaceholder = () => {
    const placeholders = updatePlaceholders();
    
    if (placeholders.length > 0) {
      // Sélectionner le premier placeholder
      const first = placeholders[0];
      selectPlaceholder(textarea, first.start, first.end);
      currentPlaceholderIndex = 0;
      return true;
    }
    return false;
  };
  
  // Gérer la navigation avec Tab
  const handleKeyDown = (e) => {
    // Tab ou Shift+Tab
    if (e.key === 'Tab') {
      const placeholders = updatePlaceholders();
      
      if (placeholders.length === 0) {
        // Pas de placeholders, comportement normal
        return;
      }
      
      e.preventDefault(); // Empêcher le comportement par défaut de Tab
      
      const backward = e.shiftKey;
      const currentPos = textarea.selectionStart;
      
      // Trouver le placeholder actuel
      let currentIdx = -1;
      for (let i = 0; i < placeholders.length; i++) {
        if (placeholders[i].start === currentPos || 
            (currentPos >= placeholders[i].start && currentPos <= placeholders[i].end)) {
          currentIdx = i;
          break;
        }
      }
      
      // Calculer le prochain index
      let nextIdx;
      if (backward) {
        nextIdx = currentIdx <= 0 ? placeholders.length - 1 : currentIdx - 1;
      } else {
        nextIdx = currentIdx >= placeholders.length - 1 ? 0 : currentIdx + 1;
      }
      
      // Sélectionner le prochain placeholder
      const next = placeholders[nextIdx];
      selectPlaceholder(textarea, next.start, next.end);
      currentPlaceholderIndex = nextIdx;
      
      console.log(`[PLACEHOLDER] Navigation ${backward ? '←' : '→'} vers placeholder ${nextIdx + 1}/${placeholders.length}`);
    }
  };
  
  // Observer les changements de contenu
  let lastValue = textarea.value;
  let autoSelectTimeout = null;
  
  const handleInput = () => {
    const newValue = textarea.value;
    
    // Vérifier si de nouveaux placeholders ont été ajoutés
    const oldPlaceholderCount = findPlaceholders(lastValue).length;
    const newPlaceholderCount = findPlaceholders(newValue).length;
    
    if (newPlaceholderCount > oldPlaceholderCount) {
      // De nouveaux placeholders ont été ajoutés
      console.log(`[PLACEHOLDER] Nouveaux placeholders détectés (${oldPlaceholderCount} → ${newPlaceholderCount})`);
      
      // Attendre un court instant pour laisser l'insertion se terminer
      clearTimeout(autoSelectTimeout);
      autoSelectTimeout = setTimeout(() => {
        autoSelectFirstPlaceholder();
      }, 50);
    }
    
    lastValue = newValue;
  };
  
  // Attacher les événements
  textarea.addEventListener('keydown', handleKeyDown);
  textarea.addEventListener('input', handleInput);
  
  // Vérification initiale
  updatePlaceholders();
  
  console.log('[PLACEHOLDER] Navigation configurée pour textarea');
  
  // Retourner une fonction de nettoyage
  return () => {
    textarea.removeEventListener('keydown', handleKeyDown);
    textarea.removeEventListener('input', handleInput);
    clearTimeout(autoSelectTimeout);
  };
}

/**
 * Sélectionne manuellement le premier placeholder dans une textarea
 * @param {HTMLTextAreaElement} textarea 
 * @returns {boolean} True si un placeholder a été sélectionné
 */
export function selectFirstPlaceholder(textarea) {
  if (!textarea) return false;
  
  const placeholders = findPlaceholders(textarea.value);
  
  if (placeholders.length > 0) {
    const first = placeholders[0];
    selectPlaceholder(textarea, first.start, first.end);
    return true;
  }
  
  return false;
}

/**
 * Sélectionne le premier [xxx] dans un conteneur preview (contenteditable)
 * @param {HTMLElement} previewContainer - Le conteneur du preview
 * @returns {boolean} True si un placeholder a été sélectionné
 */
export function selectFirstPlaceholderInPreview(previewContainer) {
  if (!previewContainer) return false;
  
  try {
    // Trouver tous les éléments .pv-content (spans contenteditable)
    const spans = previewContainer.querySelectorAll('.pv-content');
    
    for (const span of spans) {
      const text = span.textContent || span.innerText;
      
      // Chercher [xxx] dans ce span
      if (text.includes('[xxx]')) {
        // Sélectionner [xxx] dans cet élément
        const success = selectTextInContentEditable(span, '[xxx]');
        if (success) {
          // ✅ Ajouter la classe is-focused à la ligne parente (.pv-row)
          const row = span.closest('.pv-row');
          if (row) {
            // Retirer is-focused des autres lignes
            previewContainer.querySelectorAll('.pv-row.is-focused').forEach(r => {
              if (r !== row) r.classList.remove('is-focused');
            });
            // Ajouter is-focused à cette ligne
            row.classList.add('is-focused');
            console.log('[PLACEHOLDER][PREVIEW] Ligne mise en surbrillance (is-focused)');
          }
          
          console.log('[PLACEHOLDER][PREVIEW] Premier [xxx] sélectionné avec succès');
          return true;
        }
      }
    }
    
    console.log('[PLACEHOLDER][PREVIEW] Aucun [xxx] trouvé dans le preview');
    return false;
  } catch (e) {
    console.error('[PLACEHOLDER][PREVIEW] Erreur:', e);
    return false;
  }
}


