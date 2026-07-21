// SPDX-License-Identifier: Apache-2.0
// @vitest-environment happy-dom
/**
 * views/payer.ts — the trust surface. Hostile text becomes text, never
 * elements; the state machine shows facts and refuses guesses; in-page
 * payment exists only where config allows it.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { match } from "@hiero-hackers/hiero-payment-requests";
import type { Fulfilment, Payment } from "@hiero-hackers/hiero-payment-requests";
import { receiptFor } from "@hiero-hackers/hiero-receipts";
import { fromMirror } from "@hiero-hackers/hiero-receipts/mirror";
import { renderFulfilment, renderRequest } from "../../src/ui.js";
import { MAINNET_REQUEST as BASE, USDC_DISPLAY as DISPLAY } from "../helpers.js";

const UNKNOWN_DECIMALS = { decimals: undefined, symbol: "0.0.720" } as const;

const pay = (amount: bigint, id = "0.0.9@1.1"): Payment => ({
  transactionId: id,
  consensusTimestamp: "1783012000.000000000",
  network: "mainnet",
  memo: "INV-2026-041",
  succeeded: true,
  credits: [
    {
      account: "0.0.1234",
      asset: { kind: "token", network: "mainnet", id: { shard: 0n, realm: 0n, num: 720n } },
      amount,
    },
  ],
});

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
});

describe("hostile text renders as text, never as elements", () => {
  const HOSTILE = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';

  it("a hostile label cannot inject — and the card survives QR overflow", () => {
    renderRequest({ ...BASE, label: HOSTILE }, DISPLAY);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("[onerror]")).toBeNull();
    expect((window as { __pwned?: number }).__pwned).toBeUndefined();
    expect(document.querySelector("h1")?.textContent).toBe(HOSTILE); // shown, defanged
    expect(document.querySelector(".actions")).not.toBeNull(); // card still usable
  });

  it("a hostile reference cannot inject", () => {
    renderRequest({ ...BASE, reference: `${HOSTILE}"` }, DISPLAY);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("[onerror]")).toBeNull();
  });

  it("the QR is the ONE trusted innerHTML — present, self-generated, in its fold", () => {
    renderRequest(BASE, DISPLAY);
    expect(document.querySelector(".qr-details .qr svg")).not.toBeNull();
  });
});

describe("the state machine shows facts and refuses guesses", () => {
  it("unknown token decimals render grouped base units, DEMOTED", () => {
    renderRequest(BASE, UNKNOWN_DECIMALS);
    const amount = document.querySelector(".amount");
    expect(amount?.textContent).toBe("100,000,000 base units");
    expect(amount?.className).toContain("unknown");
    expect(document.body.textContent).toContain("your wallet will show");
  });

  it("known decimals render trimmed decimals with the symbol", () => {
    renderRequest(BASE, DISPLAY);
    expect(document.querySelector(".amount")?.textContent).toBe("100 USDC");
  });

  it("the memo has its own copy button, marked required", () => {
    renderRequest(BASE, DISPLAY);
    expect(document.getElementById("copy-memo")).not.toBeNull();
    expect(document.body.textContent).toContain("required");
  });

  it("the checksum chip renders only for a checksummed recipient", () => {
    renderRequest(BASE, DISPLAY);
    expect(document.querySelector(".chip.ok")).toBeNull();
    renderRequest({ ...BASE, recipient: "hedera:mainnet:0.0.1234-pikcw" }, DISPLAY);
    expect(document.querySelector(".chip.ok")?.textContent).toContain("checksum verified");
  });

  it("an expiring request renders the expiry line; one without doesn't", () => {
    renderRequest(BASE, DISPLAY);
    expect(document.getElementById("expiry")).toBeNull();
    renderRequest({ ...BASE, expiresAt: "1783012345.000000000" }, DISPLAY);
    expect(document.getElementById("expiry")).not.toBeNull();
  });

  it("the reassurance line is present", () => {
    renderRequest(BASE, DISPLAY);
    expect(document.body.textContent).toContain("never asks for keys");
  });

  it("Pay now exists ONLY where config allows — mainnet gets the note", () => {
    renderRequest(BASE, DISPLAY);
    expect(document.getElementById("pay-now")).toBeNull();
    expect(document.body.textContent).toContain("testnet-only");
    renderRequest(
      { ...BASE, recipient: "hedera:testnet:0.0.2", asset: "hedera:testnet/slip44:3030" },
      { decimals: 8, symbol: "ℏ" },
    );
    const payNow = document.getElementById("pay-now");
    expect(payNow?.className).toContain("primary");
    expect(document.querySelector("#pay-actions a.button")?.className).not.toContain("primary");
  });

  it("a correlated payment WITHOUT the memo badges the machine rail", () => {
    renderRequest(BASE, DISPLAY);
    // byUniqueAmount-style: correlated by amount, memo empty (x402-shaped).
    const machinePaid: Fulfilment = match(BASE, [pay(100_000000n)], {
      correlate: (payments) => payments,
    });
    const memoless = { ...machinePaid } as Fulfilment;
    renderFulfilment(
      BASE,
      "payments" in memoless
        ? ({
            ...memoless,
            payments: memoless.payments.map((p) => ({ ...p, memo: "" })),
          } as Fulfilment)
        : memoless,
      DISPLAY,
      [],
    );
    expect(document.getElementById("verdict")?.textContent).toContain("machine rail · no memo");
  });

  it("unpaid keeps the watching pulse — no verdict yet is not a verdict", () => {
    renderRequest(BASE, DISPLAY);
    renderFulfilment(BASE, { status: "unpaid" }, DISPLAY, []);
    expect(document.getElementById("status")?.className).toContain("await");
    expect(document.getElementById("verdict")?.innerHTML).toBe("");
  });

  it("underpaid names the shortfall, says the memo rule, offers the remainder QR", () => {
    renderRequest(BASE, DISPLAY);
    renderFulfilment(BASE, match(BASE, [pay(60_000000n)]), DISPLAY, []);
    expect(document.getElementById("verdict")?.textContent).toContain("40 USDC still owed");
    expect(document.getElementById("verdict")?.textContent).toContain("same memo");
    expect(document.querySelector("#verdict .qr svg")).not.toBeNull();
    const link = document.querySelector("#verdict a.button") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("amount=40000000");
    expect(link.getAttribute("href")).toContain("ref=INV-2026-041"); // SAME reference
  });

  it("paid flips status; the receipt button appears only with a receipt", () => {
    renderRequest(BASE, DISPLAY);
    const paid: Fulfilment = match(BASE, [pay(100_000000n)]);
    renderFulfilment(BASE, paid, DISPLAY, []);
    expect(document.getElementById("status")?.className).toContain("paid");
    // The RAIL chip: evidence-based (memo carried the reference), never a
    // human-vs-AI identity claim.
    expect(document.getElementById("verdict")?.textContent).toContain("wallet rail · memo matched");
    expect(document.getElementById("receipt")).toBeNull();
    const receipt = receiptFor(
      "0.0.1234",
      fromMirror(
        {
          transactionId: "0.0.9-1783012000-000000000",
          name: "CRYPTOTRANSFER",
          result: "SUCCESS",
          consensusTimestamp: "1783012000.000000000",
          chargedTxFee: 1,
          memo: "INV-2026-041",
          transfers: [],
          tokenTransfers: [
            { tokenId: "0.0.720", accountId: "0.0.1234", amount: 100000000 },
            { tokenId: "0.0.720", accountId: "0.0.9", amount: -100000000 },
          ],
        },
        { network: "mainnet" },
      ),
    );
    renderFulfilment(BASE, paid, DISPLAY, [receipt]);
    expect(document.getElementById("receipt")).not.toBeNull();
  });

  it("paid shows on-chain proof links to HashScan", () => {
    renderRequest(BASE, DISPLAY);
    renderFulfilment(BASE, match(BASE, [pay(100_000000n)]), DISPLAY, []);
    const proof = document.querySelector(".proofs a") as HTMLAnchorElement;
    expect(proof.getAttribute("href")).toBe(
      "https://hashscan.io/mainnet/transaction/1783012000.000000000",
    );
    expect(proof.getAttribute("rel")).toContain("noopener");
  });

  it("overpaid says so and mentions the refundable excess", () => {
    renderRequest(BASE, DISPLAY);
    renderFulfilment(
      BASE,
      match(BASE, [pay(100_000000n), pay(100_000000n, "0.0.9@2.2")]),
      DISPLAY,
      [],
    );
    expect(document.getElementById("status-text")?.textContent).toContain("overpaid");
    expect(document.getElementById("verdict")?.textContent).toContain("refund the difference");
  });
});
