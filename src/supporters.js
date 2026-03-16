// SPDX-License-Identifier: Apache-2.0
// FlashCPAP — Supporters content config
import { t } from './i18n.js';

function getSupportersConfig() {
  return {
    donorsPrefix: 'Avec le soutien de : ',
    donors: ['PrestaireX'],
    coffee: {
      title: t('supportTitle'),
      descriptionHtml: t('supportDescriptionHtml'),
      link: 'https://ko-fi.com/flashcpap',
      buttonLabel: t('supportButtonLinkLabel'),
      thanks: t('supportThanks')
    }
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || '';
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = value || '';
}

export function initSupportersUI() {
  const supportersConfig = getSupportersConfig();
  const donorsRibbon = document.getElementById('donors-ribbon');
  if (donorsRibbon) {
    donorsRibbon.style.display = '';
    donorsRibbon.innerHTML = '';
    Object.assign(donorsRibbon.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0',
      padding: '3px 6px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      background: 'transparent',
      color: '#334155',
      fontSize: '11px',
      lineHeight: '1.2',
      overflow: 'hidden'
    });

    const supportBtn = document.createElement('button');
    supportBtn.type = 'button';
    supportBtn.id = 'donors-support-btn';
    supportBtn.textContent = t('supportButtonLabel');
    Object.assign(supportBtn.style, {
      flex: '0 0 auto',
      border: '1px solid #f5cf7a',
      background: 'linear-gradient(180deg, #ffefc6, #ffe2a1)',
      color: '#7a4a00',
      borderRadius: '8px',
      padding: '4px 10px',
      fontSize: '10px',
      fontWeight: '700',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 2px rgba(122,74,0,0.18)'
    });
    supportBtn.title = t('supportOpenTitle');
    supportBtn.addEventListener('mouseenter', () => {
      supportBtn.style.filter = 'brightness(0.98)';
    });
    supportBtn.addEventListener('mouseleave', () => {
      supportBtn.style.filter = 'none';
    });
    supportBtn.addEventListener('click', () => {
      try { window.open(supportersConfig.coffee.link, '_blank', 'noopener,noreferrer'); } catch {}
    });

    donorsRibbon.appendChild(supportBtn);
    donorsRibbon.title = t('supportTitle');
  }

  setText('coffee-title', supportersConfig.coffee.title);
  setHtml('coffee-description', supportersConfig.coffee.descriptionHtml);
  setText('coffee-thanks', supportersConfig.coffee.thanks);

  const coffeeLink = document.getElementById('coffee-link');
  if (coffeeLink) {
    coffeeLink.href = supportersConfig.coffee.link;
    coffeeLink.textContent = supportersConfig.coffee.buttonLabel;
  }
}

export { getSupportersConfig };
