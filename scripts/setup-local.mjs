// SPDX-License-Identifier: Apache-2.0
// Installs the @hiero-hackers dependencies from the SIBLING CHECKOUTS by
// packing real tarballs — exactly what `npm install` from the registry will
// deliver once the packages are published there. When that happens, replace
// this with plain dependencies on ^0.1.0 and delete the script.
//
//   node scripts/setup-local.mjs
//
// Expects ../hiero-payment-requests and ../hiero-receipts next to this repo,
// each already built (`npm ci && npm run build`).
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vendor = join(root, "vendor");
const siblings = ["hiero-payment-requests", "hiero-receipts"];

rmSync(vendor, { recursive: true, force: true });
mkdirSync(vendor, { recursive: true });

const tarballs = [];
for (const name of siblings) {
  const dir = resolve(root, "..", name);
  if (!existsSync(join(dir, "dist"))) {
    console.error(`${name}: no dist/ — run \`npm ci && npm run build\` in ${dir} first`);
    process.exit(1);
  }
  // npm pack prints the tarball name last (prepare output may precede it).
  const out = execSync(`npm pack --pack-destination "${vendor}"`, { cwd: dir, encoding: "utf8" });
  const lines = out.trim().split("\n");
  tarballs.push(join(vendor, lines[lines.length - 1].trim()));
}

execSync(`npm install --no-save ${tarballs.map((t) => `"${t}"`).join(" ")}`, {
  cwd: root,
  stdio: "inherit",
});
console.log(`\ninstalled from local tarballs: ${readdirSync(vendor).join(", ")}`);
console.log("(--no-save: package.json stays registry-ready for when 0.1.0 publishes)");
