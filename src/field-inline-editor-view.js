import { t } from './i18n.js';

function escapeTemplateValue(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTupleSizeOptions(tupleSizeInit) {
  return [1, 2, 3, 4, 5, 6, 7].map(size => {
    const label = size === 7 ? 'NIR' : t('fieldEditorTupleSizeOption', [String(size), size > 1 ? 's' : '']);
    return `<option value="${size}" ${tupleSizeInit === size ? 'selected' : ''}>${label}</option>`;
  }).join('');
}

function renderLabelCard({
  fieldKey,
  lbl0,
  lblTextInit,
  lblStartInit,
  lblEndInit,
  lblLabelExclInit,
  lblExcludeInit,
  lblPriorityInit,
  typeSectionMarkup,
  extractionModeMarkup
}) {
  return `
        <div class="field-group" id="add-label-section-${fieldKey}" style="margin-bottom: 10px;">
          <div id="add-label-card-${fieldKey}" style="border: 1px solid #ddd; border-radius: 4px; padding: 8px; background: #f9f9f9;">
            <div id="add-label-card-header-${fieldKey}" style="cursor: pointer; font-weight: bold; padding: 5px; background: #eee; border-radius: 3px; display:flex; align-items:center; justify-content:space-between;">
              <span id="add-label-card-title-${fieldKey}">${t('fieldEditorCardTitle', [t('fieldEditorEmptyKeyword'), '1', '999'])}</span>
              <span id="add-label-card-toggle-${fieldKey}" style="font-size:12px;">▲</span>
            </div>
            <div id="add-label-card-body-${fieldKey}" style="display:block; margin-top:8px;">
              ${typeSectionMarkup}
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <div style="flex:2 1 160px;">
                  <label for="add-label-text-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">${t('fieldEditorAnchorKeyword')}</label>
                  <input id="add-label-text-${fieldKey}" type="text" placeholder="${escapeTemplateValue(t('fieldEditorAnchorKeywordPlaceholder'))}" style="width:100%; padding:6px; box-sizing:border-box;" value="${escapeTemplateValue(lblTextInit)}">
                </div>
                <div style="flex:1 1 60px;">
                  <label for="add-label-start-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">${t('fieldEditorLineStart')}</label>
                  <input id="add-label-start-${fieldKey}" type="number" min="1" value="${escapeTemplateValue(lblStartInit)}" style="width:100%; padding:6px; box-sizing:border-box;">
                </div>
                <div style="flex:1 1 60px;">
                  <label for="add-label-end-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">${t('fieldEditorLineEnd')}</label>
                  <input id="add-label-end-${fieldKey}" type="number" min="1" value="${escapeTemplateValue(lblEndInit)}" style="width:100%; padding:6px; box-sizing:border-box;">
                </div>
              </div>
              <div style="margin-top:6px;">
                <label for="add-label-label-exclude-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">${t('fieldEditorExcludeLineKeyword')}</label>
                <input id="add-label-label-exclude-${fieldKey}" type="text" placeholder="${escapeTemplateValue(t('fieldEditorExcludeLineKeywordPlaceholder'))}" style="width:100%; padding:6px; box-sizing:border-box;" value="${escapeTemplateValue(lblLabelExclInit)}">
                <div style="font-size:10px; color:#888; margin-top:3px;">Si la <strong>ligne du label</strong> contient un de ces mots, cette occurrence est ignorée (utile quand un même mot-clé apparaît en plusieurs contextes).</div>
              </div>
              <div style="margin-top:6px;">
                <label for="add-label-exclude-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">${t('fieldEditorExcludeContent')}</label>
                <input id="add-label-exclude-${fieldKey}" type="text" placeholder="${escapeTemplateValue(t('fieldEditorExcludeContentPlaceholder'))}" style="width:100%; padding:6px; box-sizing:border-box;" value="${escapeTemplateValue(lblExcludeInit)}">
                <div style="font-size:10px; color:#888; margin-top:3px;">Les <strong>lignes de valeur</strong> contenant un de ces mots sont ignorées. Utile pour filtrer des lignes parasites juste après le label.</div>
              </div>
              <div style="margin-top:6px;">
                <label for="add-label-priority-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">${t('fieldEditorPriorityWords')}</label>
                <input id="add-label-priority-${fieldKey}" type="text" placeholder="${escapeTemplateValue(t('fieldEditorPriorityWordsPlaceholder'))}" style="width:100%; padding:6px; box-sizing:border-box;" value="${escapeTemplateValue(lblPriorityInit)}">
                <div style="font-size:10px; color:#888; margin-top:3px;">Parmi plusieurs valeurs candidates, <strong>préfère celle qui contient</strong> un de ces mots. Laissez vide pour prendre la première valeur trouvée.</div>
              </div>
              <div style="margin-top:10px; padding:10px; background:#fff9e6; border-radius:4px; border:1px solid #ffe066;">
                <div style="font-size:12px; font-weight:bold; color:#444; margin-bottom:4px;">${t('fieldEditorParsingSeparatorsTitle')}</div>
                <div style="font-size:10px; color:#666; margin-bottom:6px;">
                    ${t('fieldEditorParsingSeparatorsHelpHtml')}
                </div>
                <label for="add-label-split-separators-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">
                    ${t('fieldEditorParsingSeparatorsLabel')}
                </label>
                  <input id="add-label-split-separators-${fieldKey}" type="text" placeholder="${escapeTemplateValue(t('fieldEditorParsingSeparatorsPlaceholder'))}" style="width:100%; padding:6px; box-sizing:border-box;" value="${escapeTemplateValue((lbl0?.splitSeparators || []).join(', '))}">
                <div style="font-size:10px; color:#888; margin-top:3px;">
                    ${t('fieldEditorParsingSeparatorsExamplesHtml')}
                </div>
              </div>
              ${extractionModeMarkup}
                <div style="font-size: 11px; color:#777; margin-top:3px;">${t('fieldEditorLeaveEmptyHint')}</div>
            </div>
          </div>
        </div>`;
}

function renderTypeSection({ fieldKey, isNumeric, isTime, unitInitial, tupleSizeInit }) {
  return `
        <div class="field-group" style="margin-bottom: 8px;">
          <label style="display:block; font-weight: bold; margin-bottom:4px;">${t('fieldEditorType')}</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="radio" name="add-field-type-${fieldKey}" value="text" ${!isNumeric && !isTime ? 'checked' : ''}> ${t('fieldEditorTypeText')}</label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="radio" name="add-field-type-${fieldKey}" value="numeric" ${isNumeric ? 'checked' : ''}> ${t('fieldEditorTypeNumeric')}</label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="radio" name="add-field-type-${fieldKey}" value="time" ${isTime ? 'checked' : ''}> ${t('fieldEditorTypeTime')}</label>
          </div>
        </div>
        <div class="field-group" id="add-field-unit-row-${fieldKey}" style="margin-bottom: 10px;">
          <label for="add-field-unit-${fieldKey}" style="display:block; font-weight: bold; margin-bottom:4px;">${t('fieldEditorUnitLabel')}</label>
          <input id="add-field-unit-${fieldKey}" type="text" placeholder="${escapeTemplateValue(t('fieldEditorUnitPlaceholder'))}" value="${escapeTemplateValue(unitInitial)}" style="width:100%; padding:6px; box-sizing:border-box;" ${isNumeric ? '' : 'disabled'}>
        </div>
        <div class="field-group" id="add-field-tuple-row-${fieldKey}" style="margin-bottom: 10px; display: ${isNumeric || isTime ? 'block' : 'none'};">
          <label style="display:block; font-weight: bold; margin-bottom:4px;">${t('fieldEditorTupleExtraction')}</label>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
            <div style="flex:1 1 80px;">
              <label for="add-field-tuple-size-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">${t('fieldEditorTupleSize')}</label>
              <select id="add-field-tuple-size-${fieldKey}" style="width:100%; padding:4px;">
                ${renderTupleSizeOptions(tupleSizeInit)}
              </select>
            </div>
            <div style="flex:2 1 120px;">
              <label for="add-field-tuple-mask-${fieldKey}" style="display:block; font-size:12px; color:#444; margin-bottom:3px;">${t('fieldEditorTupleSelection')}</label>
              <select id="add-field-tuple-mask-${fieldKey}" style="width:100%; padding:4px;"></select>
            </div>
          </div>
          <div id="add-field-tuple-connectors-${fieldKey}" style="margin-top:8px; display:none;">
            <label style="display:block; font-size:12px; color:#444; margin-bottom:4px;">${t('fieldEditorTupleConnectors')}</label>
            <div id="add-field-tuple-connectors-inputs-${fieldKey}" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
            <div style="font-size:10px; color:#999; margin-top:4px;">${t('fieldEditorTupleConnectorHint')}</div>
          </div>
          <div id="add-field-time-format-${fieldKey}" style="margin-top:8px; display:none;">
            <label style="display:block; font-size:12px; font-weight:bold; color:#444; margin-bottom:4px;">${t('fieldEditorTimeConfig')}</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <div style="flex:1 1 140px;">
                <label for="add-field-time-raw-${fieldKey}" style="display:block; font-size:11px; color:#444; margin-bottom:3px;">${t('fieldEditorTimeRaw')}</label>
                <select id="add-field-time-raw-${fieldKey}" style="width:100%; padding:4px; font-size:11px;">
                  <option value="">${t('fieldEditorChoose')}</option>
                </select>
              </div>
              <div style="flex:1 1 140px;">
                <label for="add-field-time-display-${fieldKey}" style="display:block; font-size:11px; color:#444; margin-bottom:3px;">${t('fieldEditorTimeDisplay')}</label>
                <select id="add-field-time-display-${fieldKey}" style="width:100%; padding:4px; font-size:11px;">
                  <option value="">${t('fieldEditorChoose')}</option>
                </select>
              </div>
            </div>
            <div style="font-size:10px; color:#999; margin-top:4px;">
              ${t('fieldEditorTimeFormatHint')}
            </div>
          </div>
          <div style="font-size: 11px; color:#777; margin-top:6px;">
            ${t('fieldEditorTupleTipsTitle')}
            <ul style="margin:4px 0 0 16px; padding:0;">
              <li>${t('fieldEditorTupleTip1')}</li>
              <li>${t('fieldEditorTupleTip2')}</li>
              <li>${t('fieldEditorTupleTip3')}</li>
              <li>${t('fieldEditorTupleTip4')}</li>
            </ul>
          </div>
        </div>`;
}

function renderExtractionModeSection({ fieldKey, firstLabel }) {
  return `
              <div style="margin-top:10px; padding:10px; background:#f0f8ff; border-radius:4px; border:1px solid #cce7ff;">
                <div style="font-size:12px; font-weight:bold; color:#444; margin-bottom:8px;">${t('fieldEditorExtractionModeTitle')}</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; font-size:11px;">
                    <input type="radio" name="extraction-mode-${fieldKey}" value="auto" ${firstLabel?.requireInline === true || firstLabel?.requireNextLine === true ? '' : 'checked'} style="margin-top:2px;">
                    <div>
                      <div style="font-weight:bold; color:#28a745;">${t('fieldEditorExtractionAutoTitle')}</div>
                      <div style="color:#666; margin-top:2px;">${t('fieldEditorExtractionAutoDesc')}</div>
                      <div style="color:#888; font-size:10px; margin-top:2px;">${t('fieldEditorExtractionAutoExample')}</div>
                    </div>
                  </label>
                  <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; font-size:11px;">
                    <input type="radio" name="extraction-mode-${fieldKey}" value="inline" ${firstLabel?.requireInline === true ? 'checked' : ''} style="margin-top:2px;">
                    <div>
                      <div style="font-weight:bold; color:#0066cc;">${t('fieldEditorExtractionInlineTitle')}</div>
                      <div style="color:#666; margin-top:2px;">${t('fieldEditorExtractionInlineDesc')}</div>
                      <div style="color:#888; font-size:10px; margin-top:2px;">${t('fieldEditorExtractionInlineExample')}</div>
                    </div>
                  </label>
                  <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; font-size:11px;">
                    <input type="radio" name="extraction-mode-${fieldKey}" value="nextline" ${firstLabel?.requireNextLine === true ? 'checked' : ''} style="margin-top:2px;">
                    <div>
                      <div style="font-weight:bold; color:#cc6600;">${t('fieldEditorExtractionNextTitle')}</div>
                      <div style="color:#666; margin-top:2px;">${t('fieldEditorExtractionNextDesc')}</div>
                      <div style="color:#888; font-size:10px; margin-top:2px;">${t('fieldEditorExtractionNextExample')}</div>
                    </div>
                  </label>
                </div>

                <div id="nextline-range-config-${fieldKey}" style="margin-top:8px; padding:8px; background:#fff; border:1px solid #ddd; border-radius:4px; display:${firstLabel?.requireInline === true ? 'none' : 'block'}">
                  <div style="font-size:11px; font-weight:bold; color:#444; margin-bottom:4px;">${t('fieldEditorNextRangeTitle')}</div>
                  <div style="font-size:10px; color:#666; margin-bottom:6px;">
                    ${t('fieldEditorNextRangeHelpHtml')}
                  </div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:11px;">${t('fieldEditorNextRangeFrom')}</span>
                    <input id="add-label-nextline-min-${fieldKey}" type="number" min="1" max="20" value="${escapeTemplateValue(firstLabel?.nextLineRange?.[0] || 1)}" style="width:40px; padding:2px; font-size:11px;">
                    <span style="font-size:11px;">${t('fieldEditorNextRangeTo')}</span>
                    <input id="add-label-nextline-max-${fieldKey}" type="number" min="1" max="20" value="${escapeTemplateValue(firstLabel?.nextLineRange?.[1] || 3)}" style="width:40px; padding:2px; font-size:11px;">
                    <span style="font-size:10px; color:#888;">${t('fieldEditorNextRangeUnit')}</span>
                  </div>
                  <div style="font-size:10px; color:#888; margin-top:2px;">
                    ${t('fieldEditorNextRangeExample')}
                  </div>
                </div>

                <div style="font-size:10px; color:#666; margin-top:8px; padding:8px; background:#fff; border-left:3px solid #0066cc; border-radius:2px;">
                  ${t('fieldEditorModeUsageHtml')}
                </div>
              </div>`;
}

function renderRoleAndSuffixSection({ fieldKey, roleInitial, suffixInitial }) {
  return `
        <div class="field-group" id="add-field-role-row-${fieldKey}" style="margin-bottom: 10px;">
          <label for="add-field-role-${fieldKey}" style="display:block; font-weight: bold; margin-bottom:4px;">${t('fieldEditorRoleLabel')}</label>
          <select id="add-field-role-${fieldKey}" style="width:100%; padding:6px; box-sizing:border-box;">
            <option value="" ${roleInitial === '' ? 'selected' : ''}>${t('fieldEditorRoleNone')}</option>
            <option value="obs" ${roleInitial === 'obs' ? 'selected' : ''}>${t('fieldEditorRoleObs')}</option>
            <option value="iah" ${roleInitial === 'iah' ? 'selected' : ''}>IAH</option>
            <option value="fuites" ${roleInitial === 'fuites' ? 'selected' : ''}>${t('fieldEditorRoleLeaks')}</option>
          </select>
          <div style="font-size: 11px; color:#777; margin-top:3px;">${t('fieldEditorRoleHelp')}</div>
        </div>
        <div class="field-group" style="margin-bottom: 10px;">
          <label for="add-field-suffix-${fieldKey}" style="display:block; font-weight: bold; margin-bottom:4px;">${t('fieldEditorSuffixLabel')}</label>
          <select id="add-field-suffix-${fieldKey}" style="width:100%; padding:6px; box-sizing:border-box;">
            <option value="__DEFAULT__" ${suffixInitial === undefined ? 'selected' : ''}>${t('fieldEditorSuffixDefault')}</option>
            <option value=" " ${suffixInitial === ' ' ? 'selected' : ''}>${t('fieldEditorSuffixSpace')}</option>
            <option value=". " ${suffixInitial === '. ' ? 'selected' : ''}>${t('fieldEditorSuffixDotSpace')}</option>
            <option value=", " ${suffixInitial === ', ' ? 'selected' : ''}>${t('fieldEditorSuffixCommaSpace')}</option>
            <option value="&#10;" ${suffixInitial === '\n' ? 'selected' : ''}>${t('fieldEditorSuffixNewLine')}</option>
            <option value="" ${suffixInitial === '' ? 'selected' : ''}>${t('fieldEditorSuffixNone')}</option>
          </select>
        </div>`;
}

export function buildInlineFieldEditorMarkup({ fieldKey, siteLabel, initialState }) {
  const {
    isNumeric,
    isTime,
    nameInitial,
    unitInitial,
    suffixInitial,
    roleInitial,
    tupleSizeInit,
    firstLabel,
    lblTextInit,
    lblStartInit,
    lblEndInit,
    lblLabelExclInit,
    lblExcludeInit,
    lblPriorityInit
  } = initialState;

  const typeSectionMarkup = renderTypeSection({ fieldKey, isNumeric, isTime, unitInitial, tupleSizeInit });
  const extractionModeMarkup = renderExtractionModeSection({ fieldKey, firstLabel });

  return `
      <div style="padding: 10px 12px;">
        <input type="hidden" id="add-field-mode-${fieldKey}" value="edit">
        <input type="hidden" id="add-field-site-${fieldKey}" value="${escapeTemplateValue(siteLabel)}">
        <div class="field-group" style="margin-bottom: 8px;">
          <label for="add-field-name-${fieldKey}" style="display:block; font-weight: bold; margin-bottom:4px;">${t('fieldEditorFieldName')}</label>
          <input id="add-field-name-${fieldKey}" type="text" placeholder="${escapeTemplateValue(t('fieldEditorFieldNamePlaceholder'))}" value="${escapeTemplateValue(nameInitial)}" style="width:100%; padding:6px; box-sizing:border-box;">
          <div id="add-field-name-help-${fieldKey}" style="font-size: 11px; color:#777; margin-top:3px;">${t('fieldEditorFieldNameHelp')}</div>
        </div>
        ${renderLabelCard({
          fieldKey,
          lbl0: firstLabel,
          lblTextInit,
          lblStartInit,
          lblEndInit,
          lblLabelExclInit,
          lblExcludeInit,
          lblPriorityInit,
          typeSectionMarkup,
          extractionModeMarkup
        })}
        ${renderRoleAndSuffixSection({ fieldKey, roleInitial, suffixInitial })}
        <div id="add-field-error-${fieldKey}" style="display:none; color:#b00020; font-weight:bold; font-size:12px; margin-bottom:6px;"></div>
        <div class="inline-actions" style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px;">
          <button id="inline-cancel-${fieldKey}" style="padding:6px 10px;">${t('buttonCancel')}</button>
          <button id="inline-submit-${fieldKey}" style="padding:6px 10px; background:#007acc; color:#fff; border: none; border-radius: 4px;">${t('buttonValidate')}</button>
        </div>
      </div>`;
}