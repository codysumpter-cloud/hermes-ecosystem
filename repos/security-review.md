# Hermes Ecosystem Community Repos - Security Review

**Date:** 2026-04-08
**Reviewer:** Automated README-based security scan
**Scope:** README content review for 16 community repositories
**Methodology:** Checked each repo's README for obfuscated code, suspicious network calls, credential harvesting, typosquatting, supply chain risks, crypto mining, excessive permissions, and empty/placeholder patterns.

---

## Summary

| Repo | Stars | Language | Verdict | Key Concern |
|------|-------|----------|---------|-------------|
| outsourc-e/hermes-workspace | 830 | TypeScript | **PASS** | ETH wallet address (donation, not mining) |
| greyhaven-ai/autocontext | 711 | Python | **PASS** | Legitimate complex tool |
| swarmclawai/swarmclaw | 285 | TypeScript | **WARN** | Could not fully fetch README; needs manual review |
| ucsandman/DashClaw | 204 | JavaScript | **PASS** | Legitimate governance platform |
| Agents365-ai/drawio-skill | 131 | Shell | **PASS** | Shell commands limited to draw.io CLI usage |
| yoloshii/ClawMem | 86 | TypeScript | **PASS** | Auto-downloads ML models from HuggingFace (minor supply chain note) |
| joeynyc/hermes-skins | 76 | Python | **WARN** | Could not fully fetch README; needs manual review |
| fathah/hermes-desktop | 65 | TypeScript | **PASS** | Standard Electron app |
| sanchomuzax/hermes-webui | 57 | Python | **PASS** | Read-only data access, token auth |
| AlexAI-MCP/hermes-CCC | 56 | PowerShell | **WARN** | Runs install.ps1 and curl-pipe-bash installer; scripts not inspectable from README alone |
| esaradev/icarus-plugin | 51 | Python | **PASS** | Standard Hermes plugin |
| howdymary/hermes-agent-metaharness | 46 | Python | **PASS** | Academic project with arxiv reference |
| unmodeled-tyler/vessel-browser | 44 | Rust | **WARN** | curl-pipe-bash installer; creates persistent CLI tools |
| Crustocean/reina | 35 | Python | **PASS** | Autonomous bot agent; no suspicious code patterns |
| runtimenoteslabs/gladiator | 29 | Python | **WARN** | curl-pipe-bash from hermes.nousresearch.com; hardcoded DB creds in examples; binds 0.0.0.0 |
| Abruptive/Ankh.md | 25 | Shell | **PASS** | Bootstrap script noted but no suspicious patterns in README |

**Overall: 0 FAIL, 5 WARN, 11 PASS**
**No repos flagged as genuinely malicious.**

---

## Detailed Findings

---

### 1. outsourc-e/hermes-workspace (830 stars, TypeScript)

**Verdict: PASS**

**What it is:** Web-based workspace/command center for Hermes Agent with chat, files, memory, skills, and terminal.

**Security observations:**
- Standard `git clone` + `pnpm install` + `pnpm dev` installation. No unusual download patterns.
- Environment variables include `ANTHROPIC_API_KEY` and optional `HERMES_PASSWORD` -- stored locally in `.env`, standard practice.
- Docker Compose setup pulls from their own repos only.
- ETH wallet address present (`0xB332D4C60f6FBd94913e3Fd40d77e3FE901FAe22`) -- this is for **donations**, not hidden mining. Clearly labeled "Support the Project" section with GitHub Sponsors link.
- CSP headers, auth middleware, path traversal prevention, and rate limiting documented.
- References `outsourc-e/hermes-agent` fork for extended gateway endpoints -- this is a fork of the official NousResearch repo, not a suspicious third-party.

**Crypto mining:** No. Wallet is a transparent donation address.
**Obfuscated code:** None detected.
**Supply chain:** Clean -- standard npm/pnpm ecosystem.

---

### 2. greyhaven-ai/autocontext (711 stars, Python)

**Verdict: PASS**

**What it is:** Multi-agent improvement loop framework. Runs scenarios, evaluates outputs, accumulates validated knowledge.

