# Hermes Agent — Competitive Comparisons

## Sources

- The New Stack: https://thenewstack.io/persistent-ai-agents-compared/
- Turing Post: https://turingpost.substack.com/p/ai-101-hermes-agent-openclaws-rival
- Trilogy AI (Technical Deep Dive): https://trilogyai.substack.com/p/technical-deep-dive-hermes-vs-openclaw
- Medium (Daniel.O.Ayo): https://medium.com/@Daniel.O.Ayo/claude-vs-hermes-vs-openclaw-which-ai-agent-is-actually-worth-paying-for-in-2026-81ad77de8225
- Lushbinary: https://lushbinary.com/blog/hermes-vs-openclaw-key-differences-comparison/
- Userorbit: https://userorbit.com/blog/hermes-agent-vs-openclaw
- popularaitools.ai: https://popularaitools.ai/blog/hermes-agent-vs-openclaw
- getopenclaw.ai: https://www.getopenclaw.ai/blog/openclaw-vs-hermes-agent

## Three-Way Positioning (Claude Code vs OpenClaw vs Hermes)

| Dimension | Claude Code | OpenClaw | Hermes Agent |
|-----------|-------------|----------|-------------|
| **Core identity** | Pair-programmer at the desk | Full operations platform for teams | Personal assistant that lives on your server and learns |
| **Architecture** | IDE-integrated | Gateway control plane (Node.js) | AIAgent runtime loop (Python) |
| **Memory** | Auto-memory notes to disk | File-based Markdown, unbounded | Bounded char limits (2,200 + 1,375), FTS5 search |
| **Skills** | Static, human-authored | Static, human-authored (ClawHub marketplace) | Autonomously created by the agent, refined over time |
| **Channels** | IDE only | 22+ including iMessage, IRC, LINE, Nostr | 14 with strong enterprise Asian support (DingTalk, WeCom, Feishu) |
| **Language** | TypeScript | TypeScript/Node.js | Python 3.11 |
| **Stars** | N/A (Anthropic product) | 345,000+ | 36,400+ |
| **License** | Proprietary | MIT | MIT |

## Hermes vs OpenClaw: Key Architectural Differences

### Design Philosophy
- **OpenClaw:** Gateway-first. Central coordinator for routing, permissions, channels, skill dispatch. Emphasizes breadth of integration.
- **Hermes:** Runtime-first. The AIAgent loop is the core. Emphasizes depth of learning. "Do, learn, improve" cycle.

### Memory Philosophy
- **OpenClaw:** Unbounded, human-editable Markdown. Three backend options. Prioritizes auditability.
- **Hermes:** Bounded character limits enforce deliberate curation. Agent must consolidate when full. "Constraints as features."

### Skills Philosophy
- **OpenClaw:** Skills are static files you write and maintain. ClawHub marketplace hosts 5,700+ community skills.
- **Hermes:** Skills are created autonomously by the agent, refined during use, compounded across sessions. Follows agentskills.io standard.

### Execution
- **OpenClaw:** Per-command approval policies. Fine-grained control.
- **Hermes:** Serverless backends (Daytona, Modal) where heavy compute spins up on demand. Six backends total.

### Security Context
- **OpenClaw:** Snyk found 1,467 malicious skills in ClawHub. 40,000+ self-hosted instances with insecure defaults.
- **Hermes:** Safer defaults with prompt injection scanning. Security scanning on all hub skills. Seven-layer defense-in-depth.

### Multi-Agent
- **OpenClaw:** Routes named agents across channels.
- **Hermes:** Isolated Profiles (each profile = independent agent instance).

### Interoperability
Both adopted identical SKILL.md format and support Open Gateway Protocol (OGP) federation. An OpenClaw agent and Hermes agent can exchange cryptographically-verified messages across framework boundaries.

## When to Choose Each

**Choose Hermes when:**
- You want autonomous skill growth loops
- You need built-in user modeling
- You want serverless execution (Modal, Daytona)
- You're doing research/RL workflows
- You prefer Python-native tooling
- You want safer defaults out of the box

**Choose OpenClaw when:**
- You need multi-agent orchestration with isolated workspaces
- You want fine-grained per-command execution control
- You need macOS integration (iMessage)
- You prefer TypeScript-native deployments
- You need the largest community skill marketplace

**Choose Claude Code when:**
- You're doing focused coding sessions in an IDE
- You want Anthropic's first-party integration

**Community consensus:** They're complementary, not competitive. Use Claude Code for coding, Hermes for learning/automation, OpenClaw for team operations.

## OpenClaw Ban Context (April 3, 2026)

Anthropic blocked OpenClaw from accessing Claude Code subscriptions. Hacker News thread: 1,064 points, 811 comments, #1 story in tech that week. This event drove additional interest in Hermes as an alternative, though community consensus is the tools serve different purposes.
