#!/usr/bin/env node
/**
 * fix-image-urls.js
 *
 * Patches all existing project HTML files to rewrite relative image/media
 * src attributes to absolute GitHub raw URLs. This is a one-time fix for
 * pages built before the rewriteRelativeUrls logic was added to build-pages.js.
 *
 * Usage: node scripts/fix-image-urls.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const projectsDir = path.join(ROOT, "projects");

function isAbsoluteUrl(url) {
  return /^(?:https?:\/\/|data:|mailto:|#|\/\/)/.test(url.trim());
}

function cleanRelativePath(p) {
  return p.replace(/^\.\//, "").replace(/ /g, "%20");
}

let totalFixed = 0;
let filesFixed = 0;

// Walk projects/{owner}/{repo}.html
const owners = fs.readdirSync(projectsDir);
for (const owner of owners) {
  const ownerDir = path.join(projectsDir, owner);
  if (!fs.statSync(ownerDir).isDirectory()) continue;

  const files = fs.readdirSync(ownerDir).filter((f) => f.endsWith(".html"));
  for (const file of files) {
    const repo = file.replace(".html", "");
    const filePath = path.join(ownerDir, file);
    const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/main/`;

    let html = fs.readFileSync(filePath, "utf-8");
    let fixCount = 0;

    // Fix <img src="relative"> and <source src="relative">
    html = html.replace(
      /(<(?:img|source|video)\s[^>]*?src=["'])([^"']+)(["'])/gi,
      (match, prefix, url, suffix) => {
        if (isAbsoluteUrl(url)) return match;
        fixCount++;
        return `${prefix}${rawBase}${cleanRelativePath(url)}${suffix}`;
      }
    );

    if (fixCount > 0) {
      fs.writeFileSync(filePath, html, "utf-8");
      console.log(`  Fixed ${fixCount} image(s) in ${owner}/${repo}`);
      totalFixed += fixCount;
      filesFixed++;
    }
  }
}

console.log(`\nDone: fixed ${totalFixed} image references across ${filesFixed} files.`);
