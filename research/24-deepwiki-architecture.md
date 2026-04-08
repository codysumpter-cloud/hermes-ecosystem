# Hermes Agent — DeepWiki Architecture Analysis

**Source:** https://deepwiki.com/NousResearch/hermes-agent  
Auto-generated codebase analysis providing code-level architecture details.

## Three-Tier Design

1. **User Interface Layer:** CLI, Gateway (messaging), ACP (editor integration), batch processing
2. **Agent Core:** Central AIAgent orchestrator — conversation loops, context compression, memory
3. **Execution Layer:** Pluggable tools and isolated backends (Local, Docker, SSH, Modal)

## Runtime Modes

| Mode | Entry Point | Use Case | State |
|------|-------------|----------|-------|
| CLI | cli.py | Interactive terminal with TUI | ~/.hermes/sessions/ |
| Gateway | gateway/run.py | Telegram, Discord, Slack | ~/.hermes/sessions/ |
| ACP | acp_adapter/ | VS Code, Zed integrations | Client-managed |
| Batch | batch_runner.py | Research/RL trajectory generation | JSONL files |

## Tool System

Decoupled discovery pattern — implementations register at import time:
- **Discovery:** model_tools.py dynamically loads from tools/
- **Definition:** Schemas filtered by enabled/disabled toolsets
- **Execution:** handle_function_call() translates LLM JSON → Python handlers

## Conversation Loop (AIAgent.run_conversation())

1. Build system prompt (SOUL.md + memory + context files + skills)
2. Call LLM with messages and tool schemas
3. Parse tool calls from response
4. Execute tools via handle_function_call()
5. Append results to history
6. Repeat until iteration budget exhausted or task complete
7. Auto-compress when context limits approach

## Configuration Hierarchy

```
CLI arguments → Environment variables → config.yaml → .env → Built-in defaults
```

## Authentication

- OAuth Device Code: Nous Portal (with refresh tokens)
- OAuth External: GitHub Copilot via codex CLI
- API Keys: OpenRouter, Anthropic, Z.AI, DeepSeek, Kimi, etc.
- External Process: Local endpoints
- Credential pooling: Key rotation and failover across multiple credentials

## Key File Sizes (from architecture doc)

- run_agent.py: ~9,200 lines (core conversation loop)
- cli.py: ~8,500 lines (interactive terminal UI)
- gateway/run.py: ~7,500 lines (message dispatch)
- hermes_cli/main.py: ~5,500 lines (CLI entry point)
- hermes_cli/setup.py: ~3,100 lines (interactive wizard)
- tools/mcp_tool.py: ~2,200 lines (MCP client)
