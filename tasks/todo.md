# Hermes Atlas v2 — Execution Plan

**Status:** draft · pending review
**Design source of truth:** `C:\Users\kevin\hermes-drafts\DESIGN.md` (Mock A — Industrial Brutalist)
**Locked direction:** 2026-04-17
**Scope:** redesign + maintainability refactor + Reports sub-page + Featured Projects + accessibility
**Out of scope:** Sentiment page (deferred), Security hardening (post-v2), Self-maintaining Hermes skill (post-v2), May 2026 State of Hermes report (parallel drafts track)

---

## Guiding constraints

- **Keep URLs stable.** `/projects/{owner}/{repo}`, `/lists/{slug}`, `/reports/state-of-hermes-april-2026` — no URL changes. Preserves SEO, backlinks, sitemap.
- **Work on a branch, land in one PR.** Branch `v2-redesign`. Rollback = revert the PR.
- **Sequential testing per feature.** Local → push → verify on Vercel → move on. No bundled pushes.
- **Preserve pSEO pipeline.** `generate-summaries.js` writes `summaries.json`; that's data, not HTML. Only `build-pages.js` (renderer) changes.
- **Don't break chunks.** The RAG chatbot reads `data/chunks.json` built from `research/`. HTML restructure shouldn't touch chunks unless we add `index.html` / page content to the knowledge base.

---

## Phase 0 · Bug fixes (independent, land immediately)

Small, self-contained fixes that don't wait for v2. Each ships as its own commit on `main`.

- [ ] **M1 — Fix duplicate repo in `index.html`**
  - `portable-hermes-agent` (line 937) and `portable-hermes` (line 970) both link to `/projects/rookiemann/portable-hermes-agent`.
  - Decision: keep the line 937 version (accurate name), delete line 970. Verify `data/repos.json` has no duplicate entry.
- [ ] **M2 — Refresh stale copy across `index.html` meta tags**
  - Lines 7, 10, 19, 780 say "80+ projects". Current count is 94.
  - Change "80+ quality-filtered" → "94 quality-filtered" (keep dynamic pinned to actual count if possible; otherwise update on every build).
  - Check Hermes version string "Hermes v0.9.0" — verify current release.
- [ ] **M5 — Delete stale `ecosystem-map.html`**
  - 77KB dead file at repo root from pre-v1 iteration.
  - Add `301` in `vercel.json` from `/ecosystem-map.html` → `/` to cover any inbound links.
  - Delete the file.
- [ ] Run a sitemap regen after M1–M5 land to make sure nothing references the dead page.

---

## Phase 1 · CSS componentization (foundation)

Before any visual change lands, we break the monolith. Every shared style moves to `/assets/css/`; every page `<style>` block goes away. Zero visual regression is the goal for this phase — same look, better structure.

- [ ] **Create `/assets/css/` directory structure**
  - `tokens.css` — all `--*` custom properties (v1 tokens initially, swap to v2 in Phase 2)
  - `base.css` — reset, body, html, `*, *::before, *::after`, theme init complement
  - `type.css` — font imports, type scale classes
  - `layout.css` — grid, container, section utilities
  - `masthead.css` — header, nav, brand mark
  - `hero.css` — hero box, stats bar
  - `category.css` — category block, cat-label, cat-count
  - `repo-row.css` — chip/row styles
  - `tooltip.css` — tooltip positioning + styling
  - `chat.css` — chat widget
  - `theme-toggle.css` — toggle button
  - `footer.css`
- [ ] **Extract `index.html` styles** into the files above. Verify `index.html` renders identically with only `<link>` tags.
- [ ] **Update `scripts/build-pages.js`** to emit `<link rel="stylesheet" href="/assets/css/page.css">` instead of inline `<style>` blocks for project and list pages.
- [ ] **Create `assets/css/page.css`** — imports all the shared sheets needed by project + list pages (base, type, masthead, chat shared styles, + project-specific or list-specific sheet).
- [ ] **Regenerate all 93 project pages + 6 list pages** via `build-pages.js`. Verify identical rendering on 3 sample pages.
- [ ] **Regression test:** diff visual output of 5 sample pages (index, 1 project page, 1 list page, report, 404 if exists) pre/post Phase 1. Any pixel-level regression = fix before moving on.

---

## Phase 2 · v2 redesign to Mock A

Apply `DESIGN.md` tokens and patterns across all pages. This is the visible transformation.

- [ ] **Replace `tokens.css`** with v2 palette, fonts, type scale from `DESIGN.md §3, §2`.
- [ ] **Add Google Fonts preconnect + CSS** for Space Grotesk + JetBrains Mono. Remove Inter.
- [ ] **Rebuild `index.html`**
  - New masthead (brand wordmark + live meta strip + nav)
  - New hero strip (asymmetric 1.4fr 1fr)
  - New stats row (5-column with 1px internal gaps)
  - New featured block (for hero repo)
  - Category sections: replace 4-column symmetric grid with vertical category blocks using `grid-template-columns: 220px 1fr`
  - Repo chips → repo rows with hover padding shift
  - Kill: sun/moon toggle → text toggle, emoji brand → lowercase wordmark, purple gradients, pill badges, Title Case labels, `🔥` flame, flame-flicker animation
  - Add: grain overlay, `font-variant-numeric: tabular-nums`, `text-wrap: balance` on headlines
- [ ] **Rebuild project page template** (`build-pages.js` → project page generator)
  - New masthead
  - Brutalist nav/breadcrumb
  - Hero section: repo name in display, org italic muted, stars + delta in mono, official flag inline
  - Summary section (LLM-generated) styled to Mock A
  - Collapsed README with brutalist `<details>` styling
  - Related repos as text rows, not chips
