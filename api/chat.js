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
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free";
const FALLBACK_MODELS = (process.env.OPENROUTER_FALLBACK_MODELS || "google/gemma-4-26b-a4b-it:free,meta-llama/llama-3.3-70b-instruct:free")
  .split(",").map(s => s.trim()).filter(Boolean);

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

  try {
    // 1. Load chunks
    const allChunks = loadChunks();
    if (allChunks.length === 0) {
      return res.status(500).json({ error: "Knowledge base not built yet" });
    }

    // 2. Embed the query
    const queryEmbedding = await getEmbedding(message);

    // 3. Cosine similarity search
    const scored = allChunks
      .map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // 4. Build context from top chunks
    const context = scored
      .map(c => `[Source: ${c.source}${c.section ? `, Section: "${c.section}"` : ""}]\n${c.text}`)
      .join("\n\n---\n\n");

    // 5. Build messages for LLM
    const systemPrompt = `You are the Hermes Agent Ecosystem assistant. You help users understand the Hermes Agent ecosystem — tools, skills, plugins, comparisons, setup guides, and more.

RULES:
- Answer ONLY from the provided context. If the context doesn't cover the question, say so honestly.
- Cite your sources using [Source: filename.md] format.
- Be concise and direct. Use bullet points for lists.
- When comparing tools or recommending repos, mention star counts if available.
- If asked about setup or installation, reference the specific guide from the research.

CONTEXT:
${context}`;

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
        model: PRIMARY_MODEL,
        // OpenRouter native fallback — tries these in order if primary fails
        models: FALLBACK_MODELS.length > 0 ? [PRIMARY_MODEL, ...FALLBACK_MODELS] : undefined,
        route: "fallback",
        messages,
        stream: true,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      console.error("LLM error:", err);
      return res.status(502).json({ error: "LLM request failed" });
    }

    // Stream SSE to client
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    const reader = llmRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(content);
          }
        } catch (e) {
          // Skip malformed chunks
        }
      }
    }

    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal error" });
    }
    res.end();
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
