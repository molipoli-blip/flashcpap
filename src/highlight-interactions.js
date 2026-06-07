// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// src/highlight-interactions.js - Text highlighting and info popup logic
import { settings } from './storage.js';
import { escapeHtml } from './shared/escape.js';
import { getFieldDisplayName } from './field-card-view.js';
import { safeRun } from './error-handling.js';

export function setupHighlighting(sourceWrapper, matches) {
  // Helper to assign a color class per role/field
  const colorClassFor = (m) => {
    const role = (m.role || '').toLowerCase();
    if (role === 'separator') return 'hl-separator';
    if (role === 'obs') return 'hl-obs';
    if (role === 'iah') return 'hl-iah';
    if (role === 'fuites') return 'hl-fuites';
    // fallback hash for other fields
    return 'hl-other';
  };

  // Wire up highlight click to show info popup
  const infoPopup = document.getElementById('hl-info-popup');
  let currentPopupAnchor = null;

  function hideInfoPopup() {
    if (!infoPopup) return;
    // Remove persistent group highlight if any
    safeRun(() => {
      if (currentPopupAnchor?.data?.group) toggleGroupHover(currentPopupAnchor.data.group, false);
    }, { context: 'HL_HIDE_POPUP_GROUP_TOGGLE' });
    infoPopup.style.display = 'none';
    currentPopupAnchor = null;
  }

  function appendInfoRow(container, label, value) {
    const row = document.createElement('div');
    row.className = 'row';

    const strong = document.createElement('strong');
    strong.textContent = `${label} :`;

    row.appendChild(strong);
    row.appendChild(document.createTextNode(` ${value}`));
    container.appendChild(row);
  }

  function showInfoPopup(target, data) {
    if (!infoPopup) return;
    safeRun(() => console.log('[HL][POPUP] showInfoPopup kind=%s label=%s field=%s line=%s raw=%o group=%s', data?.kind || 'value', data?.label || data?.field, data?.field, data?.line, data?.raw, data?.group), { context: 'HL_POPUP_LOG' });
    // Build content
  // Resolve friendly display name for the field to use as popup title and Champ
  const chosen = (document.getElementById('prest-param')?.value) || (document.getElementById('prestataire-select')?.value) || '';
  const site = (chosen || '').toLowerCase();
  const def = settings?.patterns?.[site]?.fields?.[data?.field];
  let champDisplay = '';
  try {
    champDisplay = getFieldDisplayName(data?.field || '', def || {});
  } catch { champDisplay = data?.field || ''; }
  const titleText = champDisplay || data?.label || data?.field || '';
  const effectiveType = data?.valueType || data?.type;
  const typeText = ((effectiveType === 'numeric' || effectiveType === 'tuple') ? 'Numérique' : 'Texte') + (data?.unit ? ` (${data.unit})` : '');
    const rangeText = (data && data.labelRange) ? `${data.labelRange.start}–${data.labelRange.end}` : '';
    const tupleSize = (typeof data?.tupleSize === 'number' && data.tupleSize >= 2) ? data.tupleSize : '';
  // Compute tuple mask display from settings (combo selection like "X * X")
  let tupleMaskDisplay = '';
  try {
    const te = def?.tupleExtraction;
    if (te && typeof te.size === 'number' && te.size >= 2) {
      const size = te.size;
      let mask = (te.mask || '').trim();
      if (!mask) {
        mask = Array.from({ length: size }, () => 'X').join(' ');
      } else if (/^\d+(\s*,\s*\d+)*$/.test(mask)) {
        // Convert index list (e.g., "1,3") to tokens of length `size`
        const idx = mask.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < size);
        const tokens = Array.from({ length: size }, (_, i) => idx.includes(i) ? 'X' : '*');
        mask = tokens.join(' ');
      } else {
        // Normalize spacing/case and pad/trim to size
        const toks = mask.split(/\s+/).filter(Boolean).map(t => (String(t).toUpperCase() === 'X' ? 'X' : '*'));
        while (toks.length < size) toks.push('*');
        mask = toks.slice(0, size).join(' ');
      }
      tupleMaskDisplay = mask;
    }
  } catch (error) {
    safeRun(() => console.warn('[HL][POPUP] tuple mask build failed', error), { context: 'HL_POPUP_TUPLE_MASK_WARN' });
  }
    infoPopup.replaceChildren();

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = titleText;
    infoPopup.appendChild(title);

    appendInfoRow(infoPopup, 'Champ', String(champDisplay));
    appendInfoRow(infoPopup, 'Label', String(data.labelText || data.label || ''));
    appendInfoRow(infoPopup, 'Valeur', String(data.valueRaw ?? data.raw ?? ''));
    appendInfoRow(infoPopup, 'Ligne', String(data.valueLine ?? data.line ?? ''));
    appendInfoRow(infoPopup, 'Type', typeText);
    appendInfoRow(infoPopup, 'Intervalle de lecture', rangeText);

    if (tupleSize) {
      appendInfoRow(infoPopup, 'Nombre de tuples', String(tupleSize));
    }

    if (tupleMaskDisplay) {
      appendInfoRow(infoPopup, 'Sélection tuples', String(tupleMaskDisplay));
    }

  infoPopup.style.display = 'block';
  // Resolve a stable anchor element: prefer the highlight/badge wrapper if a text node was clicked
  const anchorEl = (target instanceof HTMLElement) ? target : (target && target.closest ? target.closest('.hl, .hl-badge') : null) || target;
  // Save anchor to reposition on scroll/resize
  currentPopupAnchor = { el: anchorEl, data };
  positionInfoPopup();
  // While popup is open, keep the entire group highlighted
  safeRun(() => {
    if (data && data.group) toggleGroupHover(data.group, true, data.variant || null);
  }, { context: 'HL_POPUP_GROUP_TOGGLE' });
  }

  function positionInfoPopup() {
    if (!infoPopup || !currentPopupAnchor?.el) return;
    const target = currentPopupAnchor.el;
    // If the anchor is no longer visible inside the source wrapper viewport, hide the popup
    safeRun(() => {
      const anchorRect = target.getBoundingClientRect();
      const wrapperRect = sourceWrapper.getBoundingClientRect();
      const outOfView = (
        anchorRect.bottom < wrapperRect.top ||
        anchorRect.top > wrapperRect.bottom ||
        anchorRect.right < wrapperRect.left ||
        anchorRect.left > wrapperRect.right
      );
      if (outOfView) { hideInfoPopup(); return; }
    }, { context: 'HL_POSITION_POPUP_VIEWPORT_CHECK' });
    const rect = target.getBoundingClientRect();
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const popupRect = infoPopup.getBoundingClientRect();
    // Preferred: right side
    let left = rect.right + 8;
    let top = rect.top;
    // If overflow right, flip to left
    if (left + popupRect.width + 8 > vw) {
      left = Math.max(8, rect.left - popupRect.width - 8);
    }
    // If overflow bottom, align to bottom of anchor; if still overflow, clamp
    if (top + popupRect.height + 8 > vh) {
      top = Math.max(8, rect.bottom - popupRect.height);
    }
    // Final clamp
    left = Math.min(Math.max(left, 8), vw - popupRect.width - 8);
    top = Math.min(Math.max(top, 8), vh - popupRect.height - 8);
    infoPopup.style.left = `${left}px`;
    infoPopup.style.top = `${top}px`;
  }

  function processBadgeClick(el, scopeWrapper) {
    const group = el.getAttribute('data-hl-group');
    const variant = el.getAttribute('data-hl-variant');
    safeRun(() => console.log('[BADGE][CLICK] group=%s variant=%s hasId=%s [scope=%s]', group, variant, String(el.hasAttribute('data-hl-id')), scopeWrapper === sourceWrapper ? 'primary' : 'global'), { context: 'HL_BADGE_CLICK_LOG' });
    if (group) {
      try {
        // If the badge carries a direct payload id to a VALUE, use it
        const directId = el.getAttribute('data-hl-id');
        if (directId && Array.isArray(scopeWrapper.__hlMap)) {
          const idx = parseInt(directId, 10);
          const data = scopeWrapper.__hlMap[idx];
          if (data) {
            safeRun(() => console.log('[BADGE][CLICK][DIRECT] id=%s -> kind=%s label=%s field=%s line=%s raw=%o', directId, data?.kind || 'value', data?.label || data?.field, data?.field, data?.line, data?.raw), { context: 'HL_BADGE_DIRECT_LOG' });
            toggleGroupHover(group, true, variant);
            currentPopupAnchor = { el, data: { group, variant } };
            // Find a node with this id if possible (for positioning), else use the badge itself
            const node = scopeWrapper.querySelector(`[data-hl-id="${CSS.escape(String(directId))}"]`) || el;
            showInfoPopup(node, { ...data, variant });
            return true;
          }
        }
        const escaped = CSS && CSS.escape ? CSS.escape(group) : group.replace(/"/g, '\\"');
        // Gather all candidates in the group that carry a payload id
        const candidates = Array.from(scopeWrapper.querySelectorAll(`[data-hl-group=\"${escaped}\"][data-hl-id]`));
        safeRun(() => console.log('[BADGE][CLICK][FALLBACK] candidates=%d group=%s', candidates.length, group), { context: 'HL_BADGE_FALLBACK_LOG' });
        // Rank: prefer non-exclusion, non-masked, not label-ghost; among equals, prefer value over label
        const score = (node) => {
          const idAttr = node.getAttribute('data-hl-id');
          const idx = parseInt(idAttr || '-1', 10);
          const data = Array.isArray(scopeWrapper.__hlMap) ? scopeWrapper.__hlMap[idx] : null;
          let s = 0;
          if (data?.kind === 'masked' || data?.kind === 'exclusion') s -= 10;
          if (node.classList.contains('hl-label')) s -= 1; else s += 1;
          if (node.classList.contains('hl-label-ghost')) s -= 5;
          if (node.classList.contains('hl-excl')) s -= 4;
          return s;
        };
        let targetEl = null;
        let bestData = null;
        candidates.forEach((n) => {
          const idAttr = n.getAttribute('data-hl-id');
          const idx = parseInt(idAttr || '-1', 10);
          const data = Array.isArray(scopeWrapper.__hlMap) ? scopeWrapper.__hlMap[idx] : null;
          if (targetEl == null) { targetEl = n; bestData = data; return; }
          if (score(n) > score(targetEl)) { targetEl = n; bestData = data; }
        });
        if (targetEl && bestData) {
          safeRun(() => console.log('[BADGE][CLICK][CHOSEN] id=%s kind=%s label=%s field=%s line=%s raw=%o', targetEl.getAttribute('data-hl-id'), bestData?.kind || 'value', bestData?.label || bestData?.field, bestData?.field, bestData?.line, bestData?.raw), { context: 'HL_BADGE_CHOSEN_LOG' });
          safeRun(() => toggleGroupHover(group, true, variant), { context: 'HL_BADGE_CHOSEN_GROUP_TOGGLE' });
          showInfoPopup(targetEl, { ...bestData, variant });
          return true;
        }
        safeRun(() => console.warn('[BADGE][CLICK][NO-CANDIDATE] group=%s', group), { context: 'HL_BADGE_NO_CANDIDATE_WARN' });
        toggleGroupHover(group, true, variant);
        currentPopupAnchor = { el, data: { group, variant } };
        return false;
      } catch (error) {
        safeRun(() => console.warn('[BADGE][CLICK] processing failed', error), { context: 'HL_BADGE_CLICK_WARN' });
      }
    }
    return false;
  }

  sourceWrapper.addEventListener('click', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    // If clicking a numbered badge, toggle persistent highlight for its target group (no popup)
    if (el.classList && el.classList.contains('hl-badge')) {
      if (processBadgeClick(el, sourceWrapper)) return;
    }
    // Clicking any ghost label should open the same payload as the primary label for that group
    if (el.classList && el.classList.contains('hl-label-ghost')) {
      const group = el.getAttribute('data-hl-group');
      if (group) {
        try {
          const primary = sourceWrapper.querySelector(`.hl-label[data-hl-group="${CSS.escape(group)}"][data-hl-id]`);
          if (primary) {
            const pid = primary.getAttribute('data-hl-id');
            if (pid && Array.isArray(sourceWrapper.__hlMap)) {
              const idx = parseInt(pid, 10);
              const data = sourceWrapper.__hlMap[idx];
              if (data) { showInfoPopup(el, data); return; }
            }
          }
        } catch (error) {
          safeRun(() => console.warn('[HL][GHOST] failed to resolve primary label payload', error), { context: 'HL_GHOST_CLICK_WARN' });
        }
      }
    }
    // Prefer compact id-based lookup to avoid large attributes in DOM
    const idAttr = el.getAttribute('data-hl-id');
    if (idAttr && sourceWrapper && Array.isArray(sourceWrapper.__hlMap)) {
      const idx = parseInt(idAttr, 10);
      const data = sourceWrapper.__hlMap[idx];
      safeRun(() => console.log('[HL][CLICK] id=%s -> idx=%d, kind=%s, label=%s, field=%s', idAttr, idx, data?.kind || 'value', data?.label || data?.field, data?.field), { context: 'HL_CLICK_LOG' });
      if (data) { showInfoPopup(el, data); return; }
    }
  });

  // Global fallback: if click on badge doesn't bubble to sourceWrapper (different container), handle it here
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const badge = target.closest('.hl-badge');
    if (!badge) return;
    // Find nearest ancestor wrapper that carries a __hlMap (render root)
    let scope = badge.parentElement;
    while (scope && !(scope.__hlMap)) scope = scope.parentElement;
    const scopeWrapper = scope && scope.__hlMap ? scope : sourceWrapper;
    const handled = processBadgeClick(badge, scopeWrapper);
    if (handled) { e.stopPropagation(); e.preventDefault(); }
  }, { capture: true });

  // Group hover: when hovering a label/value, highlight all peers in the same group
  const toggleGroupHover = (group, on, variantOverride = null) => {
    if (!group) return;
    try {
      const escaped = CSS && CSS.escape ? CSS.escape(group) : group.replace(/"/g, '\\"');
      const nodes = sourceWrapper.querySelectorAll(`[data-hl-group="${escaped}"]`);
      safeRun(() => console.log('[HL][GROUP] %s group=%s, nodes=%d', on ? 'enter' : 'leave', group, nodes.length), { context: 'HL_GROUP_LOG' });
      nodes.forEach(n => {
        if (on) n.classList.add('hl-linked');
        else n.classList.remove('hl-linked');
        // If a variant override is provided (from a badge), set it so CSS applies the right color
        if (on && variantOverride) {
          safeRun(() => n.setAttribute('data-hl-variant', String(variantOverride)), { context: 'HL_GROUP_SET_VARIANT_NODE' });
        }
      });
      // Include labels that are shared across multiple fields for the same label token:
      // They expose data-hl-groups="g1,g2,g3"; highlight them if list contains the target group
      const sharedLabels = sourceWrapper.querySelectorAll('[data-hl-groups]');
      sharedLabels.forEach(n => {
        const csv = n.getAttribute('data-hl-groups') || '';
        const list = csv.split(',').map(s => s.trim()).filter(Boolean);
        if (list.includes(group)) {
          if (on) n.classList.add('hl-linked'); else n.classList.remove('hl-linked');
          if (on && variantOverride) {
            safeRun(() => n.setAttribute('data-hl-variant', String(variantOverride)), { context: 'HL_GROUP_SET_VARIANT_SHARED' });
          }
        }
      });
      // Also apply to badges that carry the same data-hl-group
      const badges = sourceWrapper.querySelectorAll(`.hl-badge[data-hl-group="${escaped}"]`);
      badges.forEach(b => {
        if (on) b.classList.add('hl-linked');
        else b.classList.remove('hl-linked');
        if (on && variantOverride) {
          safeRun(() => b.setAttribute('data-hl-variant', String(variantOverride)), { context: 'HL_GROUP_SET_VARIANT_BADGE' });
        }
      });
    } catch (error) {
      safeRun(() => console.warn('[HL][GROUP] toggle failed', error), { context: 'HL_GROUP_TOGGLE_WARN' });
    }
  };
  sourceWrapper.addEventListener('mouseover', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    // Hover on badges: highlight both label and value of the target group, using the badge's variant color if present
    const g = el.getAttribute('data-hl-group');
    if (g) {
      const v = el.getAttribute('data-hl-variant');
      toggleGroupHover(g, true, v);
    }
  });
  sourceWrapper.addEventListener('mouseout', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const g = el.getAttribute('data-hl-group');
    // If popup is open and anchored to the same group, keep it highlighted
    if (g) {
      const anchoredGroup = currentPopupAnchor?.data?.group;
      // Keep when sticky (badge toggled) or popup open on same group
      const sticky = !!anchoredGroup && anchoredGroup === g;
      const popupOpenSame = infoPopup && infoPopup.style.display === 'block' && sticky;
      if (sticky || popupOpenSame) return;
      toggleGroupHover(g, false);
    }
  });

  // Hide popup on outside click and clear sticky highlight if any
  document.addEventListener('click', (e) => {
    const el = e.target;
    if (!infoPopup || !(el instanceof HTMLElement)) return;
    if (el.closest('#hl-info-popup')) return;
    if (el.hasAttribute && el.hasAttribute('data-hl-id')) return; // clicking another highlight will re-open
    hideInfoPopup();
  }, { capture: true });

  // Reposition popup when the source wrapper scrolls (vertical/horizontal)
  sourceWrapper.addEventListener('scroll', () => {
    if (infoPopup && infoPopup.style.display === 'block') positionInfoPopup();
  });
  // Also reposition on window scroll and resize for stability
  window.addEventListener('scroll', () => {
    if (infoPopup && infoPopup.style.display === 'block') positionInfoPopup();
  }, { capture: true, passive: true });
  window.addEventListener('resize', () => {
    if (infoPopup && infoPopup.style.display === 'block') positionInfoPopup();
  });

  return { colorClassFor };
}