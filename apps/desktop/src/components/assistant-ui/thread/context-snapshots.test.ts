import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '@/lib/chat-messages'

import { assignContextSnapshots, type ContextSnapshot } from './context-snapshots'

const snapshot = (user_row_id: number | null, user_text: string): ContextSnapshot => ({
  request_id: `req-${user_row_id}`,
  user_row_id,
  user_text,
  blocks: [],
  request: '{}',
  truncated: false,
  redacted: true
})
const user = (id: string, rowId: number | undefined, text: string): ChatMessage => ({
  id,
  role: 'user',
  rowId,
  parts: [{ type: 'text', text }],
  timestamp: 1
})

describe('context snapshot attribution', () => {
  it('uses durable row IDs before text and refuses ambiguous duplicates', () => {
    const messages = [user('one', 12, 'again'), user('two', 14, 'again')]
    const assigned = assignContextSnapshots(messages, [snapshot(14, 'again'), snapshot(null, 'again')])
    expect(assigned.get('two')?.length).toBe(1)
    expect(assigned.has('one')).toBe(false)
  })

  it('shows the captured system and memory for each turn, including unchanged repeats', () => {
    const first = snapshot(12, 'one')
    first.blocks = [{ source: 'System prompt', text: 'soul' }, { source: 'Memory', text: 'context' }, { source: 'Tools', text: '[]' }]
    const second = snapshot(14, 'two')
    second.blocks = [...first.blocks]
    const assigned = assignContextSnapshots([user('one', 12, 'one'), user('two', 14, 'two')], [first, second])
    expect(assigned.get('one')?.[0]?.blocks).toHaveLength(3)
    expect(assigned.get('two')?.[0]?.blocks).toEqual(first.blocks)
  })

  it('matches a unique optimistic user turn by exact text', () => {
    const assigned = assignContextSnapshots([user('optimistic', undefined, 'hello')], [snapshot(null, 'hello')])
    expect(assigned.get('optimistic')?.[0]?.request_id).toBe('req-null')
  })
})