**Security observations:**
- Complex but legitimate tool with clear architecture documentation.
- Supports multiple LLM providers (Anthropic, OpenAI, Gemini, Mistral, etc.) via env-driven config. API keys stored in environment variables -- standard practice.
- No suspicious download patterns. Installation via `uv sync` or `pip install autocontext`.
- Published on both PyPI (`autocontext`) and npm (`autoctx`).
- Remote execution options (SSH, PrimeIntellect sandbox) are opt-in and clearly documented.
- Deterministic mode available for testing without API keys.
- Notification hooks (Slack, HTTP webhooks) are opt-in via `AUTOCONTEXT_NOTIFY_*` env vars.

**Obfuscated code:** None.
**Supply chain:** Clean. Standard Python/Node ecosystem with named providers.
**Excessive permissions:** Remote execution is opt-in, not default.

---

### 3. swarmclawai/swarmclaw (285 stars, TypeScript)

**Verdict: WARN (Incomplete Review)**

**What it is:** Could not fully retrieve README content. The WebFetch tool returned a refusal rather than content.

**Why WARN:**
- README content was not successfully extracted for full analysis.
- Cannot confirm or deny presence of suspicious patterns.
- Repo name "swarmclaw" does not appear to be typosquatting any known project.

**Action required:** Manual review of this repository is recommended. Clone and inspect `README.md`, `package.json`, and any install/setup scripts directly.

---

### 4. ucsandman/DashClaw (204 stars, JavaScript)

**Verdict: PASS**

**What it is:** Decision infrastructure / governance layer for AI agents. Intercepts agent actions, enforces policies, records evidence.

**Security observations:**
- `npx dashclaw-demo` runs a local demo -- standard npm execution pattern.
- SDK available on npm (`dashclaw`) and PyPI (`dashclaw`).
- Deploy via Vercel + Neon (free tier) -- mainstream platforms.
- Claude Code hooks (`dashclaw_pretool.py`, `dashclaw_posttool.py`) govern tool calls. These are copied locally, not fetched remotely at runtime.
- Environment variables: `DASHCLAW_BASE_URL`, `DASHCLAW_API_KEY`, `DATABASE_URL`, `ENCRYPTION_KEY` -- standard for a SaaS-like tool.
- Prompt injection scanning built in and enabled by default.
- `livingcode/` self-monitoring framework is interesting but contained -- runs locally.
- Website domain `dashclaw.io` is a legitimate registered domain matching the project.

**Obfuscated code:** None.
**Credential harvesting:** No. API keys stay with user's own DashClaw instance.
**Supply chain:** Clean.

---

### 5. Agents365-ai/drawio-skill (131 stars, Shell)

**Verdict: PASS**

**What it is:** Skill file that generates draw.io diagrams from natural language. Uses draw.io desktop CLI for export.

**Security observations (Shell - extra scrutiny):**
- Shell commands are limited to invoking the draw.io desktop CLI for diagram export (`drawio` command).
- Requires draw.io desktop to be pre-installed (Homebrew on macOS, manual on Linux/Windows).
- Linux headless export requires `xvfb` -- standard for headless GUI apps.
- No curl-pipe-bash patterns. No remote code download.
- Python 3 used only for browser fallback URL generation -- minimal scope.
- Single `SKILL.md` file format -- minimal attack surface.

**Shell script risk:** Low. Commands are diagram-generation focused, not system-administration focused.

---

### 6. yoloshii/ClawMem (86 stars, TypeScript)

**Verdict: PASS**

**What it is:** Local-first memory engine for AI agents using SQLite + optional GPU inference via llama.cpp.

**Security observations:**
- Strong local-first design: "no API keys, no cloud dependencies" for core features.
- 5-layer prompt injection filtering is a security positive.
- Bearer token auth for HTTP API, localhost-only by default.
- **Minor supply chain note:** `node-llama-cpp` auto-downloads GGUF model files from HuggingFace without pinned versions. If HuggingFace mirrors were compromised, models could be swapped. This is standard practice in the ML ecosystem but worth noting.
- Cloud embedding fallback (Jina, OpenAI) is opt-in, sends embeddings to external providers.
- SOTA models use CC-BY-NC-4.0 license -- commercial users should verify.

