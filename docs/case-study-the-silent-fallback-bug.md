# Case Study: The Silent Fallback Bug That 10x'd an AI Bill

> A real story from building the JD AI System. Sharing it so it doesn't happen to you.

## The symptom

A founder checks their AI usage dashboard. It says **62% of the monthly quota
used** — after *not touching the assistant for six hours.* Something was spending
the budget on its own.

## The setup

The system runs a fleet of background agents — lead scouts, outreach writers,
content generators — that call AI models all day. They were *designed* the right
way: a fallback chain that routes cheap work to inexpensive models and reserves a
premium model (Claude) only for when everything cheaper is unavailable.

On paper, the premium model should almost never run.

## The bug

The "cheap" model names in the config were **wrong** — they pointed at model IDs
that didn't exist (a version that was never released). Here's the trap:

```
1. Agent calls the cheap model  →  404, model not found
2. The error is caught silently  →  chain falls through
3. Falls through to the next option  →  also a wrong name  →  fails
4. Falls through to the LAST resort  →  the premium model  →  succeeds ✅
```

Every single request "succeeded" — so nothing looked broken. No errors surfaced.
But **100% of traffic was being served by the most expensive model in the chain**,
around the clock, across every agent.

The fallback safety net had quietly become the default path.

## The fix

Two parts:

1. **Correct the model names.** Two-line change. Cheap models started serving
   traffic again. Premium-model usage dropped toward zero.

2. **Add a guard so it can never happen silently again.** A tiny script
   (`verify-models.ts` in this repo) pings each cheap model with a one-token
   request. If a name is wrong, you find out in two seconds — in CI or on deploy —
   instead of on next month's invoice.

## The lessons

- **A fallback that always fires is just your default — at the worst price.**
  Log which provider actually served each call. If your "last resort" is doing
  all the work, you'll see it immediately.
- **Silent catches hide cost bugs.** Catching an error and moving on is fine for
  resilience, but emit a warning so the failure is visible.
- **Verify model names like you verify credentials.** They go stale. Providers
  rename and retire models. A wrong ID doesn't error loudly — it just routes you
  to whatever's next in line.
- **Put cost where you can see it.** A live cost readout (see `statusline/` in
  this repo) turns "I had no idea" into "I caught it in the first minute."

## Takeaway

The architecture was correct. One stale string in a config file turned a
cost-optimized system into a worst-case one — invisibly. This repo packages the
fix and the guardrails so your system fails loud, runs cheap, and never surprises
you.
