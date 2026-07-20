// SPDX-License-Identifier: Apache-2.0
/**
 * Prototype configuration — every deliberate limitation in ONE place, so
 * un-gating is a conscious, reviewable act rather than an archaeology dig.
 *
 * Before flipping anything here for real money, read SECURITY.md — the
 * "Supply-chain posture" section is an explicit pre-flight checklist.
 */

/**
 * Networks where the in-page "Pay now" (WalletConnect) button may exist and
 * `payWithWallet` will agree to run. Testnet-only while this is a prototype: testnet
 * signatures are real, testnet money is faucet money — the full flow with
 * zero stakes. Viewing, minting, and sharing requests on OTHER networks
 * still works everywhere; only in-page signing is gated.
 */
export const IN_PAGE_PAYMENT_NETWORKS: readonly string[] = ["testnet"];

export const canPayInPage = (network: string): boolean =>
  IN_PAGE_PAYMENT_NETWORKS.includes(network);

/**
 * Public mirror-node hosts per network — the page's only data source, and
 * the one table to extend when a new Hiero network gets a public mirror.
 * (The production CSP in vite.config.ts must list the same hosts; the dist
 * trust-check keeps that honest.)
 */
export const MIRROR_HOSTS: Record<string, string> = {
  mainnet: "https://mainnet.mirrornode.hedera.com",
  testnet: "https://testnet.mirrornode.hedera.com",
  previewnet: "https://previewnet.mirrornode.hedera.com",
};
