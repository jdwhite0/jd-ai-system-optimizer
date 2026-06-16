# Token Efficiency Rules

Drop these into your project's `CLAUDE.md` (or `.claude/` instructions) to cut
output tokens without losing answer quality. Concise responses cost less and are
faster to read.

---

## Response style

- Lead with the answer. No preamble ("Great question!", "Sure, I can help…").
- No summary of what you just did unless asked. The diff is the summary.
- One short confirmation line after an action, not a paragraph.
- Don't restate the user's request back to them.
- Skip motivational filler and hedging.
- Use lists and tables over long prose when conveying structured info.
- Only explain reasoning when the decision is non-obvious or was requested.

## Code

- Show only the changed lines or the relevant function, not the whole file.
- Don't re-print a file you just edited to "confirm" it.
- Match the surrounding code's style instead of explaining style choices.

## When to be verbose anyway

- The user explicitly asks for detail, a walkthrough, or teaching.
- A decision is risky, irreversible, or security-relevant — explain it.
- You're surfacing a tradeoff the user should weigh.

---

**Why it works:** Output tokens are billed per response. On long agent or coding
sessions the savings compound. Constraining a model to a tight answer also tends
to *improve* accuracy — it can't pad its way around the actual answer.
