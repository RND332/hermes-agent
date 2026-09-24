import { useCallback, useEffect, useRef, useState } from 'react'

import type { HermesGateway } from '@/hermes'

import type { ContextSnapshot } from './context-snapshots'

interface SnapshotResult {
  snapshots: ContextSnapshot[]
  revision: string
  unchanged: boolean
}

interface CaptureState {
  gateway: HermesGateway
  sessionId: string
  revision: string
  snapshots: ContextSnapshot[]
}

const EMPTY: ContextSnapshot[] = []

export function useContextSnapshots(
  gateway: HermesGateway | null | undefined,
  sessionId: string | null | undefined,
  visible: boolean,
  running: boolean
) {
  const [capture, setCapture] = useState<CaptureState | null>(null)
  const latest = useRef(capture)
  const pending = useRef<Promise<SnapshotResult> | null>(null)

  // These refs coordinate async requests/revisions, not mirrored reactive props.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!gateway || !sessionId || !visible) {
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const refresh = async () => {
      // A visibility/session/running change may restart the effect while its
      // previous request is still in flight. Wait; never queue another poll.
      if (pending.current) {
        await pending.current.catch(() => undefined)
      }

      if (cancelled) {
        return
      }

      const previous = latest.current
      const revision = previous?.gateway === gateway && previous.sessionId === sessionId ? previous.revision : undefined

      const request = gateway.request<SnapshotResult>('session.context_snapshots', {
        session_id: sessionId,
        revision: revision ?? '' // Older backends reject this instead of sending full histories.
      })

      pending.current = request

      try {
        const result = await request

        if (!cancelled && !result.unchanged && Array.isArray(result.snapshots)) {
          const next = { gateway, sessionId, revision: result.revision, snapshots: result.snapshots }
          latest.current = next
          setCapture(next)
        }
      } catch {
        // An older/unavailable backend must not trigger a full-history fallback.
      } finally {
        if (pending.current === request) {
          pending.current = null
        }

        if (!cancelled && running) {
          timer = setTimeout(() => void refresh(), 2500)
        }
      }
    }

    void refresh()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [gateway, sessionId, visible, running])

  const loadSnapshot = useCallback(
    async (requestId: string) => {
      if (!gateway || !sessionId) {
        return undefined
      }

      const result = await gateway.request<SnapshotResult>('session.context_snapshots', {
        session_id: sessionId,
        request_id: requestId
      })

      return result.snapshots.find(snapshot => snapshot.request_id === requestId)
    },
    [gateway, sessionId]
  )

  return {
    snapshots: capture && capture.gateway === gateway && capture.sessionId === sessionId ? capture.snapshots : EMPTY,
    loadSnapshot
  }
}
