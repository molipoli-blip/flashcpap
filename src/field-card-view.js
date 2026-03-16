import { t } from './i18n.js';

export function getFieldDisplayName(fieldKey, definition) {
  return definition.label || (fieldKey === fieldKey.toUpperCase()
    ? fieldKey
    : fieldKey.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase()));
}

function createFieldCardContainer(fieldKey, index) {
  const group = document.createElement('div');
  group.className = 'field-group';
  group.style.marginBottom = '15px';
  group.style.border = '2px solid #ccc';
  group.style.borderRadius = '6px';
  group.style.backgroundColor = '#fafafa';
  group.draggable = true;
  group.dataset.fieldName = fieldKey;
  group.dataset.fieldIndex = index;
  return group;
}

function createFieldDeleteButton(fieldKey, onDelete) {
  const button = document.createElement('button');
  button.textContent = '🗑';
  button.title = t('fieldDeleteTitle');
  button.style.fontSize = '12px';
  button.style.padding = '2px 6px';
  button.onclick = onDelete;
  return button;
}

function createFieldHeader({ fieldKey, definition, index, expandedFieldKey, canDelete, onDelete }) {
  const fieldHeader = document.createElement('div');
  fieldHeader.style.cursor = 'grab';
  fieldHeader.style.fontWeight = 'bold';
  fieldHeader.style.padding = '10px';
  fieldHeader.style.backgroundColor = '#e8f4f8';
  fieldHeader.style.borderRadius = '4px 4px 0 0';
  fieldHeader.style.display = 'flex';
  fieldHeader.style.justifyContent = 'space-between';
  fieldHeader.style.alignItems = 'center';
  fieldHeader.style.borderBottom = '1px solid #ddd';

  const fieldTitleContainer = document.createElement('div');
  fieldTitleContainer.style.display = 'flex';
  fieldTitleContainer.style.alignItems = 'center';

  const dragIcon = document.createElement('span');
  dragIcon.textContent = '⋮⋮';
  dragIcon.style.color = '#999';
  dragIcon.style.marginRight = '8px';
  dragIcon.style.cursor = 'grab';
  dragIcon.style.fontSize = '14px';
  dragIcon.style.lineHeight = '1';

  const orderNumber = document.createElement('span');
  orderNumber.textContent = `${index + 1}. `;
  orderNumber.style.fontWeight = 'bold';
  orderNumber.style.color = '#666';
  orderNumber.style.marginRight = '5px';

  const fieldIcon = document.createElement('span');
  fieldIcon.textContent = definition.type === 'numeric' ? '🔢' : '📝';
  fieldIcon.style.marginRight = '8px';
  fieldIcon.style.fontSize = '16px';

  const fieldTitle = document.createElement('span');
  const displayName = getFieldDisplayName(fieldKey, definition);
  fieldTitle.textContent = definition.type === 'numeric' && definition.unit
    ? `${displayName} (${definition.type} - ${definition.unit})`
    : `${displayName} (${definition.type})`;

  const unsavedIndicator = document.createElement('span');
  unsavedIndicator.textContent = t('fieldUnsavedIndicator');
  unsavedIndicator.style.color = '#d33';
  unsavedIndicator.style.fontSize = '11px';
  unsavedIndicator.style.marginLeft = '6px';
  unsavedIndicator.style.display = 'none';

  fieldTitleContainer.appendChild(dragIcon);
  fieldTitleContainer.appendChild(orderNumber);
  fieldTitleContainer.appendChild(fieldIcon);
  fieldTitleContainer.appendChild(fieldTitle);
  fieldTitleContainer.appendChild(unsavedIndicator);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.alignItems = 'center';
  buttonContainer.style.gap = '5px';

  if (canDelete) {
    buttonContainer.append(createFieldDeleteButton(fieldKey, onDelete));
  }

  const fieldToggleIcon = document.createElement('span');
  fieldToggleIcon.textContent = fieldKey === expandedFieldKey ? '▲' : '▼';
  fieldToggleIcon.style.fontSize = '14px';
  fieldToggleIcon.style.marginLeft = '10px';
  fieldToggleIcon.style.cursor = 'pointer';
  buttonContainer.appendChild(fieldToggleIcon);

  fieldHeader.appendChild(fieldTitleContainer);
  fieldHeader.appendChild(buttonContainer);

  return { fieldHeader, fieldToggleIcon, unsavedIndicator };
}

export function createFieldGroupView({
  fieldKey,
  definition,
  index,
  expandedFieldKey,
  canDelete,
  onDelete,
  buildContent
}) {
  const card = createFieldCardContainer(fieldKey, index);
  const { fieldHeader, fieldToggleIcon, unsavedIndicator } = createFieldHeader({
    fieldKey,
    definition,
    index,
    expandedFieldKey,
    canDelete,
    onDelete
  });
  const fieldContent = buildContent(unsavedIndicator);
  card.appendChild(fieldHeader);
  card.appendChild(fieldContent);

  return {
    card,
    fieldHeader,
    fieldToggleIcon,
    fieldContent,
    unsavedIndicator
  };
}