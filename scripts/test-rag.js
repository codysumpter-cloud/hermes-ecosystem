#!/usr/bin/env node
/**
 * test-rag.js — Local RAG pipeline tests
 *
 * Tests query rewriting, retrieval quality, and other RAG improvements
 * without deploying. Uses the same OpenRouter calls as production.
 *
 * Usage: OPENROUTER_API_KEY=... node scripts/test-rag.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_KEY) {
  console.error("Error: OPENROUTER_API_KEY required");
  process.exit(1);
}

// Copy of rewriteQuery from api/chat.js for isolated testing
async function rewriteQuery(message, history) {
  try {
    const historyText = history
      .slice(-4)
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 300)}`)
      .join("\n");

    const rewritePrompt = `Your job: rewrite follow-up questions into complete, standalone questions by resolving pronouns and adding implicit context from the conversation.

Rules:
- If the message uses pronouns like "it", "they", "this", "that" — replace them with the specific thing from the conversation.
- If the message is a fragment like "and for Telegram?" or "what about X?" — expand it into a full question.
- If the message is ALREADY a complete standalone question, return it EXACTLY as-is.
- Output ONLY the rewritten question. No preamble, no quotes, no explanation.
- Always prefer mentioning "Hermes Agent" explicitly if the question is about Hermes.

Examples:

History:
User: What is Hermes Agent?
Assistant: Hermes Agent is an open-source AI agent by Nous Research.
Latest: how do I install it?
Rewritten: How do I install Hermes Agent?

History:
User: Tell me about Hermes skills
Assistant: Skills are on-demand knowledge documents.
Latest: how do I create one?
Rewritten: How do I create a Hermes skill?

History:
User: What tools come with Hermes?
Assistant: Hermes has 47 built-in tools including terminal, browser, files, etc.
Latest: what are they?
Rewritten: What are the built-in tools in Hermes Agent?

History:
User: How do I set up the Discord integration in Hermes?
Assistant: Run hermes gateway setup and select Discord.
Latest: and for Telegram?
Rewritten: How do I set up the Telegram integration in Hermes?

History:
User: What memory providers does Hermes support?
Assistant: Hermes supports 8 providers including Honcho, Mem0, Supermemory, Hindsight.
Latest: which one is best?
Rewritten: Which memory provider is best for Hermes Agent?

History:
User: Hi
Assistant: Hello! How can I help?
Latest: What's the difference between Hermes Agent and OpenClaw?
Rewritten: What's the difference between Hermes Agent and OpenClaw?

Now rewrite this:

History:
${historyText}
Latest: ${message}
Rewritten:`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: [
          "google/gemini-3.1-flash-lite-preview",
          "qwen/qwen3.5-flash-02-23",
          "mistralai/mistral-small-2603",
        ],
        messages: [{ role: "user", content: rewritePrompt }],
        max_tokens: 100,
        temperature: 0,
        stop: ["\n\n", "History:", "Latest:"],
      }),
    });

    if (!res.ok) {
      console.warn("  [rewrite] API failed, using original");
      return message;
    }

    const data = await res.json();
    let rewritten = data.choices?.[0]?.message?.content?.trim();

    if (!rewritten || rewritten.length < 5 || rewritten.length > message.length * 10) {
      return message;
    }

    rewritten = rewritten.replace(/^["'`]+|["'`]+$/g, "").trim();
    rewritten = rewritten.replace(/^Rewritten:\s*/i, "").trim();
    rewritten = rewritten.split("\n")[0].trim();

    return rewritten || message;
  } catch (err) {
    console.warn("  [rewrite] Error:", err.message);
    return message;
  }
}

