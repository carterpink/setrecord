/**
 * License gateway — the optional online layer.
 *
 * SetSense is offline-first: a license activates and keeps working with no
 * network. This gateway is purely additive. When a fulfilment backend exists it
 * lets us (a) bind a key to this device at activation time and (b) periodically
 * refresh revocation/expiry so refunds and charge-backs can actually revoke a
 * key that has already been issued.
 *
 * Hard rule: the network is never on the critical path. Every method resolves
 * to a result with `reachable: false` on any failure (no endpoint configured,
 * DNS down, timeout, non-2xx). Callers MUST treat unreachable as "keep doing
 * whatever the offline signature said" — never as "lock the user out".
 */

import { net } from 'electron'

/**
 * Base URL of the fulfilment Worker (the setsense-fulfilment repo), e.g.
 * https://setsense-fulfilment.<subdomain>.workers.dev. This single value turns
 * on BOTH online revocation/renewal (/v1/check, /v1/activate) AND server-side
 * checkout creation (/checkout). Null = pure offline, no purchasing.
 *
 * Set this to your deployed Worker URL after running `npm run deploy` in the
 * fulfilment repo. Leave null until the backend is live.
 */
export const LICENSE_API_BASE: string | null = null

const REQUEST_TIMEOUT_MS = 5000

export interface ActivateRequest {
  /** Signed key the user pasted, or an order token from checkout. */
  keyOrOrderToken: string
  deviceId: string
}

export interface ActivateResult {
  reachable: boolean
  /** A (possibly device-bound) signed key to store, when the server re-issued one. */
  key?: string
}

export interface CheckRequest {
  licenseId: string
  deviceId: string
}

export interface CheckResult {
  reachable: boolean
  revoked?: boolean
  /** Server may tighten expiry (e.g. subscription cancelled). Never extends it. */
  expiresAt?: string | null
  /**
   * A freshly re-issued signed key to swap in. The server returns this when a
   * subscription has RENEWED — the new key carries a later expiresAt, which a
   * tightening-only expiry override could never express. The caller verifies it
   * before storing, so a bad key is ignored. Absent ⇒ keep the current key.
   */
  key?: string
}

export interface CheckoutRequest {
  /** Billing cadence the buyer picked. The server maps this to a store variant. */
  plan: 'monthly' | 'annual' | 'lifetime'
  /** This machine's anonymous device id, so a subscription key binds here. */
  deviceId: string
}

export interface CheckoutResult {
  reachable: boolean
  /** Hosted-checkout URL to open in the browser. Absent on any failure. */
  url?: string
}

export interface LicenseGateway {
  activate(req: ActivateRequest): Promise<ActivateResult>
  check(req: CheckRequest): Promise<CheckResult>
  checkout(req: CheckoutRequest): Promise<CheckoutResult>
}

/** The no-network gateway. Everything is "unreachable" so callers stay offline. */
export const offlineGateway: LicenseGateway = {
  async activate() {
    return { reachable: false }
  },
  async check() {
    return { reachable: false }
  },
  async checkout() {
    return { reachable: false }
  }
}

async function postJson(base: string, path: string, body: unknown): Promise<unknown | null> {
  return new Promise((resolve) => {
    let settled = false
    const done = (value: unknown | null): void => {
      if (settled) return
      settled = true
      resolve(value)
    }
    try {
      const request = net.request({ method: 'POST', url: `${base}${path}` })
      request.setHeader('content-type', 'application/json')
      const timer = setTimeout(() => {
        request.abort()
        done(null)
      }, REQUEST_TIMEOUT_MS)
      request.on('response', (response) => {
        const chunks: Buffer[] = []
        response.on('data', (c) => chunks.push(Buffer.from(c)))
        response.on('end', () => {
          clearTimeout(timer)
          if (response.statusCode < 200 || response.statusCode >= 300) return done(null)
          try {
            done(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch {
            done(null)
          }
        })
      })
      request.on('error', () => {
        clearTimeout(timer)
        done(null)
      })
      request.write(JSON.stringify(body))
      request.end()
    } catch {
      done(null)
    }
  })
}

/** HTTP-backed gateway. Inert until LICENSE_API_BASE is set; fails soft always. */
export function createHttpGateway(base: string): LicenseGateway {
  return {
    async activate(req) {
      const json = (await postJson(base, '/v1/activate', req)) as { key?: string } | null
      if (!json) return { reachable: false }
      return { reachable: true, key: typeof json.key === 'string' ? json.key : undefined }
    },
    async check(req) {
      const json = (await postJson(base, '/v1/check', req)) as {
        revoked?: boolean
        expiresAt?: string | null
        key?: string
      } | null
      if (!json) return { reachable: false }
      return {
        reachable: true,
        revoked: json.revoked === true,
        expiresAt: typeof json.expiresAt === 'string' ? json.expiresAt : null,
        key: typeof json.key === 'string' ? json.key : undefined
      }
    },
    async checkout(req) {
      const json = (await postJson(base, '/checkout', req)) as { url?: string } | null
      if (!json) return { reachable: false }
      return { reachable: true, url: typeof json.url === 'string' ? json.url : undefined }
    }
  }
}

/** Resolve the active gateway — HTTP when an endpoint is configured, else offline. */
export function getGateway(): LicenseGateway {
  return LICENSE_API_BASE ? createHttpGateway(LICENSE_API_BASE) : offlineGateway
}
