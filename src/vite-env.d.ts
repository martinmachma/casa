/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

/** The commit a deployed build came from ('local' otherwise), from vite.config.ts. */
declare const __BUILD__: string
