import { kv } from "@vercel/kv";
import repos from "../data/repos.json" assert { type: "json" };

const CACHE_KEY = "stars:current";
const CACHE_TTL = 3600; // 1 hour

export default async function handler(req, res) {
  try {
    // Check cache first
    const cached = await kv.get(CACHE_KEY).catch(() => null);
    if (cached && !req.query.cron) {
      return res.status(200).json(cached);
    }

    // Build GitHub GraphQL query batching all repos
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      // No token — return static data from repos.json
      const fallback = buildResponse(repos.map(r => ({
        owner: r.owner,
        repo: r.repo,
        stars: r.stars,
        updatedAt: null
      })));
      return res.status(200).json(fallback);
    }

    // Batch all repos into one GraphQL query
    const repoQueries = repos.map((r, i) =>
      `repo${i}: repository(owner: "${r.owner}", name: "${r.repo}") {
        stargazerCount
        updatedAt
        pushedAt
      }`
    ).join("\n");

    const query = `query { ${repoQueries} }`;

    const ghRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "hermes-ecosystem"
      },
      body: JSON.stringify({ query })
    });

    if (!ghRes.ok) {
      throw new Error(`GitHub API error: ${ghRes.status}`);
    }

    const ghData = await ghRes.json();

    if (ghData.errors) {
      console.error("GraphQL errors:", ghData.errors);
    }

    // Map results back to repos
    const starData = repos.map((r, i) => {
      const node = ghData.data?.[`repo${i}`];
      return {
        owner: r.owner,
        repo: r.repo,
        stars: node?.stargazerCount ?? r.stars,
        updatedAt: node?.pushedAt ?? node?.updatedAt ?? null
      };
    });

    const response = buildResponse(starData);

    // Cache the result
    await kv.set(CACHE_KEY, response, { ex: CACHE_TTL }).catch(console.error);

    // Save daily snapshot for history
    const today = new Date().toISOString().slice(0, 10);
    const historyKey = `stars:history:${today}`;
    const snapshot = Object.fromEntries(
      starData.map(r => [`${r.owner}/${r.repo}`, r.stars])
    );
    await kv.set(historyKey, snapshot).catch(console.error);

    return res.status(200).json(response);
  } catch (err) {
    console.error("Stars API error:", err);
    // Fallback to static data
    const fallback = buildResponse(repos.map(r => ({
      owner: r.owner,
      repo: r.repo,
      stars: r.stars,
      updatedAt: null
    })));
    return res.status(200).json({ ...fallback, error: err.message });
  }
}

function buildResponse(starData) {
  const totalStars = starData.reduce((sum, r) => sum + r.stars, 0);

  // Build a lookup map
  const repoMap = {};
  starData.forEach(r => {
    repoMap[`${r.owner}/${r.repo}`] = {
      stars: r.stars,
      updatedAt: r.updatedAt
    };
  });

  return {
    repos: repoMap,
    totals: {
      stars: totalStars,
      count: starData.length,
      updated: new Date().toISOString()
    }
  };
}
