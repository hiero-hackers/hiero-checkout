// SPDX-License-Identifier: Apache-2.0
/**
 * The tour's script is pure and must tell the truth: each step's simulated
 * payments really do produce the verdict its caption claims, through the
 * real matcher.
 */
import { describe, expect, it } from "vitest";
import { match } from "@hiero-hackers/hiero-payment-requests";
import { tourSteps } from "../src/tour.js";

const REQUEST = {
  recipient: "hedera:mainnet:0.0.1234-pikcw",
  asset: "hedera:mainnet/token:0.0.720",
  amount: 100_000000n,
  reference: "INV-2026-041",
};

describe("the tour's captions match its verdicts", () => {
  const steps = tourSteps();

  it("plays three acts", () => {
    expect(steps).toHaveLength(3);
  });

  it("act 1: nothing paid", () => {
    expect(
      match(
        REQUEST,
        steps[0]!.payments.map((p) => p.payment),
      ).status,
    ).toBe("unpaid");
  });

  it("act 2: underpaid — the remainder story is real", () => {
    const verdict = match(
      REQUEST,
      steps[1]!.payments.map((p) => p.payment),
    );
    expect(verdict).toMatchObject({ status: "underpaid", shortfall: 40_000000n });
  });

  it("act 3: overpaid with a refundable excess, receipts included", () => {
    const verdict = match(
      REQUEST,
      steps[2]!.payments.map((p) => p.payment),
    );
    expect(verdict).toMatchObject({ status: "overpaid", excess: 9_500000n });
    expect(steps[2]!.payments.map((p) => p.receipt)).toHaveLength(2);
  });
});
