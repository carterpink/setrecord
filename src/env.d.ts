/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Opt a non-dev (preview) build into the fake-Pro design state.
   *  Has no effect in packaged production builds where the IPC bridge is the
   *  sole source of entitlement truth. */
  readonly VITE_PREVIEW_PRO?: string
  /** Cloud collab relay base URL (e.g. wss://collab.setsense.app). When set, the
   *  Build-mode "Collaborate" menu offers a remote (cross-network) host option.
   *  Unset = LAN-only collaboration. */
  readonly VITE_COLLAB_RELAY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
