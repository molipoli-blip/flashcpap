function clearDragIndicators() {
  document.querySelectorAll('.drag-over').forEach(element => {
    element.classList.remove('drag-over');
    element.style.borderTop = '';
    element.style.borderBottom = '';
  });
}

function toggleFieldContent(content, toggleIcon) {
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  toggleIcon.textContent = isOpen ? '▼' : '▲';
}

function getDropPlacement(card, clientY) {
  const rect = card.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  return clientY < midpoint ? 'before' : 'after';
}

function reorderField(fieldOrder, draggedFieldName, targetFieldName, placement) {
  const draggedIndex = fieldOrder.indexOf(draggedFieldName);
  const targetIndex = fieldOrder.indexOf(targetFieldName);
  if (draggedIndex === -1 || targetIndex === -1 || draggedFieldName === targetFieldName) return false;

  const [movedField] = fieldOrder.splice(draggedIndex, 1);
  let newIndex = targetIndex;
  if (draggedIndex < targetIndex) {
    newIndex = placement === 'before' ? targetIndex - 1 : targetIndex;
  } else {
    newIndex = placement === 'before' ? targetIndex : targetIndex + 1;
  }
  fieldOrder.splice(newIndex, 0, movedField);
  return true;
}

export function bindFieldCardInteractions({
  card,
  header,
  content,
  toggleIcon,
  fieldKey,
  siteKey,
  fieldOrder,
  hasProviderConfig,
  onPersistReorder,
  onRefresh
}) {
  // Disable draggable temporarily when clicking inside interactive elements (inputs, selects, etc.)
  // so Firefox doesn't intercept mousedown and prevent proper cursor placement.
  card.addEventListener('mousedown', event => {
    if (event.target.closest('input, textarea, select, button, a')) {
      card.draggable = false;
      card.addEventListener('mouseup', () => { card.draggable = true; }, { once: true });
      card.addEventListener('mouseleave', () => { card.draggable = true; }, { once: true });
    }
  });

  header.addEventListener('click', event => {
    if (event.target.tagName === 'BUTTON' || card.isDragging) return;
    toggleFieldContent(content, toggleIcon);
  });

  toggleIcon.addEventListener('click', event => {
    event.stopPropagation();
    toggleFieldContent(content, toggleIcon);
  });

  card.addEventListener('dragstart', event => {
    if (!siteKey || !hasProviderConfig()) {
      event.preventDefault();
      return;
    }
    card.isDragging = true;
    header.style.cursor = 'grabbing';
    card.style.opacity = '0.6';
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', fieldKey);
  });

  card.addEventListener('dragend', () => {
    card.isDragging = false;
    header.style.cursor = 'grab';
    card.style.opacity = '1';
    clearDragIndicators();
  });

  card.addEventListener('dragover', event => {
    if (!siteKey || !hasProviderConfig()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDragIndicators();
    const placement = getDropPlacement(card, event.clientY);
    card.classList.add('drag-over');
    if (placement === 'before') card.style.borderTop = '3px solid #2196F3';
    else card.style.borderBottom = '3px solid #2196F3';
  });

  card.addEventListener('dragleave', event => {
    if (!card.contains(event.relatedTarget)) {
      card.classList.remove('drag-over');
      card.style.borderTop = '';
      card.style.borderBottom = '';
    }
  });

  card.addEventListener('drop', event => {
    if (!siteKey || !hasProviderConfig()) return;
    event.preventDefault();
    const draggedFieldName = event.dataTransfer.getData('text/plain');
    const placement = getDropPlacement(card, event.clientY);
    const changed = reorderField(fieldOrder, draggedFieldName, fieldKey, placement);
    if (!changed) return;
    onPersistReorder();
    onRefresh();
  });
}
