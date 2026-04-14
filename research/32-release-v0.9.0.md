# Hermes Agent v0.9.0 Release Notes

**Version:** v0.9.0 (v2026.4.13)
**Published:** April 13, 2026
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v2026.4.13
**Scope:** 487 commits, 269 merged PRs, 167 resolved issues, 24 contributors
**Tagline:** "The everywhere release — Hermes goes mobile with Termux/Android, adds iMessage and WeChat, ships Fast Mode, introduces background process monitoring, and delivers the deepest security hardening pass yet across 16 supported platforms."

---

## Major Highlights

### Local Web Dashboard
A new browser-based interface enables management without terminal access. Users can configure settings, monitor sessions, browse skills, and manage the gateway through a clean web UI designed for accessibility.

### Fast Mode (/fast)
Priority processing toggle routes requests through priority queues on supported models (GPT-5.4, Codex, Claude), significantly reducing latency. Implementation spans OpenAI Priority Processing models and Anthropic's fast tier.

### iMessage via BlueBubbles
Full iMessage integration through BlueBubbles with auto-webhook registration and setup wizard support. Hermes Agent can now send and receive iMessages.

### WeChat and WeCom
Native WeChat support via iLink Bot API with streaming and media uploads. WeCom callback-mode adapter serves self-built enterprise applications with atomic state persistence.

### Termux/Android
Native Android execution environment with mobile-optimized terminal UI, voice support, and image generation capabilities. Hermes Agent now runs directly on Android phones via Termux.

### Background Process Monitoring
The watch_patterns feature monitors subprocess output in real-time, triggering notifications when patterns match — useful for tracking errors or awaiting specific events like port listeners.

### Pluggable Context Engine
Context management becomes extensible through `hermes plugins`. Custom engines can filter, summarize, or inject domain-specific context each turn.

### New Native Provider Support
First-class support for xAI (Grok), Xiaomi MiMo, and Qwen with OAuth capability. Direct API access and model catalogs enable seamless provider switching.

### Unified Proxy Support
SOCKS proxies, Discord proxy configuration, and system proxy auto-detection work across all gateway platforms, benefiting corporate environments.

---

## Messaging Platform Expansion

Hermes Agent now supports **16 messaging platforms** (up from 14):

**New platforms:**
- iMessage (via BlueBubbles) — full integration with auto-webhook registration
- WeChat (via iLink Bot API) — streaming, media uploads

**Improved platforms:**
- WeCom — callback-mode adapter for enterprise apps with atomic state persistence
- Discord — allowed channels whitelist, forum topic inheritance, configurable reply mode, extended file types (.log), increased file size limits
- Slack — 7 community PRs consolidated, assistant thread lifecycle events
- Matrix — migrated from matrix-nio to mautrix-python, SQLite crypto store replaces pickle for E2EE, cross-signing recovery key verification
- Feishu — QR-based bot onboarding

**Gateway core improvements:**
- Inbound text batching for Discord, Matrix, and WeCom with adaptive delay
- Natural mid-turn assistant messages surface in chat platforms
- WSL-aware gateway with smart systemd detection
- Per-platform tool_progress override
- Configurable "still working" notification intervals
- Model switches persist across messages
- /usage shows rate limits, cost, and token details between turns
- Drain in-flight work before restart
- Webhook delivery support for all platforms

---

## Core Architecture Improvements

### Provider and Model Management
- Structured API error classification enables smart failover decisions
- Rate limit headers now appear in /usage output
- Fallback provider activation on repeated empty responses with status visibility
- OpenRouter variant tags (:free, :extended, :fast) preserved during model switching
- Credential exhaustion TTL reduced from 24 hours to 1 hour
- Enhanced OAuth credential lifecycle management

### Agent Loop Enhancements
- Improved context compression with higher limits and degradation warnings
- /compress <focus> command for guided compression with topic focus
- Tiered context pressure warnings with gateway deduplication
- Staged inactivity warnings before timeout escalation
- Compression floor prevents premature agent termination
- Empty response retry mechanism (3 attempts with nudge)
- Adaptive streaming backoff prevents message truncation

