// SPDX-License-Identifier: Apache-2.0
/**
 * The REST → structural mapping, and the full pipeline it feeds: a raw
 * mirror-node JSON row must flow through hiero-receipts (fromMirror →
 * receiptFor) into payment-requests (fromReceipt → match) and come out
 * `paid` — the exact path the page walks, minus the network.
 */
import { describe, expect, it } from "vitest";
import { fromReceipt, match } from "@hiero-hackers/hiero-payment-requests";
import type { PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { receiptFor } from "@hiero-hackers/hiero-receipts";
import { fromMirror } from "@hiero-hackers/hiero-receipts/mirror";
import { toTransactionInfo } from "../src/mirror.js";

// A mirror REST row as the API actually shapes it (snake_case, base64 memo).
const restRow = {
  transaction_id: "0.0.9-1783012000-000000000",
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  consensus_timestamp: "1783012000.000000000",
  charged_tx_fee: 76522,
  memo_base64: Buffer.from("INV-2026-041", "utf8").toString("base64"),
  transfers: [
    { account: "0.0.9", amount: -76522 },
    { account: "0.0.98", amount: 76522 },
  ],
  token_transfers: [
    { token_id: "0.0.720", account: "0.0.9", amount: -100000000 },
    { token_id: "0.0.720", account: "0.0.1234", amount: 100000000 },
  ],
};

const request: PaymentRequest = {
  recipient: "hedera:mainnet:0.0.1234",
  asset: "hedera:mainnet/token:0.0.720",
  amount: 100_000000n,
  reference: "INV-2026-041",
};

describe("REST row → receipts → payment-requests → verdict", () => {
  it("maps snake_case and decodes the memo", () => {
    const mapped = toTransactionInfo(restRow);
    expect(mapped.transactionId).toBe("0.0.9-1783012000-000000000");
    expect(mapped.memo).toBe("INV-2026-041");
    expect(mapped.tokenTransfers).toHaveLength(2);
  });

  it("the full pipeline reaches `paid` — same verdict the merchant computes", () => {
    const receipt = receiptFor(
      "0.0.1234",
      fromMirror(toTransactionInfo(restRow), { network: "mainnet" }),
    );
    const payment = fromReceipt(receipt, "mainnet");
    expect(match(request, [payment])).toMatchObject({
      status: "paid",
      received: 100_000000n,
    });
  });

  it("an undecodable memo becomes absence, not garbage", () => {
    expect(toTransactionInfo({ ...restRow, memo_base64: null }).memo).toBeUndefined();
    expect(toTransactionInfo({ ...restRow, memo_base64: "" }).memo).toBeUndefined();
  });
});
