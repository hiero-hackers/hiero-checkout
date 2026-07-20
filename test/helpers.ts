// SPDX-License-Identifier: Apache-2.0
/**
 * Shared test fixtures and DOM helpers — one canonical request per network,
 * one form-filler, one control inventory. Narrow per-suite; never fork.
 */
import { vi } from "vitest";
import type { Payment, PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import type { DisplayContext } from "../src/ui.js";

export const TESTNET_REQUEST: PaymentRequest = {
  recipient: "hedera:testnet:0.0.2",
  asset: "hedera:testnet/slip44:3030",
  amount: 500_000_000n,
  reference: "INV-1",
};

export const MAINNET_REQUEST: PaymentRequest = {
  recipient: "hedera:mainnet:0.0.1234",
  asset: "hedera:mainnet/token:0.0.720",
  amount: 100_000000n,
  reference: "INV-2026-041",
};

export const HBAR_DISPLAY: DisplayContext = { decimals: 8, symbol: "ℏ" };
export const USDC_DISPLAY: DisplayContext = { decimals: 6, symbol: "USDC" };

/** A payment fulfilling TESTNET_REQUEST exactly — override what you need. */
export function testnetPayment(over: Partial<Payment> = {}): Payment {
  return {
    transactionId: "0.0.9@1.1",
    consensusTimestamp: "1.1",
    network: "testnet",
    memo: "INV-1",
    succeeded: true,
    credits: [
      { account: "0.0.2", asset: { kind: "hbar", network: "testnet" }, amount: 500_000_000n },
    ],
    ...over,
  };
}

/** Fill a form field and fire the input event the page listens for. */
export function setField(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Let queued microtasks/timers-at-zero settle. */
export const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Stub fetch to return `body` as JSON (or a failed response). */
export function stubFetchJson(body: unknown, ok = true): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", mock);
  return mock;
}
