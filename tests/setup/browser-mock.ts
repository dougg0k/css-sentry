type StorageValue = Record<string, unknown>;

export type MockDnrRule = {
  id?: number;
  priority?: number;
  action?: { type?: string };
  condition?: {
    requestDomains?: string[];
    urlFilter?: string;
    regexFilter?: string;
    domainType?: string;
    tabIds?: number[];
    resourceTypes?: string[];
    initiatorDomains?: string[];
  };
};

export type MockDnrSessionRuleUpdate = {
  removeRuleIds?: number[];
  addRules?: MockDnrRule[];
};

const storage = new Map<string, unknown>();
const sessionRules: MockDnrRule[] = [];
let updateSessionRulesFailure: ((update: MockDnrSessionRuleUpdate) => boolean) | null = null;
const navigationListeners: Array<(details: { tabId: number; url: string; frameId: number; parentFrameId?: number }) => void> = [];
const removedTabListeners: Array<(tabId: number) => void> = [];

export const browser = {
  storage: {
    local: {
      async get(key?: string | string[] | null): Promise<StorageValue> {
        if (key === null || key === undefined) return Object.fromEntries(storage.entries());
        if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, storage.get(item)]));
        return { [key]: storage.get(key) };
      },
      async set(values: StorageValue): Promise<void> { for (const [key, value] of Object.entries(values)) storage.set(key, value); },
      async remove(keys: string | string[]): Promise<void> { for (const key of Array.isArray(keys) ? keys : [keys]) storage.delete(key); },
      async clear(): Promise<void> { storage.clear(); }
    }
  },
  declarativeNetRequest: {
    async updateSessionRules(update: MockDnrSessionRuleUpdate): Promise<void> {
      if (updateSessionRulesFailure?.(update)) throw new Error("mock DNR rule update rejected");
      if (update.removeRuleIds?.length) {
        for (const id of update.removeRuleIds) {
          const idx = sessionRules.findIndex((rule) => rule.id === id);
          if (idx >= 0) sessionRules.splice(idx, 1);
        }
      }
      if (update.addRules?.length) sessionRules.push(...update.addRules);
    },
    async getSessionRules(): Promise<MockDnrRule[]> { return [...sessionRules]; },
    __getSessionRules(): MockDnrRule[] { return sessionRules; },
    __setUpdateSessionRulesFailure(predicate: ((update: MockDnrSessionRuleUpdate) => boolean) | null): void { updateSessionRulesFailure = predicate; }
  },
  tabs: {
    async query(): Promise<Array<{ id: number; url: string }>> { return [{ id: 1, url: "https://app.example.test/" }]; },
    async get(tabId: number): Promise<{ id: number; url: string }> { return { id: tabId, url: "https://app.example.test/" }; },
    async create(): Promise<void> {},
    onRemoved: { addListener(listener: (tabId: number) => void): void { removedTabListeners.push(listener); } }
  },
  runtime: {
    getURL(path: string): string { return `chrome-extension://test/${path}`; },
    async sendMessage(): Promise<void> {},
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener() {} }
  },
  webNavigation: {
    onBeforeNavigate: { addListener(listener: (details: { tabId: number; url: string; frameId: number; parentFrameId?: number }) => void): void { navigationListeners.push(listener); } },
    onCommitted: { addListener(listener: (details: { tabId: number; url: string; frameId: number; parentFrameId?: number }) => void): void { navigationListeners.push(listener); } },
    onErrorOccurred: { addListener(listener: (details: { tabId: number; url: string; frameId: number; parentFrameId?: number }) => void): void { navigationListeners.push(listener); } }
  },
  action: {
    async setBadgeText(): Promise<void> {},
    async setBadgeBackgroundColor(): Promise<void> {}
  },
  permissions: {
    async contains(): Promise<boolean> { return true; },
    async request(): Promise<boolean> { return true; }
  },
  __resetBrowserMock(): void { resetBrowserMockState(); }
};

function resetBrowserMockState(): void {
  storage.clear();
  sessionRules.splice(0, sessionRules.length);
  updateSessionRulesFailure = null;
  navigationListeners.splice(0, navigationListeners.length);
  removedTabListeners.splice(0, removedTabListeners.length);
}

export function __resetBrowserMock(): void { resetBrowserMockState(); }
export function __emitNavigation(details: { tabId: number; url: string; frameId: number; parentFrameId?: number }): void { for (const listener of navigationListeners) listener(details); }
export function __emitTabRemoved(tabId: number): void { for (const listener of removedTabListeners) listener(tabId); }
