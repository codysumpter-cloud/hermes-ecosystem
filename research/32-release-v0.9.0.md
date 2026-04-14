# Hermes Agent v0.9.0 Release Notes

**Version:** v0.9.0 (v2026.4.13)
**Published:** April 13, 2026
**Source:** https://github.com/NousResearch/hermes-agent/releases/tag/v2026.4.13
**Scope:** 487 commits, 269 merged PRs, 167 resolved issues, 24 contributors

## Major Highlights

1. **Local Web Dashboard** — Browser-based management UI for settings, sessions, skills, and gateway
2. **Fast Mode (/fast)** — Priority processing for GPT-5.4, Codex, Claude with reduced latency
3. **iMessage via BlueBubbles** — Full integration with auto-webhook registration
4. **WeChat & WeCom** — Native WeChat via iLink Bot API + WeCom callback-mode adapter
5. **Termux/Android** — Native Android execution with mobile-optimized terminal UI
6. **Background Process Monitoring** — watch_patterns triggers notifications on subprocess output matches
7. **Pluggable Context Engine** — Custom engines filter/summarize/inject context per turn via hermes plugins
8. **xAI (Grok), Xiaomi MiMo, Qwen** — First-class native provider support with OAuth
9. **Unified Proxy Support** — SOCKS proxy, Discord proxy, system proxy auto-detection across all platforms
10. **16 Security Fixes** — Twilio RCE mitigation, shell injection, SSRF bypass, path traversal, more

## Messaging Platform Expansion

Now 16 platforms (up from 14):
- NEW: iMessage (via BlueBubbles)
- NEW: WeChat (via iLink Bot API)
- Improved: WeCom callback-mode, Discord (allowed channels, forum topics, reply mode), Slack (assistant threads), Matrix (migrated to mautrix-python), Feishu (QR onboarding)

## Core Improvements

- Structured API error classification for smart failover
- /compress <focus> for guided compression
- Tiered context pressure warnings
- Empty response retry (3 attempts with nudge)
- Adaptive streaming backoff
- Hindsight memory plugin feature parity
- Multi-arch Docker (amd64 + arm64), non-root
- hermes backup / hermes import for config portability
- hermes dump for copy-pasteable setup summary
- 279 random tips on session start

## Skills

- Centralized skills index with tree cache (no more rate-limit failures)
- Google Workspace skill migrated to GWS CLI
- Creative divergence strategies skill
- Creative ideation skill
- Parallelized skills browse/search

## Security (16 Fixes)

- Twilio webhook signature validation (SMS RCE mitigation)
- Shell injection neutralization via path quoting
- Git argument injection and path traversal prevention
- SSRF redirect bypass protection in Slack image uploads
- API bind guard for non-loopback binding
- Approval button authorization
- DingTalk/API webhook origin validation
- Header injection rejection

## Contributors

24 contributors across 269 PRs. Key: @alt-glitch (6 PRs), @SHL0MS (2), @sprmn24 (2), @nicoloboschi, @Hygaard, @jarvis-phw, and 18 others.
