// scripts/generate-manifest.mjs
// Walks data/ and writes data/manifest.json: { relativePath: shortHash } for every .json file
// (manifest.json itself excluded). The site (DataLoader.refreshManifest, in the wuwa-calc-site
// repo) fetches only this one small file over raw.githubusercontent.com to detect whether
// something it already has cached has changed here -- comparing a short hash instead of
// re-downloading every data file it's holding. Ported from wuwa-calc-site's
// scripts/generate-data-manifest.mjs, which did the same thing for public/data when data lived
// in that repo.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const manifestPath = join(dataDir, 'manifest.json');

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (name.endsWith('.json') && full !== manifestPath) {
      out.push(full);
    }
  }
}

export function generateManifest() {
  const files = [];
  walk(dataDir, files);

  const manifest = {};
  for (const file of files) {
    const relPath = relative(dataDir, file).split(sep).join('/');
    const contents = readFileSync(file);
    manifest[relPath] = createHash('sha256').update(contents).digest('hex').slice(0, 16);
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

const manifest = generateManifest();
console.log(`[generate-manifest] Wrote ${Object.keys(manifest).length} entries to ${manifestPath}`);