**Obfuscated code:** None.
**Crypto mining:** None.
**Supply chain:** Minor concern with unpinned HuggingFace model downloads, but standard for the ecosystem.

---

### 7. joeynyc/hermes-skins (76 stars, Python)

**Verdict: WARN (Incomplete Review)**

**What it is:** Custom visual themes/skins for Hermes CLI agent. YAML configuration for colors, spinners, branding, ASCII art.

**Why WARN:**
- Full README content was not successfully extracted for detailed analysis.
- From partial info: appears to be cosmetic themes with YAML configs, which is low-risk.
- No code execution patterns visible in the partial content retrieved.

**Action required:** Manual review recommended, though risk profile appears low based on the project description (visual themes only).

---

### 8. fathah/hermes-desktop (65 stars, TypeScript)

**Verdict: PASS**

**What it is:** Electron desktop app for installing, configuring, and chatting with Hermes Agent.

**Security observations:**
- Standard Electron app pattern with `npm run dev` / `npm run build`.
- Manages Hermes installation in `~/.hermes` -- scoped to user directory.
- Supports multiple AI providers (OpenRouter, Anthropic, OpenAI, local endpoints).
- macOS Gatekeeper warning documented -- standard for unsigned Electron apps.
- No suspicious download patterns or remote code execution.

**Obfuscated code:** None.
**Excessive permissions:** Standard Electron app permissions.

---

### 9. sanchomuzax/hermes-webui (57 stars, Python)

**Verdict: PASS**

**What it is:** Web dashboard for Hermes Agent. Read-only access to agent's SQLite DB and YAML configs.

**Security observations:**
- Token-based auth stored in `~/.hermes/auth.json`.
- Default binding `0.0.0.0:8643` -- exposes to network, but documented with `--localhost` flag alternative.
- Explicitly read-only against agent data files.
- Masks sensitive environment variable values in config viewer.
- Standard Python (FastAPI) + React 19 stack.
- No eval(), no remote code downloads, no suspicious patterns.

**Network exposure:** Binds to `0.0.0.0` by default, which could be a concern on untrusted networks. Mitigated by auth token requirement.

---

### 10. AlexAI-MCP/hermes-CCC (56 stars, PowerShell)

**Verdict: WARN**

**What it is:** Claude Code-based agent system with cross-platform installers.

**Security observations (PowerShell - extra scrutiny):**
- **Windows installer:** `.\install.ps1` -- PowerShell script execution. The script content is NOT visible in the README. Cannot verify what it does without inspecting the actual file.
- **Unix installer:** `curl -fsSL https://raw.githubusercontent.com/AlexAI-MCP/hermes-CCC/main/install.sh | bash` -- classic curl-pipe-bash pattern. Downloads and executes remote code without verification.
- No `Invoke-Expression`, `IEX`, `DownloadString`, or encoded command patterns visible in the README itself.
- References original Hermes at `https://github.com/NousResearch/hermes-agent`.

**Why WARN:**
- The `install.ps1` script cannot be audited from the README alone. PowerShell scripts can do anything on Windows including modifying system settings, downloading executables, and modifying registry.
- The curl-pipe-bash Unix installer is a common but risky pattern.
- These are not necessarily malicious -- many legitimate projects use this pattern -- but they require source code inspection.

**Action required:** Inspect `install.ps1` and `install.sh` directly for suspicious commands (Invoke-WebRequest to unknown domains, encoded payloads, registry modifications, scheduled tasks, etc.).

---

### 11. esaradev/icarus-plugin (51 stars, Python)

**Verdict: PASS**

**What it is:** Hermes plugin for Together AI fine-tuning integration with Fabric and Obsidian.

