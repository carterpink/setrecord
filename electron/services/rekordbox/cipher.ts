import sqlcipher from '@journeyapps/sqlcipher'

/**
 * SQLCipher key for Rekordbox 6/7 master.db.
 *
 * This is the key Rekordbox uses for its main library database. It's a
 * constant embedded in the Rekordbox application bundle and has been
 * documented publicly by the open-source DJ tools community for years
 * (pyrekordbox, liamcottle/pioneer-rekordbox-database-encryption, Lexicon DJ,
 * DJ.Studio).
 *
 * Key format differs between major versions (confirmed by empirical testing on
 * macOS with Rekordbox 7.2.7):
 *  - Rekordbox 6.x: raw-bytes form — PRAGMA key = "x'<hex>'"
 *  - Rekordbox 7.x: passphrase form — PRAGMA key = "<hex>"
 * openMasterDb() tries both forms automatically so both versions work without
 * user intervention.
 *
 * Legal note: reading the user's own master.db on the user's own machine sits
 * in a grey area of the Rekordbox EULA §g (no reverse-engineering). Pioneer
 * has not publicly pursued projects that do this. Lexicon DJ ships the same
 * capability commercially. SetSense gates this behind a one-time consent
 * dialog (`rekordboxDbConsent` setting) and never modifies master.db.
 */
export const REKORDBOX_MASTER_DB_KEY =
  '402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497'

/** Thrown when Rekordbox is open and holds an exclusive lock on master.db. */
export class RekordboxLockedError extends Error {
  constructor() {
    super('Rekordbox is currently open. Please close Rekordbox and try again.')
    this.name = 'RekordboxLockedError'
  }
}

/** Thrown when the SQLCipher key doesn't decrypt master.db (newer RB version). */
export class RekordboxKeyMismatchError extends Error {
  constructor() {
    super('Could not read this Rekordbox database. Use XML export instead.')
    this.name = 'RekordboxKeyMismatchError'
  }
}

type Sqlite3Database = {
  run: (
    sql: string,
    paramsOrCb?: unknown[] | ((err: Error | null) => void),
    cb?: (err: Error | null) => void
  ) => void
  all: (sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => void
  get: (sql: string, params: unknown[], cb: (err: Error | null, row: unknown) => void) => void
  serialize: (cb: () => void) => void
  close: (cb?: (err: Error | null) => void) => void
}

export interface MasterDb {
  /** Run a SELECT and return all rows. */
  all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>
  /** Run a SELECT and return one row (first match or null). */
  get<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>
  /** Close the database. Always call when done. */
  close(): Promise<void>
}

/** Writable variant — adds parameterised writes for the MyTag exporter. */
export interface MasterDbRW extends MasterDb {
  run(sql: string, params?: unknown[]): Promise<void>
}

/**
 * Open a Rekordbox master.db in read-only mode and apply the SQLCipher key.
 *
 * Returns a thin promisified wrapper. The connection is held open for the
 * duration of the import — callers must call `.close()` when finished.
 *
 * Automatically tries both key formats so both Rekordbox 6 and 7 work:
 *  - RB6: raw-bytes form  PRAGMA key = "x'<hex>'"
 *  - RB7: passphrase form PRAGMA key = "<hex>"
 *
 * Errors map as follows:
 *  - SQLITE_BUSY                  → RekordboxLockedError (Rekordbox is running)
 *  - SQLITE_NOTADB / file is encrypted → RekordboxKeyMismatchError (both formats failed)
 *  - all other errors             → re-thrown with context
 */
export async function openMasterDb(path: string): Promise<MasterDb> {
  // Try Rekordbox 6 raw-bytes format first; fall back to RB7 passphrase format.
  try {
    return await openMasterDbWithKeyFormat(path, 'raw')
  } catch (err) {
    if (err instanceof RekordboxKeyMismatchError) {
      return openMasterDbWithKeyFormat(path, 'passphrase')
    }
    throw err
  }
}

/**
 * Internal: open master.db with one specific key format.
 *  'raw'        → PRAGMA key = "x'<hex>'"  (Rekordbox 6.x)
 *  'passphrase' → PRAGMA key = "<hex>"     (Rekordbox 7.x)
 */
async function openMasterDbWithKeyFormat(
  path: string,
  format: 'raw' | 'passphrase'
): Promise<MasterDb> {
  const sqlite3Module = (
    sqlcipher as {
      verbose: () => {
        Database: new (...args: unknown[]) => Sqlite3Database
        OPEN_READONLY: number
      }
    }
  ).verbose()
  const { Database, OPEN_READONLY } = sqlite3Module

  const db = await new Promise<Sqlite3Database>((resolve, reject) => {
    const instance = new Database(path, OPEN_READONLY, (err: Error | null) => {
      if (err) return reject(translateOpenError(err))
      resolve(instance)
    })
  })

  const keyPragma =
    format === 'raw'
      ? `PRAGMA key = "x'${REKORDBOX_MASTER_DB_KEY}'"`
      : `PRAGMA key = "${REKORDBOX_MASTER_DB_KEY}"`

  // cipher_compatibility = 4 sets SQLCipher 4.x defaults (AES-256-CBC,
  // PBKDF2-HMAC-SHA512, page size 4096) for both RB6 and RB7.
  await runSerialized(db, [`PRAGMA cipher_compatibility = 4`, keyPragma])

  // Sanity-check by reading sqlite_master. If the key is wrong, this throws
  // "file is encrypted or is not a database" (SQLITE_NOTADB).
  try {
    await new Promise<void>((resolve, reject) => {
      db.all(`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`, [], (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  } catch (err) {
    await closeQuiet(db)
    throw translateOpenError(err as Error)
  }

  return {
    all: <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows as T[]) ?? [])))
      }),
    get: <T>(sql: string, params: unknown[] = []): Promise<T | null> =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) =>
          err ? reject(err) : resolve((row as T | undefined) ?? null)
        )
      }),
    close: (): Promise<void> => closeQuiet(db)
  }
}