// Test cases
const TESTS = [
  {
    name: "Empty history — pass-through",
    message: "What is Hermes Agent?",
    history: [],
    expectRewrite: false, // Should NOT go through rewriter at all in prod, but our test calls it directly
  },
  {
    name: "Pronoun resolution (it)",
    message: "how do I install it?",
    history: [
      { role: "user", content: "What is Hermes Agent?" },
      { role: "assistant", content: "Hermes Agent is an open-source autonomous AI agent by Nous Research with persistent memory and self-improving skills." },
    ],
    expectKeywords: ["hermes", "install"],
  },
  {
    name: "Pronoun resolution (them)",
    message: "how do I install them?",
    history: [
      { role: "user", content: "What skills are available for Hermes?" },
      { role: "assistant", content: "Hermes has many community skills including drawio-skill, chainlink-agent-skills, litprog-skill, and more." },
    ],
    expectKeywords: ["skill", "install"],
  },
  {
    name: "Incomplete follow-up",
    message: "and for Telegram?",
    history: [
      { role: "user", content: "How do I set up the Discord integration?" },
      { role: "assistant", content: "Run `hermes gateway setup` and select Discord from the menu." },
    ],
    expectKeywords: ["telegram"],
  },
  {
    name: "Already standalone question",
    message: "What's the difference between Hermes Agent and OpenClaw?",
    history: [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello! How can I help you?" },
    ],
    expectKeywords: ["hermes", "openclaw"],
  },
  {
    name: "Topic switch",
    message: "What memory providers are supported?",
    history: [
      { role: "user", content: "How do I install Hermes?" },
      { role: "assistant", content: "Run the install script: curl -fsSL ... | bash" },
    ],
    expectKeywords: ["memory"],
  },
];

// ── BM25 implementation (mirror of api/chat.js) ──
const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","he","in","is","it",
  "its","of","on","that","the","to","was","were","will","with","you","your","i","me","my",
  "we","us","our","they","them","their","this","these","those","or","but","if","so","do",
  "does","did","can","how","what","when","where","why","which","who","whom","which"
]);

function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9_-]+/).filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

function buildBM25Index(chunks) {
  const N = chunks.length;
  const docFreq = new Map();
  const docs = [];
  let totalLen = 0;
  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    docs.push({ tf, len: tokens.length });
    totalLen += tokens.length;
    for (const t of tf.keys()) docFreq.set(t, (docFreq.get(t) || 0) + 1);
  }
  const avgdl = totalLen / N;
  const idf = new Map();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }
  return { docs, idf, avgdl, k1: 1.5, b: 0.75 };
}

function bm25Score(query, index) {
  const queryTokens = tokenize(query);
  const scores = new Array(index.docs.length).fill(0);
  for (const term of queryTokens) {
    const termIdf = index.idf.get(term);
    if (!termIdf) continue;
    for (let i = 0; i < index.docs.length; i++) {
      const doc = index.docs[i];
      const tf = doc.tf.get(term) || 0;
      if (tf === 0) continue;
      const norm = tf * (index.k1 + 1);
      const denom = tf + index.k1 * (1 - index.b + index.b * (doc.len / index.avgdl));
      scores[i] += termIdf * (norm / denom);
    }
  }
  return scores;
}

