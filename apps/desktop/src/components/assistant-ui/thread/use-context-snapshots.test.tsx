import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { HermesGateway } from '@/hermes'

import { useContextSnapshots } from './use-context-snapshots'

afterEach(() => vi.useRealTimers())

it('waits for slow polls, uses revisions, and does not poll a hidden pane', async () => {
  vi.useFakeTimers()
  let resolve!: (value: unknown) => void

  const request = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r
        })
    )
    .mockResolvedValue({ snapshots: [], revision: 'v1', unchanged: true })

  const gateway = { request } as unknown as HermesGateway

  const { result, rerender, unmount } = renderHook(
    ({ visible, running }) => useContextSnapshots(gateway, 'a', visible, running),
    { initialProps: { visible: true, running: true } }
  )

  await act(() => vi.advanceTimersByTimeAsync(15000))
  expect(request).toHaveBeenCalledTimes(1)

  const snapshots = [
    { request_id: 'one', user_row_id: 1, user_text: '', blocks: [], request: '', redacted: true, truncated: false }
  ]

  await act(async () => resolve({ snapshots, revision: 'v1', unchanged: false }))
  expect(result.current.snapshots).toEqual(snapshots)
  await act(() => vi.advanceTimersByTimeAsync(2500))
  expect(request).toHaveBeenLastCalledWith('session.context_snapshots', { session_id: 'a', revision: 'v1' })
  expect(result.current.snapshots).toBe(snapshots)
  rerender({ visible: false, running: true })
  const calls = request.mock.calls.length
  await act(() => vi.advanceTimersByTimeAsync(15000))
  expect(request).toHaveBeenCalledTimes(calls)
  unmount()
})

it('serializes lifecycle refreshes and never publishes an old session reply', async () => {
  vi.useFakeTimers()
  let resolve!: (value: unknown) => void

  const request = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r
        })
    )
    .mockResolvedValue({ snapshots: [], revision: 'b1', unchanged: false })

  const gateway = { request } as unknown as HermesGateway

  const { result, rerender } = renderHook(({ id, running }) => useContextSnapshots(gateway, id, true, running), {
    initialProps: { id: 'a', running: true }
  })

  rerender({ id: 'a', running: false })
  rerender({ id: 'b', running: false })
  expect(request).toHaveBeenCalledTimes(1)
  await act(async () => resolve({ snapshots: [{ request_id: 'old' }], revision: 'a1', unchanged: false }))
  expect(request).toHaveBeenCalledTimes(2)
  expect(request).toHaveBeenLastCalledWith('session.context_snapshots', { session_id: 'b', revision: '' })
  expect(result.current.snapshots).toEqual([])
  await act(() => vi.advanceTimersByTimeAsync(15000))
  expect(request).toHaveBeenCalledTimes(2)
})
