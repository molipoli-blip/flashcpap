// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip

import { t } from './i18n.js';

function createButtonLabel(key) {
  const label = document.createElement('span');
  label.className = 'onboarding-ui-label';
  label.textContent = t(key);
  return label;
}

function createFieldCardLabel() {
  const label = document.createElement('span');
  label.className = 'onboarding-field-card-label';

  const handle = document.createElement('span');
  handle.className = 'onboarding-field-card-handle';
  handle.textContent = '⋮⋮';

  const icon = document.createElement('span');
  icon.textContent = '📝';

  const text = document.createElement('span');
  text.textContent = t('onboardingFieldCardLabel');

  label.append(handle, icon, text);
  return label;
}

function createInstruction(...parts) {
  const item = document.createElement('li');
  parts.forEach(part => item.append(
    typeof part === 'string' ? document.createTextNode(part) : part
  ));
  return item;
}

export function createQuickStartGuide() {
  const fragment = document.createDocumentFragment();

  const trialIntro = document.createElement('p');
  trialIntro.className = 'onboarding-trial-intro';
  const trialIntroText = document.createElement('span');
  trialIntroText.textContent = t('onboardingQuickStartJourneyStart');
  const trialLink = document.createElement('a');
  trialLink.href = 'https://www.flashcpap.com/espace-essai/';
  trialLink.target = '_blank';
  trialLink.rel = 'noopener noreferrer';
  trialLink.textContent = t('onboardingQuickStartTrialLink');
  trialIntro.append(trialIntroText, trialLink, document.createTextNode('.'));

  const instructions = document.createElement('ol');
  instructions.className = 'onboarding-quick-start';
  const providerStep = createInstruction(
    t('onboardingQuickStartStep2Before'),
    createButtonLabel('buttonAddProvider'),
    t('onboardingQuickStartStep2After')
  );

  const communityNote = document.createElement('span');
  communityNote.className = 'onboarding-community-note';
  const communityBefore = document.createElement('span');
  communityBefore.textContent = t('onboardingCommunityBefore');
  const communityLink = document.createElement('a');
  communityLink.href = 'https://flashcpap.com/#community';
  communityLink.target = '_blank';
  communityLink.rel = 'noopener noreferrer';
  communityLink.textContent = t('onboardingCommunityLink');
  const communityAfter = document.createElement('span');
  communityAfter.textContent = t('onboardingCommunityAfter');
  communityNote.append(communityBefore, communityLink, communityAfter);
  providerStep.appendChild(communityNote);

  const fieldConfigurationStep = createInstruction(
    t('onboardingQuickStartStep5Before'),
    createButtonLabel('tabSettings'),
    t('onboardingQuickStartStep5After'),
    createFieldCardLabel(),
    t('onboardingQuickStartStep5Details')
  );

  const criticalDocs = document.createElement('span');
  criticalDocs.className = 'onboarding-critical-docs';
  const criticalDocsBefore = document.createElement('span');
  criticalDocsBefore.textContent = t('onboardingCriticalDocsBefore');
  const docsLink = document.createElement('a');
  docsLink.href = 'https://flashcpap.com/docs#step3';
  docsLink.target = '_blank';
  docsLink.rel = 'noopener noreferrer';
  docsLink.textContent = t('onboardingDocsLink');
  const criticalDocsAfter = document.createElement('strong');
  criticalDocsAfter.textContent = t('onboardingCriticalDocsAfter');
  criticalDocs.append(criticalDocsBefore, docsLink, criticalDocsAfter);
  fieldConfigurationStep.appendChild(criticalDocs);

  instructions.append(
    createInstruction(t('onboardingQuickStartStep1'), createButtonLabel('tabSettings'), '.'),
    providerStep,
    createInstruction(t('onboardingQuickStartStep3Before'), createButtonLabel('tabAnalyze'), t('onboardingQuickStartStep3Middle'), createButtonLabel('buttonAnalyzePage'), '.'),
    createInstruction(t('onboardingQuickStartStep4'), createButtonLabel('buttonOpenSourceText'), '.'),
    fieldConfigurationStep,
    createInstruction(t('onboardingQuickStartStep6Before'), createButtonLabel('tabAnalyze'), t('onboardingQuickStartStep6Middle'), createButtonLabel('buttonAnalyzePage'), '.')
  );

  fragment.append(trialIntro, instructions);
  return fragment;
}
