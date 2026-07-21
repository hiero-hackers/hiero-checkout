// SPDX-License-Identifier: Apache-2.0
/**
 * Mirror access = the shared thin-fetch module + this page's host policy.
 *
 * The fetch half (snake→camel mapping, memo decode, endpoint calls) used to
 * live here as ~140 lines and was upstreamed to
 * `@hiero-hackers/hiero-receipts/mirror-fetch` (v0.2.0)
 *
 * The mirror host is derived from the network INSIDE the request's own CAIP
 * identifiers — this page has no configuration.
 */
import type { TransactionInfoLike } from "@hiero-hackers/hiero-receipts/mirror";
import {
  recentTransactions as fetchRecentTransactions,
  tokenDecimals as fetchTokenDecimals,
  toTransactionInfo,
} from "@hiero-hackers/hiero-receipts/mirror-fetch";
import { MIRROR_HOSTS } from "./config.js";

export { toTransactionInfo };

/** The camelCase shape hiero-receipts' `fromMirror` accepts (structural). */
export type MirrorTx = TransactionInfoLike;

export function mirrorFor(network: string): string {
  const host = MIRROR_HOSTS[network];
  if (host === undefined) {
    throw new Error(`no public mirror node for "${network}" — this page cannot watch it`);
  }
  return host;
}

/** Recent transactions crediting `accountId`, mapped and ready to normalize. */
export async function recentTransactions(network: string, accountId: string): Promise<MirrorTx[]> {
  return fetchRecentTransactions(mirrorFor(network), accountId);
}

/** A token's display decimals, or undefined when the lookup fails — the page
 *  then shows base units rather than guessing. */
export async function tokenDecimals(network: string, tokenId: string): Promise<number | undefined> {
  return fetchTokenDecimals(mirrorFor(network), tokenId);
}

/** The network's own HBAR↔cents rate — for a clearly-labeled estimate only.
 *  All-bigint math; returns undefined rather than guessing on failure. */
export async function usdEstimateCents(
  network: string,
  tinybar: bigint,
): Promise<bigint | undefined> {
  try {
    const response = await fetch(`${mirrorFor(network)}/api/v1/network/exchangerate`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      current_rate?: { cent_equivalent?: number; hbar_equivalent?: number };
    };
    const cents = body.current_rate?.cent_equivalent;
    const hbar = body.current_rate?.hbar_equivalent;
    if (!cents || !hbar) return undefined;
    // tinybar → whole cents: amount × (cents/hbar) ÷ 10^8, all in bigint.
    return (tinybar * BigInt(Math.trunc(cents))) / (BigInt(Math.trunc(hbar)) * 100_000_000n);
  } catch {
    return undefined;
  }
}
