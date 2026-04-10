#!/usr/bin/env node
/**
 * test-rag.js — Local RAG pipeline tests
 *
 * Tests query rewriting, retrieval quality, and other RAG improvements
 * without deploying. Uses the same OpenRouter calls as production.
 *
 * Usage: OPENROUTER_API_KEY=... node scripts/test-rag.js
 */

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

async function main() {
  console.log("=".repeat(60));
  console.log("RAG #1: Query Rewriting Tests");
  console.log("=".repeat(60));
  console.log();

  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    console.log(`TEST: ${test.name}`);
    console.log(`  Original: "${test.message}"`);

    const rewritten = await rewriteQuery(test.message, test.history);
    console.log(`  Rewritten: "${rewritten}"`);

    let testPassed = true;
    const checks = [];

    // Check expected keywords are present
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

    // For already-standalone questions, we just want some rewrite (could be identical)
    if (!test.expectKeywords && !test.expectRewrite) {
      checks.push(`  ✓ Returned (no specific check)`);
    }

    checks.forEach(c => console.log(c));

    if (testPassed) {
      console.log("  → PASS\n");
      passed++;
    } else {
      console.log("  → FAIL\n");
      failed++;
    }
  }

  console.log("=".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
