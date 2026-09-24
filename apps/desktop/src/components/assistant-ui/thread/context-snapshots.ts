import type { ChatMessage } from '@/lib/chat-messages'
import { chatMessageText } from '@/lib/chat-messages'

export interface ContextSnapshot {
  request_id: string
  user_row_id: number | null
  user_text: string
  blocks: Array<{ source: string; text: string }>
  request: string
  truncated: boolean
  redacted: boolean
}

/** Never attribute an ambiguous capture to a different turn. */
export function assignContextSnapshots(messages: readonly ChatMessage[], snapshots: readonly ContextSnapshot[]) {
  const users = messages.filter(message => message.role === 'user')
  const assigned = new Map<string, ContextSnapshot[]>()
  for (const snapshot of snapshots) {
    let user = snapshot.user_row_id == null ? undefined : users.find(m => m.rowId === snapshot.user_row_id)
    if (!user && snapshot.user_text.trim()) {
      const matches = users.filter(m => chatMessageText(m).trim() === snapshot.user_text.trim())
      user = matches.length === 1 ? matches[0] : undefined
    }
    if (!user) continue
    assigned.set(user.id, [...(assigned.get(user.id) ?? []), snapshot])
  }
  return assigned
}
