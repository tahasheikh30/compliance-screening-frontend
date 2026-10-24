import { vi } from 'vitest'

/** Stand-ins for the optional AI endpoints, for tests that replace the whole api module. AI search is off. */
export const aiApi = {
  getAiStatus: vi.fn(async () => ({ state: 'off', configured: false, enabled: false, available: false, features: {}, message: 'AI search is off.' })),
  getAiAdmin: vi.fn(async () => ({ state: 'off', configured: false, enabled: false, available: false, features: {}, feature_list: [], message: 'AI search is off.' })),
  setAiAdmin: vi.fn(), testAi: vi.fn(),
  getMemo: vi.fn(async () => ({ memo: null, ai_available: false })), draftMemo: vi.fn(), saveMemo: vi.fn(), approveMemo: vi.fn(), downloadMemo: vi.fn(),
  askCopilot: vi.fn(), getDigest: vi.fn(async () => ({ days: 7, stats: { total: 0, open: 0, confirmed: 0, dismissed: 0, by_source: {}, oldest_open_days: 0, people: 0 }, open_alerts: [], narrative: null })),
}