- [ ] **Rebuild list page template**
  - Display serif intro
  - Table with hard rules, mono stars, no zebra striping
  - Listicle section below table: each entry as a brutalist row
- [ ] **Reskin report page** `reports/state-of-hermes-april-2026.html` to v2 system.
- [ ] **404 page** — create `404.html` with Mock A styling. Link back to `/`.
- [ ] **Favicon** — replace emoji SVG with amber square + `H` SVG.

---

## Phase 3 · New pages / information architecture

Add Reports sub-page and Featured Projects mechanic.

### Reports sub-page

- [ ] **`/reports/` index page**
  - List all reports, most recent first
  - Each entry: title, date, 1-line summary, read-time estimate
  - Seed with `state-of-hermes-april-2026` (rename URL to `/reports/state-of-hermes-april-2026` if not already that path — confirm current path)
- [ ] **Update top nav** to include `reports` link.
- [ ] **Update masthead** on report detail pages with breadcrumb: `reports / state of hermes — april 2026`.
- [ ] **Sitemap regen** to include `/reports/`.

### Featured Projects

- [ ] **`data/featured.json`** — weekly-rotating list of 2–3 project slugs + rotation metadata (week starting date).
- [ ] **Homepage featured module** — between hero strip and stats row. 2–3 repos shown with larger treatment (bigger repo name, short editorial blurb).
- [ ] **`/featured/` archive page** — list all historical featured picks. Link from homepage footer.
- [ ] **Rotation script** — `scripts/rotate-featured.js` that picks the next batch (can be manual curation or an automated ranking — start manual).
- [ ] **Update nav** to include `featured` link.

---

## Phase 4 · Accessibility pass

After v2 redesign lands visually, systematic a11y sweep. `DESIGN.md §11` is the target.

- [ ] **Skip-to-content link** on every page template (index, project, list, report, featured, reports-index, 404).
- [ ] **Semantic landmarks** audit: `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>` wherever appropriate.
- [ ] **Focus rings** visible on every interactive element (links, buttons, inputs, toggles). 2px amber, 2px offset.
- [ ] **Text theme toggle** (`[light/dark]` mono) replaces sun/moon.
- [ ] **Alt text audit** on every `<img>` across all pages. Decorative images → empty alt + `aria-hidden`.
- [ ] **`aria-label`** on icon-only buttons (close, clear, any remaining icons).
- [ ] **Form labels** on chat input, search input.
- [ ] **Heading hierarchy** check: single `<h1>` per page, no skipping levels.
- [ ] **Keyboard nav sweep**: tab through every page template, verify logical order and no focus traps.
- [ ] **Contrast verification** via automated tool (e.g., axe DevTools) on 3 sample pages per theme.
- [ ] **`prefers-reduced-motion`** media query honored (already specified in DESIGN.md §7).
- [ ] **Screen reader smoke test** on home → project page → list page flow.

---

## Phase 5 · Review & ship

- [ ] **Local dogfood** — use the full site in a headless browser via `/browse`. Check: hero, category navigation, search, sort, chat, theme toggle, project page flow, list page, report page, reports index, featured module, 404, mobile viewport.
- [ ] **`/review` skill** on the v2 diff before PR.
- [ ] **`/codex` challenge mode** — adversarial second opinion on the v2 PR.
- [ ] **`/design-review` skill** for a final visual QA on deployed preview.
- [ ] **`/qa` skill** for functional regressions.
- [ ] **Deploy preview** on Vercel (branch deploy).
- [ ] **Smoke test deploy preview** — star counts load, chat answers, theme persists, all URLs 200.
- [ ] **Merge PR** after final review.
- [ ] **Post-ship canary** — `/canary` skill for 24h to watch for regressions.
- [ ] **Update memory** with v2 state snapshot in `project_hermes.md`.

---

## Dependencies & risk

| Concern | Risk | Mitigation |
|---|---|---|
| pSEO pipeline breaks | High | Run `generate-summaries.js` + `build-pages.js` dry-run on Phase 1 exit; compare HTML diff before Phase 2. |
| RAG chunks stale | Low | Chunks reference `research/`, not page HTML. No regen needed unless we add page content to KB. |
| Sitemap drift | Medium | Regen sitemap after every phase. Verify 93 project + 6 list + new pages all listed. |
| Theme LocalStorage key | Medium | Keep the `theme` key and `(prefers-color-scheme: light)` detection during rebuild. Users shouldn't lose preference. |
| Vercel env vars | Low | No new env vars required for v2. |
| Mobile breakage | High | Mock A's mobile responsive is already specced. Test every page at 375px, 768px, 1280px. |
| OG image stays stale | Medium | Regenerate OG images during Phase 2 to match v2 aesthetic. |

---

## Review checklist for this plan

Before we start Phase 0, confirm:

- [ ] Phase ordering makes sense (refactor before redesign? yes — avoids redesigning the monolith)
- [ ] Phase 0 can ship immediately to `main` without waiting for v2
- [ ] Branch strategy is correct (`v2-redesign` for Phases 1–4, `main` for Phase 0)
- [ ] The 5 open questions in `DESIGN.md §13` are resolved (theme toggle placement, light mode parity, reports IA, featured mechanic, stale-page redirect)
- [ ] Nothing in the "out of scope" list needs to be pulled in
- [ ] Timing pressure: any hard deadlines (e.g., needs to ship before May report)?

---

## Notes

- This is a multi-week push with limited visible milestones until Phase 2 lands. Phase 0 gives an immediate visible win (bug fixes) to prove progress.
- After v2 ships, roadmap resumes: Sentiment page, security hardening, Issue #4 (self-maintaining), Issue #6 (use-case recommender), May 2026 report.
