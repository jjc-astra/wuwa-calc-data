// scripts/generate-rankings-index.mjs
// Builds data/character_results/index.json -- everything the site's Rotation Rankings page needs
// in one small file -- from the default-build results files in character_results/results/.
//
// Each results file names the rotation file it was calculated from and that file's hash. The hash
// is recomputed here from the rotation file (sha256 of JSON.stringify({ rotation, team, settings, enemy }),
// first 16 hex chars -- same as the site's hashRotationInputs); a results file whose rotation is
// missing or has changed since is left out, with a warning.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Optional argument: another data directory, e.g. the site's local WIP mirror (site/public/wip-data/data).
const dataDir = process.argv[2] || join(__dirname, '..', 'data');
const rankingsDir = join(dataDir, 'character_results');
const resultsDir = join(rankingsDir, 'results');
const rotationsDir = join(rankingsDir, 'rotations');
const indexPath = join(rankingsDir, 'index.json');

// The only team fields a ranking row shows or filters on.
const ROSTER_FIELDS = ['character', 'sequence', 'weapon', 'rank', 'mainSet', 'subSet', 'subSet2a', 'subSet2b', 'mainEcho', 'layout'];

const hashRotationInputs = ({ rotation, team, settings, enemy }) =>
  createHash('sha256').update(JSON.stringify({ rotation, team, settings, enemy })).digest('hex').slice(0, 16);

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

export function generateRankingsIndex() {
  const files = existsSync(resultsDir) ? readdirSync(resultsDir).filter(name => name.endsWith('.json')).sort() : [];
  const index = [];

  for (const id of files) {
    const results = readJson(join(resultsDir, id));
    if (results.build !== 'default') continue;

    const rotationPath = join(rotationsDir, results.rotationFile || '');
    if (!results.rotationFile || !existsSync(rotationPath)) {
      console.warn(`[rankings-index] Skipping ${id}: rotation file "${results.rotationFile}" not found.`);
      continue;
    }
    const rotationHash = hashRotationInputs(readJson(rotationPath));
    if (results.hash !== rotationHash) {
      console.warn(`[rankings-index] Skipping ${id}: calculated from a different version of ${results.rotationFile}.`);
      continue;
    }

    index.push({
      id,
      rotationFile: results.rotationFile,
      hash: results.hash,
      rotationType: results.rotationType ?? null,
      ...(results.author && { author: results.author }),
      team: results.team.map(slot => Object.fromEntries(ROSTER_FIELDS.filter(k => k in slot).map(k => [k, slot[k]]))),
      results: { dpsStats: results.results.dpsStats, contribution: results.results.contribution }
    });
  }

  writeFileSync(indexPath, JSON.stringify(index) + '\n');
  return index;
}

const index = generateRankingsIndex();
console.log(`[rankings-index] Wrote ${index.length} entries to ${indexPath}`);
