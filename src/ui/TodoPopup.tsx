import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { supabase } from '../lib/supabase'

type Todo = { id: string; text: string; done: boolean; author: string | null; created_at: string }

/** A floating, draggable list of wishes and bugs for the app, kept in house.todos. */
export const TodoPopup = ({ onClose }: { onClose: () => void }) => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string }>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)
  const [clearing, setClearing] = useState(false)
  const clearButton = useRef<HTMLButtonElement>(null)
  const clearPending = useRef(false)
  const [pos, setPos] = useState({ x: 300, y: 120 })
  const drag = useRef<{ dx: number; dy: number } | undefined>(undefined)

  const load = async () => {
    const { data, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTodos(data as Todo[])
  }

  useEffect(() => {
    void Promise.resolve().then(load)
    const channel = supabase
      .channel('todos')
      .on('postgres_changes', { event: '*', schema: 'house', table: 'todos' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const cancelClear = (event: Event) => {
      if (!clearButton.current?.contains(event.target as Node)) setClearArmed(false)
    }
    document.addEventListener('pointerdown', cancelClear, true)
    document.addEventListener('click', cancelClear, true)
    return () => {
      document.removeEventListener('pointerdown', cancelClear, true)
      document.removeEventListener('click', cancelClear, true)
    }
  }, [])

  const run = async (query: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await query
    if (error) setError(error.message)
    else load()
  }

  const add = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    run(supabase.from('todos').insert({ text }))
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    const bounds = e.currentTarget.parentElement!.getBoundingClientRect()
    drag.current = { dx: e.clientX - bounds.left, dy: e.clientY - bounds.top }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setPos({
      x: Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 80),
      y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 40),
    })
  }

  const saveEdit = () => {
    if (!editing) return
    const text = editing.text.trim()
    const before = todos.find((t) => t.id === editing.id)?.text
    setEditing(undefined)
    if (text && text !== before) run(supabase.from('todos').update({ text }).eq('id', editing.id))
  }

  const open = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

  const copy = async () => {
    const lines = [...open.map((t) => `- [ ] ${t.text}`), ...done.map((t) => `- [x] ${t.text}`)]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not copy')
    }
  }

  const clear = async () => {
    if (clearPending.current || todos.length === 0) return
    if (!clearArmed) {
      setClearArmed(true)
      return
    }
    clearPending.current = true
    setClearing(true)
    setClearArmed(false)
    setError(undefined)
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .in(
          'id',
          todos.map((t) => t.id),
        )
      if (error) throw error
      setEditing(undefined)
      await load()
    } catch (e) {
      setError(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Could not clear list')
    } finally {
      clearPending.current = false
      setClearing(false)
    }
  }

  const item = (t: Todo) => (
    <li key={t.id} className={t.done ? 'todo-item done' : 'todo-item'}>
      <button
        className="todo-check"
        role="checkbox"
        aria-checked={t.done}
        aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
        onClick={() => run(supabase.from('todos').update({ done: !t.done }).eq('id', t.id))}
      >
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </button>
      <div className="todo-body">
        {editing?.id === t.id ? (
          <textarea
            className="todo-edit"
            autoFocus
            rows={Math.max(1, editing.text.split('\n').length)}
            value={editing.text}
            onChange={(e) => setEditing({ id: t.id, text: e.target.value })}
            onBlur={saveEdit}
            onFocus={(e) =>
              e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                saveEdit()
              } else if (e.key === 'Escape') setEditing(undefined)
            }}
          />
        ) : (
          <p title="Click to edit" onClick={() => setEditing({ id: t.id, text: t.text })}>
            {t.text}
          </p>
        )}
        <span className="todo-meta">
          {t.author?.split('@')[0] ?? 'someone'} · {when(t.created_at)}
        </span>
      </div>
      <button
        className="todo-delete"
        aria-label="Delete"
        onClick={() => confirm('Delete this to-do?') && run(supabase.from('todos').delete().eq('id', t.id))}
      >
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </li>
  )

  return (
    <div
      className="todo-popup"
      style={{
        left: `clamp(16px, ${pos.x}px, calc(100vw - min(360px, 100vw - 32px) - 16px))`,
        top: `clamp(16px, ${pos.y}px, calc(100dvh - min(560px, 75dvh) - 16px))`,
      }}
      role="dialog"
      aria-label="To-dos"
    >
      <div
        className="todo-head"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = undefined)}
      >
        <span className="todo-grip" aria-hidden>
          ⋮⋮
        </span>
        <h3>Wishes &amp; bugs</h3>
        {open.length > 0 && <span className="todo-count">{open.length}</span>}
        <button className="icon-btn icon-btn-sm" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <form
        className="todo-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <textarea
          value={draft}
          placeholder="An idea, a wish, a bug…"
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              add()
            }
          }}
        />
        <div className="todo-add-foot">
          <span className="todo-meta">Enter to add · Shift+Enter for a new line</span>
          <button className="btn btn-primary btn-small" disabled={!draft.trim()}>
            Add
          </button>
        </div>
      </form>
      {error && (
        <p className="todo-error" onClick={() => setError(undefined)}>
          {error}
        </p>
      )}
      <div className="todo-scroll">
        {todos.length === 0 ? (
          <div className="todo-empty">
            <span aria-hidden>✨</span>
            <p>Nothing on the list yet.</p>
          </div>
        ) : (
          <>
            <ul className="todo-list">{open.map(item)}</ul>
            {done.length > 0 && (
              <>
                <div className="todo-section">Done · {done.length}</div>
                <ul className="todo-list">{done.map(item)}</ul>
              </>
            )}
          </>
        )}
      </div>
      <div className="todo-footer">
        <button className="btn" disabled={todos.length === 0 || clearing} onClick={copy}>
          {copied ? 'Copied' : 'Copy list'}
        </button>
        <button
          ref={clearButton}
          className={`btn${clearArmed && todos.length > 0 ? ' todo-clear-armed' : ''}`}
          disabled={todos.length === 0 || clearing}
          onClick={clear}
        >
          {clearing ? 'Clearing…' : clearArmed && todos.length > 0 ? 'Sure?' : 'Clear list'}
        </button>
      </div>
    </div>
  )
}

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
