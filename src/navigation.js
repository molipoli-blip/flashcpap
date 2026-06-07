// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
import { byId } from './dom-utils.js';

export function setupTabNavigation({ onMainTabActivated, onSubTabActivated } = {}) {
  const tabAnalyse = byId('tab-analyse');
  const tabParam = byId('tab-param');
  const tabHelp = byId('tab-help');
  const tabBug = byId('tab-bug');
  const panelAnalyse = byId('analyse');
  const panelParam = byId('param');
  const panelHelp = byId('help-panel');
  const panelBug = byId('bug-panel');

  if (!tabAnalyse || !tabParam || !panelAnalyse || !panelParam) return;

  function switchToTab(activeTab, activePanel, tabName) {
    const tabs = [tabAnalyse, tabParam];
    if (tabHelp) tabs.push(tabHelp);
    if (tabBug) tabs.push(tabBug);

    const panels = [panelAnalyse, panelParam];
    if (panelHelp) panels.push(panelHelp);
    if (panelBug) panels.push(panelBug);

    tabs.forEach(tab => tab.classList.remove('active'));
    panels.forEach(panel => panel.classList.remove('active'));

    activeTab.classList.add('active');
    activePanel.classList.add('active');

    if (typeof onMainTabActivated === 'function' && tabName) {
      onMainTabActivated(tabName, activePanel);
    }
  }

  tabAnalyse.addEventListener('click', () => {
    switchToTab(tabAnalyse, panelAnalyse, 'analyse');
  });

  tabParam.addEventListener('click', () => {
    switchToTab(tabParam, panelParam, 'param');
  });

  if (tabHelp && panelHelp) {
    tabHelp.addEventListener('click', () => {
      switchToTab(tabHelp, panelHelp, 'help');
    });
  }

  if (tabBug && panelBug) {
    tabBug.addEventListener('click', () => {
      switchToTab(tabBug, panelBug, 'bug');
    });
  }

  setupSubTabNavigation({ onSubTabActivated });
}

function setupSubTabNavigation({ onSubTabActivated } = {}) {
  const subtabs = ['general', 'interpretation', 'organization'];

  subtabs.forEach(subtab => {
    const tabButton = byId(`param-tab-${subtab}`);
    const panel = byId(`param-${subtab}-panel`);

    if (tabButton && panel) {
      tabButton.addEventListener('click', () => {
        subtabs.forEach(st => {
          const btn = byId(`param-tab-${st}`);
          const pnl = byId(`param-${st}-panel`);
          if (btn) {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
          }
          if (pnl) {
            pnl.classList.remove('active');
          }
        });

        tabButton.classList.add('active');
        tabButton.setAttribute('aria-selected', 'true');
        panel.classList.add('active');

        if (typeof onSubTabActivated === 'function') {
          onSubTabActivated(subtab, panel);
        }

      });
    }
  });
}
