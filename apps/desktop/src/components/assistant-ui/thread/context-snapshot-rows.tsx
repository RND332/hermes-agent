import { useState } from 'react'

import type { ContextSnapshot } from './context-snapshots'

function Disclosure({ title, text }: { title: string; text: string }) {
  return (
    <details className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium text-foreground">{title}</summary>
      <div className="mt-2 flex justify-end">
        <button className="rounded px-2 py-1 hover:bg-accent/15" onClick={() => void navigator.clipboard.writeText(text)} type="button">
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
          if (seen.has(key)) return []
          seen.add(key)
          return [<Disclosure key={`${snapshot.request_id}-${key}`} text={block.text} title={block.source} />]
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
          <p className="text-xs text-muted-foreground">Local diagnostic · secrets masked; redacted text differs from what the model received.</p>
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
