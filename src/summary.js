// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { logDebug, logFlow, logWarn } from './debug-logger.js';
import { getProviderConfig, toProviderKey } from './domain/provider-rules.js';
import { normalizePhraseGroupId } from './shared/id.js';

function toHoursNumber(v) {
  if (v == null) return NaN;
  const s = String(v).trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/i);
  if (m) {
    const h = m[1] ? parseFloat(m[1]) : 0;
    const min = m[2] ? parseFloat(m[2]) : 0;
    return (isNaN(h) && isNaN(min)) ? NaN : (h + min / 60);
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function parseDecimalNumber(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? NaN : n;
}

function normalizeLineText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value) {
  return normalizeLineText(value).toLowerCase();
}

const DEFAULT_INTERPRETATION_TEXTS = {
  obs: { ge: 'bonne observance', lt: 'observance non satisfaisante' },
  iah: { ge: 'non efficace', lt: 'efficace' },
  fuites: { ge: 'fuites significatives', lt: 'pas de fuites' }
};

function parseOptionalFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildInterpretationConfig(settings) {
  const interpSettings = settings?.interpretation || {};
  const inputTexts = interpSettings.texts || {};

  return {
    thresholds: {
      obsHours: parseOptionalFiniteNumber(interpSettings.obsHours),
      iah: parseOptionalFiniteNumber(interpSettings.iah),
      fuites: parseOptionalFiniteNumber(interpSettings.fuites)
    },
    texts: {
      obs: {
        ge: (inputTexts.obs?.ge || '').trim() || DEFAULT_INTERPRETATION_TEXTS.obs.ge,
        lt: (inputTexts.obs?.lt || '').trim() || DEFAULT_INTERPRETATION_TEXTS.obs.lt
      },
      iah: {
        ge: (inputTexts.iah?.ge || '').trim() || DEFAULT_INTERPRETATION_TEXTS.iah.ge,
        lt: (inputTexts.iah?.lt || '').trim() || DEFAULT_INTERPRETATION_TEXTS.iah.lt
      },
      fuites: {
        ge: (inputTexts.fuites?.ge || '').trim() || DEFAULT_INTERPRETATION_TEXTS.fuites.ge,
        lt: (inputTexts.fuites?.lt || '').trim() || DEFAULT_INTERPRETATION_TEXTS.fuites.lt
      }
    }
  };
}

function getFieldInterpretation(fieldName, value, fieldDef, thresholds, texts) {
  const role = (fieldDef.role || fieldName).toLowerCase();
  if (role === 'obs') {
    if (thresholds.obsHours === null) return '';
    const h = toHoursNumber(value);
    return !isNaN(h) ? (h >= thresholds.obsHours ? (texts.obs?.ge || DEFAULT_INTERPRETATION_TEXTS.obs.ge) : (texts.obs?.lt || DEFAULT_INTERPRETATION_TEXTS.obs.lt)) : '';
  }
  if (role === 'iah') {
    if (thresholds.iah === null) return '';
    const n = parseDecimalNumber(value);
    return !isNaN(n) ? (n >= thresholds.iah ? (texts.iah?.ge || DEFAULT_INTERPRETATION_TEXTS.iah.ge) : (texts.iah?.lt || DEFAULT_INTERPRETATION_TEXTS.iah.lt)) : '';
  }
  if (role === 'fuites') {
    if (thresholds.fuites === null) return '';
    const n = parseDecimalNumber(value);
    return !isNaN(n) ? (n >= thresholds.fuites ? (texts.fuites?.ge || DEFAULT_INTERPRETATION_TEXTS.fuites.ge) : (texts.fuites?.lt || DEFAULT_INTERPRETATION_TEXTS.fuites.lt)) : '';
  }
  return '';
}

function getFieldLabel(fieldName, fieldDef) {
  return fieldDef?.label || (fieldName === fieldName.toUpperCase() ? fieldName : (fieldName.replace(/([a-z])([A-Z])/g, '$1 $2'))).replace(/^./, c => c.toUpperCase());
}

function getDerivedTimeUnit(fieldDef) {
  if (!fieldDef || fieldDef.type !== 'time') return '';
  const display = String(fieldDef?.timeFormat?.display || '').trim().toLowerCase();
  if (display === 'h (convertir)') return ' h';
  if (display === 'min (convertir)') return ' min';
  return '';
}

function getFieldUnit(value, fieldDef) {
  const unit = fieldDef?.unit ? ` ${fieldDef.unit}` : getDerivedTimeUnit(fieldDef);
  if (!unit || !value) return unit;

  const valueText = String(value).trim().toLowerCase();
  const unitText = unit.trim().toLowerCase();
  if (valueText.endsWith(unitText)) return '';
  if (unitText === 'h' && /^\d+h\s*\d+m?$/i.test(valueText)) return '';
  return unit;
}

