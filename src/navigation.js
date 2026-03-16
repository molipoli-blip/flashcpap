// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 molipoli-blip
// FlashCPAP - https://github.com/molipoli-blip/flashcpap
// src/navigation.js - Gestion de la navigation et des onglets

/**
 * Configuration de la navigation principale entre les onglets (Analyse, Paramètres)
 */
export function setupTabNavigation({ onMainTabActivated, onSubTabActivated } = {}) {
  const tabAnalyse = document.getElementById('tab-analyse');
  const tabParam = document.getElementById('tab-param');
  const tabBug = document.getElementById('tab-bug');
  const panelAnalyse = document.getElementById('analyse');
  const panelParam = document.getElementById('param');
  const panelBug = document.getElementById('bug-panel');
  
  if (!tabAnalyse || !tabParam || !panelAnalyse || !panelParam) return;
  
  // Helper function to switch tabs
  function switchToTab(activeTab, activePanel, tabName) {
    // Remove active from all tabs
    const tabs = [tabAnalyse, tabParam];
    if (tabBug) tabs.push(tabBug);
    
    const panels = [panelAnalyse, panelParam];
    if (panelBug) panels.push(panelBug);

    tabs.forEach(tab => tab.classList.remove('active'));
    panels.forEach(panel => panel.classList.remove('active'));
    
    // Add active to selected tab and panel
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

  if (tabBug && panelBug) {
    tabBug.addEventListener('click', () => {
      switchToTab(tabBug, panelBug, 'bug');
    });
  }

  // Setup sub-tabs navigation for Paramètres
  setupSubTabNavigation({ onSubTabActivated });
}

/**
 * Configuration de la navigation des sous-onglets dans l'onglet Paramètres
 */
function setupSubTabNavigation({ onSubTabActivated } = {}) {
  const subtabs = ['general', 'interpretation', 'organization'];
  
  subtabs.forEach(subtab => {
    const tabButton = document.getElementById(`param-tab-${subtab}`);
    const panel = document.getElementById(`param-${subtab}-panel`);
    
    if (tabButton && panel) {
      tabButton.addEventListener('click', () => {
        // Remove active from all subtabs
        subtabs.forEach(st => {
          const btn = document.getElementById(`param-tab-${st}`);
          const pnl = document.getElementById(`param-${st}-panel`);
          if (btn) {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
          }
          if (pnl) {
            pnl.classList.remove('active');
          }
        });
        
        // Add active to clicked subtab
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