/**
 * Open master.db **read-write** with the SQLCipher key. Used only by the MyTag
 * exporter, which always takes a backup first and writes inside a transaction.
 * Tries both key formats like {@link openMasterDb}.
 */
export async function openMasterDbWritable(path: string): Promise<MasterDbRW> {
  try {
    return await openMasterDbWritableWithFormat(path, 'raw')
  } catch (err) {
    if (err instanceof RekordboxKeyMismatchError) {
      return openMasterDbWritableWithFormat(path, 'passphrase')
    }
    throw err
  }
}

async function openMasterDbWritableWithFormat(
  path: string,
  format: 'raw' | 'passphrase'
): Promise<MasterDbRW> {
  const sqlite3Module = (
    sqlcipher as {
      verbose: () => {
        Database: new (...args: unknown[]) => Sqlite3Database
        OPEN_READWRITE: number
      }
    }
  ).verbose()
  const { Database, OPEN_READWRITE } = sqlite3Module

  const db = await new Promise<Sqlite3Database>((resolve, reject) => {
    const instance = new Database(path, OPEN_READWRITE, (err: Error | null) => {
      if (err) return reject(translateOpenError(err))
      resolve(instance)
    })
  })

  const keyPragma =
    format === 'raw'
      ? `PRAGMA key = "x'${REKORDBOX_MASTER_DB_KEY}'"`
      : `PRAGMA key = "${REKORDBOX_MASTER_DB_KEY}"`
  await runSerialized(db, [`PRAGMA cipher_compatibility = 4`, keyPragma])

  try {
    await new Promise<void>((resolve, reject) => {
      db.all(`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`, [], (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  } catch (err) {
    await closeQuiet(db)
    throw translateOpenError(err as Error)
  }

  return {
    all: <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows as T[]) ?? [])))
      }),
    get: <T>(sql: string, params: unknown[] = []): Promise<T | null> =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) =>
          err ? reject(err) : resolve((row as T | undefined) ?? null)
        )
      }),
    run: (sql: string, params: unknown[] = []): Promise<void> =>
      new Promise((resolve, reject) => {
        db.run(sql, params, (err) => (err ? reject(err) : resolve()))
      }),
    close: (): Promise<void> => closeQuiet(db)
  }
}

function runSerialized(db: Sqlite3Database, statements: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      let pending = statements.length
      if (pending === 0) return resolve()
      for (const sql of statements) {
        db.run(sql, (err) => {
          if (err) return reject(err)
          if (--pending === 0) resolve()
        })
      }
    })
  })
}

function closeQuiet(db: Sqlite3Database): Promise<void> {
  return new Promise((resolve) => {
    db.close((err) => {
      if (err) console.error('[rekordbox/cipher] close error', err)
      resolve()
    })
  })
}

function translateOpenError(err: Error): Error {
  const msg = err.message || ''
  // sqlite3 surfaces lock contention as SQLITE_BUSY in the error code property.
  // The error class itself is a generic Error from the callback path.
  if (/SQLITE_BUSY/i.test(msg) || /database is locked/i.test(msg)) {
    return new RekordboxLockedError()
  }
  if (/SQLITE_NOTADB/i.test(msg) || /file is (?:not a database|encrypted)/i.test(msg)) {
    return new RekordboxKeyMismatchError()
  }
  return err
}
