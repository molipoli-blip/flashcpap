// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// Versioned getting-started guide. Each guide revision is shown once to both
// new and existing users, including after an extension update.

import { t } from './i18n.js';
import { openQuickStartDock } from './quick-start-dock.js';

const ONBOARDING_PENDING_KEY = 'flashcpap:onboarding-pending';
const ONBOARDING_COMPLETED_KEY = 'flashcpap:onboarding-completed';
const ONBOARDING_SEEN_REVISION_KEY = 'flashcpap:onboarding-seen-revision';
const ONBOARDING_ID = 'first-run-onboarding';
export const CURRENT_ONBOARDING_REVISION = 'quick-start-2026-08';

function writeLocalFlag(key, value) {
  try {
    if (value) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {}
}

function readLocalValue(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeLocalValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function shouldShowCurrentOnboarding() {
  return readLocalValue(ONBOARDING_SEEN_REVISION_KEY) !== CURRENT_ONBOARDING_REVISION;
}

export function markCurrentOnboardingSeen() {
  writeLocalValue(ONBOARDING_SEEN_REVISION_KEY, CURRENT_ONBOARDING_REVISION);
  // Remove the legacy flags after migration so they cannot affect later guide revisions.
  writeLocalFlag(ONBOARDING_COMPLETED_KEY, false);
  writeLocalFlag(ONBOARDING_PENDING_KEY, false);
}

function openSettings() {
  document.getElementById('tab-param')?.click();
  document.getElementById('param-tab-general')?.click();
  requestAnimationFrame(() => {
    document.getElementById('import-provider-group')?.scrollIntoView({ block: 'start' });
  });
}

function createStep({ icon, titleKey, bodyKey, content, centered = false }) {
  const step = document.createElement('section');
  step.className = 'onboarding-step';
  if (centered) step.classList.add('onboarding-step-centered');
  step.hidden = true;

  const title = document.createElement('h2');
  title.textContent = t(titleKey);

  const body = document.createElement('p');
  body.className = 'onboarding-step-body';
  body.textContent = t(bodyKey);

  if (icon) {
    const iconElement = document.createElement('div');
    iconElement.className = 'onboarding-step-icon';
    iconElement.setAttribute('aria-hidden', 'true');
    iconElement.textContent = icon;
    step.appendChild(iconElement);
  }
  step.append(title, body);
  if (content) step.appendChild(content());
  return step;
}

function createSetupDetails() {
  const warning = document.createElement('div');
  warning.className = 'onboarding-setup-warning';

  const strong = document.createElement('strong');
  strong.textContent = t('onboardingSetupWarningTitle');
  const text = document.createElement('span');
  text.textContent = t('onboardingSetupWarningBody');
  warning.append(strong, text);

  const wrap = document.createElement('div');
  wrap.appendChild(warning);
  return wrap;
}

function createOnboardingElement({ onComplete, onDismiss }) {
  const overlay = document.createElement('div');
  overlay.id = ONBOARDING_ID;
  overlay.className = 'onboarding-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'onboarding-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', t('onboardingWelcomeTitle'));

  const header = document.createElement('header');
  header.className = 'onboarding-header';

  const brand = document.createElement('div');
  brand.className = 'onboarding-brand';
  const logo = document.createElement('img');
  logo.src = 'icons/favicon_48px.png';
  logo.alt = '';
  const brandText = document.createElement('span');
  brandText.textContent = 'FlashCPAP';
  brand.append(logo, brandText);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'onboarding-close';
  close.setAttribute('aria-label', t('onboardingLater'));
  close.title = t('onboardingLater');
  close.textContent = '×';
  header.append(brand, close);

  const content = document.createElement('div');
  content.className = 'onboarding-content';
  const steps = [
    createStep({
      icon: '👋',
      titleKey: 'onboardingWelcomeTitle',
      bodyKey: 'onboardingWelcomeBody',
      centered: true
    }),
    createStep({
      titleKey: 'onboardingSetupTitle',
      bodyKey: 'onboardingSetupBody',
      content: createSetupDetails,
      centered: true
    })
  ];
  steps.forEach(step => content.appendChild(step));

  const footer = document.createElement('footer');
  footer.className = 'onboarding-footer';
  const progress = document.createElement('div');
  progress.className = 'onboarding-progress';
  progress.setAttribute('aria-label', t('onboardingProgressLabel'));
  const dots = steps.map(() => {
    const dot = document.createElement('span');
    progress.appendChild(dot);
    return dot;
  });

  const actions = document.createElement('div');
  actions.className = 'onboarding-actions';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'onboarding-button onboarding-button-secondary';
  previous.textContent = t('onboardingPrevious');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'onboarding-button onboarding-button-primary';
  actions.append(previous, next);
  footer.append(progress, actions);

  dialog.append(header, content, footer);
  overlay.appendChild(dialog);

  let currentStep = 0;
  const renderStep = () => {
    steps.forEach((step, index) => {
      step.hidden = index !== currentStep;
      dots[index].classList.toggle('active', index === currentStep);
    });
    previous.hidden = currentStep === 0;
    next.textContent = currentStep === steps.length - 1
      ? t('onboardingOpenGuidePanel')
      : t('onboardingNext');
    next.focus();
  };

  const dismiss = () => {
    overlay.remove();
    document.body.classList.remove('onboarding-open');
    onDismiss?.();
  };

  previous.addEventListener('click', () => {
    if (currentStep > 0) currentStep -= 1;
    renderStep();
  });
  next.addEventListener('click', () => {
    if (currentStep < steps.length - 1) {
      currentStep += 1;
      renderStep();
      return;
    }
    overlay.remove();
    document.body.classList.remove('onboarding-open');
    onComplete?.();
  });
  close.addEventListener('click', dismiss);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') dismiss();
  });

  renderStep();
  return overlay;
}

export function showFirstRunOnboarding({ markComplete = true } = {}) {
  if (document.getElementById(ONBOARDING_ID)) return;

  const overlay = createOnboardingElement({
    onComplete: async () => {
      if (markComplete) markCurrentOnboardingSeen();
      try {
        await openQuickStartDock();
      } catch (error) {
        console.warn('[ONBOARDING] Le guide de démarrage n\'a pas pu être ouvert', error);
      } finally {
        openSettings();
      }
    },
    onDismiss: () => {
      if (markComplete) markCurrentOnboardingSeen();
    }
  });
  document.body.classList.add('onboarding-open');
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.querySelector('.onboarding-button-primary')?.focus();
  });
}

export function initFirstRunOnboarding({ isFirstRun = false } = {}) {
  // `isFirstRun` is kept in the signature for backward compatibility. The
  // revision check deliberately applies to fresh and pre-existing installs.
  void isFirstRun;
  if (shouldShowCurrentOnboarding()) showFirstRunOnboarding();

  document.getElementById('btn-replay-onboarding')?.addEventListener('click', () => {
    openQuickStartDock().catch(error => {
      console.warn('[ONBOARDING] Le guide de démarrage n\'a pas pu être rouvert', error);
    });
  });
}
