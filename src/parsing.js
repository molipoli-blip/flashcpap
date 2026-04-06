// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// src/parsing.js
import { logDebug, logError, logFlow, logWarn } from './debug-logger.js';
import { getProviderConfig } from './domain/provider-rules.js';

const LABEL_BOUNDARY_WORD_CHARS = 'A-Za-z0-9_À-ÖØ-öø-ÿĀ-ſƀ-ɏ';

function getLabelBoundaryParts() {
  return {
    before: `(?:^|[^${LABEL_BOUNDARY_WORD_CHARS}])`,
    after: `(?:[^${LABEL_BOUNDARY_WORD_CHARS}]|$)`,
    flags: 'i'
  };
}

function buildLabelBoundaryRegex(lbl) {
  const { before, after, flags } = getLabelBoundaryParts();
  return new RegExp(`${before}${esc(lbl)}${after}`, flags);
}

function buildInlineLabelValueRegex(lbl, valuePattern, separator = '(?:\\s*[:=])?') {
  const { before, flags } = getLabelBoundaryParts();
  return new RegExp(`${before}${esc(lbl)}${separator}\\s*${valuePattern}`, flags);
}

function logParsingStrategy(message, meta) {
  logFlow('PARSE', message, meta);
}

function normalizeLabelDefs(labelDefs) {
  if (!Array.isArray(labelDefs)) return [];
  return labelDefs.filter(label => label && typeof label === 'object' && typeof label.text === 'string' && label.text.trim().length > 0);
}

function getLabelExtractionMode(labelDefs = []) {
  const firstLabel = normalizeLabelDefs(labelDefs)[0] || null;
  if (!firstLabel) {
    return {
      mode: 'no-label',
      labelText: '',
      nextLineRange: null,
      hasSplitSeparators: false
    };
  }

  return {
    mode: firstLabel.requireNextLine ? 'nextline' : (firstLabel.requireInline ? 'inline' : 'auto'),
    labelText: String(firstLabel.text || ''),
    nextLineRange: Array.isArray(firstLabel.nextLineRange) ? firstLabel.nextLineRange : null,
    hasSplitSeparators: Array.isArray(firstLabel.splitSeparators) && firstLabel.splitSeparators.length > 0
  };
}