function formatExtractedFieldLine(fieldName, value, fieldDef, includeInterpretation, thresholds, texts, hasIncompleteTuple) {
  const unit = getFieldUnit(value, fieldDef);
  const label = getFieldLabel(fieldName, fieldDef);
  let line;

  if (label.trim() === '') {
    line = `${value}${unit}`;
  } else {
    const separator = /\s$/.test(label) ? '' : ' ';
    line = `${label}${separator}${value}${unit}`;
  }

  if (hasIncompleteTuple) line += ' (?)';

  if (includeInterpretation && !hasIncompleteTuple) {
    const interpretation = getFieldInterpretation(fieldName, value, fieldDef, thresholds, texts);
    if (interpretation) line += ` (${interpretation})`;
  }

  return line;
}

function dedupeNormalizedLines(lines) {
  const deduped = [];
  const seenNorm = new Set();

  for (const line of lines) {
    const normalized = normalizeComparableText(line);
    if (!normalized) {
      deduped.push(line);
      continue;
    }
    if (seenNorm.has(normalized)) continue;
    seenNorm.add(normalized);
    deduped.push(line);
  }

  return deduped;
}

function splitManualIntoSegments(text) {
  if (!text) return [];
  const parts = [];
  const lines = String(text).split(/\r?\n/);
  const re = /([.;?!:])/;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      // Preserve blank lines as manual break segments.
      parts.push('\n');
      continue;
    }
    let buf = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      buf += ch;
      if (re.test(ch)) {
        const seg = buf.trim();
        if (seg) parts.push(seg);
        buf = '';
      }
    }
    const tail = buf.trim();
    if (tail) parts.push(tail);
  }
  return parts.filter(s => s === '\n' || String(s).trim().length > 0);
}

