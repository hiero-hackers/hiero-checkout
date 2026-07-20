// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vite";

/**
 * The privacy claim, browser-enforced: production builds carry a CSP that
 * allows connections ONLY to the public mirror nodes. Injected at build time
 * (not in index.html) because Vite's dev server needs websockets and inline
 * HMR helpers; scripts/check-dist.mjs asserts it survived into dist/.
 */
const CSP = [
  "default-src 'self'",
  // Mirror nodes (the page's own data) + the WalletConnect relay and its
  // support services (Pay now — argued for in SECURITY.md). Nothing else.
  "connect-src https://mainnet.mirrornode.hedera.com https://testnet.mirrornode.hedera.com https://previewnet.mirrornode.hedera.com" +
    " wss://relay.walletconnect.com wss://relay.walletconnect.org" +
    " https://explorer-api.walletconnect.com https://verify.walletconnect.com https://verify.walletconnect.org https://pulse.walletconnect.org",
  // Wallet icons in the pairing modal come from the explorer CDN.
  "img-src 'self' data: https://explorer-api.walletconnect.com https://imagedelivery.net",
  // The WalletConnect modal injects its styles at runtime — style-only
  // relaxation, scripts stay 'self'.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src https://verify.walletconnect.com https://verify.walletconnect.org",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

export default defineConfig({
  // Relative asset paths: GitHub Pages serves this from /hiero-checkout/,
  // not the domain root — absolute /assets/… URLs 404 there.
  base: "./",
  plugins: [
    {
      name: "inject-csp",
      apply: "build",
      transformIndexHtml(html) {
        return html.replace(
          "<title>",
          `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <title>`,
        );
      },
    },
  ],
});