// util - escape special regex characters
function esc(s) {
  return s.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Applique les séparateurs de parsing configurés pour diviser le texte
 * @param {string} text - Texte brut à traiter
 * @param {Array<string>} separators - Liste de séparateurs (mots, caractères, patterns)
 * @returns {string} Texte avec sauts de ligne insérés aux séparateurs
 */
export function applySplitSeparators(text, separators) {
  if (!separators || separators.length === 0) return text;
  
  logDebug('PARSE', 'Application split separators demarree', {
    inputLength: text.length,
    separatorCount: separators.length
  });
  let result = text;
  
  for (const sep of separators) {
    if (!sep) continue;
    
    // Échapper les caractères spéciaux regex
    const escapedSep = esc(sep.trim());
    
    // Remplacer chaque occurrence du séparateur par séparateur + saut de ligne
    // Mais seulement si pas déjà suivi d'un saut de ligne ou du marqueur
    const pattern = new RegExp(`(${escapedSep})(?!\\s*(?:✂|\\n))`, 'gi');
    const matchCount = (result.match(pattern) || []).length;
    if (matchCount > 0) {
        logDebug('PARSE', 'Separateur detecte pour split', { separatorLength: sep.length, matchCount });
        // ✅ AJOUT DU MARQUEUR VISUEL " ✂ " (Ciseaux)
        result = result.replace(pattern, '$1 ✂ \n');
    }
  }
  
  logDebug('PARSE', 'Application split separators terminee', { outputLength: result.length });
  return result;
}

// Build a whole-word style pattern around a label to avoid substring matches.
// Uses a stable Latin-friendly boundary class instead of engine-dependent Unicode property escapes.
function labelBoundaryPattern(lbl) {
  return buildLabelBoundaryRegex(lbl);
}

/**
 * Format time value according to timeFormat configuration
 * @param {string[]} values - Extracted numeric values
 * @param {string} rawFormat - Format brut (ex: 'H M', 'DD MM YYYY')
 * @param {string} displayFormat - Format affiché (ex: 'HhMMm', 'DD/MM/YYYY')
 * @returns {string} Formatted time string
 */
function formatTimeValue(values, rawFormat, displayFormat) {
  logDebug('TIME_FORMAT', 'formatTimeValue appele', {
    valueCount: values?.length || 0,
    hasRawFormat: !!rawFormat,
    hasDisplayFormat: !!displayFormat
  });
  
  if (!values || !values.length || !rawFormat || !displayFormat) {
    logDebug('TIME_FORMAT', 'Parametres incomplets, retour joint');
    return values.join(' ');
  }

  const parts = rawFormat.split(' ');
  const tokens = {};
  parts.forEach((part, idx) => {
    if (values[idx] !== undefined) tokens[part] = values[idx];
  });
  
  logDebug('TIME_FORMAT', 'Tokens temporels parses', { tokenCount: Object.keys(tokens).length });

  // Gestion du format spécial "h (convertir)" pour conversion en heures décimales
  if (displayFormat === 'h (convertir)') {
    const decimalHours = timeToDecimalHours(values, rawFormat);
    if (decimalHours !== null) {
      const result = decimalHours.toFixed(2);
      logDebug('TIME_FORMAT', 'Conversion heures decimales effectuee');
      return result;
    }
  }

  // Gestion du format spécial "min (convertir)" pour conversion en minutes décimales
  if (displayFormat === 'min (convertir)') {
    const decimalMinutes = timeToDecimalMinutes(values, rawFormat);
    if (decimalMinutes !== null) {
      const result = Math.round(decimalMinutes).toString();
      logDebug('TIME_FORMAT', 'Conversion minutes decimales effectuee');
      return result;
    }
  }

  let result = displayFormat;
  
  // Replace tokens in display format
  if (tokens.H !== undefined) result = result.replace(/H+/g, tokens.H);
  if (tokens.M !== undefined) result = result.replace(/M+/g, (match) => tokens.M.padStart(match.length, '0'));
  if (tokens.S !== undefined) result = result.replace(/S+/g, (match) => tokens.S.padStart(match.length, '0'));
  if (tokens.DD !== undefined) result = result.replace(/DD/g, tokens.DD.padStart(2, '0'));
  if (tokens.MM !== undefined) result = result.replace(/MM/g, tokens.MM.padStart(2, '0'));
  if (tokens.YYYY !== undefined) result = result.replace(/YYYY/g, tokens.YYYY);
  
  logDebug('TIME_FORMAT', 'Format temporel final produit', { outputLength: result.length });
  
  // Handle literal text (h, m, s, /, -, :, etc.)
  return result;
}

/**
 * Convert time to decimal hours for interpretation (observance, etc.)
 * @param {string[]} values - Extracted values
 * @param {string} rawFormat - Format brut (ex: 'H M')
 * @returns {number|null} Decimal hours or null
 */
function timeToDecimalHours(values, rawFormat) {
  if (!values || !rawFormat) return null;
  
  const parts = rawFormat.split(' ');
  const tokens = {};
  parts.forEach((part, idx) => {
    if (values[idx] !== undefined) tokens[part] = parseFloat(values[idx].replace(',', '.'));
  });

  if (tokens.H !== undefined && tokens.M !== undefined && tokens.S !== undefined) {
    return tokens.H + (tokens.M / 60) + (tokens.S / 3600);
  }
  if (tokens.H !== undefined && tokens.M !== undefined) {
    return tokens.H + (tokens.M / 60);
  }
  if (tokens.H !== undefined) {
    return tokens.H;
  }
  return null;
}

/**
 * Convert time to decimal minutes
 * @param {string[]} values - Extracted values
 * @param {string} rawFormat - Format brut (ex: 'H M')
 * @returns {number|null} Decimal minutes or null
 */
function timeToDecimalMinutes(values, rawFormat) {
  if (!values || !rawFormat) return null;
  
  const parts = rawFormat.split(' ');
  const tokens = {};
  parts.forEach((part, idx) => {
    if (values[idx] !== undefined) tokens[part] = parseFloat(values[idx].replace(',', '.'));
  });

  if (tokens.H !== undefined && tokens.M !== undefined && tokens.S !== undefined) {
    return (tokens.H * 60) + tokens.M + (tokens.S / 60);
  }
  if (tokens.H !== undefined && tokens.M !== undefined) {
    return (tokens.H * 60) + tokens.M;
  }
  if (tokens.H !== undefined) {
    return tokens.H * 60;
  }
  if (tokens.M !== undefined) {
    return tokens.M;
  }
  return null;
}

function extractTimeMeta(text, labelDefs, { mask, connectors, size, timeFormat } = {}) {
  logDebug('TIME_META', 'extractTimeMeta appele', {
    labelCount: labelDefs?.length || 0,
    hasMask: !!mask,
    connectorCount: connectors?.length || 0,
    hasTimeFormat: !!(timeFormat && timeFormat.raw && timeFormat.display)
  });
  
  // Extract raw values using tuple logic
  const tupleResult = extractTupleMeta(text, labelDefs, { mask, connectors, size });
  logDebug('TIME_META', 'extractTupleMeta termine', { hasValue: !!tupleResult?.value, hasMatch: !!tupleResult?.match });
  
  if (!tupleResult || !tupleResult.value || tupleResult.value === '?') {
    logDebug('TIME_META', 'Aucune valeur temporelle trouvee');
    return { value: '?', match: null };
  }

  let formattedValue = tupleResult.value;
  
  // If timeFormat specified, format the output
  if (timeFormat && timeFormat.raw && timeFormat.display) {
    const values = tupleResult.value.split(/\s+/).map(v => v.replace(/[^\d.]/g, ''));
    formattedValue = formatTimeValue(values, timeFormat.raw, timeFormat.display);
    logDebug('TIME_META', 'Valeur temporelle formatee', { valueCount: values.length, outputLength: formattedValue.length });
  } else {
    logDebug('TIME_META', 'Aucun timeFormat, valeur brute conservee');
  }

  return {
    value: formattedValue,
    match: tupleResult.match
  };
}

// New: meta-aware extractors to capture positions for highlighting
export function extractSmartMeta(text, labelDefs, fieldUnit = '') {
  const effectiveLabelDefs = normalizeLabelDefs(labelDefs);
  if (!effectiveLabelDefs.length) return { value: '?', match: null };

  // Appliquer les séparateurs personnalisés si configurés
  let processedText = text;
  for (const labelDef of effectiveLabelDefs) {
    if (labelDef.splitSeparators && labelDef.splitSeparators.length > 0) {
      logDebug('PARSE', 'Separateurs trouves pour extractSmartMeta', {
        labelLength: String(labelDef.text || '').length,
        separatorCount: labelDef.splitSeparators.length
      });
      const beforeLen = processedText.length;
      processedText = applySplitSeparators(processedText, labelDef.splitSeparators);
      logDebug('PARSE', 'Texte retraite pour extractSmartMeta', { beforeLen, afterLen: processedText.length });
      break; // Appliquer une seule fois (premier label avec séparateurs)
    }
  }

  const L = processedText.split(/\r?\n/);
  for (let { text: lbl, range, labelExcludeKeywords, requireInline, requireNextLine, nextLineRange } of effectiveLabelDefs) {
    logDebug('PARSE', 'Analyse label numeric', {
      labelLength: String(lbl).length,
      requireInline: !!requireInline,
      requireNextLine: !!requireNextLine
    });
    const start = range?.start ?? 1;
    const end = range?.end ?? L.length;
    for (let i = start - 1; i < Math.min(end, L.length); i++) {
      const line = L[i].trim();
      if (!labelBoundaryPattern(lbl).test(line)) continue;
      logDebug('PARSE', 'Label numeric trouve', { line: i + 1, labelLength: String(lbl).length, lineLength: line.length });

      if (labelExcludeKeywords && labelExcludeKeywords.length > 0) {
        const labelExcludePattern = new RegExp(labelExcludeKeywords.join('|'), 'i');
        if (labelExcludePattern.test(line)) {
            logDebug('PARSE', 'Label numeric exclu par mot-cle', { line: i + 1, keywordCount: labelExcludeKeywords.length });
            continue;
        }
      }
      const unitPattern = fieldUnit ? `\\s*(?:${esc(fieldUnit)})?` : '\\s*(?:cmH2O|mbar|hPa|L\\/min|/h|h)?';
      const numPattern = '(\\d+(?:[.,]\\d*)?)(?!\\s*h\\s*\\d)';
      
      // Si le label se termine déjà par : ou =, ne pas ajouter [:=]
      const labelEndsWithSeparator = /[:=]\s*$/.test(lbl);
      const separator = labelEndsWithSeparator ? '' : '(?:\\s*[:=])?';
      
      const inline = buildInlineLabelValueRegex(lbl, `${numPattern}${unitPattern}`, separator);
      
      const m = line.match(inline);
      logDebug('PARSE', 'Verification inline numeric', { line: i + 1, matched: !!m });
      
      // ✅ Mode requireNextLine : ignore la valeur inline, cherche dans les lignes suivantes
      if (requireNextLine) {
        // ✅ Utiliser la plage configurée ou par défaut (1 à 3)
        const startOffset = nextLineRange?.[0] || 1;
        const endOffset = nextLineRange?.[1] || 3;

        for (let j = startOffset; j <= endOffset; j++) {
          const nxt = (L[i + j] || '').trim();
          logDebug('PARSE', 'Verification ligne suivante numeric', { line: i + j + 1, lineLength: nxt.length });

          // Ignorer les lignes qui ne contiennent que le marqueur de séparation
          if (nxt === '✂' || nxt === '|') {
            logDebug('PARSE', 'Ligne separateur ignoree pour numeric', { line: i + j + 1 });
              continue;
          }
          
          const m2 = fieldUnit
            ? nxt.match(new RegExp(`${numPattern}\\s*(?:${esc(fieldUnit)})?`, 'i'))
            : nxt.match(new RegExp(numPattern, 'i'));
          if (m2) {
            logDebug('PARSE', 'Valeur numeric trouvee sur ligne suivante', { line: i + j + 1 });
            const raw = m2[1];
            return { value: raw.replace(',', '.'), match: { line: i + j + 1, raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
          }
        }
        return { value: '?', match: null };
      }
      
      // ✅ Mode requireInline : valeur DOIT être sur la ligne du label
      if (requireInline) {
        if (m) {
          const raw = m[1];
          return { value: raw.replace(',', '.'), match: { line: i + 1, raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
        }
        return { value: '?', match: null };
      }
      
      // ✅ Mode automatique : cherche d'abord inline, puis lignes suivantes
      if (m) {
        const raw = m[1];
        return { value: raw.replace(',', '.'), match: { line: i + 1, raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
      }
      
      logParsingStrategy('Mode auto numeric: recherche sur lignes suivantes', {
        labelText: lbl,
        labelLength: String(lbl).length,
        labelLine: i + 1,
        providerLineWindow: 3
      });
      for (let j = 1; j <= 3; j++) {
        const nxt = (L[i + j] || '').trim();
        logDebug('PARSE', 'Inspection ligne suivante numeric', { line: i + j + 1, lineLength: nxt.length });
        
        // Ignorer les lignes qui ne contiennent que le marqueur de séparation
        if (nxt === '✂' || nxt === '|') {
            logDebug('PARSE', 'Separateur ignore dans fallback numeric', { line: i + j + 1 });
            continue;
        }

        const m2 = fieldUnit
          ? nxt.match(new RegExp(`${numPattern}\\s*(?:${esc(fieldUnit)})?`, 'i'))
          : nxt.match(new RegExp(numPattern, 'i'));
        
        if (m2) {
          logParsingStrategy('Mode auto numeric: valeur trouvee sur ligne suivante', {
            labelText: lbl,
            labelLine: i + 1,
            valueLine: i + j + 1,
            fieldUnit: fieldUnit || ''
          });
          const raw = m2[1];
          return { value: raw.replace(',', '.'), match: { line: i + j + 1, raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
        }
      }
    }
  }
  return { value: '?', match: null };
}

export function extractTextMeta(text, labelDefs) {
  const effectiveLabelDefs = normalizeLabelDefs(labelDefs);
  if (!effectiveLabelDefs.length) return { value: '?', match: null };

  // Appliquer les séparateurs personnalisés si configurés
  let processedText = text;
  for (const labelDef of effectiveLabelDefs) {
    if (labelDef.splitSeparators && labelDef.splitSeparators.length > 0) {
      logDebug('PARSE', 'Separateurs trouves pour extractTextMeta', {
        labelLength: String(labelDef.text || '').length,
        separatorCount: labelDef.splitSeparators.length
      });
      const beforeLen = processedText.length;
      processedText = applySplitSeparators(processedText, labelDef.splitSeparators);
      logDebug('PARSE', 'Texte retraite pour extractTextMeta', { beforeLen, afterLen: processedText.length });
      break; // Appliquer une seule fois (premier label avec séparateurs)
    }
  }

  const L = processedText.split(/\r?\n/);
  for (let { text: lbl, range, excludeKeywords, priorityKeywords, labelExcludeKeywords, requireInline, requireNextLine, nextLineRange } of effectiveLabelDefs) {
    const start = range?.start ?? 1;
    const end = range?.end ?? L.length;
    for (let i = start - 1; i < Math.min(end, L.length); i++) {
      const line = L[i].trim();
      if (!labelBoundaryPattern(lbl).test(line)) continue;
      if (labelExcludeKeywords && labelExcludeKeywords.length > 0) {
        const labelExcludePattern = new RegExp(labelExcludeKeywords.join('|'), 'i');
        if (labelExcludePattern.test(line)) continue;
      }
      // Si le label se termine déjà par : ou =, ne pas ajouter [:=]
      const labelEndsWithSeparator = /[:=]\s*$/.test(lbl);
      // Allow optional separator (colon/equals) or just whitespace
      const separator = labelEndsWithSeparator ? '' : '(?:\\s*[:=])?';

      const inline = buildInlineLabelValueRegex(lbl, '([^;]+)', separator);

      logDebug('PARSE', 'Regex texte construite', { labelLength: String(lbl).length, hasInlineRegex: !!inline });

      const m = line.match(inline);
      
      // ✅ Mode requireNextLine : ignore la valeur inline, cherche dans les lignes suivantes
      if (requireNextLine) {
        const candidates = [];
        
        // ✅ Utiliser la plage configurée ou par défaut (1 à 5)
        const startOffset = nextLineRange?.[0] || 1;
        const endOffset = nextLineRange?.[1] || 5;

        for (let j = startOffset; j <= endOffset; j++) {
          const nxt = (L[i + j] || '').trim().replace(/\s*✂\s*/g, '').trim();
          if (!nxt) continue;
          
          if (/\d{2}\/\d{2}\/\d{4}|depuis le|du \d/.test(nxt)) continue;
          if (excludeKeywords && excludeKeywords.length > 0) {
            const excludePattern = new RegExp(excludeKeywords.join('|'), 'i');
            if (excludePattern.test(nxt)) continue;
          }
          candidates.push({ line: i + j + 1, raw: nxt });
        }
        if (priorityKeywords && priorityKeywords.length > 0) {
          const priorityPattern = new RegExp(priorityKeywords.join('|'), 'i');
          for (const c of candidates) if (priorityPattern.test(c.raw)) return { value: c.raw, match: { line: c.line, raw: c.raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
        }
        for (const c of candidates) {
          if (c.raw.length > 3 && !/^(de|du|le|la|les|un|une|des)$/i.test(c.raw)) return { value: c.raw, match: { line: c.line, raw: c.raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
        }
        return { value: '?', match: null };
      }
      
      // ✅ Mode requireInline : valeur DOIT être sur la ligne du label
      if (requireInline) {
        if (m) {
          const raw = m[1].replace(/\s*✂\s*/g, '').trim();
          return { value: raw || '?', match: raw ? { line: i + 1, raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } : null };
        }
        return { value: '?', match: null };
      }
      
      // ✅ Mode automatique : cherche d'abord inline, puis lignes suivantes
      if (m) {
        const raw = m[1].replace(/\s*✂\s*/g, '').trim();
        if (raw.length > 0) {
          return { value: raw, match: { line: i + 1, raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
        }
      }
      
      logParsingStrategy('Mode auto texte: recherche sur lignes suivantes', {
        labelText: lbl,
        labelLength: String(lbl).length,
        labelLine: i + 1,
        providerLineWindow: 5
      });
      const candidates = [];
      for (let j = 1; j <= 5; j++) {
        const nxt = (L[i + j] || '').trim().replace(/\s*✂\s*/g, '').trim();
        if (!nxt) continue;
        if (/\d{2}\/\d{2}\/\d{4}|depuis le|du \d/.test(nxt)) continue;
        if (excludeKeywords && excludeKeywords.length > 0) {
          const excludePattern = new RegExp(excludeKeywords.join('|'), 'i');
          if (excludePattern.test(nxt)) continue;
        }
        candidates.push({ line: i + j + 1, raw: nxt });
      }
      if (priorityKeywords && priorityKeywords.length > 0) {
        const priorityPattern = new RegExp(priorityKeywords.join('|'), 'i');
        for (const c of candidates) {
          if (priorityPattern.test(c.raw)) {
            logParsingStrategy('Mode auto texte: candidat prioritaire trouve sur ligne suivante', {
              labelText: lbl,
              labelLine: i + 1,
              valueLine: c.line,
              candidateLength: c.raw.length
            });
            return { value: c.raw, match: { line: c.line, raw: c.raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
          }
        }
      }
      for (const c of candidates) {
        if (c.raw.length > 3 && !/^(de|du|le|la|les|un|une|des)$/i.test(c.raw)) {
          logParsingStrategy('Mode auto texte: valeur trouvee sur ligne suivante', {
            labelText: lbl,
            labelLine: i + 1,
            valueLine: c.line,
            candidateLength: c.raw.length
          });
          return { value: c.raw, match: { line: c.line, raw: c.raw, labelText: lbl, labelLine: i + 1, labelRange: { start, end } } };
        }
      }
    }
  }
  return { value: '?', match: null };
}

export function parseTextMeta(text, prest, settings) {
  const cfg = getProviderConfig(settings, prest) || { fields: {} };
  const data = {};
  const matches = [];
  logFlow('PARSE', 'parseTextMeta demarre', { provider: prest, fieldCount: Object.keys(cfg.fields || {}).length });
  for (let [f, def] of Object.entries(cfg.fields)) {
    const fname = (f || '').toLowerCase();
    const role = (def.role || f || '').toLowerCase();
    const strategy = getLabelExtractionMode(def.labels);
    logDebug('PARSE', 'Traitement champ', { field: f, type: def.type, role, labelCount: def.labels?.length || 0 });
    logParsingStrategy('Strategie champ', {
      field: f,
      type: def.type,
      role,
      mode: strategy.mode,
      labelText: strategy.labelText,
      nextLineRange: strategy.nextLineRange,
      hasSplitSeparators: strategy.hasSplitSeparators,
      tupleSize: def.tupleExtraction?.size || null,
      tupleMask: def.tupleExtraction?.mask || null,
      hasTimeFormat: !!def.timeFormat
    });
    
    if (def.type === 'time') {
      logDebug('PARSE', 'Champ de type time', { field: f });
      const tupleExt = def.tupleExtraction || {};
      const { value, match } = extractTimeMeta(text, def.labels, { 
        mask: tupleExt.mask || def.mask, 
        connectors: tupleExt.connectors,
        size: tupleExt.size,
        timeFormat: def.timeFormat
      });
      data[f] = value;
      logDebug('PARSE', 'Resultat time obtenu', { field: f, hasValue: value !== '?', hasMatch: !!match });
      if (match) {
        const m = { field: f, role: (def.role || f).toLowerCase(), label: def.label || f, type: 'time', unit: def.unit || '', ...match };
        matches.push(m);
        logDebug('PARSE', 'Match time ajoute', { field: f, line: m.line, labelLine: m.labelLine });
      }
      if (!match) {
        logParsingStrategy('Aucune valeur trouvee pour champ', { field: f, mode: strategy.mode, type: 'time' });
      }
    } else if (def.type === 'tuple' || role === 'obs' || fname === 'obs' || (def.type === 'numeric' && (def.tupleExtraction?.size || 0) >= 2)) {
      logDebug('PARSE', 'Champ de type tuple', { field: f });
      const tupleExt = def.tupleExtraction || {};
      const { value, match } = extractTupleMeta(text, def.labels, { mask: tupleExt.mask || def.mask, connectors: tupleExt.connectors, size: tupleExt.size });
      data[f] = value;
      if (match) {
        const m = { field: f, role: (def.role || f).toLowerCase(), label: def.label || f, type: 'tuple', unit: def.unit || '', ...match };
        matches.push(m);
        logDebug('PARSE', 'Match tuple ajoute', { field: f, line: m.line, labelLine: m.labelLine });
      }
      logDebug('PARSE', 'Resultat tuple obtenu', { field: f, hasValue: data[f] !== '?', hasMatch: !!match });
      if (!match) {
        logParsingStrategy('Aucune valeur trouvee pour champ', { field: f, mode: strategy.mode, type: 'tuple' });
      }
    } else if (def.type === 'numeric') {
      logDebug('PARSE', 'Champ de type numeric', { field: f });
      
      // ✅ Apply separators locally for debug visibility
      let effectiveText = text;
      if (def.labels) {
        for (const lbl of def.labels) {
          if (lbl.splitSeparators && lbl.splitSeparators.length > 0) {
             effectiveText = applySplitSeparators(effectiveText, lbl.splitSeparators);
             break;
          }
        }
      }

      logDebug('PARSE', 'Appel extractSmartMeta', { field: f, labelCount: def.labels?.length || 0 });
      
      // 🔍 NOUVEAU : Afficher les lignes autour du label pour debug
      if (def.labels && def.labels.length > 0) {
        const labelText = def.labels[0].text;
        const lines = effectiveText.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(labelText.toLowerCase().substring(0, 10))) {
            logDebug('PARSE', 'Contexte label numeric localise', { field: f, aroundLine: i + 1 });
            break;
          }
        }
      }
      
      const { value, match } = extractSmartMeta(effectiveText, def.labels, def.unit || '');
      data[f] = value;
      logDebug('PARSE', 'Resultat numeric obtenu', { field: f, hasValue: value !== '?', hasMatch: !!match });
      if (match) {
        const m = { field: f, role: (def.role || f).toLowerCase(), label: def.label || f, type: def.type, unit: def.unit || '', ...match };
        matches.push(m);
        logDebug('PARSE', 'Match numeric ajoute', { field: f, line: m.line, labelLine: m.labelLine });
      }
      if (!match) {
        logParsingStrategy('Aucune valeur trouvee pour champ', { field: f, mode: strategy.mode, type: 'numeric' });
      }
    } else {
      logDebug('PARSE', 'Champ de type text', { field: f });
      
      // ✅ Apply separators locally for debug visibility
      let effectiveText = text;
      if (def.labels) {
        for (const lbl of def.labels) {
          if (lbl.splitSeparators && lbl.splitSeparators.length > 0) {
             effectiveText = applySplitSeparators(effectiveText, lbl.splitSeparators);
             break;
          }
        }
      }

      const { value, match } = extractTextMeta(effectiveText, def.labels);
      data[f] = value;
      logDebug('PARSE', 'Resultat texte obtenu', { field: f, hasValue: value !== '?', hasMatch: !!match });
      if (match) {
        const m = { field: f, role: (def.role || f).toLowerCase(), label: def.label || f, type: def.type, unit: def.unit || '', ...match };
        matches.push(m);
        logDebug('PARSE', 'Match texte ajoute', { field: f, line: m.line, labelLine: m.labelLine });
      }
      if (!match) {
        logParsingStrategy('Aucune valeur trouvee pour champ', { field: f, mode: strategy.mode, type: def.type || 'text' });
      }
    }
  }
  // Déduplication par labelLine : si plusieurs champs ont matché le même mot-clé/label,
  // le champ qui extrait le moins de nombres (tuples) perd face à celui qui en extrait plus.
  // Règle : 1 tuple < 2 tuples (même mot-clé) — ex: pression1=4 (1 valeur) perd contre
  // pression2=4-12 (2 valeurs) car un tuple avec plus de composantes est prioritaire.
  const matchesByLabelLine = new Map();
  for (const m of matches) {
    const key = m.labelLine;
    if (!matchesByLabelLine.has(key)) matchesByLabelLine.set(key, []);
    matchesByLabelLine.get(key).push(m);
  }
  for (const [, group] of matchesByLabelLine) {
    if (group.length < 2) continue;
    const sizedGroup = group.map(m => ({
      m,
      n: (String(m.raw || '').match(/\d+(?:[.,]\d+)?/g) || []).length
    }));
    const maxN = Math.max(...sizedGroup.map(g => g.n));
    if (maxN < 2) continue; // personne n'a extrait un range, pas de conflit
    for (const { m, n } of sizedGroup) {
      if (n < maxN) {
        logParsingStrategy('Deduplication labelLine: champ supprime car extrait moins de valeurs', {
          field: m.field,
          extractedN: n,
          winnerN: maxN,
          labelLine: m.labelLine
        });
        data[m.field] = '?';
        const idx = matches.indexOf(m);
        if (idx !== -1) matches.splice(idx, 1);
      }
    }
  }

  logFlow('PARSE', 'parseTextMeta termine', { matchCount: matches.length, fieldCount: Object.keys(data).length });
  return { data, matches };
}

// --- Tuple extraction helpers ---
function tuplePreprocess(s) {
  const res = s
    // 4h26 / 4:26 -> "4 26"
    .replace(/\b(\d{1,3})\s*[h:]\s*(\d{1,2})\b/gi, '$1 $2')
    // 4p55 -> "4 55" (allow letter p between numbers)
    .replace(/\b(\d{1,3})p(\d{1,3})\b/gi, '$1 $2');
  
  if (s !== res) {
    logDebug('PARSE', 'tuplePreprocess modifie la ligne', { beforeLength: s.length, afterLength: res.length });
  }
  return res;
}

function extractTupleMeta(text, labelDefs, { mask, connectors, size } = {}) {
  const effectiveLabelDefs = normalizeLabelDefs(labelDefs);
  if (!effectiveLabelDefs.length) return { value: '?', match: null };

  // ✅ Apply separators locally for tuple extraction
  let processedText = text;
  for (const labelDef of effectiveLabelDefs) {
    if (labelDef.splitSeparators && labelDef.splitSeparators.length > 0) {
      processedText = applySplitSeparators(processedText, labelDef.splitSeparators);
      logDebug('PARSE', 'Separateurs appliques pour extractTupleMeta', {
        labelLength: String(labelDef.text || '').length,
        separatorCount: labelDef.splitSeparators.length
      });
      break;
    }
  }

  const L = processedText.split(/\r?\n/);
  const numRe = /\d+(?:[.,]\d+)?/g;
  const configuredSize = Number.isInteger(size) && size >= 1 ? Math.min(size, 7) : null;
  const maxCollected = configuredSize || 4;
  const build = (arr) => {
    if (!arr.length) return '?';
    if (mask) {
      const parts = [];
      const tokens = mask.split(/\s+/);
      let arrIdx = 0; // index in collected array
      let xIdx = 0;   // index of X tokens (for connectors)
      tokens.forEach(token => {
        if (token === 'X') {
          if (arrIdx < arr.length) {
            parts.push(arr[arrIdx] + (connectors && connectors[xIdx] ? connectors[xIdx] : ''));
            xIdx++;
          }
          arrIdx++;
        } else if (token === '*') {
          arrIdx++; // skip this position in array
        } else {
          parts.push(token); // literal token from mask
        }
      });
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    return arr.map((v, idx) => v + (connectors && connectors[idx] ? connectors[idx] : '')).join(' ');
  };
  const buildTupleSourceRaw = (lineText, expectedCount) => {
    const raw = String(lineText || '');
    const matches = Array.from(raw.matchAll(/\d+(?:[.,]\d+)?/g));
    if (!matches.length) return '';
    const targetCount = Math.max(1, Math.min(expectedCount || matches.length, matches.length));
    const first = matches[0];
    const last = matches[targetCount - 1];
    const start = first.index ?? 0;
    let end = (last.index ?? 0) + String(last[0] || '').length;

    while (end < raw.length && /[A-Za-zÀ-ÖØ-öø-ÿ/%]/.test(raw[end])) {
      end += 1;
    }

    return raw.slice(start, end).trim();
  };
  for (let { text: lbl, range, labelExcludeKeywords, requireNextLine, requireInline, nextLineRange } of effectiveLabelDefs) {
    const start = range?.start ?? 1;
    const end = range?.end ?? L.length;
    for (let i = start - 1; i < Math.min(end, L.length); i++) {
      const rawLine = L[i].trim();
      const line = tuplePreprocess(rawLine);
      if (!labelBoundaryPattern(lbl).test(line)) continue;
      logDebug('PARSE', 'Label tuple trouve', {
        labelLength: String(lbl).length,
        line: i + 1,
        rawLineLength: rawLine.length,
        preprocessedLength: line.length
      });

      if (labelExcludeKeywords && labelExcludeKeywords.length) {
        const ex = new RegExp(labelExcludeKeywords.join('|'), 'i');
        if (ex.test(line)) {
            logDebug('PARSE', 'Label tuple exclu par mot-cle', { labelLength: String(lbl).length, keywordCount: labelExcludeKeywords.length });
            continue;
        }
      }
      const collected = [];
      let firstValueLine = -1;
      let firstValueSourceRaw = '';
      const scan = (s, lineIdx, sourceText = s) => {
        let found = false;
        const beforeCount = collected.length;
        for (const m of s.matchAll(numRe)) {
          const v = m[0].replace(',', '.');
          if (collected.length < maxCollected) {
            collected.push(v);
            found = true;
          }
        }
        if (found && firstValueLine === -1) {
          firstValueLine = lineIdx;
          firstValueSourceRaw = buildTupleSourceRaw(sourceText, collected.length - beforeCount) || String(sourceText || '').trim();
        }
      };
      
      if (!requireNextLine) {
        const lblMatch = labelBoundaryPattern(lbl).exec(line);
        const afterLabelIdx = lblMatch ? lblMatch.index + lblMatch[0].length : 0;
        scan(line.slice(afterLabelIdx), i, rawLine.slice(afterLabelIdx));
      }
      
      if (!requireInline && (requireNextLine || collected.length < 2)) {
        const startOffset = requireNextLine ? (nextLineRange?.[0] || 1) : 1;
        const endOffset = requireNextLine ? (nextLineRange?.[1] || 3) : 3;
        if (!requireNextLine) {
          logParsingStrategy('Mode auto tuple: recherche sur lignes suivantes', {
            labelText: lbl,
            labelLine: i + 1,
            collectedCount: collected.length,
            providerLineWindow: endOffset
          });
        }
        for (let j = startOffset; j <= endOffset && collected.length < maxCollected; j++) {
          const rawNxt = (L[i + j] || '').trim();
          // Ignorer les lignes qui ne contiennent que le marqueur de séparation
          if (rawNxt === '✂' || rawNxt === '|') continue;
          
          const nxt = tuplePreprocess(rawNxt);
          if (!nxt) continue;
          scan(nxt, i + j, rawNxt);
        }
      }
      const minRequired = configuredSize || (mask ? 1 : 2);
      if (collected.length >= minRequired) {
        const value = build(collected);
        // Use the line of the first found value for highlighting, fallback to label line
        const matchLine = (firstValueLine !== -1) ? firstValueLine + 1 : i + 1;
        if (firstValueLine !== -1 && firstValueLine + 1 !== i + 1) {
          logParsingStrategy(
            requireNextLine
              ? 'Mode nextline tuple: valeur trouvee sur ligne suivante'
              : 'Mode auto tuple: valeur trouvee sur ligne suivante',
            {
              labelText: lbl,
              labelLine: i + 1,
              valueLine: firstValueLine + 1,
              valueLength: value.length
            }
          );
        }
        return {
          value,
          match: {
            line: matchLine,
            raw: value,
            sourceRaw: firstValueSourceRaw || value,
            labelText: lbl,
            labelLine: i + 1,
            labelRange: { start, end }
          }
        };
      }

    }
  }
  return { value: '?', match: null };
}

// Export utility for interpretation in summary.js
export { timeToDecimalHours };
