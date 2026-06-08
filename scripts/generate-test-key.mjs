#!/usr/bin/env node
/**
 * Generate a test license key (dev/testing only).
 * Creates an ephemeral Ed25519 keypair and mints a valid key signed with it.
 *
 * Usage:
 *   node scripts/generate-test-key.mjs
 *   node scripts/generate-test-key.mjs --plan subscription --months 1
 */

import { generateKeyPairSync, sign as cryptoSign, randomUUID } from 'crypto'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const plan = arg('plan', 'lifetime')
const email = arg('email', 'tester@setrecord.app')
const months = Number(arg('months', '0'))

if (plan !== 'lifetime' && plan !== 'subscription') {
  console.error('--plan must be "lifetime" or "subscription"')
  process.exit(1)
}

const { privateKey } = generateKeyPairSync('ed25519')
const PREFIX = 'SES1'

const issuedAt = new Date().toISOString()
const payload = {
  v: 1,
  id: randomUUID(),
  plan,
  email,
  issuedAt
}

if (plan === 'subscription') {
  const m = months > 0 ? months : 1
  const expires = new Date()
  expires.setMonth(expires.getMonth() + m)
  payload.expiresAt = expires.toISOString()
}

const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
const signature = cryptoSign(null, Buffer.from(payloadB64), privateKey).toString('base64url')
const key = `${PREFIX}.${payloadB64}.${signature}`

console.log('\n✓ Test License Key Generated')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log('Payload:')
console.log(JSON.stringify(payload, null, 2))
console.log('\n📋 License Key (paste into Settings → SetRecord Pro → Activate):\n')
console.log(key)
console.log('\n')
