# src/ui

DOM panels and controls. No R3F here.

- Use the `ui` skill (`.agents/skills/ui/SKILL.md`) for visible changes: reuse `kit.tsx` primitives and the classes in
  `src/styles.css`; same active state, outline and icons (`lucide-react`) as neighbouring UI.
- Desktop first; ignore mobile layout unless asked.
- Logic belongs in the owning module as plain functions; components render and dispatch.
- Supabase access goes through `data/`, not new direct calls in components.
