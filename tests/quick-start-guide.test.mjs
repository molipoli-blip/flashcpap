import assert from 'node:assert/strict';
import test from 'node:test';

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.className = '';
    this.textContent = '';
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

function collectText(node) {
  if (typeof node === 'string') return node;
  return `${node?.textContent || ''}${(node?.children || []).map(collectText).join('')}`;
}

globalThis.document = {
  createDocumentFragment() {
    return new FakeNode('#fragment');
  },
  createElement(tagName) {
    return new FakeNode(tagName.toUpperCase());
  },
  createTextNode(textContent) {
    return { tagName: '#text', textContent, children: [] };
  }
};

const messages = {
  onboardingQuickStartJourneyStart: 'Connectez-vous à ',
  onboardingQuickStartTrialLink: "la page d'essai FlashCPAP ↗"
};

globalThis.chrome = {
  i18n: {
    getMessage(key) {
      return messages[key] || key;
    },
    getUILanguage() {
      return 'fr';
    }
  }
};

const { createQuickStartGuide } = await import('../src/quick-start-guide.js');

test("the trial page is the guide's first numbered step", () => {
  const fragment = createQuickStartGuide();

  assert.equal(fragment.children.length, 1);
  const instructions = fragment.children[0];
  assert.equal(instructions.tagName, 'OL');
  assert.equal(instructions.children.length, 7);

  const firstStep = instructions.children[0];
  assert.equal(firstStep.tagName, 'LI');
  assert.equal(firstStep.className, 'onboarding-trial-step');
  assert.equal(collectText(firstStep), "Connectez-vous à la page d'essai FlashCPAP ↗.");

  const trialLink = firstStep.children.find(child => child.tagName === 'A');
  assert.equal(trialLink?.href, 'https://www.flashcpap.com/espace-essai/');
  assert.equal(trialLink?.target, '_blank');
  assert.equal(trialLink?.rel, 'noopener noreferrer');
});
