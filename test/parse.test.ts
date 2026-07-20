// SPDX-License-Identifier: Apache-2.0
/**
 * Input handling, held to the OFFICIAL wire vectors shipped inside the
 * payment-requests package — this app is the vectors' first external
 * consumer, which is exactly what they exist for. Every valid vector must
 * parse into a presentable request; every invalid one must be refused (the
 * page shows an error, never a half-rendered card).
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { fromAny, paymentInstructions, toLink, toURI } from "@hiero-hackers/hiero-payment-requests";
import type { PaymentRequest } from "@hiero-hackers/hiero-payment-requests";

// The official vectors, via their exports subpath (added in 0.1.1 after this
// very file had to path-hack its way to them — first-consumer feedback loop).
const require = createRequire(import.meta.url);
const vectors = require("@hiero-hackers/hiero-payment-requests/vectors/wire.v1.json") as {
  valid: { name: string; uri: string; request: Record<string, string> }[];
  invalid: { name: string; uri: string; reason: string }[];
};

describe("every official valid vector renders", () => {
  for (const vector of vectors.valid) {
    it(vector.name, () => {
      const request = fromAny(vector.uri);
      expect(request.amount).toBe(BigInt(vector.request.amount!));
      // The card needs instructions; every valid request must yield them.
      const wallet = paymentInstructions(request);
      expect(wallet.memo).toBe(vector.request.reference);
      expect(wallet.recipient).not.toContain("-");
    });
  }
});

describe("every official invalid vector is refused", () => {
  for (const vector of vectors.invalid) {
    it(`${vector.name} — ${vector.reason}`, () => {
      expect(() => fromAny(vector.uri)).toThrow();
    });
  }
});

describe("the link form round-trips through the page's entry path", () => {
  it("what toLink writes into a fragment, the boot path parses back", () => {
    const request: PaymentRequest = {
      recipient: "hedera:mainnet:0.0.1234",
      asset: "hedera:mainnet/token:0.0.720",
      amount: 100_000000n,
      reference: "INV-2026-041",
    };
    const link = toLink(request, "https://pay.example.com/");
    // What main.ts does: take location.hash minus "#", RAW (no pre-decode).
    const fragment = link.slice(link.indexOf("#") + 1);
    expect(fromAny(fragment)).toEqual(request);
    expect(fragment).toBe(toURI(request));
  });
});
