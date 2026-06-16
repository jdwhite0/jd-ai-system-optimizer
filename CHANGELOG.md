# Changelog

All notable changes to **JD AI System Optimizer** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR** — breaking changes to the public API
- **MINOR** — new features, backwards-compatible
- **PATCH** — bug fixes and docs, backwards-compatible

## [Unreleased]

_Nothing yet. Open an issue or PR to propose the next improvement._

## [1.1.0] — 2026-06-16

### Added
- **Response cache** (`src/ai-cache.ts`) — zero-dependency, normalized exact-match
  cache for deterministic calls (scoring, classification). Opt-in per call via
  `{ cache: true }`. Repeated/near-identical prompts return instantly and free.
- **Gemini 2.5 thinking-mode guard** — on short tasks, thinking consumed the whole
  output budget and returned empty, silently falling through to the premium model.
  Flash now disables thinking on short tasks; Pro gets token headroom instead.
- **Acknowledgements & Prior Art** section crediting GPTCache, prompt-cache, and
  llm-router (all MIT). Original implementation — no code copied.

### Changed
- `generateText` / `generateJson` accept `cache` and `cacheTtlMs` options.

## [1.0.0] — 2026-06-16

### Added
- **Multi-model fallback chain** (`src/ai-provider.ts`) — routes routine work to
  cheap/fast models (Gemini Flash → Pro → Ollama) and escalates to a premium model
  (Claude/GPT) only as a last resort.
- **Silent-fallback guard** (`src/verify-models.ts`) — pings each cheap model to
  catch wrong/stale model names before they silently route traffic to the premium model.
- **Live cost statusline** (`statusline/claude-cost-statusline.sh`) — shows session
  cost in your editor's status bar; turns yellow at \$2, red at \$5.
- **Settings templates** (`claude/settings.example.json`) and **token-efficiency rules**
  (`claude/token-efficiency.md`).
- **Case study** (`docs/case-study-the-silent-fallback-bug.md`) — the silent-fallback
  bug that 10x'd a real AI bill.
- JD AI System brand assets and "Built with JD AI System" badge.

[Unreleased]: https://github.com/jdwhite0/jd-ai-system-optimizer/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/jdwhite0/jd-ai-system-optimizer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jdwhite0/jd-ai-system-optimizer/releases/tag/v1.0.0
