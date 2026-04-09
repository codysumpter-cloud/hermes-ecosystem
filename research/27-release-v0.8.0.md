# Hermes Agent v0.8.0 Release Notes

**Version:** v0.8.0 (v2026.4.8)
**Date:** April 8, 2026
**Metrics:** 209 merged PRs | 82 resolved issues
**Repo stats at release:** 43,724 stars | 5,603 forks | 2,498 open issues

## Major Highlights

1. **Background Process Notifications** — Long-running tasks trigger automatic agent notifications on completion without polling
2. **Free Xiaomi MiMo v2 Pro** — Nous Portal free-tier for auxiliary tasks (compression, vision, summarization)
3. **Live Model Switching** — `/model` command mid-session across all platforms with intelligent fallback routing
4. **Self-Optimized Tool-Use Guidance** — Automated benchmarking found and fixed 5 failure modes in GPT/Codex tool-calling
5. **Google AI Studio (Gemini) Integration** — Direct Gemini access with automatic context length detection via models.dev
6. **Inactivity-Based Timeouts** — Tracks actual tool activity instead of wall-clock time
7. **Approval Buttons** — Native Slack/Telegram buttons replace text-based approval
8. **MCP OAuth 2.1 PKCE** — Standards-compliant OAuth + automatic malware scanning via OSV
9. **Centralized Logging** — Structured logging to ~/.hermes/logs/ with `hermes logs` command
10. **Matrix Tier 1** — Reactions, read receipts, rich formatting, room management
11. **Supermemory Memory Provider** — Multi-container, search mode, identity template support
12. **Expanded Plugin System** — Custom CLI subcommands, request-scoped API hooks, session lifecycle events

## New Skills

- popular-web-designs: 54 production website design systems
- p5js: Creative coding
- manim-video: Mathematical and technical animations (3Blue1Brown style)
- llm-wiki: Karpathy's LLM Wiki integration
- gitnexus-explorer: Codebase indexing and knowledge serving
- research-paper-writing: AI-Scientist and GPT-Researcher patterns

## Security Hardening

- Consolidated SSRF protections and timing attack mitigations
- Tar traversal prevention and credential leakage guards
- Cross-session isolation
- Cron path traversal hardening
- Approval session escalation prevention
- O(n²) catastrophic backtracking regex fix (100x improvement)

## Platform Updates

- **Telegram:** Group topics, emoji reactions, approval buttons
- **Discord:** Channel controls, native slash commands
- **Slack:** Thread engagement, mrkdwn in edits
- **Matrix:** Tier 1 parity — reactions, read receipts, E2EE, room management
- **Signal:** Full MEDIA tag delivery
- **Mattermost:** File attachments
- **Feishu:** Interactive card approvals

## Documentation

- 40+ discrepancies fixed between docs and codebase
- 13 features documented from recent PRs
- 3 new tutorials in Guides section
- WSL2 networking guide, Discord config reference, Honcho CLI docs

## Contributors

Core: @teknium1 (179 PRs). Top contributors: @SHL0MS (7), @alt-glitch (3), @benbarclay (2), @CharlieKerfoot (2), @WAXLYY (2), @MadKangYu (2). Plus 12 additional contributors.
