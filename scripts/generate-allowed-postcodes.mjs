/**
 * Reads allowed-postcode.csv (UK outward codes) and writes public/allowed-outward-codes.json
 * for the Optimizely snippet and static hosting.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const csvPath = path.join(root, 'allowed-postcode.csv');
const outPath = path.join(root, 'public', 'allowed-outward-codes.json');

const text = fs.readFileSync(csvPath, 'utf8');
const codes = new Set();
for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || /^country\s+name/i.test(trimmed)) continue;
  const m = trimmed.match(/^UK,([A-Za-z0-9]+),/);
  if (m) codes.add(m[1].toUpperCase());
}

const outward = [...codes].sort();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({ outward })}\n`);
console.log(`Wrote ${outward.length} outward codes to ${path.relative(root, outPath)}`);
