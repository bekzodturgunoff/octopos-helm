/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_MOCK?: string;
  /** Where client dashes live: <slug>.<domain>. Defaults to dash.octopos.uz. */
  readonly VITE_DASH_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
