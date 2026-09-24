import { useMemo, useRef, useState } from 'react'

import type { ContextSnapshot } from './context-snapshots'

interface ToolSchema {
  name: string
  description?: string
  parameters?: unknown
}

function toolGroups(text: string): Map<string, Array<{ label: string; schema: ToolSchema }>> | null {
  try {
    const parsed: unknown = JSON.parse(text)

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null
    }

    const groups = new Map<string, Array<{ label: string; schema: ToolSchema }>>()

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const schema: unknown = 'function' in entry ? entry.function : entry

      if (!schema || typeof schema !== 'object' || !('name' in schema) || typeof schema.name !== 'string') {
        return null
      }

      const name = schema.name
      const mcp = name.match(/^mcp__(.+?)__(.+)$/)
      const dot = name.indexOf('.')
      const group = mcp ? mcp[1] : dot > 0 ? name.slice(0, dot) : 'Built-in'
      const label = mcp ? mcp[2] : dot > 0 ? name.slice(dot + 1) : name
      const items = groups.get(group) ?? []
      items.push({ label, schema: schema as ToolSchema })
      groups.set(group, items)
    }

    return groups
  } catch {
    return null
  }
}

function ToolsDisclosure({ text, initiallyOpen = false }: { text: string; initiallyOpen?: boolean }) {
  const groups = toolGroups(text)

  if (!groups) {
    return <Disclosure initiallyOpen={initiallyOpen} text={text} title="Tools" />
  }

  return (
    <details
      className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground"
      open={initiallyOpen}
    >
      <summary className="cursor-pointer select-none font-medium text-foreground">Tools</summary>
      <div className="mt-2 flex justify-end">
        <button
          className="rounded px-2 py-1 hover:bg-accent/15"
          onClick={() => void navigator.clipboard.writeText(text)}
          type="button"
        >
          Copy
        </button>
      </div>
      <div className="max-h-80 space-y-2 overflow-auto">
        {[...groups].map(([group, tools]) => (
          <details className="border-l border-border/60 pl-3" key={group}>
            <summary className="cursor-pointer select-none font-medium text-foreground">
              {group} · {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
            </summary>
            <div className="mt-1 space-y-1 pl-3">
              {tools.map(({ label, schema }) => (
                <details key={schema.name}>
                  <summary className="cursor-pointer select-none text-foreground">{label}</summary>
                  {schema.description && (
                    <p className="my-1 whitespace-pre-wrap wrap-break-word">{schema.description}</p>
                  )}
                  {schema.parameters !== undefined && (
                    <pre className="overflow-auto whitespace-pre-wrap wrap-break-word select-text">
                      {JSON.stringify(schema.parameters, null, 2)}
                    </pre>
                  )}
                </details>
              ))}
            </div>
          </details>
        ))}
        <details>
          <summary className="cursor-pointer select-none">Raw capture</summary>
          <pre className="whitespace-pre-wrap wrap-break-word select-text">{text}</pre>
        </details>
      </div>
    </details>
  )
}

function Disclosure({ title, text, initiallyOpen = false }: { title: string; text: string; initiallyOpen?: boolean }) {
  return (
    <details
      className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground"
      open={initiallyOpen}
    >
      <summary className="cursor-pointer select-none font-medium text-foreground">{title}</summary>
      <div className="mt-2 flex justify-end">
        <button
          className="rounded px-2 py-1 hover:bg-accent/15"
          onClick={() => void navigator.clipboard.writeText(text)}
          type="button"
        >
          Copy
        </button>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap wrap-break-word select-text">{text}</pre>
    </details>
  )
}

export type SnapshotLoader = (requestId: string) => Promise<ContextSnapshot | undefined>

function LazyDisclosure({ title, loadText }: { title: string; loadText: () => Promise<string> }) {
  const [text, setText] = useState<string>()
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const pending = useRef(false)

  const load = async () => {
    if (pending.current) {
      return
    }

    pending.current = true
    setError(false)

    try {
      setText(await loadText())
    } catch {
      setError(true)
    } finally {
      pending.current = false
    }
  }

  if (text !== undefined) {
    return title === 'Tools' ? (
      <ToolsDisclosure initiallyOpen={open} text={text} />
    ) : (
      <Disclosure initiallyOpen={open} text={text} title={title} />
    )
  }

  return (
    <details
      className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground"
      onToggle={event => {
        setOpen(event.currentTarget.open)

        if (event.currentTarget.open) {
          void load()
        }
      }}
    >
      <summary className="cursor-pointer select-none font-medium text-foreground">{title}</summary>
      {error ? (
        <button onClick={() => void load()} type="button">
          Could not load capture. Retry
        </button>
      ) : (
        <p>Loading…</p>
      )}
    </details>
  )
}

/** Captures are display-only; details never alter the transcript or prompt. */
export function ContextSnapshotRows({
  snapshots,
  loadSnapshot
}: {
  snapshots: readonly ContextSnapshot[]
  loadSnapshot?: SnapshotLoader
}) {
  const [showRequests, setShowRequests] = useState(false)

  // Share an explicit read across a capture's disclosures, not across owners.
  // Keep only a small recent detail cache rather than recreating the history payload.
  const load = useMemo(() => {
    const details = new Map<string, Promise<ContextSnapshot>>()

    return (requestId: string) => {
      let pending = details.get(requestId)

      if (!pending) {
        pending = Promise.resolve(loadSnapshot?.(requestId))
          .then(snapshot => {
            if (!snapshot) {
              throw new Error('Capture unavailable')
            }

            return snapshot
          })
          .catch(error => {
            details.delete(requestId)
            throw error
          })
        details.set(requestId, pending)

        if (details.size > 8) {
          details.delete(details.keys().next().value!)
        }
      }

      return pending
    }
  }, [loadSnapshot])

  const seen = new Set<string>()

  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-slot="context-snapshots">
      {snapshots.flatMap(snapshot =>
        snapshot.blocks.flatMap((block, blockIndex) => {
          const key = `${block.source}\u0000${block.fingerprint ?? block.text}`

          if (seen.has(key)) {
            return []
          }

          seen.add(key)

          return [
            block.fingerprint ? (
              <LazyDisclosure
                key={key}
                loadText={async () => (await load(snapshot.request_id)).blocks[blockIndex]?.text ?? ''}
                title={block.source}
              />
            ) : block.source === 'Tools' ? (
              <ToolsDisclosure key={`${snapshot.request_id}-${key}`} text={block.text} />
            ) : (
              <Disclosure key={`${snapshot.request_id}-${key}`} text={block.text} title={block.source} />
            )
          ]
        })
      )}
      <button
        className="self-start text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setShowRequests(value => !value)}
        type="button"
      >
        {showRequests ? 'Hide model requests' : `Model requests (${snapshots.length})`}
      </button>
      {showRequests && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            Local diagnostic · secrets masked; redacted text differs from what the model received.
          </p>
          {snapshots.map(snapshot => (
            <LazyDisclosure
              key={snapshot.request_id}
              loadText={async () => snapshot.request || (await load(snapshot.request_id)).request}
              title={`${snapshot.request_id}${snapshot.truncated ? ' · truncated' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
