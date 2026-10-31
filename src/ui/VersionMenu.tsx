import { Check, ChevronDown, Layers, Pencil, Radio, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BARE, LIVE, type HouseData } from '../data/useHouseData'
import type { Version } from '../data/types'

export const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const who = (email: string | undefined) => email?.split('@')[0]

/** The top bar's version picker: what's on screen, which version is live, and making another one live. */
export const VersionMenu = ({ data }: { data: HouseData }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const { versions, liveId, viewed, dirty } = data
  const viewedId = viewed?.id
  const isLive = viewedId === liveId

  const view = (id: string | undefined) => {
    if (dirty && id !== viewedId && !confirm('Discard your unsaved changes?')) return
    if (id !== viewedId) data.discardDraft()
    // Picking the live version follows it, so it updates when another one is made live.
    data.view(id === liveId ? LIVE : (id ?? BARE))
    setOpen(false)
  }

  const remove = (v: Version) => confirm(`Delete “${v.name}”? This can't be undone.`) && data.deleteVersion(v.id)

  const rename = (v: Version) => {
    const name = prompt('Rename version', v.name)?.trim().slice(0, 80)
    if (name && name !== v.name) data.renameVersion(v.id, name)
  }

  const row = (id: string | undefined, name: string, meta?: string, version?: Version) => {
    const live = id === liveId
    return (
      <li key={id ?? BARE} className="version-row" aria-current={id === viewedId}>
        <button className="version-pick" role="menuitem" onClick={() => view(id)}>
          <span className="version-check">{id === viewedId && <Check size={15} />}</span>
          <span className="version-text">
            <span className="version-name">{name}</span>
            {meta && <span className="version-meta">{meta}</span>}
          </span>
          {live && <span className="live-badge">Live</span>}
        </button>
        {!live && (
          <button className="version-action" title="Make this the live version" onClick={() => data.makeLive(id)}>
            <Radio size={15} />
            <span>Make live</span>
          </button>
        )}
        {version && (
          <button className="version-action" title="Rename" aria-label="Rename" onClick={() => rename(version)}>
            <Pencil size={15} />
          </button>
        )}
        {version && !live && (
          <button
            className="version-action version-delete"
            title="Delete"
            aria-label="Delete"
            onClick={() => remove(version)}
          >
            <Trash2 size={15} />
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="menu-anchor" ref={ref}>
      <button className="version-button" onClick={() => setOpen(!open)} aria-expanded={open} title="Versions">
        <Layers size={16} />
        <span className="version-button-name">{viewed?.name ?? 'Bare house'}</span>
        {isLive && <span className="live-dot" title="Live" />}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu version-menu" role="menu">
          <div className="menu-label">Versions · the live one is the house as it is now</div>
          <ul>
            {versions.map((v) => row(v.id, v.name, [who(v.author), when(v.createdAt)].filter(Boolean).join(' · '), v))}
            {row(undefined, 'Bare house', 'Nothing placed or painted')}
          </ul>
        </div>
      )}
    </div>
  )
}
