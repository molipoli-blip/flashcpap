// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
export function initDock() {
  const btnOpenDock = document.getElementById('btn-open-dock');
  const dock = document.getElementById('source-dock');
  const dockBody = document.getElementById('source-dock-body');
  const dockResizer = document.getElementById('source-dock-resizer');
  const btnAttach = document.getElementById('btn-attach-source');
  const btnClose = document.getElementById('btn-close-source');
  const holdingPen = document.getElementById('source-holding-pen');
  const sourceToolbar = document.getElementById('source-toolbar');
  const sourceWrapper = document.getElementById('source-wrapper');
  let isDocked = false;

  const MIN_LEFT_UI = 220;       // px: keep at least this much for the main UI
  const MIN_DOCK_WIDTH = 120;    // px: new smaller minimum so you can reduce further
  const MAX_DOCK_WIDTH = 900;    // px: hard upper bound

  function clampDockWidth(target) {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) || 500;
    const maxByViewport = Math.max(MIN_DOCK_WIDTH, vw - MIN_LEFT_UI);
    return Math.min(Math.max(MIN_DOCK_WIDTH, target), Math.min(MAX_DOCK_WIDTH, maxByViewport));
  }

  function dockSource() {
    if (isDocked) return;

    dockBody.innerHTML = '';
    dockBody.appendChild(sourceToolbar);
    dockBody.appendChild(sourceWrapper);

    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) || 500;
    const desired = Math.min(420, vw - MIN_LEFT_UI);
    const safeWidth = clampDockWidth(desired);
    dock.style.width = `${safeWidth}px`;
    document.body.style.setProperty('--source-dock-width', `${safeWidth}px`);

    dock.style.display = 'flex';
    document.body.classList.add('docked-right');

    const jump = document.getElementById('jump-select');
    if (jump) {
      const hasOptions = jump.options && jump.options.length > 1;
      jump.style.display = hasOptions ? 'inline-block' : 'none';
    }

    if (btnOpenDock) btnOpenDock.style.display = 'none';

    isDocked = true;
  }

  function undockSource() {
    if (!isDocked) return;

    holdingPen.appendChild(sourceToolbar);
    holdingPen.appendChild(sourceWrapper);

    dock.style.display = 'none';
    document.body.classList.remove('docked-right');

    if (btnOpenDock) btnOpenDock.style.display = '';

    isDocked = false;
  }

  // Resizer logic
  (function enableResize(){
    if (!dock || !dockResizer) return;
    let resizing = false; let startX = 0; let startWidth = 0;
    dockResizer.addEventListener('pointerdown', (e) => {
      resizing = true; startX = e.clientX; startWidth = dock.getBoundingClientRect().width;
      dockResizer.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    dockResizer.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      const dx = startX - e.clientX; // dragging left increases width
      let newWidth = clampDockWidth(startWidth + dx);
      dock.style.width = `${newWidth}px`;
      document.body.style.setProperty('--source-dock-width', `${newWidth}px`);
    });
    const stop = () => { resizing = false; };
    dockResizer.addEventListener('pointerup', stop);
    dockResizer.addEventListener('pointercancel', stop);

    // Quick toggle: double-click the resizer to switch between compact and standard widths
    dockResizer.addEventListener('dblclick', () => {
      const curr = dock.getBoundingClientRect().width;
      const compact = clampDockWidth(200);
      const standard = clampDockWidth(420);
      const target = curr > (compact + 40) ? compact : standard;
      dock.style.width = `${target}px`;
      document.body.style.setProperty('--source-dock-width', `${target}px`);
    });
  })();

  btnOpenDock?.addEventListener('click', dockSource);
  btnAttach?.addEventListener('click', undockSource);
  btnClose?.addEventListener('click', undockSource);

  // Keep dock within viewport on resize
  window.addEventListener('resize', () => {
    if (!isDocked) return;
    let current = dock.getBoundingClientRect().width;
    current = clampDockWidth(current);
    dock.style.width = `${current}px`;
    document.body.style.setProperty('--source-dock-width', `${current}px`);
  });

  return { dockSource, undockSource, isDocked: () => isDocked };
}
