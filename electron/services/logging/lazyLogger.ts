import { createLogger } from './logger'

type ScopedLogger = ReturnType<typeof createLogger>

/**
 * A lazily-initialised scoped logger.
 *
 * `createLogger()` calls `initLogger()` on first use, which reads
 * `app.getPath('userData')`. At module *load* time that path may not be
 * available yet (e.g. early in main startup, or in unit tests that import a
 * service without stubbing `electron`). Declaring the logger lazily means the
 * scope/transports are only resolved the first time something is actually
 * logged — by which point `app` is ready — so `const log = lazyLogger('x')` at
 * module top level is safe.
 *
 * The returned object exposes the same level methods used across the hot-path
 * services; each delegates to the real scoped logger, created (and cached) on
 * first call.
 */
export function lazyLogger(scope: string): Pick<ScopedLogger, 'error' | 'warn' | 'info' | 'debug'> {
  let real: ScopedLogger | null = null
  const get = (): ScopedLogger => (real ??= createLogger(scope))
  return {
    error: (...args: Parameters<ScopedLogger['error']>) => get().error(...args),
    warn: (...args: Parameters<ScopedLogger['warn']>) => get().warn(...args),
    info: (...args: Parameters<ScopedLogger['info']>) => get().info(...args),
    debug: (...args: Parameters<ScopedLogger['debug']>) => get().debug(...args)
  }
}
