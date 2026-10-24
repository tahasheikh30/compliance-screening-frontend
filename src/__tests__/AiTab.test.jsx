import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../api', async () => ({ ...(await import('./aiMocks')).aiApi, getAiUsage: vi.fn() }))

import { ToastProvider } from '../components/Toaster'
import AiTab, { usd } from '../pages/console/AiTab'
import { getAiUsage } from '../api'

afterEach(() => { cleanup(); vi.clearAllMocks() })

const usage = (over = {}) => ({
  days: 30, openrouter: { ok: true, usage_usd: 1.5, daily_usd: 0.0123, weekly_usd: 0.2, monthly_usd: 1, limit_usd: 10, limit_remaining_usd: 8.5 },
  totals: { calls: 12, failures: 1, tokens_in: 3400, tokens_out: 560, cost_usd: 0.0312 },
  daily: [{ day: '2026-10-24', calls: 12, failures: 1, tokens_in: 3400, tokens_out: 560, cost_usd: 0.0312 }],
  by_feature: [{ feature: 'memo', model: 'openai/gpt-4o-mini', calls: 12, failures: 1, tokens_in: 3400, tokens_out: 560, cost_usd: 0.0312 }], ...over })

describe('AI tab', () => {
  it('formats dollars so small spends are not zero', () => {
    expect(usd(0.0123)).toBe('$0.0123'); expect(usd(0)).toBe('$0.00'); expect(usd(12.5)).toBe('$12.50'); expect(usd(null)).toBe('n/a')
  })
  it('shows OpenRouter spend and this app\'s tokens and cost by feature', async () => {
    getAiUsage.mockResolvedValue(usage())
    render(<ToastProvider><AiTab /></ToastProvider>)
    expect(await screen.findByText('$0.0123')).toBeTruthy()           // OpenRouter, today
    expect(screen.getByText('$8.50')).toBeTruthy()                    // credit left
    expect(screen.getAllByText('$0.0312').length).toBeGreaterThan(0)  // this app's cost
    expect(screen.getByText('memo')).toBeTruthy()
    expect(screen.getAllByText('3,400').length).toBeGreaterThan(0)
  })
  it('still shows this app\'s counts when OpenRouter cannot be reached, and asks for another range', async () => {
    getAiUsage.mockResolvedValue(usage({ openrouter: { ok: false, error: 'timeout' } }))
    render(<ToastProvider><AiTab /></ToastProvider>)
    expect(await screen.findByText(/OpenRouter could not be reached/)).toBeTruthy()
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '90 days' }))
    await waitFor(() => expect(getAiUsage).toHaveBeenLastCalledWith(90))
  })
})