**Security observations:**
- Standard `git clone` + `cp` installation.
- Only external dependency is `TOGETHER_API_KEY` for Together AI's legitimate ML platform.
- File paths are user-controlled via environment variables (`FABRIC_DIR`, `OBSIDIAN_VAULT_PATH`).
- Python 3.10+ requirement, standard dependencies.
- No eval(), no base64 payloads, no auto-executing scripts.

**Obfuscated code:** None.
**Credential harvesting:** No. API key is for user's own Together AI account.

---

### 12. howdymary/hermes-agent-metaharness (46 stars, Python)

**Verdict: PASS**

**What it is:** Academic meta-optimization harness for Hermes Agent. References arxiv paper (2603.28052).

**Security observations:**
- Installation via `pip install -e ".[dev]"` from cloned repo -- standard Python development pattern.
- References `HERMES_AGENT_REPO` env var and resolves Hermes at `../hermes-agent` or `~/.hermes/hermes-agent`.
- No eval(), no base64, no curl-pipe-bash patterns.
- Academic project with published paper -- adds legitimacy.
- Conservative design: "generates deterministic wrapper candidates instead of rewriting Hermes core."
- Local endpoint reference: `http://localhost:11434/v1` (standard Ollama port).

**Obfuscated code:** None.
**Supply chain:** Clean.

---

### 13. unmodeled-tyler/vessel-browser (44 stars, Rust)

**Verdict: WARN**

**What it is:** Headless browser for AI agents with MCP integration. Available as AppImage, npm package, and Snap.

**Security observations:**
- **Curl-pipe-bash installer:** `curl -fsSL https://raw.githubusercontent.com/unmodeled-tyler/quanta-vessel-browser/main/scripts/install.sh | bash` -- downloads and executes without verification.
- The install script reportedly: clones repo to `~/.local/share/vessel-browser`, runs npm install + build, creates launcher helpers in `~/.local/bin`, generates MCP config files, creates `.desktop` entries.
- Bearer token auth for MCP server (`~/.config/vessel/mcp-auth.json`).
- Session files contain login cookies/tokens (stored with restrictive permissions).
- Agent Credential Vault uses AES-256-GCM via OS keychain.
- Connects to multiple AI providers (Anthropic, OpenAI, Ollama, etc.).
- npm package published as `@quanta-intellect/vessel-browser`.

**Why WARN:**
- Curl-pipe-bash is inherently risky -- no integrity verification.
- Creates persistent CLI tools and modifies user PATH.
- Handles sensitive credentials (browser sessions, API keys).
- The install script's scope (cloning repos, building, modifying PATH, creating desktop entries) is broad.

**Action required:** Inspect `scripts/install.sh` directly. Verify `@quanta-intellect/vessel-browser` npm package contents match the GitHub source.

---

### 14. Crustocean/reina (35 stars, Python)

**Verdict: PASS**

**What it is:** Autonomous AI bot for the Crustocean chat platform. Self-initiating behavior on randomized intervals.

**Security observations:**
- Requires Crustocean account credentials and LLM provider API key -- standard for a chatbot.
- Supports multiple providers (Nous, OpenRouter, OpenAI, custom endpoints).
- Self-perpetuating scheduler wakes on randomized intervals (10-25 min) -- this is the bot's core function, not a persistence mechanism for malware.
- "Default silence" design -- most wake cycles produce no output.
- Response sanitization strips reasoning blocks and XML markup.
- Deployable on Railway with persistent storage -- standard PaaS.

**Obfuscated code:** None.
**Suspicious network calls:** None beyond expected LLM API calls.

---

### 15. runtimenoteslabs/gladiator (29 stars, Python)

**Verdict: WARN**

**What it is:** Dashboard/adapter layer connecting Hermes Agent with a "Paperclip" system.

