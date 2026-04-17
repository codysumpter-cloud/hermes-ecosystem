/**
 * Shared OpenRouter LLM call helper with model fallback chain.
 */

const PRIMARY_MODEL = "google/gemma-4-31b-it:free";
const FALLBACK_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemini-3-flash-preview",
];

/**
 * Call OpenRouter with automatic model fallback.
 *
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User prompt
 * @param {string} options.apiKey - OpenRouter API key
 * @param {string[]} [options.models] - Model fallback chain (max 3)
 * @param {number} [options.maxTokens=800] - Max output tokens
 * @returns {Promise<string>} Raw response text
 */
export async function callOpenRouter({
  system,
  user,
  apiKey,
  models,
  maxTokens = 800,
}) {
  if (!apiKey) throw new Error("OpenRouter API key required");

  const modelChain = models || [PRIMARY_MODEL, ...FALLBACK_MODELS];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://hermesatlas.com",
      "X-Title": "Hermes Atlas",
    },
    body: JSON.stringify({
      models: modelChain.slice(0, 3),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
      route: "fallback",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter");

  return content;
}

/**
 * Call OpenRouter and parse the response as JSON.
 * Strips markdown code fences if present.
 *
 * @param {Object} options - Same as callOpenRouter
 * @returns {Promise<Object>} Parsed JSON object
 */
export async function callOpenRouterJSON(options) {
  const raw = await callOpenRouter(options);

  // Strip markdown fences if the model wraps output in ```json ... ```
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from OpenRouter response: ${e.message}\nRaw: ${raw.slice(0, 300)}`
    );
  }
}
