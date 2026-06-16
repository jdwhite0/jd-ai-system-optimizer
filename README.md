<div align="center">

<img src="assets/brand/jd-ai-system-symbol-dark.png" alt="JD AI System" width="140" />

# JD AI System Optimizer

### Stop overpaying for AI. Route cheap, fail loud, see every dollar.

A free, open-source toolkit that cuts your AI bill without cutting quality — built and battle-tested inside a real multi-agent business system.

[![License: MIT](https://img.shields.io/badge/License-MIT-06B6D4.svg)](LICENSE)
[![Built with JD AI System](https://img.shields.io/badge/Built%20with-JD%20AI%20System-000000.svg)](https://github.com/jdwhite0/jd-ai-system-optimizer)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-06B6D4.svg)](#contributing)

</div>

---

## Why this exists

I'm Jerry Devin, founder of **JD AI System** — an AI operating system that runs a
fleet of autonomous agents for lead generation, outreach, and content.

One morning I opened my usage dashboard and saw **62% of my monthly AI budget
burned — after not touching the assistant for six hours.** Background agents were
quietly spending the budget on the most expensive model available, around the clock.

The cause was a single stale string in a config file (the full story is in
[the case study](docs/case-study-the-silent-fallback-bug.md)). The fix was small.
The lesson was big: **AI cost problems are usually invisible until the invoice.**

So I packaged the fix and the guardrails into this repo — free, for any founder or
developer running AI in production. No catch, no upsell.

---

## What you get

| Tool | What it does | Typical saving |
|---|---|---|
| 🔀 **[Multi-model fallback chain](src/ai-provider.ts)** | Routes routine work to cheap/fast models (Gemini Flash, local Ollama) and only escalates to a premium model (Claude/GPT) as a true last resort. | 70–95% on agent workloads |
| 🛡️ **[Silent-fallback guard](src/verify-models.ts)** | Pings each "cheap" model to catch wrong/stale model names *before* they silently route 100% of traffic to your premium model. | Prevents the 10x surprise |
| 💰 **[Live cost statusline](statusline/claude-cost-statusline.sh)** | Shows your current AI session cost right in your editor's status bar. Turns yellow at \$2, red at \$5. | Catch runaway spend in minute one |
| ⚙️ **[Settings templates](claude/settings.example.json)** | Pre-approve safe read-only commands, hard-block destructive ones. Less friction, more safety. | Fewer prompts, safer sessions |
| ✂️ **[Token-efficiency rules](claude/token-efficiency.md)** | Drop-in instructions that make your AI answer tighter — lower output cost, faster reads. | ~10–15% on output tokens |

---

## Quick start

```bash
git clone https://github.com/jdwhite0/jd-ai-system-optimizer.git
cd jd-ai-system-optimizer
```

### 1. Use the fallback chain in your agents

```ts
import { generateText } from './src/ai-provider'

// Automatically uses the cheapest capable model. Claude only fires if
// every cheaper option is genuinely unavailable.
const result = await generateText(systemPrompt, userPrompt)
console.log(`Served by: ${result.provider}`)  // e.g. "gemini-flash"
```

Set your keys as environment variables (never hardcode them):

```bash
export GOOGLE_API_KEY="..."      # https://aistudio.google.com/apikey
export ANTHROPIC_API_KEY="..."   # optional — last-resort premium model
# Ollama runs locally and free: https://ollama.com
```

### 2. Guard against the silent-fallback bug

```bash
npx tsx src/verify-models.ts
# ✅ gemini/gemini-2.5-flash — 200 OK
# ✅ gemini/gemini-2.5-pro — 200 OK
# All cheap models respond. Your fallback chain is safe.
```

Run it in CI so a stale model name fails the build, not your wallet.

### 3. See your cost live

```bash
cp statusline/claude-cost-statusline.sh ~/.claude/
chmod +x ~/.claude/claude-cost-statusline.sh
```

Then add to `~/.claude/settings.json` (see [the template](claude/settings.example.json)):

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.claude/claude-cost-statusline.sh"
  }
}
```

---

## Is it safe?

Yes — and that's the point.

- **Nothing runs automatically.** No install scripts, no background hooks, no
  phone-home. Every file is short and readable. Look before you run.
- **No secrets, ever.** All keys come from environment variables you control.
  Nothing in this repo touches your credentials.
- **MIT licensed.** Use it, fork it, ship it commercially. No strings.

---

## The principle

> A fallback that always fires is just your default — at the worst price.

Most AI cost problems aren't about prompt length. They're about *which model is
quietly doing the work.* Route cheap, make failures loud, and put the dollar
amount where you can see it. That's the whole philosophy.

---

## Contributing

PRs welcome. Found another way founders silently overspend on AI? Open an issue.
The goal is a shared, trustworthy playbook for running AI in production affordably.

---

<div align="center">

<img src="assets/brand/built-with-jd-ai-system-light.svg" alt="Built with JD AI System" width="240" />

**A free tool from [JD AI System](https://github.com/jdwhite0)** — the AI operating system for founders.

Built by Jerry Devin · MIT License · Use it freely

</div>
