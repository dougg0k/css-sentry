type StorageValue = Record<string, unknown>;
const storage = new Map<string, unknown>();
const sessionRules: unknown[] = [];
const navigationListeners: Array<(details: { tabId: number; url: string; frameId: number }) => void> = [];
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
    async updateSessionRules(update: { removeRuleIds?: number[]; addRules?: unknown[] }): Promise<void> {
      if (update.removeRuleIds?.length) {
        for (const id of update.removeRuleIds) {
          const idx = sessionRules.findIndex((rule) => (rule as { id?: number }).id === id);
          if (idx >= 0) sessionRules.splice(idx, 1);
        }
      }
      if (update.addRules?.length) sessionRules.push(...update.addRules);
    },
    __getSessionRules(): unknown[] { return sessionRules; }
  },
  tabs: {
    async query(): Promise<Array<{ id: number; url: string }>> { return [{ id: 1, url: "https://app.example.test/" }]; },
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
    onBeforeNavigate: { addListener(listener: (details: { tabId: number; url: string; frameId: number }) => void): void { navigationListeners.push(listener); } },
    onCommitted: { addListener(listener: (details: { tabId: number; url: string; frameId: number }) => void): void { navigationListeners.push(listener); } }
  },
  action: {
    async setBadgeText(): Promise<void> {},
    async setBadgeBackgroundColor(): Promise<void> {}
  },
  permissions: {
    async contains(): Promise<boolean> { return true; },
    async request(): Promise<boolean> { return true; }
  }
};

export function __resetBrowserMock(): void { storage.clear(); sessionRules.splice(0, sessionRules.length); navigationListeners.splice(0, navigationListeners.length); removedTabListeners.splice(0, removedTabListeners.length); }
export function __emitNavigation(details: { tabId: number; url: string; frameId: number }): void { for (const listener of navigationListeners) listener(details); }
export function __emitTabRemoved(tabId: number): void { for (const listener of removedTabListeners) listener(tabId); }
