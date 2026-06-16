/**
 * ai-cache.ts — Zero-dependency response cache for deterministic AI calls.
 *
 * Technique adapted (safely) from GPTCache / prompt-cache: skip the API call
 * entirely when you've already answered the same question. GPTCache uses embedding
 * similarity + a vector store; this uses a normalized exact-match hash instead — no
 * embedding model, no vector DB, no third-party code, no new dependencies.
 *
 * WHY EXACT-MATCH IS OFTEN THE RIGHT CALL:
 *   Many agent workloads re-ask the same KINDS of questions ("score this lead",
 *   "classify this ticket"). Normalizing (lowercase + collapse whitespace) before
 *   hashing catches the trivial variations. Full semantic caching catches more,
 *   but costs an embedding call per request and a vector store to secure — often
 *   not worth it.
 *
 * SAFETY RULE: only cache DETERMINISTIC tasks (scoring, classification,
 * verification). NEVER cache generative output (emails, content) — caching those
 * would hand identical text to different recipients. Caching is opt-in per call.
 *
 * Each entry is a single JSON file named by its hash, so concurrent workers never
 * corrupt a shared file. Entries expire by TTL and evict LRU-style past a cap.
 */
import { createHash } from 'node:crypto'
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CACHE_DIR = process.env.AI_CACHE_DIR ?? join(homedir(), '.ai-cache')
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_ENTRIES = 5_000

interface CacheEntry {
  content: string
  provider: string
  ts: number
  ttl: number
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Content-based key — intentionally NOT model-specific, so a result cached from
 *  a cheap model is reused regardless of which model produced it. */
export function cacheKey(systemPrompt: string, userPrompt: string, salt = ''): string {
  const raw = `${normalize(systemPrompt)} ${normalize(userPrompt)} ${salt}`
  return createHash('sha256').update(raw).digest('hex')
}

export function cacheGet(key: string): { content: string; provider: string } | null {
  try {
    const f = join(CACHE_DIR, `${key}.json`)
    if (!existsSync(f)) return null
    const entry = JSON.parse(readFileSync(f, 'utf8')) as CacheEntry
    if (Date.now() - entry.ts > entry.ttl) {
      try { unlinkSync(f) } catch { /* ignore */ }
      return null
    }
    return { content: entry.content, provider: entry.provider }
  } catch {
    return null
  }
}

export function cacheSet(key: string, content: string, provider: string, ttlMs = DEFAULT_TTL_MS): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
    const entry: CacheEntry = { content, provider, ts: Date.now(), ttl: ttlMs }
    writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(entry))
    evictIfNeeded()
  } catch {
    /* cache failures must never break the actual request */
  }
}

function evictIfNeeded(): void {
  try {
    const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'))
    if (files.length <= MAX_ENTRIES) return
    const sorted = files
      .map((f) => ({ f, m: statSync(join(CACHE_DIR, f)).mtimeMs }))
      .sort((a, b) => a.m - b.m)
    for (const { f } of sorted.slice(0, files.length - MAX_ENTRIES)) {
      try { unlinkSync(join(CACHE_DIR, f)) } catch { /* ignore */ }
    }
  } catch {
    /* ignore */
  }
}

/** Quick stats for observability. */
export function cacheStats(): { entries: number; dir: string } {
  try {
    return { entries: readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json')).length, dir: CACHE_DIR }
  } catch {
    return { entries: 0, dir: CACHE_DIR }
  }
}
