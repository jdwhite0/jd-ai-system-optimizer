/**
 * ai-provider.ts — Cost-optimized multi-model fallback chain for AI agents.
 *
 * The core idea: route routine agent work to cheap/fast models first, and only
 * fall back to a premium model (Claude/GPT) as a last resort. This keeps your
 * expensive-model bill near zero while preserving quality where it matters.
 *
 * Fallback order (cheapest → most expensive):
 *   1. Gemini Flash   — fast, cheap, great for scoring/email/classification
 *   2. Gemini Pro     — smarter, still cheap, for harder reasoning
 *   3. Ollama (local) — free, runs on your machine, offline-capable
 *   4. Claude/Anthropic — premium quality, last resort only
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BUG THAT INSPIRED THIS REPO:
 * If your "cheap" model name is wrong (e.g. a model that doesn't exist), every
 * call to it fails SILENTLY and the chain falls through to your premium model.
 * Result: you think you're on the $0.10/M model, but you're actually paying
 * $15/M for 100% of traffic — and you only notice when the bill arrives.
 *
 * Guard against it: verify model names with a live ping before trusting the
 * chain (see verify-models.ts), and log which provider actually served each call.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Set these environment variables (never hardcode keys):
 *   GOOGLE_API_KEY     — from https://aistudio.google.com/apikey
 *   ANTHROPIC_API_KEY  — from https://console.anthropic.com (optional, last resort)
 *   OLLAMA_ENDPOINT    — defaults to http://127.0.0.1:11434
 *
 * Includes two hard-won fixes:
 *   1. Opt-in response cache (ai-cache.ts) for deterministic calls.
 *   2. Gemini 2.5 "thinking" guard — on short tasks, thinking eats the whole
 *      output budget and returns EMPTY, which silently falls through to your
 *      premium model. Flash disables thinking on short tasks; Pro gets headroom.
 */
import { cacheKey, cacheGet, cacheSet } from './ai-cache'

// ─── Model configuration ─────────────────────────────────────────────────────
// Update these to the current model IDs from each provider. Wrong IDs = silent
// fallback to the premium model. Verify with verify-models.ts before shipping.
const FAST_MODEL = 'gemini-2.5-flash'
const SMART_MODEL = 'gemini-2.5-pro'
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const OLLAMA_MODEL = 'qwen2.5-coder:7b'
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT ?? 'http://127.0.0.1:11434'

const FETCH_TIMEOUT = 180_000
const OLLAMA_TIMEOUT = 300_000
const DEFAULT_MAX_TOKENS = 16_384
const COOLDOWN_MS = 5_000
const RETRY_DELAY_MS = 2_000
const MAX_RETRIES = 1

export type Provider = 'gemini-flash' | 'gemini-pro' | 'anthropic' | 'ollama' | 'cache'

export interface AiResponse {
  content: string
  provider: Provider
}

export interface AiOptions {
  json?: boolean
  maxTokens?: number
  /** Opt-in cache. ONLY for deterministic tasks (scoring/classification). */
  cache?: boolean
  cacheTtlMs?: number
}

// ─── Rate-limit cooldown tracking ────────────────────────────────────────────
const cooldowns = new Map<string, number>()

function isOnCooldown(model: string): boolean {
  const until = cooldowns.get(model)
  if (!until) return false
  if (Date.now() >= until) {
    cooldowns.delete(model)
    return false
  }
  return true
}

function setCooldown(model: string): void {
  cooldowns.set(model, Date.now() + COOLDOWN_MS)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const isTransient = (status: number): boolean => status === 429 || status === 503

// ─── Gemini ──────────────────────────────────────────────────────────────────
async function tryGemini(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: AiOptions,
): Promise<AiResponse | null> {
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return null
  if (isOnCooldown(model)) return null

  const attempt = async (): Promise<AiResponse | null> => {
    try {
      // Gemini 2.5 has a "thinking" phase that consumes the output-token budget.
      // On short tasks (low maxTokens) thinking eats the whole budget and returns
      // an EMPTY response — which silently falls through to slow/expensive models.
      //   - Flash supports thinkingBudget: 0 → turn thinking OFF on short tasks.
      //   - Pro CANNOT disable thinking, so give it headroom instead.
      const isFast = model === FAST_MODEL
      let maxOut = options?.maxTokens ?? DEFAULT_MAX_TOKENS
      const shortTask = maxOut < 512
      const disableThinking = isFast && shortTask
      if (!isFast && shortTask) maxOut = 2048
      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: maxOut,
          ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          ...(options?.json ? { responseMimeType: 'application/json' } : {}),
        },
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      )
      clearTimeout(timeout)

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        if (isTransient(res.status)) {
          setCooldown(model)
          throw new Error(`Gemini ${model} transient ${res.status}`)
        }
        // A 404 here usually means a WRONG MODEL NAME — the silent-fallback bug.
        throw new Error(`Gemini ${model} error ${res.status}: ${errBody.slice(0, 200)}`)
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) throw new Error('Empty Gemini response')

      return { content: text, provider: model === SMART_MODEL ? 'gemini-pro' : 'gemini-flash' }
    } catch (err) {
      console.warn(`[ai-provider] Gemini ${model} failed:`, err instanceof Error ? err.message : String(err))
      return null
    }
  }

  for (let i = 0; i <= MAX_RETRIES; i++) {
    const result = await attempt()
    if (result) return result
    if (i < MAX_RETRIES) await sleep(RETRY_DELAY_MS)
  }
  return null
}

