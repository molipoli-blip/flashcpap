// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

function selectTextInContentEditable(element, textToSelect) {
  if (!element) return false;

  try {
    const text = element.textContent || element.innerText;
    const index = text.indexOf(textToSelect);

    if (index === -1) return false;

    const range = document.createRange();
    const selection = window.getSelection();

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

function findPlaceholders(text) {
  const placeholders = [];
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

function selectPlaceholder(textarea, start, end) {
  if (!textarea) return;

  try {
    textarea.focus();
    textarea.setSelectionRange(start, end);

    console.log(`[PLACEHOLDER] Sélection: ${start}-${end} => "${textarea.value.substring(start, end)}"`);
  } catch (e) {
    console.error('[PLACEHOLDER] Erreur de sélection:', e);
  }
}

function findNextPlaceholder(textarea, placeholders, backward = false) {
  const cursorPos = textarea.selectionStart;

  if (backward) {
    for (let i = placeholders.length - 1; i >= 0; i--) {
      if (placeholders[i].start < cursorPos) {
        return placeholders[i];
      }
    }
    return placeholders.length > 0 ? placeholders[placeholders.length - 1] : null;
  } else {
    for (let i = 0; i < placeholders.length; i++) {
      if (placeholders[i].start >= cursorPos) {
        return placeholders[i];
      }
    }
    return placeholders.length > 0 ? placeholders[0] : null;
  }
}

export function setupPlaceholderNavigation(textarea) {
  if (!textarea) return;

  let lastPlaceholders = [];
  let currentPlaceholderIndex = -1;


  const updatePlaceholders = () => {
    lastPlaceholders = findPlaceholders(textarea.value);
    console.log(`[PLACEHOLDER] ${lastPlaceholders.length} placeholder(s) détecté(s)`);
    return lastPlaceholders;
  };


  const autoSelectFirstPlaceholder = () => {
    const placeholders = updatePlaceholders();

    if (placeholders.length > 0) {
      const first = placeholders[0];
      selectPlaceholder(textarea, first.start, first.end);
      currentPlaceholderIndex = 0;
      return true;
    }
    return false;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      const placeholders = updatePlaceholders();

      if (placeholders.length === 0) {
        return;
      }

      e.preventDefault();

      const backward = e.shiftKey;
      const currentPos = textarea.selectionStart;
      let currentIdx = -1;
      for (let i = 0; i < placeholders.length; i++) {
        if (placeholders[i].start === currentPos ||
            (currentPos >= placeholders[i].start && currentPos <= placeholders[i].end)) {
          currentIdx = i;
          break;
        }
      }

      let nextIdx;
      if (backward) {
        nextIdx = currentIdx <= 0 ? placeholders.length - 1 : currentIdx - 1;
      } else {
        nextIdx = currentIdx >= placeholders.length - 1 ? 0 : currentIdx + 1;
      }
      const next = placeholders[nextIdx];
      selectPlaceholder(textarea, next.start, next.end);
      currentPlaceholderIndex = nextIdx;

      console.log(`[PLACEHOLDER] Navigation ${backward ? '←' : '→'} vers placeholder ${nextIdx + 1}/${placeholders.length}`);
    }
  };

  let lastValue = textarea.value;
  let autoSelectTimeout = null;

  const handleInput = () => {
    const newValue = textarea.value;
    const oldPlaceholderCount = findPlaceholders(lastValue).length;
    const newPlaceholderCount = findPlaceholders(newValue).length;

    if (newPlaceholderCount > oldPlaceholderCount) {
      console.log(`[PLACEHOLDER] Nouveaux placeholders détectés (${oldPlaceholderCount} → ${newPlaceholderCount})`);

      clearTimeout(autoSelectTimeout);
      autoSelectTimeout = setTimeout(() => {
        autoSelectFirstPlaceholder();
      }, 50);
    }

    lastValue = newValue;
  };

  textarea.addEventListener('keydown', handleKeyDown);
  textarea.addEventListener('input', handleInput);

  updatePlaceholders();

  console.log('[PLACEHOLDER] Navigation configurée pour textarea');

  return () => {
    textarea.removeEventListener('keydown', handleKeyDown);
    textarea.removeEventListener('input', handleInput);
    clearTimeout(autoSelectTimeout);
  };
}

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

export function selectFirstPlaceholderInPreview(previewContainer) {
  if (!previewContainer) return false;

  try {
    const spans = previewContainer.querySelectorAll('.pv-content');

    for (const span of spans) {
      const text = span.textContent || span.innerText;

      if (text.includes('[xxx]')) {
        const success = selectTextInContentEditable(span, '[xxx]');
        if (success) {
          const row = span.closest('.pv-row');
          if (row) {
            previewContainer.querySelectorAll('.pv-row.is-focused').forEach(r => {
              if (r !== row) r.classList.remove('is-focused');
            });
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
