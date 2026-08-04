// SPDX-License-Identifier: Apache-2.0

function getChromium() {
  return globalThis.chrome;
}

function requireChromium() {
  const chromium = getChromium();
  if (!chromium) {
    throw new Error('Chromium extension API is unavailable in this context.');
  }
  return chromium;
}

export const chromiumApi = {
  name: 'chromium',
  storage: {
    local: {
      async get(keys) {
        const chromium = requireChromium();
        return chromium.storage.local.get(keys);
      },
      async set(items) {
        const chromium = requireChromium();
        return chromium.storage.local.set(items);
      }
    }
  },
  tabs: {
    async query(queryInfo) {
      const chromium = requireChromium();
      return chromium.tabs.query(queryInfo);
    },
    async get(tabId) {
      const chromium = requireChromium();
      return chromium.tabs.get(tabId);
    },
    async reload(tabId, options = {}) {
      const chromium = requireChromium();
      return chromium.tabs.reload(tabId, options);
    },
    async create(createProperties) {
      const chromium = requireChromium();
      return chromium.tabs.create(createProperties);
    },
    get onActivated() {
      return getChromium()?.tabs?.onActivated || null;
    },
    get onUpdated() {
      return getChromium()?.tabs?.onUpdated || null;
    },
    get onRemoved() {
      return getChromium()?.tabs?.onRemoved || null;
    }
  },
  windows: {
    async getLastFocused(getInfo) {
      const chromium = requireChromium();
      return chromium.windows.getLastFocused(getInfo);
    },
    async create(createData) {
      const chromium = requireChromium();
      return chromium.windows.create(createData);
    },
    async update(windowId, updateInfo) {
      const chromium = requireChromium();
      return chromium.windows.update(windowId, updateInfo);
    },
    get onFocusChanged() {
      return getChromium()?.windows?.onFocusChanged || null;
    },
    get onRemoved() {
      return getChromium()?.windows?.onRemoved || null;
    }
  },
  permissions: {
    async contains(options) {
      const chromium = requireChromium();
      return chromium.permissions.contains(options);
    },
    async request(options) {
      const chromium = requireChromium();
      return chromium.permissions.request(options);
    }
  },
  runtime: {
    getUrl(path) {
      const chromium = requireChromium();
      return chromium.runtime.getURL(path);
    },
    getManifest() {
      const chromium = requireChromium();
      return chromium.runtime.getManifest();
    }
  },
  i18n: {
    getUiLanguage() {
      const chromium = requireChromium();
      return chromium.i18n.getUILanguage();
    },
    getMessage(key, substitutions) {
      const chromium = requireChromium();
      return chromium.i18n.getMessage(key, substitutions);
    }
  },
  action: {
    get onClicked() {
      return getChromium()?.action?.onClicked || null;
    }
  },
  webNavigation: {
    async getAllFrames(details) {
      const chromium = requireChromium();
      return chromium.webNavigation.getAllFrames(details);
    },
    get onCompleted() {
      return getChromium()?.webNavigation?.onCompleted || null;
    }
  },
  scripting: {
    async executeScript({ tabId, allFrames = false, frameIds, func }) {
      const chromium = requireChromium();
      return chromium.scripting.executeScript({
        target: frameIds ? { tabId, frameIds } : { tabId, allFrames },
        func
      });
    }
  }
};
