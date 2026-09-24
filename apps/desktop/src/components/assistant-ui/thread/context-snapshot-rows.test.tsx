import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ContextSnapshotRows } from './context-snapshot-rows'
import type { ContextSnapshot } from './context-snapshots'

describe('context snapshot disclosures', () => {
  it('fetches one capture only when expanded and shares it across its disclosures', async () => {
    const summary = {
      request_id: 'lazy:1',
      user_row_id: 1,
      user_text: 'hello',
      request: '',
      blocks: [
        { source: 'System prompt', text: '', fingerprint: 'system' },
        { source: 'Memory', text: '', fingerprint: 'memory' }
      ],
      truncated: false,
      redacted: true
    }

    const loadSnapshot = vi.fn().mockResolvedValue({
      ...summary,
      request: 'raw body',
      blocks: [
        { source: 'System prompt', text: 'loaded system' },
        { source: 'Memory', text: 'loaded memory' }
      ]
    })

    render(<ContextSnapshotRows loadSnapshot={loadSnapshot} snapshots={[summary]} />)
    expect(loadSnapshot).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Model requests (1)'))
    expect(loadSnapshot).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('System prompt'))
    expect(await screen.findByText('loaded system')).toBeTruthy()
    fireEvent.click(screen.getByText('Memory'))
    expect(await screen.findByText('loaded memory')).toBeTruthy()
    fireEvent.click(screen.getByText('lazy:1'))
    expect(await screen.findByText('raw body')).toBeTruthy()
    expect(loadSnapshot).toHaveBeenCalledTimes(1)
  })

  it('does not reopen a disclosure closed while its capture was loading', async () => {
    let resolve!: (value: ContextSnapshot) => void
    const loadSnapshot = vi.fn(() => new Promise<ContextSnapshot>(r => { resolve = r }))
    const summary = { request_id: 'slow', user_row_id: 1, user_text: '', request: '', blocks: [], redacted: true, truncated: false }
    render(<ContextSnapshotRows loadSnapshot={loadSnapshot} snapshots={[summary]} />)
    fireEvent.click(screen.getByText('Model requests (1)'))
    const details = screen.getByText('slow').closest('details')!
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(loadSnapshot).toHaveBeenCalledTimes(1)
    details.open = false
    fireEvent(details, new Event('toggle'))
    await act(async () => resolve({ ...summary, request: 'loaded' }))
    expect(screen.getByText('slow').closest('details')?.open).toBe(false)
  })

  it('groups captured tools by namespace and lets each schema expand independently', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    const tools = [
      {
        type: 'function',
        function: {
          name: 'functions.web_search',
          description: 'Search the web',
          parameters: { type: 'object', properties: { query: { type: 'string' } } }
        }
      },
      {
        type: 'function',
        function: {
          name: 'functions.web_extract',
          description: 'Extract a page',
          parameters: { type: 'object', properties: { urls: { type: 'array' } } }
        }
      },
      {
        type: 'function',
        function: { name: 'mcp__slack__channels_list', description: 'List channels', parameters: { type: 'object' } }
      },
      {
        type: 'function',
        function: { name: 'mcp__my_team__users_list', description: 'List users', parameters: { type: 'object' } }
      },
      { type: 'function', name: 'browser_exec', description: 'Browse', parameters: { type: 'object' } }
    ]

    render(
      <ContextSnapshotRows
        snapshots={[
          {
            request_id: 'turn:api:1',
            user_row_id: 2,
            user_text: 'hello',
            blocks: [{ source: 'Tools', text: JSON.stringify(tools) }],
            request: '{}',
            truncated: false,
            redacted: true
          }
        ]}
      />
    )

    fireEvent.click(screen.getByText('Tools'))
    expect(screen.getByText('functions · 2 tools')).toBeTruthy()
    expect(screen.getByText('slack · 1 tool')).toBeTruthy()
    expect(screen.getByText('my_team · 1 tool')).toBeTruthy()
    expect(screen.getByText('Built-in · 1 tool')).toBeTruthy()
    fireEvent.click(screen.getByText('Copy'))
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(tools))
    fireEvent.click(screen.getByText('functions · 2 tools'))
    fireEvent.click(screen.getByText('web_search'))
    expect(screen.getByText('Search the web')).toBeTruthy()
    expect(screen.getByText('web_search').closest('details')?.querySelector('pre')?.textContent).toContain('"query"')
    expect(screen.getByText('web_extract').closest('details')?.open).toBe(false)
  })

  it('keeps the captured text copyable and falls back to raw text for incomplete JSON', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(
      <ContextSnapshotRows
        snapshots={[
          {
            request_id: 'turn:api:1',
            user_row_id: 2,
            user_text: 'hello',
            blocks: [{ source: 'Tools', text: '[{"type":"function"}, … [block truncated]' }],
            request: '{}',
            truncated: false,
            redacted: true
          }
        ]}
      />
    )

    fireEvent.click(screen.getByText('Tools'))
    expect(screen.getByText('[{"type":"function"}, … [block truncated]')).toBeTruthy()
    fireEvent.click(screen.getByText('Copy'))
    expect(writeText).toHaveBeenCalledWith('[{"type":"function"}, … [block truncated]')
  })
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