function normalizeScores(scores) {
  let max = 0;
  for (const s of scores) if (s > max) max = s;
  if (max === 0) return scores;
  return scores.map(s => s / max);
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

async function getEmbedding(text) {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/text-embedding-3-small", input: [text] }),
  });
  if (!res.ok) throw new Error(`Embedding error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// Hybrid retrieval — combines BM25 and cosine
function hybridRetrieve(query, queryEmbedding, chunks, bm25Index, topK = 8) {
  const cosineScores = chunks.map(c => cosineSimilarity(queryEmbedding, c.embedding));
  const bm25Scores = bm25Score(query, bm25Index);
  const normCosine = normalizeScores(cosineScores);
  const normBM25 = normalizeScores(bm25Scores);

  return chunks
    .map((chunk, i) => ({
      ...chunk,
      score: 0.7 * normCosine[i] + 0.3 * normBM25[i],
      _cosine: cosineScores[i],
      _bm25: bm25Scores[i],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Pure cosine retrieval (baseline for comparison)
function cosineOnlyRetrieve(queryEmbedding, chunks, topK = 8) {
  return chunks
    .map(c => ({ ...c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function runRetrievalTests() {
  console.log("=".repeat(60));
  console.log("RAG #2: Hybrid Search Tests");
  console.log("=".repeat(60));
  console.log();

  const chunksPath = path.join(ROOT, "data", "chunks.json");
  if (!fs.existsSync(chunksPath)) {
    console.error("chunks.json not found — run build-chunks.js first");
    return { passed: 0, failed: 1 };
  }

  console.log("Loading chunks...");
  const chunks = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
  console.log(`  Loaded ${chunks.length} chunks`);

  console.log("Building BM25 index...");
  const bm25Index = buildBM25Index(chunks);
  console.log(`  Vocabulary size: ${bm25Index.idf.size} terms`);
  console.log();

  // Test queries: the expectSubstring should appear in at least one of the top 3 chunks
  const RETRIEVAL_TESTS = [
    {
      name: "CLI command exact match",
      query: "hermes skills browse",
      expectSubstringInTop3: "skills browse",
    },
    {
      name: "Version number query",
      query: "what's new in v0.8.0",
      expectSubstringInTop3: "v0.8.0",
    },
    {
      name: "Specific repo name",
      query: "hermes-workspace features",
      expectSubstringInTop3: "hermes-workspace",
    },
    {
      name: "Technical keyword (MCP)",
      query: "how does MCP work in Hermes",
      expectSubstringInTop3: "MCP",
    },
    {
      name: "Semantic question",
      query: "how does the agent remember things across sessions",
      expectSubstringInTop3: "memory",
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of RETRIEVAL_TESTS) {
    console.log(`TEST: ${test.name}`);
    console.log(`  Query: "${test.query}"`);

    const queryEmbedding = await getEmbedding(test.query);

    // Baseline: cosine only
    const cosineResults = cosineOnlyRetrieve(queryEmbedding, chunks, 3);
    // Hybrid: cosine + BM25
    const hybridResults = hybridRetrieve(test.query, queryEmbedding, chunks, bm25Index, 3);

    const cosineMatch = cosineResults.some(c => c.text.toLowerCase().includes(test.expectSubstringInTop3.toLowerCase()));
    const hybridMatch = hybridResults.some(c => c.text.toLowerCase().includes(test.expectSubstringInTop3.toLowerCase()));

    console.log(`  Cosine top source:  ${cosineResults[0]?.source || "none"}`);
    console.log(`  Hybrid top source:  ${hybridResults[0]?.source || "none"}`);
    console.log(`  Cosine found "${test.expectSubstringInTop3}": ${cosineMatch ? "yes" : "no"}`);
    console.log(`  Hybrid found "${test.expectSubstringInTop3}": ${hybridMatch ? "yes" : "no"}`);

    if (hybridMatch) {
      console.log("  → PASS\n");
      passed++;
    } else {
      console.log("  → FAIL\n");
      failed++;
    }
  }

  console.log(`Retrieval tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

async function main() {
  console.log("=".repeat(60));
  console.log("RAG #1: Query Rewriting Tests");
  console.log("=".repeat(60));
  console.log();

  let totalPassed = 0;
  let totalFailed = 0;

  for (const test of TESTS) {
    console.log(`TEST: ${test.name}`);
    console.log(`  Original: "${test.message}"`);

    const rewritten = await rewriteQuery(test.message, test.history);
    console.log(`  Rewritten: "${rewritten}"`);

    let testPassed = true;
    const checks = [];

    if (test.expectKeywords) {
      const lower = rewritten.toLowerCase();
      for (const kw of test.expectKeywords) {
        if (!lower.includes(kw.toLowerCase())) {
          checks.push(`  ❌ Missing keyword: "${kw}"`);
          testPassed = false;
        } else {
          checks.push(`  ✓ Contains "${kw}"`);
        }
      }
    }

    if (!test.expectKeywords && !test.expectRewrite) {
      checks.push(`  ✓ Returned (no specific check)`);
    }

    checks.forEach(c => console.log(c));

    if (testPassed) {
      console.log("  → PASS\n");
      totalPassed++;
    } else {
      console.log("  → FAIL\n");
      totalFailed++;
    }
  }

  console.log();

  // Run retrieval tests
  const retrievalResults = await runRetrievalTests();
  totalPassed += retrievalResults.passed;
  totalFailed += retrievalResults.failed;

  console.log();
  console.log("=".repeat(60));
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
  console.log("=".repeat(60));

  if (totalFailed > 0) process.exit(1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
