/**
 * verify-models.ts — Catch the silent-fallback bug before it bills you.
 *
 * Pings each "cheap" model with a one-token request. If a model name is wrong,
 * you find out HERE (in 2 seconds) instead of on your monthly invoice after
 * every request silently fell through to your premium model.
 *
 * Run it in CI, on deploy, or manually:
 *   npx tsx src/verify-models.ts
 *
 * Exit code 0 = all configured cheap models respond.
 * Exit code 1 = at least one is misconfigured (CI should fail).
 */

const MODELS_TO_VERIFY = [
  { provider: 'gemini', id: 'gemini-2.5-flash' },
  { provider: 'gemini', id: 'gemini-2.5-pro' },
]

async function pingGemini(modelId: string): Promise<{ ok: boolean; detail: string }> {
  const key = process.env.GOOGLE_API_KEY?.trim()
  if (!key) return { ok: false, detail: 'GOOGLE_API_KEY not set' }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      },
    )
    if (res.ok) return { ok: true, detail: `${res.status} OK` }
    const body = await res.text().catch(() => '')
    return { ok: false, detail: `${res.status} — ${body.slice(0, 120)}` }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

async function main(): Promise<void> {
  console.log('Verifying model names (silent-fallback guard)...\n')
  let allOk = true

  for (const m of MODELS_TO_VERIFY) {
    const result = m.provider === 'gemini' ? await pingGemini(m.id) : { ok: false, detail: 'unknown provider' }
    const icon = result.ok ? '✅' : '❌'
    console.log(`${icon} ${m.provider}/${m.id} — ${result.detail}`)
    if (!result.ok) allOk = false
  }

  console.log('')
  if (allOk) {
    console.log('All cheap models respond. Your fallback chain is safe.')
    process.exit(0)
  } else {
    console.error('⚠️  A model name is WRONG. Requests to it fail silently and fall')
    console.error('    through to your PREMIUM model. Fix the IDs in src/ai-provider.ts.')
    process.exit(1)
  }
}

main()
