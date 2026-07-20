// SPDX-License-Identifier: Apache-2.0
/**
 * The thinnest possible mirror-node access: two REST endpoints over CORS,
 * mapped into the camelCase structural shape `hiero-receipts`' `fromMirror`
 * reads (`TransactionInfoLike`). Deliberately NOT `enterprise-mirror` — that
 * is a Node-shaped client with machinery a phone-sized page shouldn't ship.
 *
 * The mirror host is derived from the network INSIDE the request's own CAIP
 * identifiers — this page has no configuration.
 */

import { MIRROR_HOSTS } from "./config.js";

export function mirrorFor(network: string): string {
  const host = MIRROR_HOSTS[network];
  if (host === undefined) {
    throw new Error(`no public mirror node for "${network}" — this page cannot watch it`);
  }
  return host;
}

/** The camelCase shape hiero-receipts' `fromMirror` accepts (structural). */
export interface MirrorTx {
  transactionId: string;
  name: string;
  result: string;
  consensusTimestamp: string;
  chargedTxFee: number | string;
  memo?: string;
  transfers: { accountId: string; amount: number | string }[];
  tokenTransfers: { tokenId: string; accountId: string; amount: number | string }[];
  nftTransfers?: {
    tokenId: string;
    serialNumber: number | string;
    senderAccountId: string;
    receiverAccountId: string;
  }[];
  stakingRewardTransfers?: { accountId: string; amount: number | string }[];
}

/** Raw REST rows (snake_case) — only the fields we map. */
interface RestTx {
  transaction_id: string;
  name: string;
  result: string;
  consensus_timestamp: string;
  charged_tx_fee: number;
  memo_base64?: string | null;
  transfers?: { account: string; amount: number }[];
  token_transfers?: { token_id: string; account: string; amount: number }[];
  nft_transfers?: {
    token_id: string;
    serial_number: number;
    sender_account_id: string | null;
    receiver_account_id: string;
  }[];
  staking_reward_transfers?: { account: string; amount: number }[];
}

/** REST snake_case → the structural camelCase shape, memo decoded. */
export function toTransactionInfo(tx: RestTx): MirrorTx {
  return {
    transactionId: tx.transaction_id,
    name: tx.name,
    result: tx.result,
    consensusTimestamp: tx.consensus_timestamp,
    chargedTxFee: tx.charged_tx_fee,
    memo: decodeMemo(tx.memo_base64),
    transfers: (tx.transfers ?? []).map((t) => ({ accountId: t.account, amount: t.amount })),
    tokenTransfers: (tx.token_transfers ?? []).map((t) => ({
      tokenId: t.token_id,
      accountId: t.account,
      amount: t.amount,
    })),
    nftTransfers: (tx.nft_transfers ?? []).map((n) => ({
      tokenId: n.token_id,
      serialNumber: n.serial_number,
      senderAccountId: n.sender_account_id ?? "",
      receiverAccountId: n.receiver_account_id,
    })),
    stakingRewardTransfers: (tx.staking_reward_transfers ?? []).map((s) => ({
      accountId: s.account,
      amount: s.amount,
    })),
  };
}

function decodeMemo(base64: string | null | undefined): string | undefined {
  if (base64 == null || base64 === "") return undefined;
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined; // an undecodable memo is a memo we don't have
  }
}

/** Recent transactions crediting `accountId`, mapped and ready to normalize. */
export async function recentTransactions(network: string, accountId: string): Promise<MirrorTx[]> {
  const url =
    `${mirrorFor(network)}/api/v1/transactions?account.id=${encodeURIComponent(accountId)}` +
    `&order=desc&limit=25`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`mirror node answered ${response.status}`);
  const body = (await response.json()) as { transactions?: RestTx[] };
  return (body.transactions ?? []).map(toTransactionInfo);
}

/** A token's display decimals, or undefined when the lookup fails — the page
 *  then shows base units rather than guessing. */
export async function tokenDecimals(network: string, tokenId: string): Promise<number | undefined> {
  try {
    const response = await fetch(`${mirrorFor(network)}/api/v1/tokens/${tokenId}`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as { decimals?: string | number };
    const parsed = Number(body.decimals);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
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
