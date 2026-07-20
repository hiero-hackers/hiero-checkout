// SPDX-License-Identifier: Apache-2.0
// Regenerates the README screenshots from a RUNNING dev server (npm run dev),
// via headless Chrome — so the pictures are reproducible output, not relics.
//   node scripts/screenshots.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5173";
const REQUEST =
  "hiero-pay:hedera:testnet:0.0.2?v=1&asset=hedera%3Atestnet%2Fslip44%3A3030" +
  "&amount=500000000&ref=INV-2026-041&label=Workshop%20ticket";

const SHOTS = [
  ["landing.png", `${BASE}/`, 620],
  ["builder.png", `${BASE}/#create`, 980],
  ["payer.png", `${BASE}/#${REQUEST}`, 900],
  ["invoice.png", `${BASE}/?invoice#${REQUEST}`, 1000],
];

mkdirSync(new URL("../docs/screenshots/", import.meta.url), { recursive: true });
for (const [name, url, height] of SHOTS) {
  execFileSync(CHROME, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--window-size=560,${height}`,
    "--virtual-time-budget=4000",
    `--screenshot=docs/screenshots/${name}`,
    url,
  ]);
  console.log(`✓ ${name}`);
}
