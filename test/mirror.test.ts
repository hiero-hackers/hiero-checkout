// SPDX-License-Identifier: Apache-2.0
/** The thin mirror wrapper's edges: hosts, failures, honest undefineds. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mirrorFor, recentTransactions, tokenDecimals, usdEstimateCents } from "../src/mirror.js";
import { stubFetchJson } from "./helpers.js";

afterEach(() => vi.unstubAllGlobals());

describe("mirrorFor", () => {
  it("knows the public networks and refuses the rest loudly", () => {
    expect(mirrorFor("testnet")).toContain("testnet.mirrornode");
    expect(() => mirrorFor("devnet")).toThrow(/cannot watch/);
  });
});

describe("recentTransactions", () => {
  it("maps rows and tolerates an empty body", async () => {
    stubFetchJson({ transactions: [] });
    expect(await recentTransactions("testnet", "0.0.2")).toEqual([]);
    stubFetchJson({});
    expect(await recentTransactions("testnet", "0.0.2")).toEqual([]);
  });

  it("a non-OK answer throws with the status", async () => {
    stubFetchJson({}, false);
    await expect(recentTransactions("testnet", "0.0.2")).rejects.toThrow(/answered/);
  });
});

describe("tokenDecimals — never guesses", () => {
  it("returns the decimals when the mirror knows them", async () => {
    stubFetchJson({ decimals: "6" });
    expect(await tokenDecimals("testnet", "0.0.720")).toBe(6);
  });

  it("undefined on non-OK, nonsense, or network failure", async () => {
    stubFetchJson({}, false);
    expect(await tokenDecimals("testnet", "0.0.720")).toBeUndefined();
    stubFetchJson({ decimals: "many" });
    expect(await tokenDecimals("testnet", "0.0.720")).toBeUndefined();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await tokenDecimals("testnet", "0.0.720")).toBeUndefined();
  });
});

describe("usdEstimateCents — bigint all the way, undefined over guesses", () => {
  it("computes whole cents from the network rate", async () => {
    // 12¢ per 2 ℏ → 5 ℏ (500,000,000 tinybar) ≈ 30¢
    stubFetchJson({ current_rate: { cent_equivalent: 12, hbar_equivalent: 2 } });
    expect(await usdEstimateCents("testnet", 500_000_000n)).toBe(30n);
  });

  it("undefined on missing fields, failure, or unknown network", async () => {
    stubFetchJson({ current_rate: {} });
    expect(await usdEstimateCents("testnet", 1n)).toBeUndefined();
    stubFetchJson({}, false);
    expect(await usdEstimateCents("testnet", 1n)).toBeUndefined();
    expect(await usdEstimateCents("devnet", 1n)).toBeUndefined(); // mirrorFor throws inside
  });
});