// Marker-based summary regeneration.
// Auto lines use <id=CONTENT//id> markers (fields: fld_*, checkboxes: cb_*).
// Active markers are preserved, inactive ones are removed, and manual text stays stable.
export function generateSummary(data, prestataire, includeInterpretation = false, includeRodap = false, customCheckboxStates = {}, settings, previousSummary = '') {
  const cfg = getProviderConfig(settings, prestataire) || { fields: {} };
  const lines = [];
  const markers = [];

  // Normalize legacy vertical-tab separators used by preview rendering.
  if (previousSummary && previousSummary.includes('\u000B')) {
    previousSummary = previousSummary.replace(/\u000B/g, '\n');
  }
  if (previousSummary && typeof previousSummary === 'string') {
    previousSummary = previousSummary
      .split(/\r?\n/)
      .filter(line => {
        const trimmed = String(line || '').trim();
        if (!trimmed.startsWith('<cb_group_') || !trimmed.includes('//cb_group_')) return true;
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex <= 1) return true;
        const markerId = trimmed.slice(1, equalsIndex);
        return /^[a-z0-9_-]+$/i.test(markerId);
      })
      .join('\n');
  }
  logFlow('SUMMARY', 'Generation resume demarree', {
    provider: prestataire,
    includeInterpretation: !!includeInterpretation,
    includeRodap: !!includeRodap,
    previousLength: previousSummary.length
  });
  const { thresholds, texts } = buildInterpretationConfig(settings);
  const fieldOrder = cfg.fieldOrder || Object.keys(cfg.fields || {});
  const siteKey = toProviderKey(prestataire);

  const customCheckboxes = settings?.customCheckboxes?.[siteKey] || [];
  const activeCheckboxes = customCheckboxes.filter(cb => customCheckboxStates[cb.id]);
  const activeCheckboxById = new Map(activeCheckboxes.map(cb => [cb.id, cb]));
  const familiesMap = {};
  activeCheckboxes.forEach(cb => {
    const fam = cb.family && cb.family.trim() ? cb.family.trim() : 'Sans famille';
    if (!familiesMap[fam]) familiesMap[fam] = [];
    familiesMap[fam].push(cb);
  });

  logDebug('SUMMARY', 'Etat initial generation', {
    fieldCount: fieldOrder.length,
    activeFamilyCount: Object.keys(familiesMap).length
  });

  const familiesList = Object.keys(familiesMap).sort();

  const orgOrderByProvider = settings?.organizationOrderByProvider || {};
  const orgOrder = (orgOrderByProvider[prestataire] && orgOrderByProvider[prestataire].length)
    ? orgOrderByProvider[prestataire]
    : [];
  logDebug('SUMMARY', 'Ordre organisation charge', {
    provider: prestataire,
    organizationCount: orgOrder.length
  });

  let fieldKeysUsed = [];
  const currentFieldLineByKey = new Map();
  let _appendedFieldsBlock = false;
  function appendExtractedFields() {
    if (_appendedFieldsBlock) {
      logWarn('SUMMARY', 'appendExtractedFields ignore car deja execute');
      return;
    }
    const block = [];
    block.push('Données de télésuivi :');
    block.push(`Prestataire : ${prestataire}`);
    let extractedCount = 0;
    for (let f of fieldOrder) {
      const v = data[f];
      if (!v || v === '?' || !cfg.fields[f]) continue;
      const fieldDef = cfg.fields[f];
      const fieldMeta = data?.__fieldMeta?.[f] || null;
      const hasIncompleteTuple = !!fieldMeta?.tupleIncomplete;

      logDebug('SUMMARY', 'Champ prepare pour le bloc extrait', {
        field: f,
        hasUnit: !!fieldDef?.unit,
        valueLength: String(v).length
      });

      const l = formatExtractedFieldLine(f, v, fieldDef, includeInterpretation, thresholds, texts, hasIncompleteTuple);
      block.push(l);
      currentFieldLineByKey.set(f, l);
      fieldKeysUsed.push(f);
      extractedCount++;
    }
    const deduped = dedupeNormalizedLines(block);

    const isCompact = settings?.compactFields?.[siteKey];
    const defaultSeparator = isCompact ? '. ' : '\n';


    const processedBlock = deduped.map(line => {
        let suffix = defaultSeparator;
        for (let [key, val] of currentFieldLineByKey) {
            if (val === line) {
                const def = cfg.fields[key];
                if (def && def.suffix !== undefined) {
                    suffix = def.suffix;
                }
                break;
            }
        }
        if (line.startsWith('Données de télésuivi :') || line.startsWith('Prestataire :')) {
             suffix = '\n';
        }
        return line + suffix;
    });

    const content = processedBlock.join('');
    markers.push({ id: 'fld_fields', text: content });
    _appendedFieldsBlock = true;
    logFlow('SUMMARY', 'Bloc champs extraits ajoute', { extractedCount });
  }

  const phraseGroupsAll = Array.isArray(settings?.checkboxPhrases?.[siteKey]) ? settings.checkboxPhrases[siteKey] : [];
  const phraseGroupsByFamily = new Map();
  phraseGroupsAll.forEach(g => {
    const fam = (g.family || '').trim() || 'Sans famille';
    if (!phraseGroupsByFamily.has(fam)) phraseGroupsByFamily.set(fam, []);
    phraseGroupsByFamily.get(fam).push(g);
  });
  logDebug('SUMMARY', 'Groupes de phrases charges', {
    groupCount: phraseGroupsAll.length,
    familyCount: phraseGroupsByFamily.size
  });

  const globalUsedIds = new Set();
  const emittedPhraseGroupIds = new Set();
  const eligiblePhraseGroups = phraseGroupsAll.map(grp => {
    if (!grp) return null;

    const orderedActive = (Array.isArray(grp.order) ? grp.order : [])
      .map(id => activeCheckboxById.get(id))
      .filter(Boolean);

    if (orderedActive.length < 2) return null;

    const storedFamily = (grp.family || '').trim();
    const fallbackFamily = orderedActive[0]?.family?.trim() || 'Sans famille';
    const anchorFamily = (storedFamily && familiesMap[storedFamily]) ? storedFamily : fallbackFamily;
    return {
      grp,
      orderedActive,
      anchorFamily,
      safeGroupId: normalizePhraseGroupId(grp.id, grp.family || anchorFamily)
    };
  }).filter(Boolean);

  const groupedCheckboxIds = new Set();
  eligiblePhraseGroups.forEach(entry => {
    entry.orderedActive.forEach(cb => groupedCheckboxIds.add(cb.id));
  });

  function appendFamily(familyName) {
    const cbs = familiesMap[familyName];
    if (!cbs || !cbs.length) return;

    const famGroups = eligiblePhraseGroups.filter(entry => entry.anchorFamily === familyName && !emittedPhraseGroupIds.has(entry.grp.id));

    famGroups.forEach(({ grp, orderedActive, safeGroupId }) => {
      const count = orderedActive.length;
      logDebug('SUMMARY', 'Evaluation groupe de phrases', {
        family: familyName,
        groupId: grp.id,
        activeCount: count,
        configuredCount: (grp.order || []).length
      });
      if (count >= 2) {
        // Mark grouped IDs as consumed to avoid duplicate individual lines.
        orderedActive.forEach(cb => globalUsedIds.add(cb.id));
        emittedPhraseGroupIds.add(grp.id);
        const prefix = grp.prefix ?? '';
        const connector = grp.connector ?? ' + ';
        const lastConnector = (grp.lastConnector ?? grp.connector ?? ' + ');
        const suffix = grp.suffix ?? '';
        const values = orderedActive.map(cb => cb.value);
        let core = '';
        if (values.length === 1) {
          core = values[0];
        } else if (values.length === 2) {
          core = `${values[0]}${lastConnector}${values[1]}`;
        } else {
          core = values.slice(0, -1).join(connector) + lastConnector + values[values.length - 1];
        }
  // Do not trim to preserve intentional spaces in prefix/suffix and connectors
  const phraseText = `${prefix}${core}${suffix}`;
        const markerId = `cb_group_${safeGroupId}`;
        markers.push({ id: markerId, text: phraseText });
        logDebug('SUMMARY', 'Phrase groupe emise', { markerId, textLength: phraseText.length });
      }
    });

    cbs.forEach(cb => {
      if (groupedCheckboxIds.has(cb.id) || globalUsedIds.has(cb.id)) return;
      markers.push({ id: `cb_${cb.id}`, text: cb.value });
    });

    logDebug('SUMMARY', 'Famille ajoutee au resume', {
      family: familyName,
      checkboxCount: cbs.length,
      groupedUsedCount: globalUsedIds.size,
      groupCount: (phraseGroupsByFamily.get(familyName) || []).length
    });
  }


  if (!orgOrder.length) {
  appendExtractedFields();
  familiesList.forEach(fam => appendFamily(fam));
  logFlow('FALLBACK', 'Resume genere sans organizationOrder', {
    provider: prestataire,
    familyCount: familiesList.length,
    fieldCount: fieldOrder.length
  });
  } else {
    orgOrder.forEach(item => {
      if (item.type === 'fields') {
        appendExtractedFields();
      } else if (item.type === 'family') {
        if (item.familyName) appendFamily(item.familyName);
        else {
          const m = item.title && item.title.startsWith('Famille:') ? item.title.split(':').slice(1).join(':').trim() : null;
            if (m) appendFamily(m);
        }
      }
    });
    const activeFamiliesSet = new Set(familiesList);
    const familiesInOrder = new Set(orgOrder.filter(i=>i.type==='family').map(i=> (i.familyName||'').trim()));
    const missingFamilies = [...activeFamiliesSet].filter(f => !familiesInOrder.has(f));
    if (missingFamilies.length) {
      logDebug('SUMMARY', 'Familles absentes de organizationOrder ajoutees en fin', { count: missingFamilies.length });
      missingFamilies.sort().forEach(fam => appendFamily(fam));
    }
    if (!_appendedFieldsBlock) {
      logDebug('SUMMARY', 'Bloc champs absent de organizationOrder, ajout en tete');
      appendExtractedFields();
    }
    logDebug('SUMMARY', 'organizationOrder applique');
  }
  const note = settings?.noteLibre?.[siteKey] || '';
  if (note.trim()) {
    const t = `\nNote libre : ${note}`;
    lines.push(t);
  }
  // RO DAP text removed; keep includeRodap for API compatibility.
  const currentIds = markers.map(m => m.id);
  const baseById = new Map(markers.map(m => [m.id, m.text]));

  // Parse previous summary into marker/manual token sequence.
  // Manual text is segmented into manual_* pseudo-markers using strong punctuation.
  const tokens = [];
  const existingContentById = new Map();
  const existingSuffixById = new Map();
  const headerOverrideByIndex = new Map();

  const freeLinesByIndex = new Map();
  const fieldOverrideByKey = new Map();
  // Base fld_fields lines used to filter duplicates.
  const baseFld = (markers.find(m => m.id === 'fld_fields')?.text) || '';
  const baseFldLines = String(baseFld).split(/\r?\n/);
  const baseFldNormSet = new Set(baseFldLines.map(s => normalizeLineText(s)).filter(Boolean));
  logDebug('SUMMARY', 'Analyse du resume precedent', {
    previousLength: previousSummary.length,
    baseFieldCount: baseFldLines.length
  });
  // Track free lines globally to avoid duplicate reinsertion.
  const globalFreeLineNormSet = new Set();
  function addFreeLineAtIndex(idx, rawLine) {
    if (rawLine == null) return;
    const t = String(rawLine);
    const trimmed = t.trim();
    if (!trimmed) return;
    // Do not treat known auto/header lines as free manual content.
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('prestataire :') || lower.startsWith("l'observance est ") || lower.startsWith('données de télésuivi')) {
      return;
    }
    const norm = normalizeLineText(t);
    if (!norm) return;
    if (baseFldNormSet.has(norm)) return;
    if (globalFreeLineNormSet.has(norm)) return;
    const arr = freeLinesByIndex.get(idx) || [];
    // Also avoid per-index duplicates.
    if (arr.some(x => normalizeLineText(x) === norm)) return;
    arr.push(t);
    freeLinesByIndex.set(idx, arr);
    globalFreeLineNormSet.add(norm);
  }
  if (previousSummary && typeof previousSummary === 'string') {
  // Accept hyphens in IDs too (group ids include dashes)
  const markerRegex = /<([a-z0-9_-]+)=(.*?)\/\/\1>/gis;
    let lastIndex = 0;
    let match;
    while ((match = markerRegex.exec(previousSummary)) !== null) {
      const preText = previousSummary.slice(lastIndex, match.index);
      if (preText && preText.trim().length > 0) {
        logDebug('SUMMARY', 'Texte libre detecte avant marker', { textLength: preText.trim().length });
        // Convert free text to manual tokens segmented by punctuation
        splitManualIntoSegments(preText).forEach(seg => tokens.push({ type: 'manual', text: seg }));
      }
      const id = match[1];
      const inner = match[2];

      if (id.startsWith('mx_')) {
        logDebug('SUMMARY', 'Suffixe manuel retrouve', { id, textLength: inner.length });
        existingSuffixById.set(id, inner);
      } else if (id.startsWith('manual_')) {
        // Filter manual blocks that contain auto markers to avoid duplicates.
        const innerTrimmed = String(inner || '').trim();
        const hasAutoMarker = /<(fld_fields|cb_group_[a-z0-9_-]+|cb_[a-z0-9_-]+)=.*?\/\/\1>/is.test(innerTrimmed);
        if (hasAutoMarker) {
          logDebug('SUMMARY', 'Marker manuel ignore car contient un marker auto', { id });
        } else {
          logDebug('SUMMARY', 'Marker manuel conserve', { id, textLength: inner.length });
          tokens.push({ type: 'marker', id, inner });
          if (!existingContentById.has(id)) existingContentById.set(id, inner);
        }
      } else {
        logDebug('SUMMARY', 'Marker precedent retrouve', { id, textLength: inner.length });
        tokens.push({ type: 'marker', id, inner });
        if (!existingContentById.has(id)) existingContentById.set(id, inner);
      }
      lastIndex = markerRegex.lastIndex;
    }
    const tail = previousSummary.slice(lastIndex);
    if (tail && tail.trim().length > 0) {
      logDebug('SUMMARY', 'Texte libre detecte en fin de resume precedent', { textLength: tail.trim().length });
      splitManualIntoSegments(tail).forEach(seg => tokens.push({ type: 'manual', text: seg }));
    }

    logDebug('SUMMARY', 'Analyse du resume precedent terminee', {
      tokenCount: tokens.length,
      suffixCount: existingSuffixById.size
    });
  }

  // Derive suffixes from previous base markers when mx_* markers are missing.
  const splitAtLastPunct = (s) => {
    if (!s || typeof s !== 'string') return { base: s || '', suffix: '' };
    const chars = ['.', ';', '?', '!', ':'];
    for (let i = s.length - 1; i >= 0; i--) {
      const ch = s[i];
      if (chars.includes(ch)) {
        const base = s.slice(0, i + 1);
        const suffix = s.slice(i + 1).trim();
        if (suffix) return { base, suffix };
        break;
      }
    }
    return { base: s, suffix: '' };
  };

  // For fld_fields, compute per-field suffixes using robust prefix comparison.
  let prevFld = existingContentById.get('fld_fields');
  // Sanitize previous fld_fields by collapsing repeated header/provider/observance patterns.
  if (prevFld) {
    try {
      // Normalize any remaining vertical-tab separators.
      prevFld = String(prevFld).replace(/\u000B/g,'\n');
      const rawLines = String(prevFld).split(/\r?\n/);
      const cleaned = [];
      const norm = normalizeComparableText;
      let headerSeen = false;
      let prestataireSeen = false;
      let observanceSeen = false;
      // Keep the first canonical header lines; later passes handle remaining duplicates.
      for (let i=0;i<rawLines.length;i++) {
        const ln = rawLines[i];
        const n = norm(ln);
        if (n.startsWith('données de télésuivi')) {
          if (headerSeen) { continue; } else { headerSeen = true; }
        }
        if (n.startsWith('prestataire :')) {
          if (prestataireSeen) {
            // Skip repeated provider headers before an observance line.
            continue;
          } else {
            prestataireSeen = true;
          }
        }
        if (n.startsWith("l'observance est ")) {
          if (observanceSeen) {
            continue;
          } else {
            observanceSeen = true;
          }
        }
        cleaned.push(ln);
      }
      // Collapse repeated provider/blank/observance triplets.
      function collapsePattern(lines) {
        const out = [];
        let i=0;
        while (i<lines.length) {
          const a = norm(lines[i]);
          const b = norm(lines[i+1]||'');
            const c = norm(lines[i+2]||'');
          if (a.startsWith('prestataire :') && (b==='') && c.startsWith("l'observance est ")) {
            out.push(lines[i]);
            out.push(lines[i+1]);
            out.push(lines[i+2]);
            let j = i+3;
            while (true) {
              const a2 = norm(lines[j]);
              const b2 = norm(lines[j+1]||'');
              const c2 = norm(lines[j+2]||'');
              if (a2.startsWith('prestataire :') && (b2==='') && c2.startsWith("l'observance est ")) {
                j += 3;
              } else break;
            }
            i = j;
            continue;
          }
          out.push(lines[i]);
          i++;
        }
        return out;
      }
      const collapsed = collapsePattern(cleaned);
      // Final strict pass: remove remaining dispersed observance duplicates.
      const finalOnce = [];
      const seenLineType = { header:false, prest:false, obs:false };
      collapsed.forEach(l => {
        const n = norm(l);
        if (n.startsWith('données de télésuivi')) { if (seenLineType.header) return; seenLineType.header = true; }
        else if (n.startsWith('prestataire :')) { if (seenLineType.prest) return; seenLineType.prest = true; }
        else if (n.startsWith("l'observance est ")) { if (seenLineType.obs) return; seenLineType.obs = true; }
        finalOnce.push(l);
      });
      // Log when multiple observance lines required aggressive cleanup.
      const obsCountOriginal = rawLines.filter(l=>norm(l).startsWith("l'observance est ")).length;
      if (obsCountOriginal > 1) {
        logWarn('SUMMARY', 'Reduction agressive du bloc fld_fields', { observanceCount: obsCountOriginal });
      }
      prevFld = finalOnce.join('\n');
      existingContentById.set('fld_fields', prevFld);
      logDebug('SUMMARY', 'fld_fields precedent nettoye', { before: rawLines.length, after: finalOnce.length });
    } catch(e) {
      logWarn('SUMMARY', 'Erreur sanitation fld_fields', e);
    }
  }
  if (prevFld) {
    const linesPrev = String(prevFld).split(/\r?\n/);
    const baseIndexOffset = 2;
    // Capture potential user header overrides.
    try {
      const currentFldBase = (markers.find(m => m.id === 'fld_fields')?.text) || '';
      const currBaseLines = currentFldBase.split(/\r?\n/);
      [0,1].forEach(i => {
        if (linesPrev[i] && currBaseLines[i] && linesPrev[i] !== currBaseLines[i]) {
          headerOverrideByIndex.set(i, linesPrev[i]);
          logDebug('SUMMARY', 'Override header capture', { headerIndex: i });
        }
      });
    } catch {}
    // Prepare interpretation text set for cleanup checks.
    const allInterpTexts = new Set();
    if (texts) {
      Object.values(texts).forEach(t => {
        if (t.ge) allInterpTexts.add(t.ge.trim().toLowerCase());
        if (t.lt) allInterpTexts.add(t.lt.trim().toLowerCase());
      });
    }
    logDebug('SUMMARY', 'Textes interpretation connus charges', { count: allInterpTexts.size });

    // Build regex for robust interpretation stripping.
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const interpPatterns = Array.from(allInterpTexts).map(t => escapeRegExp(t)).join('|');
    const interpRegex = interpPatterns ? new RegExp(`\\s*\\(\\s*(?:${interpPatterns})\\s*\\)\\s*$`, 'i') : null;

    // Skip index-based override mapping if structure is compact/broken.
    if (linesPrev.length < fieldKeysUsed.length + baseIndexOffset) {
      logFlow('SUMMARY', 'Structure mismatch detecte, preservation des lignes ignoree', {
        previousLines: linesPrev.length,
        expectedMinimum: fieldKeysUsed.length + baseIndexOffset
      });
    } else {
      fieldKeysUsed.forEach((key, i) => {
        const idx = baseIndexOffset + i;
        const prevLine = linesPrev[idx] || '';
        const currLine = currentFieldLineByKey.get(key) || '';

        if (!currLine) return;
        if (!prevLine.trim()) return;

        // Strip known interpretation suffixes.
        const stripInterp = (line) => {
          let s = String(line || '');
          // Remove legacy XML-like tags if present.
          s = s.replace(/<i_[a-zA-Z0-9_]+>.*?<\/i_[a-zA-Z0-9_]+>/g, '');

          // Also remove plain-text interpretation as a fallback.
          if (interpRegex) {
            // Match interpretation at end, allowing optional punctuation.
            const match = s.match(new RegExp(`(\\s*\\(\\s*(?:${interpPatterns})\\s*\\)\\s*[.,;]?)\\s*$`, 'i'));
            if (match) {
              s = s.slice(0, match.index).trim() + (match[0].match(/[.,;]$/) ? match[0].match(/[.,;]$/)[0] : '');
            }
          }
          return s.trim();
        };

        const prevClean = stripInterp(prevLine);
        const currClean = stripInterp(currLine);
        const norm = normalizeComparableText;

        if (norm(prevClean) === norm(currClean)) {
          return;
        }

        // Core mismatch: preserve user content and re-apply interpretation policy.

        let newLine = prevClean;

        if (includeInterpretation) {
            // Interpretation ON: extract interpretation from current system line.
            const tagMatch = currLine.match(/<i_([a-zA-Z0-9_]+)>(.*?)<\/i_\1>/);
            if (tagMatch) {
              newLine = newLine + ' ' + tagMatch[0];
            } else {
              // Fallback to plain-text interpretation extraction.
              let interpToAdd = '';
              const normCurr = norm(currLine);
              for (const interp of allInterpTexts) {
                  const suffix = `(${interp})`;
                  if (normCurr.includes(suffix)) {
                      interpToAdd = suffix;
                      break;
                  }
              }
              if (interpToAdd) {
                  newLine = newLine + ' ' + interpToAdd;
              }
            }
        }
        // If interpretation is OFF, keep cleaned user line only.

        if (newLine !== currLine) {
            fieldOverrideByKey.set(key, newLine);
            logDebug('SUMMARY', 'Override logique interpretation applique', { field: key });
        }
      });
    }
    // Scan indices outside mapped fields for manual free lines.
    for (let i = 0; i < linesPrev.length; i++) {
      if (i === 0 || i === 1) continue;
      const rel = i - baseIndexOffset;
      if (rel >= 0 && rel < fieldKeysUsed.length) continue;
      // Treat remaining non-empty lines as trailing manual content.
      if (linesPrev[i] && linesPrev[i].trim()) {
        addFreeLineAtIndex(i, linesPrev[i]);
      }
    }
  }

  // For cb_* markers, detect full overrides vs suffix-only extensions.
  for (const [id, inner] of existingContentById.entries()) {
    if (id.startsWith('cb_')) {
      if (id.startsWith('cb_group_')) continue;
      const mxId = `mx_${id}`;
      const base = baseById.get(id) || '';
      if (!base) continue;

      if (inner && inner !== base) {
        if (inner.startsWith(base)) {
          // Pure extension: store as suffix.
          const suf = inner.slice(base.length).trim();
          if (suf) {
            existingSuffixById.set(mxId, suf);
            logDebug('SUMMARY', 'Suffixe checkbox derive depuis contenu precedent', { id, suffixLength: suf.length });
          }
          continue;
        }
        // Internal rewrite/truncation: override full line.
        baseById.set(id, inner);
        logDebug('SUMMARY', 'Override total checkbox applique', { id, textLength: inner.length });
        continue;
      }
    }
  }

  // Compose fld_fields by reinserting preserved free lines with de-duplication.
  function composeFldWithFree(baseText) {
    let composedLines = String(baseText).split(/\r?\n/);
    const insertedFreeNormSet = new Set();
    let insertedCount = 0;
    let skippedDupCount = 0;
    const indices = Array.from(freeLinesByIndex.keys()).sort((a, b) => a - b);
    indices.forEach(idx => {
      const arr = freeLinesByIndex.get(idx) || [];
      arr.forEach((ln, j) => {
        const norm = normalizeLineText(ln);
        if (!norm) { skippedDupCount++; return; }
        if (baseFldNormSet.has(norm)) { skippedDupCount++; return; }
        if (insertedFreeNormSet.has(norm)) { skippedDupCount++; return; }
        if (composedLines.some(x => normalizeLineText(x) === norm)) { skippedDupCount++; return; }
        const insertAt = Math.min(idx + j, composedLines.length);
        composedLines.splice(insertAt, 0, ln);
        insertedFreeNormSet.add(norm);
        insertedCount++;
      });
    });
    logDebug('SUMMARY', 'Lignes libres fld_fields reinjectees', { insertedCount, skippedDupCount });
    // Apply per-field overrides after free-line reinsertion.
    if (fieldOverrideByKey.size) {
      const baseIndexOffset = 2;
      fieldKeysUsed.forEach((key, i) => {
        if (fieldOverrideByKey.has(key)) {
          const idx = baseIndexOffset + i;
            if (idx < composedLines.length) {
              logDebug('SUMMARY', 'Override champ applique au bloc compose', { field: key, index: idx });
              composedLines[idx] = fieldOverrideByKey.get(key);
            }
        }
      });
    }
    // Apply captured header overrides (indices 0 and 1).
    headerOverrideByIndex.forEach((val, idx) => {
      if (idx < composedLines.length) {
        logDebug('SUMMARY', 'Override header applique', { headerIndex: idx });
        composedLines[idx] = val;
      }
    });
    // Final strict pass: keep only one global header/provider/observance occurrence.
    const final = [];
    const seenType = { header:false, prest:false, obs:false };
    const seenNormAll = new Set();
    for (const ln of composedLines) {
      const n = normalizeComparableText(ln);
      if (!n) { final.push(ln); continue; }
      if (n.startsWith('données de télésuivi')) { if (seenType.header) continue; seenType.header = true; final.push(ln); continue; }
      if (n.startsWith('prestataire :')) { if (seenType.prest) continue; seenType.prest = true; final.push(ln); continue; }
      if (n.startsWith("l'observance est ")) { if (seenType.obs) continue; seenType.obs = true; final.push(ln); continue; }
      if (seenNormAll.has(n)) continue;
      seenNormAll.add(n);
      final.push(ln);
    }
    composedLines = final;
    return composedLines.join('\n');
  }

  // Build new marker sequence while preserving manual token relative placement.
  // 1) Analyze previous order and count autos seen before each manual token.
  const manualTokens = [];
  let autosSeen = 0;
  const activeAutoSet = new Set(currentIds.filter(id => id === 'fld_fields' || id.startsWith('cb_')));
  for (const token of tokens) {
    if (token.type === 'marker') {
      const id = token.id;
      if ((id === 'fld_fields' || id.startsWith('cb_')) && activeAutoSet.has(id)) {
        autosSeen++;
      } else if (id.startsWith('manual') || (!id.startsWith('mx_') && id !== 'fld_fields' && !id.startsWith('cb_'))) {
        // Treat non-auto markers as manual tokens for stability.
        manualTokens.push({ token: { type: 'marker', id, inner: token.inner }, autosBefore: autosSeen });
      }
    } else if (token.type === 'manual') {
      manualTokens.push({ token, autosBefore: autosSeen });
    }
  }

  const autoBaseIdsOrdered = markers.map(m => m.id).filter(id => id === 'fld_fields' || id.startsWith('cb_'));

  function renderAutoBlock(id, outArr) {
    const norm = normalizeComparableText;
    if (id === 'fld_fields') {
      const base = (baseById.get(id) || '').replace(/\u000B/g,'\n');
      const composed = composeFldWithFree(base);
      outArr.push(`<${id}=${composed}//${id}>`);
      const baseIndexOffset = 3;
      fieldKeysUsed.forEach((key, i) => {
        const mxKeyId = `mx_fld_fields_${key}`;
        const legacyIdxId = `mx_fld_fields_${baseIndexOffset + i}`;
        const suf = existingSuffixById.get(mxKeyId) || existingSuffixById.get(legacyIdxId);
        if (suf) {
          // Option C cleanup: skip suffix if it already appears in the base line
          const baseLine = currentFieldLineByKey.get(key) || '';
          if (!norm(baseLine).includes(norm(suf))) {
            logDebug('SUMMARY', 'Suffixe champ reinjecte', { field: key, suffixLength: suf.length });
            outArr.push(`<${mxKeyId}=${suf}//${mxKeyId}>`);
          } else {
            logDebug('SUMMARY', 'Suffixe champ redondant ignore', { field: key });
          }
        } else {
          logDebug('SUMMARY', 'Aucun suffixe champ a reinjecter', { field: key });
        }
      });
    } else if (id.startsWith('cb_')) {
      const base = baseById.get(id) || '';
      const mxId = `mx_${id}`;
      const suf = existingSuffixById.get(mxId);
      if (suf) {
        // Option C cleanup: skip suffix if already present in base content
        if (!norm(base).includes(norm(suf))) {
          logDebug('SUMMARY', 'Suffixe checkbox reinjecte', { id, suffixLength: suf.length });
          outArr.push(`<${id}=${base}//${id}> <${mxId}=${suf}//${mxId}>`);
        } else {
          logDebug('SUMMARY', 'Suffixe checkbox redondant ignore', { id });
          outArr.push(`<${id}=${base}//${id}>`);
        }
      } else {
        logDebug('SUMMARY', 'Aucun suffixe checkbox a reinjecter', { id });
        outArr.push(`<${id}=${base}//${id}>`);
      }
    }
  }

  // 3) Recompose by reinserting manual segments based on autosBefore.
  const outputMarkers = [];
  const totalOriginalAutos = Math.max(1, autosSeen);
  // Pre-index manual tokens by autosBefore.
  const manualsByCount = new Map();
  manualTokens.forEach(mt => {
    const key = mt.autosBefore;
    if (!manualsByCount.has(key)) manualsByCount.set(key, []);
    manualsByCount.get(key).push(mt.token);
  });

  // Add manuals that were before any auto block (autosBefore = 0).
  if (manualsByCount.has(0)) {
    manualsByCount.get(0).forEach(tok => {
      if (tok.type === 'manual') {
        // Keep placeholder and assign sequential manual_N IDs later.
        outputMarkers.push(tok.__placeholder || `__MANUAL_PLACEHOLDER__::${tok.text}`);
      } else {
        outputMarkers.push(`<${tok.id}=${tok.inner}//${tok.id}>`);
      }
    });
  }

  // Emit autos and insert manuals that followed each auto in previous flow.
  let manualSeq = 0;
  function emitManualToken(tok, arr) {
    manualSeq++;
    if (tok.type === 'manual') {
      arr.push(`<manual_${manualSeq}=${tok.text}//manual_${manualSeq}>`);
    } else if (tok.type === 'marker') {
      arr.push(`<${tok.id}=${tok.inner}//${tok.id}>`);
    }
  }
  autoBaseIdsOrdered.forEach((id, idx) => {
    renderAutoBlock(id, outputMarkers);
    const afterCount = idx + 1;
    if (manualsByCount.has(afterCount)) {
      manualsByCount.get(afterCount).forEach(tok => emitManualToken(tok, outputMarkers));
    }
  });

  // Append manuals with autosBefore beyond current auto count.
  const overflowKeys = [...manualsByCount.keys()].filter(k => k > autoBaseIdsOrdered.length);
  overflowKeys.sort((a,b)=>a-b).forEach(k => {
    manualsByCount.get(k).forEach(tok => emitManualToken(tok, outputMarkers));
  });

  const headerLines = [];
  if (lines.length) {
    if (lines[0].startsWith('Données de télésuivi')) headerLines.push(lines[0]);
    if (lines[1] && lines[1].startsWith('Prestataire')) headerLines.push(lines[1]);
  }

  const otherStatic = [];
  lines.forEach((l) => {
  if (l.startsWith('\nNote libre')) otherStatic.push(l);
  });

  const assembled = [];
  // Keep computed order (organizationOrder); do not force fld_fields first.
  assembled.push(...outputMarkers);
  if (otherStatic.length) {
    assembled.push('');
    assembled.push(...otherStatic);
  }
  const result = assembled.join('\n').replace(/\n{3,}/g,'\n\n');
  logFlow('SUMMARY', 'Resume final genere', {
    markerCount: outputMarkers.length,
    resultLength: result.length,
    manualSuffixCount: existingSuffixById.size
  });

  const reused = Array.from(existingSuffixById.keys()).length;
  logDebug('SUMMARY', 'Generation markers terminee', { totalMarkers: outputMarkers.length, suffixReused: reused });

  return result;
}
