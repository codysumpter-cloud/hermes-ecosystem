import { kv } from "@vercel/kv";
import { readFileSync } from "fs";
import { join } from "path";

// Load chunks at module level (cached across invocations in same lambda)
let chunks = null;
function loadChunks() {
  if (chunks) return chunks;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "chunks.json"), "utf-8");
    chunks = JSON.parse(raw);
    return chunks;
  } catch (e) {
    console.error("Failed to load chunks.json:", e.message);
    return [];
  }
}

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

// Model config — supports primary + fallback via OpenRouter's native routing
// OpenRouter caps the models array at 3 total, so we pick: 1 primary free,
// 1 best free fallback, 1 ultra-cheap paid safety net.
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free";
const FALLBACK_MODELS = (process.env.OPENROUTER_FALLBACK_MODELS ||
  "nvidia/nemotron-3-super-120b-a12b:free," +
  "z-ai/glm-4.7-flash"
).split(",").map(s => s.trim()).filter(Boolean).slice(0, 2);

const MAX_TOKENS = parseInt(process.env.CHAT_MAX_TOKENS || "800");

// Per-IP rate limits
const RATE_LIMIT_HOUR = parseInt(process.env.CHAT_RATE_LIMIT || "15"); // per hour per IP
const RATE_LIMIT_DAY = parseInt(process.env.CHAT_RATE_LIMIT_DAY || "50"); // per day per IP