// ─── Anthropic (Claude) — last resort ────────────────────────────────────────
async function tryAnthropic(
  systemPrompt: string,
  userPrompt: string,
  options?: AiOptions,
): Promise<AiResponse | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: options?.maxTokens ?? 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`Anthropic error ${res.status}: ${errBody.slice(0, 200)}`)
    }

    const data = (await res.json()) as { content: { text: string }[] }
    return { content: data.content?.map((c) => c.text).join('') ?? '', provider: 'anthropic' }
  } catch (err) {
    console.warn('[ai-provider] Anthropic failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

// ─── Ollama (local, free) ────────────────────────────────────────────────────
async function tryOllama(
  systemPrompt: string,
  userPrompt: string,
  options?: AiOptions,
): Promise<AiResponse | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT)
    const res = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: { temperature: 0.5, num_predict: options?.maxTokens ?? 2048 },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const errText = await res.text().catch(() => 'no body')
      throw new Error(`Ollama error ${res.status}: ${errText.slice(0, 200)}`)
    }
    const data = (await res.json()) as { message: { content: string } }
    return { content: data.message.content, provider: 'ollama' }
  } catch (err) {
    console.warn('[ai-provider] Ollama failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Generate text using the cheapest capable model. Falls through the chain on
 * failure. Throws only if every provider fails.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options?: AiOptions,
): Promise<AiResponse> {
  // Opt-in cache — ONLY for deterministic tasks. Returns instantly on a hit,
  // skipping every provider. Never enable for generative output.
  let key = ''
  if (options?.cache) {
    key = cacheKey(systemPrompt, userPrompt, options.json ? 'json' : '')
    const hit = cacheGet(key)
    if (hit) return { content: hit.content, provider: 'cache' }
  }

  let result: AiResponse | null = null

  // Cheapest first. Claude is the absolute last resort so it only bills when
  // every cheaper option is genuinely unavailable.
  result = await tryGemini(FAST_MODEL, systemPrompt, userPrompt, options)
  if (!result) result = await tryGemini(SMART_MODEL, systemPrompt, userPrompt, options)
  if (!result) result = await tryOllama(systemPrompt, userPrompt, options)
  if (!result) result = await tryAnthropic(systemPrompt, userPrompt, options)

  if (!result) {
    throw new Error('All AI providers failed: Gemini Flash, Gemini Pro, Ollama, Anthropic.')
  }

  if (options?.cache && key && result.content) {
    cacheSet(key, result.content, result.provider, options.cacheTtlMs)
  }
  return result
}

/**
 * Generate and parse JSON. Robust extraction handles every provider's output
 * style (code fences, "here is your JSON" prefixes, trailing prose).
 */
export async function generateJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; cache?: boolean; cacheTtlMs?: number },
): Promise<{ data: T; provider: Provider }> {
  const enhanced = `${userPrompt}\n\nRespond with ONLY valid JSON. No markdown, no explanation, no code fences. Just raw JSON.`
  const result = await generateText(systemPrompt, enhanced, {
    json: true,
    maxTokens: options?.maxTokens,
    cache: options?.cache,
    cacheTtlMs: options?.cacheTtlMs,
  })

  const extract = (text: string): string => {
    let t = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    t = t.replace(/^(here['’]?s|sure|okay|ok|here are|certainly|absolutely)[:\s]*/i, '')
    const objStart = t.search(/[{[]/)
    if (objStart > 0) t = t.slice(objStart)
    const objEnd = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
    if (objEnd >= 0) t = t.slice(0, objEnd + 1)
    return t.trim()
  }

  const cleaned = extract(result.content)
  if (!cleaned) throw new Error(`AI returned empty after extraction:\n${result.content.slice(0, 300)}`)

  try {
    return { data: JSON.parse(cleaned) as T, provider: result.provider }
  } catch {
    throw new Error(`AI returned invalid JSON (provider: ${result.provider}):\n${cleaned.slice(0, 500)}`)
  }
}
