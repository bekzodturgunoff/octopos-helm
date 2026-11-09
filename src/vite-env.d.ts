/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_MOCK?: string;
  /** Where client dashes live: <slug>.<domain>. Defaults to dash.octopos.uz. */
  readonly VITE_DASH_DOMAIN?: string;
  /** The map tile server (the geo stack's pmtiles service). Unset, maps are not drawn. */
  readonly VITE_MAP_TILES_URL?: string;
  /** The tileset on it; "uzbekistan" when unset. */
  readonly VITE_MAP_ARCHIVE?: string;
  /** Label fonts, e.g. https://…/font/{fontstack}/{range}. Unset, maps have no street names. */
  readonly VITE_MAP_GLYPHS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
