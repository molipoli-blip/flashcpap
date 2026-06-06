// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// src/summary.js
import { logDebug, logFlow, logWarn } from './debug-logger.js';
import { getProviderConfig } from './domain/provider-rules.js';
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

// Marker-based summary regeneration:
// Chaque ligne auto (champ ou checkbox) est encapsulée sous forme <id=CONTENU//id>
// id pour un champ: fld_<fieldName>, pour une checkbox: cb_<checkboxId>
// Lors d'une nouvelle génération, si un marker existe encore et que son id est toujours pertinent, on le conserve tel quel (contenu utilisateur inclus).
// Si un id n'est plus actif (checkbox décochée par ex) on supprime son marker.
// Les nouveaux ids sont ajoutés en fin (après le reste du texte manuel existant).
// Le texte manuel hors markers est préservé exactement (y compris placement relatif).
export function generateSummary(data, prestataire, includeInterpretation = false, includeRodap = false, customCheckboxStates = {}, settings, previousSummary = '') {
  const cfg = getProviderConfig(settings, prestataire) || { fields: {} };
  const lines = []; // lignes auto générées (avant transformation en markers)
  const markers = []; // { id, text } : contiendra notamment fld_fields (bloc champs) + cb_*
  
  // Normaliser les séparateurs internes (vertical tab utilisés dans le preview) -> vrais retours ligne
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
  const defaultThresholds = { obsHours: 4, iah: 5, fuites: 24 };
  const defaultTexts = {
    obs: { ge: 'bonne observance', lt: 'observance non satisfaisante' },
    iah: { ge: 'non efficace', lt: 'efficace' },
    fuites: { ge: 'fuites significatives', lt: 'pas de fuites' }
  };
  const interpSettings = settings?.interpretation || {};
  const thresholds = {
    obsHours: Number.isFinite(Number(interpSettings.obsHours)) ? Number(interpSettings.obsHours) : defaultThresholds.obsHours,
    iah: Number.isFinite(Number(interpSettings.iah)) ? Number(interpSettings.iah) : defaultThresholds.iah,
    fuites: Number.isFinite(Number(interpSettings.fuites)) ? Number(interpSettings.fuites) : defaultThresholds.fuites
  };
  const inputTexts = interpSettings.texts || {};
  const texts = {
    obs: {
      ge: (inputTexts.obs?.ge || '').trim() || defaultTexts.obs.ge,
      lt: (inputTexts.obs?.lt || '').trim() || defaultTexts.obs.lt
    },
    iah: {
      ge: (inputTexts.iah?.ge || '').trim() || defaultTexts.iah.ge,
      lt: (inputTexts.iah?.lt || '').trim() || defaultTexts.iah.lt
    },
    fuites: {
      ge: (inputTexts.fuites?.ge || '').trim() || defaultTexts.fuites.ge,
      lt: (inputTexts.fuites?.lt || '').trim() || defaultTexts.fuites.lt
    }
  };
  const fieldOrder = cfg.fieldOrder || Object.keys(cfg.fields || {});

  // Préparer les checkboxes personnalisées (toutes, favoris inclus) sélectionnées
  const customCheckboxes = (settings.customCheckboxes?.[prestataire.toLowerCase()]) || [];
  const activeCheckboxes = customCheckboxes.filter(cb => customCheckboxStates[cb.id]);
  const activeCheckboxById = new Map(activeCheckboxes.map(cb => [cb.id, cb]));
  const familiesMap = {};
  activeCheckboxes.forEach(cb => {
    const fam = cb.family && cb.family.trim() ? cb.family.trim() : 'Sans famille';
    if (!familiesMap[fam]) familiesMap[fam] = [];
    familiesMap[fam].push(cb);
  });

  // Log initial state
  logDebug('SUMMARY', 'Etat initial generation', {
    fieldCount: fieldOrder.length,
    activeFamilyCount: Object.keys(familiesMap).length
  });

  // Liste triée des familles actives
  const familiesList = Object.keys(familiesMap).sort();

  // Récupérer organizationOrder pour ce prestataire (peut être vide -> fallback)
  const orgOrderByProvider = settings.organizationOrderByProvider || {};
  const orgOrder = (orgOrderByProvider[prestataire] && orgOrderByProvider[prestataire].length) 
    ? orgOrderByProvider[prestataire] 
    : [];
  logDebug('SUMMARY', 'Ordre organisation charge', {
    provider: prestataire,
    organizationCount: orgOrder.length
  });

  // Fonction utilitaire: ajouter bloc champs extraits
  let fieldKeysUsed = [];
  const currentFieldLineByKey = new Map();
  let _appendedFieldsBlock = false; // garde pour éviter doublons si appelé plusieurs fois
  function appendExtractedFields() {
    if (_appendedFieldsBlock) {
      logWarn('SUMMARY', 'appendExtractedFields ignore car deja execute');
      return;
    }
    const block = [];
    block.push('Données de télésuivi :');
    block.push(`Prestataire : ${prestataire}`);
    // block.push(''); // Removed newline
    let extractedCount = 0;
    for (let f of fieldOrder) {
      const v = data[f];
      if (!v || v === '?' || !cfg.fields[f]) continue;
      const fieldDef = cfg.fields[f];
      let unit = fieldDef?.unit ? ` ${fieldDef.unit}` : '';
      const fieldMeta = data?.__fieldMeta?.[f] || null;
      const hasIncompleteTuple = !!fieldMeta?.tupleIncomplete;
      
      logDebug('SUMMARY', 'Champ prepare pour le bloc extrait', {
        field: f,
        hasUnit: !!fieldDef?.unit,
        valueLength: String(v).length
      });

      // Avoid double unit if value already ends with it
      if (unit && v) {
        const vStr = String(v).trim().toLowerCase();
        const uStr = unit.trim().toLowerCase();
        if (vStr.endsWith(uStr)) {
          logDebug('SUMMARY', 'Unite supprimee car deja presente', { field: f });
          unit = '';
        } else if (uStr === 'h' && /^\d+h\s*\d+m?$/i.test(vStr)) {
           // Special case: value is like "7h30" or "7h30m" and unit is "h" -> drop unit
           logDebug('SUMMARY', 'Unite supprimee pour format horaire', { field: f });
           unit = '';
        }
      }

      const lbl = fieldDef?.label || (f === f.toUpperCase() ? f : (f.replace(/([a-z])([A-Z])/g, '$1 $2'))).replace(/^./, c => c.toUpperCase());
      
      let l;
      // Check for "invisible" label (whitespace only)
      if (lbl.trim() === '') {
          l = `${v}${unit}`;
      } else {
          // Remove automatic colon separator.
          // If label ends with whitespace, use it as is. Otherwise add a space.
          const sep = /\s$/.test(lbl) ? '' : ' ';
          l = `${lbl}${sep}${v}${unit}`;
      }

        if (hasIncompleteTuple) l += ' (?)';

      if (includeInterpretation && !hasIncompleteTuple) {
        let interp = '';
        const role = (fieldDef.role || f).toLowerCase();
        if (role === 'obs') {
          const h = toHoursNumber(v);
          if (!isNaN(h)) interp = h >= thresholds.obsHours ? (texts.obs?.ge || 'bonne observance') : (texts.obs?.lt || 'observance non satisfaisante');
        } else if (role === 'iah') {
          const n = parseFloat(String(v).replace(',', '.'));
          if (!isNaN(n)) interp = n >= thresholds.iah ? (texts.iah?.ge || 'non efficace') : (texts.iah?.lt || 'efficace');
        } else if (role === 'fuites') {
          const n = parseFloat(String(v).replace(',', '.'));
          if (!isNaN(n)) interp = n >= thresholds.fuites ? (texts.fuites?.ge || 'fuites significatives') : (texts.fuites?.lt || 'pas de fuites');
        }
        if (interp) l += ` (${interp})`;
      }
      block.push(l);
      currentFieldLineByKey.set(f, l);
      fieldKeysUsed.push(f);
      extractedCount++;
    }
    // Dédoublonnage défensif des lignes (observé: répétitions cumulatives)
    const deduped = [];
    const seenNorm = new Set();
    const norm = s => String(s).replace(/\s+/g,' ').trim().toLowerCase();
    for (const ln of block) {
      const n = norm(ln);
      if (!n) { deduped.push(ln); continue; }
      if (seenNorm.has(n)) continue; // skip répétition exacte normalisée
      seenNorm.add(n);
      deduped.push(ln);
    }
    // Check for compact mode setting
    const isCompact = settings.compactFields && settings.compactFields[prestataire.toLowerCase()];
    const defaultSeparator = isCompact ? '. ' : '\n';
    
    // Apply suffixes to fields
    const processedBlock = deduped.map(line => {
        // If line corresponds to a field, use its suffix if defined
        // We need to find which field generated this line.
        // Since deduped might have reordered or filtered, we iterate fieldOrder again? No.
        // We can check if the line matches one of the generated field lines.
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
        // Special case for headers (first 2 lines usually)
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

  // Préparer les groupes de phrases (pot câblage) par famille
  const siteKey = prestataire.toLowerCase();
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

  // Global set to track used checkboxes across all families (handles cross-family groups)
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

  // Fonction utilitaire: ajouter une famille de checkboxes avec prise en compte des groupes de phrases
  function appendFamily(familyName) {
    const cbs = familiesMap[familyName];
    if (!cbs || !cbs.length) return;

    // 1) Générer les lignes de groupes si applicables
    const famGroups = eligiblePhraseGroups.filter(entry => entry.anchorFamily === familyName && !emittedPhraseGroupIds.has(entry.grp.id));

    famGroups.forEach(({ grp, orderedActive, safeGroupId }) => {
      const count = orderedActive.length;
      logDebug('SUMMARY', 'Evaluation groupe de phrases', {
        family: familyName,
        groupId: grp.id,
        activeCount: count,
        configuredCount: (grp.order || []).length
      });
      // Règle: produire une phrase si au moins 2 cases du groupe sont cochées; sinon laisser les lignes individuelles
      if (count >= 2) {
        // Marquer ces IDs comme utilisés pour ne pas produire les lignes individuelles en doublon
        orderedActive.forEach(cb => globalUsedIds.add(cb.id));
        emittedPhraseGroupIds.add(grp.id);
        // Composer la phrase en utilisant les paramètres de mise en forme
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
        const markerId = `cb_group_${safeGroupId}`; // reste traité comme 'cb_' pour le système de markers
        markers.push({ id: markerId, text: phraseText });
        logDebug('SUMMARY', 'Phrase groupe emise', { markerId, textLength: phraseText.length });
      }
    });

    // 2) Ajouter les checkboxes restantes (non couvertes par un groupe produit)
    cbs.forEach(cb => {
      if (groupedCheckboxIds.has(cb.id) || globalUsedIds.has(cb.id)) return; // déjà couvert par une phrase
      markers.push({ id: `cb_${cb.id}`, text: cb.value });
    });

    logDebug('SUMMARY', 'Famille ajoutee au resume', {
      family: familyName,
      checkboxCount: cbs.length,
      groupedUsedCount: globalUsedIds.size,
      groupCount: (phraseGroupsByFamily.get(familyName) || []).length
    });
  }

  // Plus de priorité spéciale pour les favoris : ils suivront simplement leur famille.

  if (!orgOrder.length) {
    // Fallback : champs extraits puis chaque famille triée
  appendExtractedFields();
  familiesList.forEach(fam => appendFamily(fam));
  logFlow('FALLBACK', 'Resume genere sans organizationOrder', {
    provider: prestataire,
    familyCount: familiesList.length,
    fieldCount: fieldOrder.length
  });
  } else {
    // Suivre l'ordre défini
    orgOrder.forEach(item => {
      if (item.type === 'fields') {
        appendExtractedFields();
      } else if (item.type === 'family') {
        // Retrouver la vraie famille (stockée dans .familyName)
        if (item.familyName) appendFamily(item.familyName);
        else {
          // Essayer de déduire du titre si nécessaire
          const m = item.title && item.title.startsWith('Famille:') ? item.title.split(':').slice(1).join(':').trim() : null;
            if (m) appendFamily(m);
        }
      }
    });
    // Ajouter ensuite les familles actives manquantes
    const activeFamiliesSet = new Set(familiesList);
    const familiesInOrder = new Set(orgOrder.filter(i=>i.type==='family').map(i=> (i.familyName||'').trim()));
    const missingFamilies = [...activeFamiliesSet].filter(f => !familiesInOrder.has(f));
    if (missingFamilies.length) {
      logDebug('SUMMARY', 'Familles absentes de organizationOrder ajoutees en fin', { count: missingFamilies.length });
      missingFamilies.sort().forEach(fam => appendFamily(fam));
    }
    // Filet de sécurité: si aucun item 'fields' n'était présent dans orgOrder, émettre quand même le bloc
    if (!_appendedFieldsBlock) {
      logDebug('SUMMARY', 'Bloc champs absent de organizationOrder, ajout en tete');
      appendExtractedFields();
    }
    logDebug('SUMMARY', 'organizationOrder applique');
  }
  const note = settings.noteLibre[prestataire.toLowerCase()] || '';
  if (note.trim()) {
    const t = `\nNote libre : ${note}`;
    lines.push(t);
  }
  if (includeRodap) {
  // RO DAP removed
    lines.push(t);
  }
  // (Les valeurs des checkboxes sont déjà ajoutées via favoris / familles)
  // --- Application du système de markers ---
  // Construire map des markers actuels (ordre logique actuel)
  const currentIds = markers.map(m => m.id);
  const baseById = new Map(markers.map(m => [m.id, m.text]));

  // Parser previousSummary pour récupérer la séquence (markers + texte manuel)
  // On transforme le texte manuel en pseudo-markers manual_* en le segmentant à la ponctuation forte . ; ? ! : (pas la virgule)
  const tokens = []; // [{type:'marker', id, inner} | {type:'manual', text}]
  const existingContentById = new Map();
  const existingSuffixById = new Map(); // ids: mx_fld_fields_<i>, mx_cb_<id>
  const headerOverrideByIndex = new Map(); // for fld_fields header lines (0,1)

  const freeLinesByIndex = new Map(); // preserve arbitrary manual lines inside fld_fields at given indices
  const fieldOverrideByKey = new Map(); // when user rewrites entire line (not just suffix), we override base line instead of appending
  // Helper: normalize a line for duplication checks (collapse inner spaces, trim)
  const normLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  // Helper set of base fld_fields lines to filter duplicates when preserving free lines (normalized)
  const baseFld = (markers.find(m => m.id === 'fld_fields')?.text) || '';
  const baseFldLines = String(baseFld).split(/\r?\n/);
  const baseFldNormSet = new Set(baseFldLines.map(s => normLine(s)).filter(Boolean));
  logDebug('SUMMARY', 'Analyse du resume precedent', {
    previousLength: previousSummary.length,
    baseFieldCount: baseFldLines.length
  });
  // Track global free lines to avoid re-adding the same manual line multiple times across indices (normalized)
  const globalFreeLineNormSet = new Set();
  function addFreeLineAtIndex(idx, rawLine) {
    if (rawLine == null) return;
    const t = String(rawLine);
    const trimmed = t.trim();
    if (!trimmed) return; // ignore empty
    // Protection anti-doublons spécifiques: ne jamais réinsérer les lignes d'en-tête ou les lignes de champs de base récurrentes
    // Cas observé: "Prestataire : XYZ" et "L'observance est à" pouvaient être re-capturées comme contenu libre
    // lorsqu'une réorganisation ou ajout de checkbox re-générait le bloc, entraînant duplication cumulative.
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('prestataire :') || lower.startsWith("l'observance est ") || lower.startsWith('données de télésuivi')) {
      return; // ne pas traiter comme free line
    }
    const norm = normLine(t);
    if (!norm) return;
    if (baseFldNormSet.has(norm)) return; // don't duplicate base auto lines (ignoring spacing)
    if (globalFreeLineNormSet.has(norm)) return; // already captured elsewhere
    const arr = freeLinesByIndex.get(idx) || [];
    // Avoid per-index duplicates as well
    if (arr.some(x => normLine(x) === norm)) return;
    arr.push(t);
    freeLinesByIndex.set(idx, arr);
    globalFreeLineNormSet.add(norm);
  }
  function splitManualIntoSegments(text) {
    if (!text) return [];
    const parts = [];
    // Treat each single line as a segment boundary even without punctuation
    const lines = String(text).split(/\r?\n/);
    const re = /([.;?!:])/; // strong punctuation, no comma
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        // preserve blank line as a dedicated manual break segment
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
    // remove any accidental all-whitespace segments (except our explicit '\n')
    return parts.filter(s => s === '\n' || String(s).trim().length > 0);
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
        // Filtrer les blocs manuels qui contiennent des markers auto pour éviter doublons
        const innerTrimmed = String(inner || '').trim();
        const hasAutoMarker = /<(fld_fields|cb_group_[a-z0-9_-]+|cb_[a-z0-9_-]+)=.*?\/\/\1>/is.test(innerTrimmed);
        if (hasAutoMarker) {
          logDebug('SUMMARY', 'Marker manuel ignore car contient un marker auto', { id });
          // Ne pas ajouter ce token, il sera régénéré comme auto
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

  // Derive suffixes from previous base markers when dedicated mx_ markers don't exist
  const splitAtLastPunct = (s) => {
    if (!s || typeof s !== 'string') return { base: s || '', suffix: '' };
    // Find last non-comma punctuation among . ; ? ! :
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

  // For fld_fields: compute per-field-key suffix using robust prefix comparison only
  let prevFld = existingContentById.get('fld_fields');
  // Sanitize previous fld_fields content: collapse repeated header + prestataire + blank + observance patterns
  if (prevFld) {
    try {
      // Normaliser éventuels séparateurs verticaux restants
      prevFld = String(prevFld).replace(/\u000B/g,'\n');
      const rawLines = String(prevFld).split(/\r?\n/);
      const cleaned = [];
      const norm = s => String(s).replace(/\s+/g,' ').trim().toLowerCase();
      let headerSeen = false;
      let prestataireSeen = false;
      let observanceSeen = false;
      // We allow only first occurrence of each of these canonical lines; other lines kept but we later dedup again
      for (let i=0;i<rawLines.length;i++) {
        const ln = rawLines[i];
        const n = norm(ln);
        if (n.startsWith('données de télésuivi')) {
          if (headerSeen) { continue; } else { headerSeen = true; }
        }
        if (n.startsWith('prestataire :')) {
          // keep only first prestataire header appearing directly after main header group
          if (prestataireSeen) {
            // skip if already kept a prestataire and the next non-empty line starts with l'observance est
            // this matches the duplication pattern observed
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
      // Additional collapse of consecutive repeating 'Prestataire :' + blank + "L'observance est" groups
      function collapsePattern(lines) {
        const out = [];
        let i=0;
        while (i<lines.length) {
          const a = norm(lines[i]);
          const b = norm(lines[i+1]||'');
            const c = norm(lines[i+2]||'');
          if (a.startsWith('prestataire :') && (b==='') && c.startsWith("l'observance est ")) {
            // look ahead to see if same triplet repeats immediately again -> skip duplicates
            out.push(lines[i]);
            out.push(lines[i+1]);
            out.push(lines[i+2]);
            // Skip any further identical repeating triplets
            let j = i+3;
            while (true) {
              const a2 = norm(lines[j]);
              const b2 = norm(lines[j+1]||'');
              const c2 = norm(lines[j+2]||'');
              if (a2.startsWith('prestataire :') && (b2==='') && c2.startsWith("l'observance est ")) {
                j += 3; // drop duplicate triplet
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
      // Aggressive final pass: supprimer toute répétition restante d'observance dispersée
      const finalOnce = [];
      const seenLineType = { header:false, prest:false, obs:false };
      collapsed.forEach(l => {
        const n = norm(l);
        if (n.startsWith('données de télésuivi')) { if (seenLineType.header) return; seenLineType.header = true; }
        else if (n.startsWith('prestataire :')) { if (seenLineType.prest) return; seenLineType.prest = true; }
        else if (n.startsWith("l'observance est ")) { if (seenLineType.obs) return; seenLineType.obs = true; }
        finalOnce.push(l);
      });
      // Si plusieurs observance détectées initialement -> journaliser reset agressif
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
    const baseIndexOffset = 2; // headers (no blank line)
    // Capture possible header overrides (user modified header lines)
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
    // Prepare interpretation texts for cleanup check
    const allInterpTexts = new Set();
    if (texts) {
      Object.values(texts).forEach(t => {
        if (t.ge) allInterpTexts.add(t.ge.trim().toLowerCase());
        if (t.lt) allInterpTexts.add(t.lt.trim().toLowerCase());
      });
    }
    logDebug('SUMMARY', 'Textes interpretation connus charges', { count: allInterpTexts.size });

    // Build regex for robust stripping
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const interpPatterns = Array.from(allInterpTexts).map(t => escapeRegExp(t)).join('|');
    // Matches: optional whitespace, (, optional whitespace, one of the texts, optional whitespace, ), optional whitespace, end of string
    const interpRegex = interpPatterns ? new RegExp(`\\s*\\(\\s*(?:${interpPatterns})\\s*\\)\\s*$`, 'i') : null;

    // Check for structure mismatch (e.g. compact mode or deleted lines)
    // If the number of lines in previous content is significantly less than expected fields,
    // we assume the structure is broken/compact and we should NOT try to map lines by index.
    // Instead, we skip the override logic and let the block regenerate fully.
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

        // Helper to strip known interpretation suffixes
        const stripInterp = (line) => {
          let s = String(line || '');
          // Remove XML-like tags if any remain from previous versions
          s = s.replace(/<i_[a-zA-Z0-9_]+>.*?<\/i_[a-zA-Z0-9_]+>/g, '');
          
          // Also try to remove plain text interpretation if tags are missing (legacy fallback)
          if (interpRegex) {
            // Try to match at end of string, allowing for optional punctuation
            const match = s.match(new RegExp(`(\\s*\\(\\s*(?:${interpPatterns})\\s*\\)\\s*[.,;]?)\\s*$`, 'i'));
            if (match) {
              s = s.slice(0, match.index).trim() + (match[0].match(/[.,;]$/) ? match[0].match(/[.,;]$/)[0] : '');
            }
          }
          return s.trim();
        };

        const prevClean = stripInterp(prevLine);
        const currClean = stripInterp(currLine);
        const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

        if (norm(prevClean) === norm(currClean)) {
          // Core content matches. Use the new system line (currLine) which respects the current includeInterpretation setting.
          // If includeInterpretation is ON, currLine has interp.
          // If includeInterpretation is OFF, currLine has no interp.
          // So we don't need to override anything, just let the system use currLine.
          return;
        }

        // Mismatch: User modified the core content. We must preserve prevLine (user's version).
        // But we need to handle interpretation based on current setting.
        
        let newLine = prevClean; // Start with cleaned user content

        if (includeInterpretation) {
            // User wants interpretation ON.
            // Extract interpretation from currLine (which has it if ON)
            // Check for tags first
            const tagMatch = currLine.match(/<i_([a-zA-Z0-9_]+)>(.*?)<\/i_\1>/);
            if (tagMatch) {
              // Found tag in current system line, append it to user line
              newLine = newLine + ' ' + tagMatch[0];
            } else {
              // Fallback to plain text extraction
              let interpToAdd = '';
              const normCurr = norm(currLine);
              for (const interp of allInterpTexts) {
                  const suffix = `(${interp})`;
                  if (normCurr.includes(suffix)) { // relaxed check
                      interpToAdd = suffix; 
                      break;
                  }
              }
              if (interpToAdd) {
                  newLine = newLine + ' ' + interpToAdd;
              }
            }
        }
        // If !includeInterpretation, newLine is just prevClean (no interp), which is correct.

        if (newLine !== currLine) {
            fieldOverrideByKey.set(key, newLine);
            logDebug('SUMMARY', 'Override logique interpretation applique', { field: key });
        }
      });
    }
    // Also scan indices outside mapped fields for free manual lines (e.g., inserted between headers and first field)
    for (let i = 0; i < linesPrev.length; i++) {
      // Skip header lines
      if (i === 0 || i === 1) continue;
      // For field indices already processed above, skip if matched or suffix captured
      const rel = i - baseIndexOffset;
      if (rel >= 0 && rel < fieldKeysUsed.length) continue;
      // If beyond known fields and non-empty, treat as trailing manual content within block
      if (linesPrev[i] && linesPrev[i].trim()) {
        addFreeLineAtIndex(i, linesPrev[i]);
      }
    }
  }

  // For cb_* markers: detect overrides vs suffix additions
  for (const [id, inner] of existingContentById.entries()) {
    if (id.startsWith('cb_')) {
      // Les groupes de phrases doivent toujours utiliser la valeur recalculee (jamais overridee)
      if (id.startsWith('cb_group_')) continue;
      const mxId = `mx_${id}`;
      const base = baseById.get(id) || '';
      if (!base) continue;

      if (inner && inner !== base) {
        if (inner.startsWith(base)) {
          // Pure extension -> treat as suffix
          const suf = inner.slice(base.length).trim();
          if (suf) {
            existingSuffixById.set(mxId, suf);
            logDebug('SUMMARY', 'Suffixe checkbox derive depuis contenu precedent', { id, suffixLength: suf.length });
          }
          continue;
        }
        // Internal modification / truncation / rewrite -> override whole line
        baseById.set(id, inner);
        logDebug('SUMMARY', 'Override total checkbox applique', { id, textLength: inner.length });
        continue;
      }
      // inner === base (unchanged) -> nothing
    }
  }

  // Helper to compose fld_fields content by reinserting preserved free lines with de-duplication
  function composeFldWithFree(baseText) {
    let composedLines = String(baseText).split(/\r?\n/);
    const insertedFreeNormSet = new Set();
    let insertedCount = 0;
    let skippedDupCount = 0;
    const indices = Array.from(freeLinesByIndex.keys()).sort((a, b) => a - b);
    indices.forEach(idx => {
      const arr = freeLinesByIndex.get(idx) || [];
      arr.forEach((ln, j) => {
        const norm = normLine(ln);
        if (!norm) { skippedDupCount++; return; }
        if (baseFldNormSet.has(norm)) { skippedDupCount++; return; }
        if (insertedFreeNormSet.has(norm)) { skippedDupCount++; return; }
        // If a line with same normalized content already exists in composed content, skip to avoid duplicates across runs
        if (composedLines.some(x => normLine(x) === norm)) { skippedDupCount++; return; }
        const insertAt = Math.min(idx + j, composedLines.length);
        composedLines.splice(insertAt, 0, ln);
        insertedFreeNormSet.add(norm);
        insertedCount++;
      });
    });
    logDebug('SUMMARY', 'Lignes libres fld_fields reinjectees', { insertedCount, skippedDupCount });
    // Apply per-field overrides (after reinserting free lines, so indices still align: baseIndexOffset + i)
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
    // Apply header overrides (indices 0 and 1) if captured
    headerOverrideByIndex.forEach((val, idx) => {
      if (idx < composedLines.length) {
        logDebug('SUMMARY', 'Override header applique', { headerIndex: idx });
        composedLines[idx] = val;
      }
    });
    // Passe finale stricte: ne garder qu'une seule occurrence globale des lignes header / prestataire / observance
    const final = [];
    const seenType = { header:false, prest:false, obs:false };
    const seenNormAll = new Set();
    const norm2 = s => String(s).replace(/\s+/g,' ').trim().toLowerCase();
    for (const ln of composedLines) {
      const n = norm2(ln);
      if (!n) { final.push(ln); continue; }
      if (n.startsWith('données de télésuivi')) { if (seenType.header) continue; seenType.header = true; final.push(ln); continue; }
      if (n.startsWith('prestataire :')) { if (seenType.prest) continue; seenType.prest = true; final.push(ln); continue; }
      if (n.startsWith("l'observance est ")) { if (seenType.obs) continue; seenType.obs = true; final.push(ln); continue; }
      if (seenNormAll.has(n)) continue; // éliminer toute répétition ailleurs
      seenNormAll.add(n);
      final.push(ln);
    }
    composedLines = final;
    return composedLines.join('\n');
  }

  // Construire nouvelle séquence de markers: on conserve ceux encore actifs (ordre précédent), puis on ajoute les nouveaux.
  // Nouvelle stratégie: respecter l'ordre hiérarchique courant des autos tout en conservant
  // la position relative originale des segments manuels.
  // 1) Analyser l'ancien ordre pour compter les autos vus avant chaque segment manuel.
  const manualTokens = []; // {token, autosBefore}
  let autosSeen = 0;
  const activeAutoSet = new Set(currentIds.filter(id => id === 'fld_fields' || id.startsWith('cb_')));
  for (const token of tokens) {
    if (token.type === 'marker') {
      const id = token.id;
      if ((id === 'fld_fields' || id.startsWith('cb_')) && activeAutoSet.has(id)) {
        autosSeen++;
      } else if (id.startsWith('manual') || (!id.startsWith('mx_') && id !== 'fld_fields' && !id.startsWith('cb_'))) {
        // Traiter markers non-auto comme manuel pour la stabilité
        manualTokens.push({ token: { type: 'marker', id, inner: token.inner }, autosBefore: autosSeen });
      }
    } else if (token.type === 'manual') {
      manualTokens.push({ token, autosBefore: autosSeen });
    }
  }

  // 2) Générer la nouvelle liste d'autos dans l'ordre hiérarchique actuel (organizationOrder déjà appliqué plus haut).
  //    markers contient déjà fld_fields + cb_* dans l'ordre voulu.
  const autoBaseIdsOrdered = markers.map(m => m.id).filter(id => id === 'fld_fields' || id.startsWith('cb_'));

  function renderAutoBlock(id, outArr) {
    const norm = (s) => String(s ?? '').replace(/\s+/g,' ').trim().toLowerCase();
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
        const norm = (s) => String(s ?? '').replace(/\s+/g,' ').trim().toLowerCase();
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

  // 3) Recomposer en insérant les segments manuels selon leur ratio autosBefore.
  const outputMarkers = [];
  const totalOriginalAutos = Math.max(1, autosSeen); // éviter division par zéro
  // Pré-indexer les manuels par autosBefore
  const manualsByCount = new Map();
  manualTokens.forEach(mt => {
    const key = mt.autosBefore;
    if (!manualsByCount.has(key)) manualsByCount.set(key, []);
    manualsByCount.get(key).push(mt.token);
  });

  // Ajouter manuels qui étaient avant tout auto (autosBefore = 0)
  if (manualsByCount.has(0)) {
    manualsByCount.get(0).forEach(tok => {
      if (tok.type === 'manual') {
        // générer un id stable si déjà manual_ sinon nouveau
        // Re-créer un manual_N séquentiel à la fin (on renumérote toujours)
        // Renumérotation: on différera jusqu'à la fin -> stocker placeholder
        outputMarkers.push(tok.__placeholder || `__MANUAL_PLACEHOLDER__::${tok.text}`);
      } else {
        outputMarkers.push(`<${tok.id}=${tok.inner}//${tok.id}>`);
      }
    });
  }

  // Génération des autos avec insertion des manuels qui suivaient chacun dans l'ancien flux.
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
    const afterCount = idx + 1; // manuels qui avaient autosBefore == afterCount
    if (manualsByCount.has(afterCount)) {
      manualsByCount.get(afterCount).forEach(tok => emitManualToken(tok, outputMarkers));
    }
  });

  // Ajouter tout manuel avec autosBefore > nombre d'autos originels (sécurité) ou > autoBaseIdsOrdered.length
  const overflowKeys = [...manualsByCount.keys()].filter(k => k > autoBaseIdsOrdered.length);
  overflowKeys.sort((a,b)=>a-b).forEach(k => {
    manualsByCount.get(k).forEach(tok => emitManualToken(tok, outputMarkers));
  });

  // Composition finale : en-têtes (premières lignes non marker) + markers + note/rodap + texte manuel résiduel
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
  // Respecter strictement l'ordre déjà calculé (organizationOrder) : ne pas forcer fld_fields en premier.
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
