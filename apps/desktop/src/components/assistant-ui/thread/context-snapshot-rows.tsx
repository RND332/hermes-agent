import { useState } from 'react'

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

function ToolsDisclosure({ text }: { text: string }) {
  const groups = toolGroups(text)

  if (!groups) {
    return <Disclosure text={text} title="Tools" />
  }

  return (
    <details className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
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

function Disclosure({ title, text }: { title: string; text: string }) {
  return (
    <details className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
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

/** Captures are display-only; details never alter the transcript or prompt. */
export function ContextSnapshotRows({ snapshots }: { snapshots: readonly ContextSnapshot[] }) {
  const [showRequests, setShowRequests] = useState(false)
  const seen = new Set<string>()

  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-slot="context-snapshots">
      {snapshots.flatMap(snapshot =>
        snapshot.blocks.flatMap(block => {
          const key = `${block.source}\u0000${block.text}`

          if (seen.has(key)) {
            return []
          }

          seen.add(key)

          return [
            block.source === 'Tools' ? (
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
            <Disclosure
              key={snapshot.request_id}
              text={snapshot.request}
              title={`${snapshot.request_id}${snapshot.truncated ? ' · truncated' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
