# Contributing to JD AI System Optimizer

Thanks for helping make AI cheaper to run in production. This project exists to be
a shared, trustworthy playbook — contributions that keep it **simple, safe, and
readable** are exactly what's wanted.

## Ground rules

1. **Every file stays readable.** No minified blobs, no obscure one-liners. If a
   maintainer can't review it in a few minutes, it doesn't belong here.
2. **No secrets, no telemetry, no phone-home.** This toolkit never touches a
   user's credentials beyond the environment variables they explicitly set.
3. **Nothing auto-runs.** No install hooks, no postinstall scripts. People should
   be able to read a file before they run it.

## How to contribute

- **Found a new way founders silently overspend on AI?** Open an issue describing
  it. Real-world cost traps are the most valuable contributions.
- **Adding a provider?** Follow the pattern in [`src/ai-provider.ts`](src/ai-provider.ts):
  cheap models first, premium last, log which provider served each call.
- **Improving the cost guard or statusline?** Keep them dependency-free.

## Pull requests

1. Fork and branch.
2. Keep changes focused — one improvement per PR.
3. Update the README if you change behavior.
4. Open the PR with a short "what and why."

PRs are reviewed with a bias toward merging anything that helps people spend less
on AI without hiding complexity.
