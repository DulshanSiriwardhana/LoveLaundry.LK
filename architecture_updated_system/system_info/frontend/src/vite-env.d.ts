/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCANNER_API_URL?: string;
  readonly VITE_SCANNER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
