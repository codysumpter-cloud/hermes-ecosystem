# Hermes Agent — Release History

## Sources
- GitHub releases: https://github.com/NousResearch/hermes-agent/releases
- Release notes: RELEASE_v0.4.0.md, RELEASE_v0.5.0.md, RELEASE_v0.7.0.md in repo

## v0.1.0 - v0.3.x (February 2026)
Initial release. Core agent loop, CLI, basic messaging gateway, memory system, skill creation. Rapid iteration period. Hit 22,000 stars within weeks of launch.

## v0.4.0 — Platform Expansion Release (March 23, 2026)
Tag: v2026.3.23 | ~200+ bug fixes, ~300 PRs

**Major additions:**
- OpenAI-compatible API server with /v1/chat/completions and /api/jobs REST API
- 6 new messaging adapters: Signal, DingTalk, SMS (Twilio), Mattermost, Matrix, Webhook
- 4 new inference providers
- MCP server management with OAuth 2.1
- @ context references for file/directory injection
- Gateway prompt caching
- Streaming enabled by default
- Hardened with input limits, field whitelists, SQLite-backed response persistence, CORS origin protection

## v0.5.0 — Model and Integration Improvements
**Major additions:**
- Anthropic output limits fixes (128K for Opus 4.6, 64K for Sonnet 4.6)
- First-class Hugging Face Inference API integration with auth and setup wizard
- Curated model list mapping OpenRouter agentic defaults to HF equivalents

## v0.6.0 — Containerization
**Major additions:**
- Official Dockerfile supporting both CLI and gateway modes
- Volume-mounted config for Docker deployments

## v0.7.0 — Memory and Reliability (Current, April 2026)
Tag: latest | 168 PRs

**Major additions:**
- Pluggable memory providers (8 external providers: Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover, Supermemory)
- Credential pool rotation for API key failover
- Camofox anti-detection browser backend with persistent sessions and VNC
- Inline diff previews for file operations
- API server session continuity with streaming tool progress events
- X-Hermes-Session-Id headers for persistent sessions
- Real-time tool streaming

## v0.8.0 — Intelligent Automation (April 8, 2026)
Tag: v2026.4.8 | 209 PRs | 82 issues resolved

**Major additions:**
- Background process notifications (no more polling)
- Live model switching via /model across all platforms
- Free Xiaomi MiMo v2 Pro on Nous Portal
- Self-optimized GPT/Codex tool-use guidance (5 failure modes patched via automated benchmarking)
- Native Google AI Studio (Gemini) integration with models.dev context length detection
- Inactivity-based timeouts (tracks tool activity, not wall-clock)
- Approval buttons for Slack and Telegram (native platform UI)
- MCP OAuth 2.1 PKCE + OSV malware scanning
- Centralized structured logging to ~/.hermes/logs/
- Matrix promoted to Tier 1 (reactions, read receipts, E2EE, room management)
- Supermemory memory provider
- Expanded plugin system (custom CLI subcommands, request-scoped API hooks, session lifecycle)
- New skills: popular-web-designs, p5js, manim-video, llm-wiki, gitnexus-explorer, research-paper-writing
- Security hardening: SSRF consolidation, timing attack mitigations, tar traversal prevention, regex fix (100x perf)
- 57 failing CI tests repaired

Full release notes: research/27-release-v0.8.0.md

## Growth Trajectory
- Feb 2026: Launch → 22,000 stars in weeks
- Apr 8 2026: v0.8.0 released — 43,700+ stars, 5,600+ forks, 2,500+ open issues
