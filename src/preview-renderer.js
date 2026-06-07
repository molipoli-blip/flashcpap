// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { logDebug, logFlow, logWarn } from './debug-logger.js';
import { selectFirstPlaceholder, selectFirstPlaceholderInPreview } from './placeholder-navigation.js';
import { t } from './i18n.js';

export function renderSummaryPreview(preview, toggle, textarea, raw) {

    // Parse stored markers from the raw summary text.
  const tokens = [];
  // Accept IDs with hyphens for group markers.
  const re = /<([a-z0-9_-]+)=(.*?)\/\/\1>/gis;
    let last = 0; let m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) {
        const free = raw.slice(last, m.index);
        if (free.trim().length) tokens.push({ type:'free', text: free });
      }
      tokens.push({ type:'marker', id: m[1], inner: m[2] });
      last = re.lastIndex;
    }
    if (last < raw.length) {
      const tail = raw.slice(last);
      if (tail.trim().length) tokens.push({ type:'free', text: tail });
    }

  // Keep checkbox suffixes for preview merging. Field suffixes stay raw-only.
  const cbSuffix = new Map();
    tokens.forEach(t => {
  if (t.type==='marker' && t.id.startsWith('mx_cb_')) {
        const cbId = t.id.replace(/^mx_/, '');
        cbSuffix.set(cbId, (cbSuffix.get(cbId)||[]).concat([t.inner]));
      } else if (t.type==='marker' && t.id.startsWith('mx_fld_fields_')) {
        // Ignore field suffix markers in preview to avoid duplicated labels.
      }
    });

  function createRow(type, id, content, base = '', opts = {}) {
      const row = document.createElement('div');
      row.className = 'pv-row';
      row.dataset.type = type;
      if (id) row.dataset.id = id;
      if (base) row.dataset.base = base;

  const contentSpan = document.createElement('span');
  contentSpan.className = 'pv-content';
  contentSpan.contentEditable = 'true';
  contentSpan.draggable = false;
  const initial = (content || '').replace(/\u000B/g, '\n');
  if (type === 'man' && !initial.trim()) {
    const ph = opts.placeholder || t('previewNewTextPlaceholder');
    contentSpan.textContent = '';
    contentSpan.dataset.ph = ph;
    contentSpan.classList.add('empty');
  } else {
    contentSpan.textContent = initial;
  }

  const handle = document.createElement('span');
  handle.className = 'pv-handle';
  handle.title = t('previewMoveBlock');
  handle.textContent = '≡';
  handle.setAttribute('aria-label', t('previewMoveBlockAria'));
  handle.setAttribute('role', 'button');
  row.insertBefore(handle, row.firstChild);

  row.appendChild(contentSpan);

      if (type !== 'fld') {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'pv-del';
        del.textContent = '✕';
        del.title = t('previewDeleteBlock');
        del.style.cssText = 'background:#ffecec; color:#b30000; border:1px solid #e5b2b2; border-radius:4px; font-size:11px; cursor:pointer; padding:0 5px; line-height:16px; margin-left:6px; align-self:center;';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          row.remove();
          rebuildRaw();
        });
        row.appendChild(del);
      }

      return row;
    }

    preview.innerHTML = '';
  tokens.forEach(t => {
      if (t.type === 'marker') {
        const id = t.id;
        if (id === 'fld_fields') {
          preview.appendChild(createRow('fld', 'fld_fields', t.inner));
        } else if (id.startsWith('cb_group_')) {
          preview.appendChild(createRow('cb', id, t.inner, t.inner));
        } else if (id.startsWith('cb_')) {
          const extras = (cbSuffix.get(id)||[]).join(' ');
          const merged = extras ? (t.inner + ' ' + extras) : t.inner;
          preview.appendChild(createRow('cb', id, merged, t.inner));
        } else if (id.startsWith('manual')) {
          // Unwrap embedded markers stored inside manual blocks.
          const inner = String(t.inner || '').trim();
          const m = inner.match(/^<([a-z0-9_]+)=(.*?)\/\/\1>$/is);
          if (m) {
            const innerId = m[1];
            const innerText = m[2];
            if (innerId === 'fld_fields') {
              preview.appendChild(createRow('fld', 'fld_fields', innerText));
            } else if (innerId.startsWith('cb_group_')) {
              preview.appendChild(createRow('cb', innerId, innerText, innerText));
            } else if (innerId.startsWith('cb_')) {
              preview.appendChild(createRow('cb', innerId, innerText, innerText));
            } else {
              preview.appendChild(createRow('man', id, inner));
            }
          } else {
            preview.appendChild(createRow('man', id, t.inner));
          }
        } else if (!id.startsWith('mx_')) {
          // Unknown non-suffix marker
          preview.appendChild(createRow('man', id, t.inner));
        }
      } else if (t.type === 'free') {
        // Recover wrapped markers from free-text segments when possible.
        const freeText = String(t.text || '').trim();
  const fm = freeText.match(/^<([a-z0-9_-]+)=(.*?)\/\/\1>$/is);
        if (fm) {
          const freeId = fm[1];
          const freeInner = fm[2];
          if (freeId === 'fld_fields') {
            preview.appendChild(createRow('fld', 'fld_fields', freeInner));
          } else if (freeId.startsWith('cb_group_')) {
            preview.appendChild(createRow('cb', freeId, freeInner, freeInner));
          } else if (freeId.startsWith('cb_')) {
            preview.appendChild(createRow('cb', freeId, freeInner, freeInner));
          } else {
            preview.appendChild(createRow('man', '', freeText));
          }
        } else {
          preview.appendChild(createRow('man', '', freeText));
        }
      }
    });

    if (!document.getElementById('pv-row-style')) {
      const st = document.createElement('style');
      st.id = 'pv-row-style';
      st.textContent = `
        #résumé-preview {
          position: relative;
          background:#fff;
          border:1px solid #f5f5f5;
          border-radius:6px;
          padding:10px 12px;
          max-width: 760px;
          margin: 6px auto;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          font-family: "Segoe UI", Calibri, Arial, sans-serif;
          font-size: 13.5px;
        }
        #résumé-preview .pv-row { display:flex; align-items:stretch; gap:2px; padding:1px 2px; border-radius:4px; cursor:text; position:relative; }
  #résumé-preview .pv-row .pv-content { flex:1; min-height:16px; outline:none; white-space:pre-wrap; -webkit-user-drag:none; user-drag:none; color:#000; line-height:1.5; }
  #résumé-preview .pv-row:hover { background:#fbfbfb; }
  #résumé-preview .pv-row.is-focused { background:#f7f7f7; box-shadow:none; }
  #résumé-preview .pv-row.is-focused .pv-content { caret-color:#000; }
        #résumé-preview .pv-add-btn { margin-top:2px; }
        #résumé-preview .pv-row .pv-del { opacity:0; transition:opacity .15s; }
        #résumé-preview .pv-row:hover .pv-del { opacity:1; }
        #résumé-preview .pv-row .pv-del:hover { color:#b30000; background:#ffecec; border-color:#e5b2b2; }
        #résumé-preview .pv-row .pv-content.empty:before { content: attr(data-ph); color:#888; font-style:italic; pointer-events:none; }
        #résumé-preview .pv-row .pv-handle { user-select:none; cursor:grab; color:#bbb; padding:0 3px; display:flex; align-items:center; }
        #résumé-preview .pv-row .pv-handle:hover { color:#888; }
        #résumé-preview.drag-active .pv-row.dragging { opacity:0.6; }
  #résumé-preview .pv-row.drag-over { outline: 1px dashed #dcdcdc; }
      `;
      document.head.appendChild(st);
    }

    function focusRow(row, opts = { mode: 'preserve' }) {
      if (!row) return;
      preview.querySelectorAll('.pv-row.is-focused').forEach(r=>r.classList.remove('is-focused'));
      row.classList.add('is-focused');
      const span = row.querySelector('.pv-content');
      if (!span) return;
      if (opts.mode === 'preserve') {
        return;
      }
      span.focus({ preventScroll:false });
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      if (opts.mode === 'selectAll') {
        range.selectNodeContents(span);
      } else if (opts.mode === 'end') {
        range.selectNodeContents(span);
        range.collapse(false);
      } else if (opts.mode === 'start') {
        range.selectNodeContents(span);
        range.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    }

    preview.addEventListener('mousedown', (e) => {
      const row = e.target.closest('.pv-row');
      if (!row) return;
      const inContent = e.target.classList.contains('pv-content');
      if (inContent) {
        setTimeout(()=>focusRow(row, { mode:'preserve' }), 0);
      } else {
        e.preventDefault();
        setTimeout(()=>focusRow(row, { mode:'end' }), 0);
      }
    });

    // Prefer the first placeholder token without forcing a scroll jump.
    let focused = false;
    const rows = Array.from(preview.querySelectorAll('.pv-row'));
    for (const row of rows) {
      const contentSpan = row.querySelector('.pv-content');
      if (contentSpan && contentSpan.textContent.includes('[xxx]')) {
        const text = contentSpan.textContent;
        const idx = text.indexOf('[xxx]');
        if (idx !== -1 && contentSpan.firstChild) {
           const range = document.createRange();
           const sel = window.getSelection();
           try {
             range.setStart(contentSpan.firstChild, idx);
             range.setEnd(contentSpan.firstChild, idx + 5);
             sel.removeAllRanges();
             sel.addRange(range);
             focused = true;
           } catch(e) { logWarn('FOCUS', 'Erreur selection placeholder initial', e); }
        }
        if (focused) break;
      }
    }

    if (!focused) {
      // Leave focus unchanged if no placeholder was found.
    }

    const addBtn = document.createElement('div');
    addBtn.className = 'pv-add-btn';
    addBtn.innerHTML = `<span style="color:#999; cursor:pointer; font-size:12px;">${t('previewAddText')}</span>`;
    addBtn.onclick = () => {
      const newRow = createRow('man', '', '', '', { placeholder: t('previewNewTextPlaceholder') });
      preview.insertBefore(newRow, addBtn);
      newRow.querySelector('.pv-content').focus();
      rebuildRaw();
    };
    preview.appendChild(addBtn);

    (function setupDnD(){
      let draggingRow = null;
      let canDrag = false;
      let pointerActive = false;
      let pointerOverRow = null;
      const rowIndex = (row) => Array.from(preview.querySelectorAll('.pv-row')).indexOf(row);
      const rowLabel = (row) => {
        const t = row?.dataset?.type || '?';
        const id = row?.dataset?.id || '';
        return `${t}${id?(':'+id):''}#${rowIndex(row)}`;
      };
      function onDragStart(e){
        if (!canDrag) {
          logDebug('DND', 'dragstart ignore car canDrag=false');
          e.preventDefault();
          return;
        }
        draggingRow = e.currentTarget;
        logDebug('DND', 'dragstart', { source: rowLabel(draggingRow) });
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', 'pv-row'); } catch {}
        preview.classList.add('drag-active');
        draggingRow.classList.add('dragging');
      }
      function onDragEnd(){
        if (draggingRow) {
          logDebug('DND', 'dragend', { source: rowLabel(draggingRow) });
          draggingRow.classList.remove('dragging');
        }
        preview.classList.remove('drag-active');
        preview.querySelectorAll('.pv-row.drag-over').forEach(r=>r.classList.remove('drag-over'));
        draggingRow = null;
        canDrag = false;
      }
      function onDragEnter(e){ if (!draggingRow) return; e.preventDefault(); e.currentTarget.classList.add('drag-over'); logDebug('DND', 'dragenter', { target: rowLabel(e.currentTarget) }); }
      function onDragOver(e){
        if (!draggingRow) return;
        e.preventDefault();
        const target = e.currentTarget;
        if (target === draggingRow) return;
        preview.querySelectorAll('.pv-row.drag-over').forEach(r=>{ if (r!==target) r.classList.remove('drag-over'); });
        target.classList.add('drag-over');
      }
      function insertAfter(node, ref){ if (ref.nextSibling) ref.parentNode.insertBefore(node, ref.nextSibling); else ref.parentNode.appendChild(node); }
      function onDrop(e){
        if (!draggingRow) return;
        e.preventDefault();
        const target = e.currentTarget;
        target.classList.remove('drag-over');
        if (target === draggingRow) return;
        const rect = target.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height/2;
        logDebug('DND', 'drop', { target: rowLabel(target), before, source: rowLabel(draggingRow) });
        if (before) target.parentNode.insertBefore(draggingRow, target); else insertAfter(draggingRow, target);
        const order = Array.from(preview.querySelectorAll('.pv-row')).map(r=>rowLabel(r));
        logDebug('DND', 'nouvel ordre apres drop', { rowCount: order.length, order });
        onDragEnd();
        rebuildRaw();
      }
      function attachDnDToRow(row){
        const handle = row.querySelector('.pv-handle');
        row.draggable = true;
        row.addEventListener('dragstart', onDragStart);
        row.addEventListener('dragend', onDragEnd);
        row.addEventListener('dragenter', onDragEnter);
        row.addEventListener('dragover', onDragOver);
        row.addEventListener('drop', onDrop);
        if (handle) {
          handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            canDrag = true;
            logDebug('DND', 'mousedown poignee', { source: rowLabel(row) });
            pointerActive = true;
            draggingRow = row;
            preview.classList.add('drag-active');
            draggingRow.classList.add('dragging');
          });
          // Allow dragging directly from the handle as a fallback.
          handle.draggable = true;
          handle.addEventListener('dragstart', (e) => {
            logDebug('DND', 'dragstart poignee', { source: rowLabel(row) });
            pointerActive = false;
            draggingRow = row;
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', 'pv-row'); } catch {}
            preview.classList.add('drag-active');
            draggingRow.classList.add('dragging');
          });
          handle.addEventListener('dragend', onDragEnd);
        } else {
          logWarn('DND', 'Poignee absente sur la ligne', { row: rowLabel(row) });
        }
        logDebug('DND', 'DnD cable sur ligne', { row: rowLabel(row) });
      }
      const rows = Array.from(preview.querySelectorAll('.pv-row'));
      rows.forEach(attachDnDToRow);
      window.addEventListener('mouseup', (e) => {
        if (pointerActive && draggingRow) {
          const y = e.clientY;
          let target = document.elementFromPoint(e.clientX, e.clientY);
          if (target && !target.classList.contains('pv-row')) {
            target = target.closest('.pv-row');
          }
          if (target && target.classList.contains('pv-add-btn')) target = null;
          if (target && target !== draggingRow) {
            const rect = target.getBoundingClientRect();
            const before = (y - rect.top) < rect.height/2;
            logDebug('DND', 'pointer-drop', { target: rowLabel(target), before, source: rowLabel(draggingRow) });
            if (before) target.parentNode.insertBefore(draggingRow, target);
            else {
              if (target.nextSibling) target.parentNode.insertBefore(draggingRow, target.nextSibling);
              else target.parentNode.appendChild(draggingRow);
            }
            const order = Array.from(preview.querySelectorAll('.pv-row')).map(r=>rowLabel(r));
            logDebug('DND', 'nouvel ordre apres pointer-drop', { rowCount: order.length, order });
            rebuildRaw();
          } else {
            logDebug('DND', 'pointer-drop sans cible utile');
          }
          preview.querySelectorAll('.pv-row.drag-over').forEach(r=>r.classList.remove('drag-over'));
          if (draggingRow) draggingRow.classList.remove('dragging');
          preview.classList.remove('drag-active');
          pointerActive = false;
          draggingRow = null;
        }
        if (canDrag) { canDrag = false; logDebug('DND', 'mouseup global, canDrag=false'); }
      }, true);
      window.addEventListener('mousemove', (e) => {
        if (!pointerActive || !draggingRow) return;
        let target = document.elementFromPoint(e.clientX, e.clientY);
        if (target && !target.classList.contains('pv-row')) {
          target = target.closest('.pv-row');
        }
        if (!target || target === draggingRow || (target.classList && target.classList.contains('pv-add-btn'))) {
          if (pointerOverRow) { pointerOverRow.classList.remove('drag-over'); pointerOverRow = null; }
          return;
        }
        if (pointerOverRow && pointerOverRow !== target) pointerOverRow.classList.remove('drag-over');
        target.classList.add('drag-over');
        pointerOverRow = target;
      }, true);

      const originalAdd = addBtn.onclick;
      addBtn.onclick = () => {
        const newRow = createRow('man', '', '', '', { placeholder: t('previewNewTextPlaceholder') });
        preview.insertBefore(newRow, addBtn);
        const span = newRow.querySelector('.pv-content');
        if (span) { span.focus(); }
        attachDnDToRow(newRow);
        rebuildRaw();
      };

      preview.addEventListener('dragover', (e) => {
        if (!draggingRow || pointerActive) return;
        e.preventDefault();
      });
      preview.addEventListener('drop', (e) => {
        if (!draggingRow || pointerActive) return;
        e.preventDefault();
        const y = e.clientY;
        const rowsNow = Array.from(preview.querySelectorAll('.pv-row'));
        let target = null;
        for (const r of rowsNow) {
          const rect = r.getBoundingClientRect();
          if (y >= rect.top && y <= rect.bottom) { target = r; break; }
        }
        if (!target) {
          logDebug('DND', 'drop container sans cible, append fin');
          preview.insertBefore(draggingRow, addBtn);
        } else if (target !== draggingRow) {
          const rect = target.getBoundingClientRect();
          const before = (y - rect.top) < rect.height/2;
          logDebug('DND', 'drop container', { target: rowLabel(target), before, source: rowLabel(draggingRow) });
          if (before) target.parentNode.insertBefore(draggingRow, target); else insertAfter(draggingRow, target);
        }
        const order = Array.from(preview.querySelectorAll('.pv-row')).map(r=>rowLabel(r));
        logDebug('DND', 'nouvel ordre apres drop container', { rowCount: order.length, order });
        onDragEnd();
        rebuildRaw();
      });
    })();

    let syncTimer = null;
    function rebuildRaw() {
      const rows = Array.from(preview.querySelectorAll('.pv-row'));
      const out = [];
      let manSeq = 0;
      rows.forEach((row, index) => {
        const type = row.dataset.type;
        const id = row.dataset.id || '';
        const text = row.querySelector('.pv-content')?.textContent || '';
        logDebug('SUMMARY', 'Rebuild row inspectee', { index, type, id, textLength: text.length });
        if (!text.trim()) return;
        if (type === 'cb' && id.startsWith('cb_group_')) {
          const encGroup = text.replace(/\n/g, '\u000B');
          out.push(`<${id}=${encGroup}//${id}>`);
        } else if (type === 'cb') {
          const base = row.dataset.base || '';
          const norm = s => String(s||'').replace(/\s+/g,' ').trim();
          const normBase = norm(base);
          const normText = norm(text);
          if (normBase && normText.startsWith(normBase)) {
            const suffix = normText.slice(normBase.length).trim();
            const encBase = base.replace(/\n/g, '\u000B');
            out.push(`<${id}=${encBase}//${id}>`);
            if (suffix) {
              const encSuffix = suffix.replace(/\n/g, '\u000B');
              out.push(`<mx_${id}=${encSuffix}//mx_${id}>`);
            }
          } else {
            const encFull = text.replace(/\n/g, '\u000B');
            out.push(`<${id}=${encFull}//${id}>`);
          }
        } else if (type === 'fld') {
          const rawLines = (text||'').replace(/\u000B/g,'\n').split(/\n/);
          const norm = s => String(s).replace(/\s+/g,' ').trim().toLowerCase();
          const final = [];
          let header=false, prest=false, obs=false;
          const seenOther = new Set();
          rawLines.forEach(l => {
            const n = norm(l);
            if (!n) { final.push(l); return; }
            if (n.startsWith('données de télésuivi')) { if (header) return; header=true; final.push(l); return; }
            if (n.startsWith('prestataire :')) { if (prest) return; prest=true; final.push(l); return; }
            if (n.startsWith("l'observance est ")) { if (obs) return; obs=true; final.push(l); return; }
            if (seenOther.has(n)) return; seenOther.add(n); final.push(l);
          });
          const cleaned = final.join('\n');
          const encFld = cleaned.replace(/\n/g, '\u000B');
          out.push(`<fld_fields=${encFld}//fld_fields>`);
        } else if (type === 'man') {
          const trimmed = String(text||'').trim();
          const mt = trimmed.match(/^<([a-z0-9_-]+)=(.*?)\/\/\1>$/is);
          if (mt) {
            const recId = mt[1];
            const recInner = mt[2].replace(/\n/g, '\u000B');
            out.push(`<${recId}=${recInner}//${recId}>`);
          } else {
            manSeq++;
            const mid = id && id.startsWith('manual_') ? id : `manual_${manSeq}`;
            const encMan = text.replace(/\n/g, '\u000B');
            out.push(`<${mid}=${encMan}//${mid}>`);
          }
        }
      });
      const finalOutput = out.join('\n');
      const oldValue = textarea.value;
      textarea.value = finalOutput;
      logFlow('SUMMARY', 'Rebuild raw termine', {
        rowCount: rows.length,
        outputLength: finalOutput.length,
        previousLength: oldValue.length,
        changed: oldValue !== finalOutput
      });
    }
    const debouncedRebuild = () => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(rebuildRaw, 300);
    };

    preview.addEventListener('input', (e) => {
      const row = e.target.closest('.pv-row');
      if (row) {
        const type = row.dataset.type;
        const id = row.dataset.id || '';
        const base = row.dataset.base || '';
        const userText = e.target.textContent || '';
        logDebug('SUMMARY', 'Edition preview detectee', {
          type,
          id,
          hasBase: !!base,
          textLength: userText.length,
          textChangedFromBase: !!base && userText.trim() !== base.trim()
        });

        if (type === 'cb' && base) {
          logDebug('SUMMARY', 'Edition checkbox preview', {
            id,
            baseLength: base.length,
            textLength: userText.length,
            baseStillPresent: userText.includes(base)
          });
        }
      }

      const span = e.target.classList && e.target.classList.contains('pv-content') ? e.target : null;
      if (span && span.dataset.ph !== undefined) {
        if (span.textContent.trim().length === 0) {
          span.classList.add('empty');
        } else {
          span.classList.remove('empty');
        }
      }
      debouncedRebuild();
    });

    preview.addEventListener('blur', (e) => {
      const row = e.target.closest?.('.pv-row');
      logDebug('SUMMARY', 'Blur preview', {
        type: row?.dataset?.type || null,
        id: row?.dataset?.id || null,
        textLength: e.target?.textContent?.length || 0
      });
      const span = e.target.classList && e.target.classList.contains('pv-content') ? e.target : null;
      if (span && span.dataset.ph !== undefined && !span.textContent.trim()) {
        span.classList.add('empty');
      }
      rebuildRaw();
    }, true);

    preview.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const allSpans = Array.from(preview.querySelectorAll('.pv-content'));
        const matches = [];

        for (const span of allSpans) {
          const text = span.textContent;
          let idx = text.indexOf('[xxx]');
          while (idx !== -1) {
            matches.push({ span, idx });
            idx = text.indexOf('[xxx]', idx + 1);
          }
        }
        logDebug('TAB', 'Placeholders detectes dans le preview', { count: matches.length });

        if (matches.length === 0) return;

        const sel = window.getSelection();
        let currentMatchIndex = -1;

        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);

          for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            if (m.span.firstChild && range.startContainer === m.span.firstChild && range.startOffset === m.idx && range.endOffset === m.idx + 5) {
                currentMatchIndex = i;
                logDebug('TAB', 'Placeholder courant detecte', { index: i });
            }
          }
        }

        let nextMatch = null;

        const activeEl = document.activeElement;
        const activeSpan = activeEl && activeEl.classList.contains('pv-content') ? activeEl : null;

        if (!activeSpan) {
          nextMatch = matches[0];
          logDebug('TAB', 'Aucun span actif, selection du premier placeholder');
        } else {
          const range = sel.getRangeAt(0);

          for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            const matchRange = document.createRange();
            if (m.span.firstChild) {
               matchRange.setStart(m.span.firstChild, m.idx);
               matchRange.setEnd(m.span.firstChild, m.idx + 5);
            } else {
               continue;
            }

            const cmp = range.compareBoundaryPoints(Range.START_TO_START, matchRange);

            if (cmp < 0) {
              nextMatch = m;
              logDebug('TAB', 'Placeholder suivant selectionne', { index: i, currentIndex: currentMatchIndex });
              break;
            }
          }

          if (!nextMatch) {
            nextMatch = matches[0];
            logDebug('TAB', 'Retour au premier placeholder');
          }
        }

        if (nextMatch) {
           const m = nextMatch;
           const row = m.span.closest('.pv-row');
           focusRow(row, { mode: 'preserve' });
           const range = document.createRange();
           const sel = window.getSelection();
           try {
             if (m.span.firstChild) {
               range.setStart(m.span.firstChild, m.idx);
               range.setEnd(m.span.firstChild, m.idx + 5);
               sel.removeAllRanges();
               sel.addRange(range);
               m.span.focus();
             }
           } catch(e) { logWarn('TAB', 'Erreur selection placeholder preview', e); }
        }
      }

      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        const addBtn = preview.querySelector('.pv-add-btn');
        if (addBtn) addBtn.click();
      }
    });

    if (toggle) {
      const showPreview = !!toggle.checked;
      preview.style.display = showPreview ? 'block' : 'none';
      textarea.style.display = showPreview ? 'none' : 'block';

      if (showPreview) {
        selectFirstPlaceholderInPreview(preview);
      } else {
        selectFirstPlaceholder(textarea);
      }
    } else {
      preview.style.display = 'block';
      textarea.style.display = 'none';
      selectFirstPlaceholderInPreview(preview);
    }
}
