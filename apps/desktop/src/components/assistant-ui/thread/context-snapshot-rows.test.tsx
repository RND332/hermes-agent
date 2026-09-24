import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ContextSnapshotRows } from './context-snapshot-rows'

describe('context snapshot disclosures', () => {
  it('keeps captured text collapsed, expands and copies redacted content on demand', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(
      <ContextSnapshotRows
        snapshots={[
          {
            request_id: 'turn:api:1',
            user_row_id: 2,
            user_text: 'hello',
            blocks: [{ source: 'System prompt', text: 'SOUL and index' }],
            request: '{"instructions":"SOUL and index"}',
            truncated: false,
            redacted: true
          }
        ]}
      />
    )
    expect(screen.getByText('System prompt').closest('details')?.open).toBe(false)
    fireEvent.click(screen.getByText('System prompt'))
    expect(screen.getByText('System prompt').closest('details')?.open).toBe(true)
    fireEvent.click(screen.getByText('Copy'))
    expect(writeText).toHaveBeenCalledWith('SOUL and index')
    fireEvent.click(screen.getByText('Model requests (1)'))
    expect(screen.queryByText('turn:api:1')).not.toBeNull()
  })
})