// Global rate limit (all users combined)
const GLOBAL_LIMIT_HOUR = parseInt(process.env.CHAT_GLOBAL_LIMIT || "300"); // per hour site-wide
const GLOBAL_LIMIT_DAY = parseInt(process.env.CHAT_GLOBAL_LIMIT_DAY || "2000"); // per day site-wide

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENROUTER_KEY) {
    return res.status(500).json({ error: "Chat not configured — missing API key" });
  }

  const { message, history = [] } = req.body || {};
  if (!message || typeof message !== "string" || message.length > 2000) {
    return res.status(400).json({ error: "Invalid message" });
  }

  // Rate limiting — per-IP (hour + day) and global (hour + day)
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  const today = new Date().toISOString().slice(0, 10);

  try {
    const limits = [
      { key: `chat:ip:hour:${ip}`, max: RATE_LIMIT_HOUR, ttl: 3600, label: "per-hour", scope: "you" },
      { key: `chat:ip:day:${ip}:${today}`, max: RATE_LIMIT_DAY, ttl: 86400, label: "per-day", scope: "you" },
      { key: `chat:global:hour`, max: GLOBAL_LIMIT_HOUR, ttl: 3600, label: "per-hour", scope: "the site" },
      { key: `chat:global:day:${today}`, max: GLOBAL_LIMIT_DAY, ttl: 86400, label: "per-day", scope: "the site" },
    ];

    for (const { key, max, ttl, label, scope } of limits) {
      const count = await kv.incr(key).catch(() => 0);
      if (count === 1) await kv.expire(key, ttl).catch(() => {});
      if (count > max) {
        return res.status(429).json({
          error: `Rate limit reached (${max} ${label} for ${scope}). Try again later.`,
        });
      }
    }
  } catch (e) {
    // KV unavailable — allow request to avoid blocking users due to infra issues
    console.error("Rate limit check failed:", e.message);
  }

  // Set streaming headers EARLY so client gets response immediately
  // This prevents Vercel from killing the connection during slow LLM responses
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  // Send immediate heartbeat (zero-width space) so connection is established
  // Client can now show "thinking" indicator
  res.write("\u200B");
  if (typeof res.flush === "function") res.flush();

  try {
    // 1. Load chunks (cached after first cold start)
    const allChunks = loadChunks();
    if (allChunks.length === 0) {
      res.write("Knowledge base not built yet. Please try again later.");
      return res.end();
    }

    // 2. Embed the query
    const queryEmbedding = await getEmbedding(message);

    // 3. Cosine similarity search — top 8 chunks for broader coverage
    const scored = allChunks
      .map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // 4. Build context: ALWAYS include baseline + retrieved chunks
    // This prevents vague queries from getting weak answers due to bad retrieval
    const baselineContext = `## CORE FACTS (always true)

Hermes Agent is an open-source autonomous AI agent developed by Nous Research, released in February 2026 under MIT license. It currently has 43,700+ stars on GitHub (v0.8.0 released April 8, 2026).

**What makes it unique:** Unlike stateless chatbots, Hermes has a built-in learning loop — it creates reusable skills from experience, remembers what it learns across sessions via persistent memory (MEMORY.md + USER.md + SQLite FTS5), and gets more capable the longer you use it. It's "the agent that grows with you."

**Core capabilities:**
- 47 built-in tools (terminal, files, browser, code execution, image gen, voice, etc.)
- 14 messaging platforms (Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Feishu, etc.)
- 20+ LLM providers (OpenRouter, Nous Portal, Anthropic, OpenAI, local via Ollama, etc.)
- 6 execution backends (local, Docker, SSH, Singularity, Modal, Daytona)
- Autonomous skill creation following agentskills.io standard
- Persistent cross-session memory with 8 pluggable memory providers

**Installation:** One-line install on Linux/macOS/WSL2:
\`curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash\`
Then run \`hermes\` to start. Only Git is required as a prerequisite — the installer handles Python, Node.js, ripgrep, and ffmpeg. Windows native not supported — use WSL2.

**Links:** https://github.com/NousResearch/hermes-agent | https://hermes-agent.nousresearch.com/docs`;

    const retrievedContext = scored
      .map(c => `[Source: ${c.source}${c.section ? `, Section: "${c.section}"` : ""}]\n${c.text}`)
      .join("\n\n---\n\n");

    // 5. Build messages for LLM
    const systemPrompt = `You are the Hermes Agent Ecosystem assistant. You help users understand the Hermes Agent ecosystem — what it is, how to use it, tools, skills, plugins, comparisons, setup guides, and more.

ANSWER RULES:
- Start with a direct, complete answer. Don't hedge with "based on the context."
- Use the CORE FACTS section as your baseline — those are always true.
- Use the RETRIEVED CONTEXT section for specific details, recent updates, and tool recommendations.
- Cite sources from RETRIEVED CONTEXT using [Source: filename.md] format in brackets.
- For "what is" questions, give a proper 2-3 sentence overview first, THEN details.
- For "how do I" questions, give concrete steps with commands.
- Use bullet points for lists of tools, skills, or steps.
- Mention star counts when comparing or recommending repos.
- If a question isn't covered by your sources, say so honestly.

${baselineContext}

## RETRIEVED CONTEXT (relevant to this specific question)

${retrievedContext}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6).map(m => ({
        role: m.role,
        content: m.content.slice(0, 1000),
      })),
      { role: "user", content: message },
    ];

    // 6. Stream from LLM
    const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hermes-ecosystem.vercel.app",
        "X-Title": "Hermes Ecosystem Chat",
      },
      body: JSON.stringify({
        // OpenRouter native fallback — pass ONLY `models` array (no `model` field)
        // It will try each in order until one succeeds
        ...(FALLBACK_MODELS.length > 0
          ? { models: [PRIMARY_MODEL, ...FALLBACK_MODELS] }
          : { model: PRIMARY_MODEL }),
        messages,
        stream: true,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      console.error("LLM error:", err);
      let userMsg = "The AI service is temporarily unavailable. Please try again in a moment.";
      try {
        const parsed = JSON.parse(err);
        if (parsed.error?.code === 429) {
          userMsg = "All available AI models are rate-limited right now. Please try again in a minute.";
        } else if (parsed.error?.message) {
          userMsg = parsed.error.message;
        }
      } catch {}
      res.write(userMsg);
      return res.end();
    }

    const reader = llmRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let totalContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);

          // Check for errors embedded in the stream
          if (parsed.error) {
            console.error("Stream error:", parsed.error);
            if (totalContent.length === 0) {
              res.write("The model returned an error. Please try asking again.");
            }
            return res.end();
          }

          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            totalContent += content;
            res.write(content);
          }
        } catch (e) {
          // Skip malformed chunks
        }
      }
    }

    // If the model returned nothing, tell the user
    if (totalContent.trim().length === 0) {
      res.write("The model returned an empty response. This sometimes happens with free models under load. Please try rephrasing or ask again.");
    }

    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    // Headers are already sent, write error inline and end
    try {
      res.write("\n\n[Error: " + (err.message || "Internal error") + "]");
      res.end();
    } catch {}
  }
}

async function getEmbedding(text) {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: [text],
    }),
  });

  if (!res.ok) throw new Error(`Embedding error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
