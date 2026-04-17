import { kvGet, kvSet } from "../lib/redis.js";
import { readFileSync } from "fs";
import { join } from "path";

const CACHE_KEY = "stars:current";
const CACHE_TTL = 3600; // 1 hour

// Load repos at module level (cached across invocations in same lambda)
let repos = null;
function loadRepos() {
  if (repos) return repos;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "repos.json"), "utf-8");
    repos = JSON.parse(raw);
    return repos;
  } catch (e) {
    console.error("Failed to load repos.json:", e.message);
    return [];
  }
}

export default async function handler(req, res) {
  try {
    const repoList = loadRepos();
    if (repoList.length === 0) {
      return res.status(500).json({ error: "Repo list unavailable" });
    }

    // Check cache first
    const cached = await kvGet(CACHE_KEY);
    if (cached && !req.query.cron) {
      return res.status(200).json(cached);
    }

    // Build GitHub GraphQL query batching all repos
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      // No token — return static data from repos.json
      const fallback = buildResponse(repoList.map(r => ({
        owner: r.owner,
        repo: r.repo,
        stars: r.stars,
        updatedAt: null
      })));
      return res.status(200).json(fallback);
    }

    // Batch all repos into one GraphQL query.
    // For NousResearch/hermes-agent, also pull latestRelease so the site can
    // render live Hermes version in the masthead without staleness.
    const repoQueries = repoList.map((r, i) => {
      const releaseField = (r.owner === "NousResearch" && r.repo === "hermes-agent")
        ? "latestRelease { tagName publishedAt }"
        : "";
      return `repo${i}: repository(owner: "${r.owner}", name: "${r.repo}") {
        stargazerCount
        updatedAt
        pushedAt
        ${releaseField}
      }`;
    }).join("\n");

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
    let hermesRelease = null;
    const starData = repoList.map((r, i) => {
      const node = ghData.data?.[`repo${i}`];
      if (r.owner === "NousResearch" && r.repo === "hermes-agent" && node?.latestRelease) {
        hermesRelease = {
          version: node.latestRelease.tagName,
          publishedAt: node.latestRelease.publishedAt
        };
      }
      return {
        owner: r.owner,
        repo: r.repo,
        stars: node?.stargazerCount ?? r.stars,
        updatedAt: node?.pushedAt ?? node?.updatedAt ?? null
      };
    });

    const response = buildResponse(starData, hermesRelease);

    // Cache the result
    await kvSet(CACHE_KEY, response, { ex: CACHE_TTL });

    // Save daily snapshot for history
    const today = new Date().toISOString().slice(0, 10);
    const historyKey = `stars:history:${today}`;
    const snapshot = Object.fromEntries(
      starData.map(r => [`${r.owner}/${r.repo}`, r.stars])
    );
    await kvSet(historyKey, snapshot);

    return res.status(200).json(response);
  } catch (err) {
    console.error("Stars API error:", err);
    // Fallback to static data
    const repoList = loadRepos();
    const fallback = buildResponse(repoList.map(r => ({
      owner: r.owner,
      repo: r.repo,
      stars: r.stars,
      updatedAt: null
    })));
    return res.status(200).json({ ...fallback, error: err.message });
  }
}

function buildResponse(starData, hermesRelease = null) {
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
    },
    hermes: hermesRelease
  };
}
