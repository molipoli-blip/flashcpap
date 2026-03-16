// SPDX-License-Identifier: Apache-2.0

function getFirefox() {
  return globalThis.browser;
}

function requireFirefox() {
  const firefox = getFirefox();
  if (!firefox) {
    throw new Error('Firefox extension API is unavailable in this context.');
  }
  return firefox;
}

function withoutUnsupportedReloadOptions() {
  return undefined;
}

export const firefoxApi = {
  name: 'firefox',
  storage: {
    local: {
      async get(keys) {
        const firefox = requireFirefox();
        return firefox.storage.local.get(keys);
      },
      async set(items) {
        const firefox = requireFirefox();
        return firefox.storage.local.set(items);
      }
    }
  },
  tabs: {
    async query(queryInfo) {
      const firefox = requireFirefox();
      return firefox.tabs.query(queryInfo);
    },
    async get(tabId) {
      const firefox = requireFirefox();
      return firefox.tabs.get(tabId);
    },
    async reload(tabId, options = {}) {
      const firefox = requireFirefox();
      return firefox.tabs.reload(tabId, withoutUnsupportedReloadOptions(options));
    },
    async create(createProperties) {
      const firefox = requireFirefox();
      return firefox.tabs.create(createProperties);
    },
    async update(tabId, updateProperties) {
      const firefox = requireFirefox();
      return firefox.tabs.update(tabId, updateProperties);
    },
    get onRemoved() {
      return getFirefox()?.tabs?.onRemoved || null;
    }
  },
  windows: {
    async getLastFocused(getInfo) {
      const firefox = requireFirefox();
      return firefox.windows.getLastFocused(getInfo);
    },
    async create(createData) {
      const firefox = requireFirefox();
      return firefox.windows.create(createData);
    },
    async update(windowId, updateInfo) {
      const firefox = requireFirefox();
      return firefox.windows.update(windowId, updateInfo);
    },
    get onRemoved() {
      return getFirefox()?.windows?.onRemoved || null;
    }
  },
  permissions: {
    async request(options) {
      const firefox = requireFirefox();
      return firefox.permissions.request(options);
    }
  },
  runtime: {
    getUrl(path) {
      const firefox = requireFirefox();
      return firefox.runtime.getURL(path);
    },
    getManifest() {
      const firefox = requireFirefox();
      return firefox.runtime.getManifest();
    }
  },
  i18n: {
    getUiLanguage() {
      const firefox = requireFirefox();
      return firefox.i18n.getUILanguage();
    },
    getMessage(key, substitutions) {
      const firefox = requireFirefox();
      return firefox.i18n.getMessage(key, substitutions);
    }
  },
  action: {
    get onClicked() {
      return getFirefox()?.action?.onClicked || null;
    }
  },
  scripting: {
    async executeScript({ tabId, allFrames = false, func }) {
      const firefox = requireFirefox();
      const results = await firefox.scripting.executeScript({
        target: { tabId, allFrames },
        func
      });
      return results || [];
    }
  }
};