### Memory and Sessions
- Hindsight memory plugin achieves feature parity with setup wizard improvements
- Honcho supports opt-in initOnSessionStart for tools mode
- Orphan children instead of cascade-deleting during pruning/deletion operations

---

## CLI and User Experience

### New Commands
- `hermes dump` — copy-pasteable setup summary for sharing/debugging
- `hermes backup` / `hermes import` — full configuration portability
- Native /model picker modal for provider-then-model selection
- Live per-tool elapsed timer in TUI spinner
- 279 random tips on session start

### Configuration
- Per-platform display verbosity settings
- Component-separated logging with session context
- network.force_ipv4 configuration for IPv6 timeout issues
- Config.yaml takes priority over environment variables
- HERMES_HOME_MODE environment variable override capability

---

## Tool System Enhancements

### Environments and Execution
- Unified spawn-per-call execution layer for environments
- Unified file sync with modification time tracking and deletion
- Persistent sandbox environments survive between turns
- Bulk file sync via tar pipe for SSH/Modal backends
- Foreground timeout cap prevents session deadlocks

### MCP Integration
- hermes mcp add supports --env and --preset flags
- Combined content and structuredContent handling
- Tool name deconfliction fixes

### Browser Automation
- Hardening: dead code removal, caching improvements, scroll performance, security patches, thread safety
- /browser connect auto-launch uses dedicated Chrome profile directory
- Orphaned browser sessions reaped on startup

### Voice and Vision
- Voxtral TTS provider integration (Mistral AI)
- TTS speed support for Edge TTS, OpenAI TTS, and MiniMax
- Vision auto-resize for oversized images up to 20 MB
- Retry-on-failure for vision processing

---

## Skills Ecosystem

- Centralized skills index with tree cache eliminates rate-limit installation failures
- More aggressive skill loading instructions in system prompt (v3)
- Google Workspace skill migrated to GWS CLI backend
- New: Creative divergence strategies skill
- New: Creative ideation skill with constraint-driven generation
- Parallelized skills browse/search

---

## Security Hardening (16 Fixes)

This release includes the deepest security hardening pass to date:

1. Twilio webhook signature validation (SMS RCE mitigation)
2. Shell injection neutralization via path quoting in sandbox writes
3. Git argument injection and path traversal prevention
4. SSRF redirect bypass protection in Slack image uploads
5. Path traversal gaps addressed in multiple components
6. Credential gate gaps fixed
7. Dangerous pattern detection improvements
8. API bind guard enforces keys for non-loopback binding
9. Approval button authorization requires authentication
10. Path boundary enforcement in skill operations
11. DingTalk webhook origin validation
12. API webhook origin validation
13. Header injection rejection
14. Context length halving prevention on output-cap errors
15. Primary client recovery on OpenAI transport errors
16. Credential pool rotation on billing-classified 400s

---

## Infrastructure

- Multi-arch Docker images (amd64 + arm64)
- Docker runs as non-root with virtualenv
- Container-aware Nix CLI
- Per-profile subprocess HOME isolation
- Shallow git clone for faster installation
- hermes update always reset on stash conflict

---

## Documentation

- Platform adapter developer guide
- WeCom Callback implementation docs
- Cron troubleshooting guide
- Streaming timeout auto-detection guide
- Tool-use enforcement documentation
- BlueBubbles pairing instructions
- Telegram proxy support section
- hermes dump and hermes logs CLI reference

---

## Contributors

24 contributors across 269 merged PRs and 487 commits.

Key community contributors: @alt-glitch (6 PRs across Nix, Matrix, and file sync), @SHL0MS (2 PRs on creative skills), @sprmn24 (2 PRs on error handling), with additional contributions from @nicoloboschi, @Hygaard, @jarvis-phw, @Kathie-yu, @hermes-agent-dhabibi, @kira-ariaki, @cherifya, @Cafexss, @KUSH42, @kuishou68, @luyao618, @ygd58, @0xbyt4, @JiayuuWang, @HiddenPuppy, @dsocolobsky, @benbarclay, @sosyz, @devorun, and @ethernet8023.
