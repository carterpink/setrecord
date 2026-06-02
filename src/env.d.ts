/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Opt a non-dev (preview) build into the fake-Pro design state.
   *  Has no effect in packaged production builds where the IPC bridge is the
   *  sole source of entitlement truth. */
  readonly VITE_PREVIEW_PRO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
