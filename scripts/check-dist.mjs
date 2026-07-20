// SPDX-License-Identifier: Apache-2.0
// The built page must carry the CSP — the browser-enforced version of the
// README's "talks only to the mirror node" promise. Run after `vite build`.
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const failures = [];
if (!html.includes('http-equiv="Content-Security-Policy"')) failures.push("CSP meta tag missing");
if (!/connect-src[^"]*mirrornode\.hedera\.com/.test(html))
  failures.push("CSP does not pin mirror hosts");
if (!/connect-src[^"]*relay\.walletconnect/.test(html))
  failures.push("CSP lost the WalletConnect relay (Pay now would break silently)");
if (!html.includes('name="referrer" content="no-referrer"'))
  failures.push("referrer policy missing");
if (failures.length > 0) {
  console.error("dist/index.html failed the trust checks:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log("dist check: CSP + referrer policy present ✓");
