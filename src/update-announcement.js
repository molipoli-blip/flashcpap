// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// Display a dismissible update message once per extension version.

import { t } from './i18n.js';

const DISMISSED_VERSION_KEY = 'flashcpap:update-dismissed-version';
const ANNOUNCEMENT_ID = 'update-announcement';

// Example title/body pairs you can reuse in translation files.
// - updateBannerExampleTitle1 / updateBannerExampleBody1
// - updateBannerExampleTitle2 / updateBannerExampleBody2
// - updateBannerExampleTitle3 / updateBannerExampleBody3

function getCurrentVersion(browserApi) {
  try {
    return browserApi?.runtime?.getManifest?.()?.version || '';
  } catch {
    return '';
  }
}

function hasDismissedVersion(version) {
  try {
    return localStorage.getItem(DISMISSED_VERSION_KEY) === version;
  } catch {
    return false;
  }
}

function markVersionDismissed(version) {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch {}
}

function createAnnouncementElement(version) {
  const overlay = document.createElement('div');
  overlay.id = ANNOUNCEMENT_ID;
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '10050',
    background: '#f8fafc',
    color: '#334155',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '24px',
    gap: '14px'
  });

  const title = document.createElement('h2');
  title.textContent = t('updateBannerTitle', [version]);
  Object.assign(title.style, {
    margin: '0',
    fontSize: '20px',
    lineHeight: '1.25',
    color: '#0f172a'
  });

  const contentWrap = document.createElement('div');
  Object.assign(contentWrap.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '920px',
    overflowY: 'auto'
  });

  let appendedSections = 0;
  for (let index = 1; index <= 6; index++) {
    const titleKey = `updateBannerSectionTitle${index}`;
    const bodyKey = `updateBannerSectionBody${index}`;
    const sectionTitle = t(titleKey, [version]);
    const sectionBody = t(bodyKey, [version]);
    if (sectionTitle === titleKey || sectionBody === bodyKey) continue;

    const section = document.createElement('section');
    Object.assign(section.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    });

    const sectionTitleEl = document.createElement('h3');
    sectionTitleEl.textContent = sectionTitle;
    Object.assign(sectionTitleEl.style, {
      margin: '0',
      fontSize: '16px',
      lineHeight: '1.3',
      color: '#1e293b'
    });

    const sectionBodyEl = document.createElement('p');
    sectionBodyEl.textContent = sectionBody;
    Object.assign(sectionBodyEl.style, {
      margin: '0',
      fontSize: '14px',
      lineHeight: '1.45',
      color: '#334155',
      whiteSpace: 'pre-line'
    });

    section.appendChild(sectionTitleEl);
    section.appendChild(sectionBodyEl);
    contentWrap.appendChild(section);
    appendedSections += 1;
  }

  if (!appendedSections) {
    const fallbackBody = document.createElement('p');
    fallbackBody.textContent = t('updateBannerBody', [version]);
    Object.assign(fallbackBody.style, {
      margin: '0',
      fontSize: '14px',
      lineHeight: '1.45',
      color: '#334155',
      whiteSpace: 'pre-line'
    });
    contentWrap.appendChild(fallbackBody);
  }

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = t('updateBannerClose');
  closeButton.title = t('updateBannerCloseTitle');
  Object.assign(closeButton.style, {
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    borderRadius: '4px',
    fontSize: '11px',
    padding: '3px 8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  });

  closeButton.addEventListener('click', () => {
    markVersionDismissed(version);
    overlay.remove();
  });

  overlay.appendChild(title);
  overlay.appendChild(contentWrap);
  overlay.appendChild(closeButton);

  return overlay;
}

export function initUpdateAnnouncement({ browserApi } = {}) {
  const version = getCurrentVersion(browserApi);
  if (!version || hasDismissedVersion(version)) return;
  if (document.getElementById(ANNOUNCEMENT_ID)) return;

  const overlay = createAnnouncementElement(version);
  document.body.appendChild(overlay);
}
