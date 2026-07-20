// SPDX-License-Identifier: Apache-2.0
/**
 * The confirmation loop: polls, dedupes, matches, keeps going through
 * errors, and stops when told. The mirror is mocked at the module seam —
 * these tests pin OUR loop, not the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchFulfilment } from "../src/confirm.js";
import { TESTNET_REQUEST } from "./helpers.js";

const recent = vi.hoisted(() => vi.fn());
vi.mock("../src/mirror.js", () => ({ recentTransactions: recent }));

const PAID_TX = {
  transactionId: "0.0.9-1-000000000",
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  consensusTimestamp: "1.000000000",
  chargedTxFee: 1,
  memo: "INV-1",
  transfers: [
    { accountId: "0.0.9", amount: -500_000_000 },
    { accountId: "0.0.2", amount: 500_000_000 },
  ],
  tokenTransfers: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  recent.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("watchFulfilment", () => {
  it("first poll with the payment → paid, receipts attached", async () => {
    recent.mockResolvedValue([PAID_TX]);
    const updates: string[] = [];
    const handle = watchFulfilment(
      TESTNET_REQUEST,
      ({ fulfilment, receipts }) => updates.push(`${fulfilment.status}:${receipts.length}`),
      () => updates.push("error"),
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(updates).toEqual(["paid:1"]);
    handle.stop();
  });

  it("re-delivery across polls never double-counts (at-least-once is fine)", async () => {
    recent.mockResolvedValue([PAID_TX]);
    const updates: string[] = [];
    const handle = watchFulfilment(
      TESTNET_REQUEST,
      ({ fulfilment }) => updates.push(fulfilment.status),
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(1); // poll 1
    await vi.advanceTimersByTimeAsync(5_000); // poll 2, same tx again
    expect(updates).toEqual(["paid", "paid"]); // still paid — never overpaid
    handle.stop();
  });

  it("a failing poll surfaces via onError and the loop keeps going", async () => {
    recent.mockRejectedValueOnce(new Error("mirror down")).mockResolvedValue([PAID_TX]);
    const events: string[] = [];
    const handle = watchFulfilment(
      TESTNET_REQUEST,
      ({ fulfilment }) => events.push(fulfilment.status),
      (error) => events.push(`error:${error.message}`),
    );
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(events).toEqual(["error:mirror down", "paid"]);
    handle.stop();
  });

  it("stop() actually stops", async () => {
    recent.mockResolvedValue([]);
    const updates: unknown[] = [];
    const handle = watchFulfilment(
      TESTNET_REQUEST,
      (u) => updates.push(u),
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(1);
    handle.stop();
    const before = updates.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(updates.length).toBe(before);
  });
});
