function buildMaskTokens(size) {
  const parsedSize = parseInt(size, 10);
  if (!parsedSize || parsedSize < 1 || parsedSize > 7) return [];
  if (parsedSize === 1) return ['X'];
  // NIR preset: only one valid mask
  if (parsedSize === 7) return ['X X X X X X X'];

  const tokens = [];
  const max = 1 << parsedSize;
  for (let mask = 1; mask < max; mask += 1) {
    const parts = [];
    for (let index = 0; index < parsedSize; index += 1) {
      parts.push(((mask >> (parsedSize - 1 - index)) & 1) ? 'X' : '*');
    }
    tokens.push(parts.join(' '));
  }
  return tokens;
}

export function populateMaskOptions(selectElement, size, currentMask) {
  if (!selectElement) return;

  const maskParent = selectElement.parentElement;
  const isNir = parseInt(size, 10) === 7;
  if (maskParent) maskParent.style.display = isNir ? 'none' : '';

  const options = buildMaskTokens(size);
  selectElement.replaceChildren();
  if (!options.length) return;

  const wanted = (currentMask || '').trim().toUpperCase();
  options.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    const isAll = value.split(' ').every((token) => token === 'X');
    if ((wanted && wanted === value) || (!wanted && isAll)) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });

  selectElement.disabled = parseInt(size, 10) === 1;
}

export function readFieldEditorValues({ elements, fieldKey }) {
  const suffix = fieldKey ? `-${fieldKey}` : '';
  return {
    label: (elements.name?.value || '').trim(),
    type: Array.from(elements.typeRadios || []).find((radio) => radio.checked)?.value || 'text',
    unit: (elements.unit?.value || '').trim(),
    role: (elements.role?.value || '').trim(),
    tupleSize: parseInt(elements.tupleSize?.value || '', 10),
    tupleMask: (elements.tupleMask?.value || '').trim(),
    lblText: (document.getElementById(`add-label-text${suffix}`)?.value || '').trim(),
    lblStart: parseInt(document.getElementById(`add-label-start${suffix}`)?.value || '1', 10) || 1,
    lblEnd: parseInt(document.getElementById(`add-label-end${suffix}`)?.value || '999', 10) || 999,
    lblLabelExclude: (document.getElementById(`add-label-label-exclude${suffix}`)?.value || '')
      .split(',').map((value) => value.trim()).filter(Boolean),
    lblExclude: (document.getElementById(`add-label-exclude${suffix}`)?.value || '')
      .split(',').map((value) => value.trim()).filter(Boolean),
    lblPriority: (document.getElementById(`add-label-priority${suffix}`)?.value || '')
      .split(',').map((value) => value.trim()).filter(Boolean),
    debugSuffix: suffix
  };
}
