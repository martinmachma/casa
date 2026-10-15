import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { supabase } from '../lib/supabase'

type Todo = { id: string; text: string; done: boolean; author: string | null; created_at: string }

/** A floating, draggable list of wishes and bugs for the app, kept in house.todos. */
export const TodoPopup = ({ onClose }: { onClose: () => void }) => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string>()
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
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setPos({
      x: Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 80),
      y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 40),
    })
  }

  return (
    <div className="todo-popup" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label="To-dos">
      <div className="todo-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = undefined)}>
        <strong>To-dos</strong>
        <button className="icon-btn icon-btn-sm" aria-label="Close" onClick={onClose}>
          ×
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
          placeholder="Idea, wish or bug…"
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              add()
            }
          }}
        />
        <button className="btn btn-primary btn-small" disabled={!draft.trim()}>
          Add
        </button>
      </form>
      {error && (
        <p className="hint todo-error" onClick={() => setError(undefined)}>
          {error}
        </p>
      )}
      <ul className="todo-list">
        {todos.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => run(supabase.from('todos').update({ done: !t.done }).eq('id', t.id))}
            />
            <span title={t.author ?? undefined}>{t.text}</span>
            <button
              className="icon-btn icon-btn-sm"
              aria-label="Delete"
              onClick={() => confirm('Delete this to-do?') && run(supabase.from('todos').delete().eq('id', t.id))}
            >
              ×
            </button>
          </li>
        ))}
        {!todos.length && <li className="hint">Nothing yet.</li>}
      </ul>
    </div>
  )
}