**Security observations:**
- **Curl-pipe-bash:** `curl -fsSL https://hermes.nousresearch.com/install.sh | bash` -- downloads from `hermes.nousresearch.com`. This domain appears to be the official NousResearch domain, which reduces risk, but pipe-to-bash remains inherently risky.
- **Hardcoded credentials:** PostgreSQL examples use username `paperclip`, password `paperclip` -- these are clearly example/dev credentials but could be copied verbatim by careless users.
- **Network binding:** Services bind to `0.0.0.0` (port 4000 for dashboard, port 3100 for Paperclip) with no authentication layer mentioned for these endpoints.
- **Subprocess execution:** Spawns Hermes CLI as subprocess (`hermes chat -q "prompt" -Q`), potential prompt injection vector if user input flows unescaped.
- **Manual node_modules patching:** Two known bugs in `hermes-paperclip-adapter@0.1.1` require hand-editing files in `node_modules/`. This is fragile and a maintenance risk.
- SQLite Evidence DB runs in WAL mode without encryption mentioned.

**Why WARN:**
- Multiple minor concerns that compound: curl-pipe-bash, hardcoded dev creds, 0.0.0.0 binding without auth, subprocess injection risk, manual dependency patching.
- None individually are malicious, but the combination suggests the project is early-stage with security gaps.

---

### 16. Abruptive/Ankh.md (25 stars, Shell)

**Verdict: PASS**

**What it is:** Framework for creating scoped Hermes Agents. Patches and deploys Hermes to `~/.agent/extensions/ankh`.

**Security observations (Shell - extra scrutiny):**
- `bun bootstrap` downloads Hermes Agent, patches it, deploys to `~/.agent/extensions/ankh` -- this is a bootstrap/installer pattern.
- PATH modification: `export PATH="$HOME/.agent/extensions/ankh/bin:$PATH"` -- standard for CLI tools.
- Management commands: `ankh setup`, `ankh uninstall`.
- **No curl-pipe-bash patterns detected.**
- **No eval, base64 decode, or inline remote code execution in README.**
- References `https://www.agent.so/` as project page.

**Shell script risk:** Moderate. The `bun bootstrap` command downloads and patches code, but this is the expected behavior for a framework installer. The README itself contains no suspicious patterns.

**Action required (low priority):** Optionally inspect the bootstrap script to verify it only fetches from expected sources (GitHub/npm).

---

## Cross-Cutting Observations

### Common Patterns (Not Concerning)
1. **API key storage in .env files** -- universal across the ecosystem, standard practice.
2. **Local server binding** -- most projects run local HTTP servers. Some bind to `0.0.0.0` which is worth noting but not malicious.
3. **ETH donation addresses** -- found in hermes-workspace. Transparent, not hidden mining.

### Patterns Requiring Attention
1. **Curl-pipe-bash installers** -- Found in hermes-CCC, vessel-browser, and gladiator. While common in the open-source world, these bypass integrity verification. Users should inspect scripts before running.
2. **PowerShell installer** (hermes-CCC) -- Cannot be audited from README alone. Requires direct file inspection.
3. **Unpinned model downloads** (ClawMem) -- HuggingFace model auto-download without version pinning is a minor supply chain concern.

### No Evidence Of
- Crypto mining scripts or hidden wallet addresses (hermes-workspace donation address is transparent)
- Credential harvesting or exfiltration to third-party servers
- Typosquatting of official package names
- Base64-encoded payloads or obfuscated code
- Hardcoded suspicious IPs or unusual domains
- Empty/placeholder name-squatting repos

---

## Recommendations

1. **Manual code review needed** for repos marked WARN, specifically:
   - `swarmclawai/swarmclaw` -- Full README not retrieved; needs manual inspection
   - `AlexAI-MCP/hermes-CCC` -- Inspect `install.ps1` and `install.sh`
   - `unmodeled-tyler/vessel-browser` -- Inspect `scripts/install.sh`
   - `runtimenoteslabs/gladiator` -- Review subprocess handling and network binding
   - `joeynyc/hermes-skins` -- Full README not retrieved; needs manual inspection

2. **For all curl-pipe-bash installers:** Consider recommending users download scripts first, inspect them, then execute -- rather than piping directly to bash.

3. **For ClawMem:** Consider pinning HuggingFace model versions/hashes to prevent supply chain attacks via model swapping.

4. **For gladiator:** Default database credentials should be randomized or clearly marked as must-change, and network services should not bind to 0.0.0.0 without authentication.
