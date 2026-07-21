// SPDX-License-Identifier: Apache-2.0
/**
 * src/x402.ts — an agent's 402 challenge becomes a human-payable card.
 * All three pasteable spellings, the honest refusals, and the guarantee that
 * the normal entry points still behave exactly as before.
 */
import { describe, expect, it } from "vitest";
import { toURI } from "@hiero-hackers/hiero-payment-requests";
import { fromX402, parseRequest } from "../src/x402.js";
import { MAINNET_REQUEST } from "./helpers.js";

const REQUIREMENTS = {
  scheme: "exact",
  network: "hedera:testnet",
  amount: "5000000",
  asset: "0.0.0",
  payTo: "0.0.4507290",
  maxTimeoutSeconds: 180,
  extra: { feePayer: "0.0.7000001" },
};

const BODY = {
  x402Version: 2,
  error: "Payment required",
  resource: { url: "https://api.example.test/data/spot-price", mimeType: "application/json" },
  accepts: [REQUIREMENTS],
};

describe("fromX402", () => {
  it("reads a full 402 body: HBAR terms, resource URL as the reference", () => {
    const request = fromX402(JSON.stringify(BODY));
    expect(request).toEqual({
      recipient: "hedera:testnet:0.0.4507290",
      asset: "hedera:testnet/slip44:3030",
      amount: 5_000_000n,
      reference: "https://api.example.test/data/spot-price",
      label: "x402 · https://api.example.test/data/spot-price",
    });
  });

  it("reads a bare requirements object, token asset, defaulted reference", () => {
    const request = fromX402(JSON.stringify({ ...REQUIREMENTS, asset: "0.0.5449", amount: "250" }));
    expect(request?.asset).toBe("hedera:testnet/token:0.0.5449");
    expect(request?.amount).toBe(250n);
    expect(request?.reference).toBe("x402");
  });

  it("reads the raw base64 payment-required header an agent holds", () => {
    const header = btoa(JSON.stringify(BODY));
    expect(fromX402(header)?.recipient).toBe("hedera:testnet:0.0.4507290");
  });

  it("accepts the v1 spelling maxAmountRequired", () => {
    const { amount: _dropped, ...rest } = REQUIREMENTS;
    const request = fromX402(JSON.stringify({ ...rest, maxAmountRequired: "42" }));
    expect(request?.amount).toBe(42n);
  });

  it("picks the first usable option from a multi-option challenge", () => {
    const evm = { ...REQUIREMENTS, network: "base-sepolia", asset: "0x036c", payTo: "0x2096" };
    const request = fromX402(JSON.stringify({ ...BODY, accepts: [evm, REQUIREMENTS] }));
    expect(request?.recipient).toBe("hedera:testnet:0.0.4507290");
  });

  it("answers undefined for everything that isn't x402-shaped", () => {
    for (const text of ["", "hello", "hiero-pay:junk", "{}", '{"a":1}', "AAAA", "not json {"]) {
      expect(fromX402(text)).toBeUndefined();
    }
  });

  it("refuses, with its own reason, a challenge this page cannot render", () => {
    // Messages are the library adapter's own (upstreamed in v0.1.3): a
    // foreign scheme names the scheme problem; a foreign network fails the
    // network table's validation — either way, not "not a hiero-pay URI".
    const evmOnly = { ...BODY, accepts: [{ ...REQUIREMENTS, network: "base-sepolia" }] };
    expect(() => fromX402(JSON.stringify(evmOnly))).toThrow();
    const upto = { ...BODY, accepts: [{ ...REQUIREMENTS, scheme: "upto" }] };
    expect(() => fromX402(JSON.stringify(upto))).toThrow(/exact/);
  });

  it("refuses malformed terms loudly — alias payTo, weird asset, float amount", () => {
    const bad = (patch: object): string =>
      JSON.stringify({ ...BODY, accepts: [{ ...REQUIREMENTS, ...patch }] });
    expect(() => fromX402(bad({ payTo: "0xdead" }))).toThrow(/payTo/);
    expect(() => fromX402(bad({ asset: "USDC" }))).toThrow(/asset/);
    expect(() => fromX402(bad({ amount: "1.5" }))).toThrow(/amount/);
    expect(() => fromX402(bad({ network: "hedera:notanet" }))).toThrow();
  });
});

describe("parseRequest", () => {
  it("still parses every normal entry exactly as fromAny does", () => {
    const uri = toURI(MAINNET_REQUEST);
    expect(parseRequest(uri)).toEqual(MAINNET_REQUEST);
  });

  it("falls back to x402 for a pasted challenge", () => {
    expect(parseRequest(JSON.stringify(BODY)).reference).toBe(
      "https://api.example.test/data/spot-price",
    );
  });

  it("keeps the original diagnosis when text is neither", () => {
    expect(() => parseRequest("hiero-pay:nonsense")).toThrow();
  });
});
