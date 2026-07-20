// SPDX-License-Identifier: Apache-2.0
// @vitest-environment happy-dom
/** The corners the main suites walked past — found by coverage, kept by it. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "@hiero-hackers/hiero-payment-requests";
import { receiptFor } from "@hiero-hackers/hiero-receipts";
import { fromMirror } from "@hiero-hackers/hiero-receipts/mirror";
import { toTransactionInfo } from "../src/mirror.js";
import { watchFulfilment } from "../src/confirm.js";
import {
  ageChecked,
  renderChecked,
  renderFulfilment,
  renderInvoice,
  renderRequest,
  renderWaitingHint,
} from "../src/ui.js";
import { HBAR_DISPLAY, TESTNET_REQUEST, testnetPayment } from "./helpers.js";

const recent = vi.hoisted(() => vi.fn());
vi.mock("../src/mirror.js", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recentTransactions: recent,
}));

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("liveness tick", () => {
  it("stamps, then ages", () => {
    renderRequest(TESTNET_REQUEST, HBAR_DISPLAY);
    renderChecked();
    expect(document.getElementById("checked")!.textContent).toContain("just now");
    ageChecked(Date.now() - 7_000);
    expect(document.getElementById("checked")!.textContent).toContain("7s ago");
    ageChecked(0); // no poll yet → says nothing
  });
});

describe("waiting hint", () => {
  it("shows while awaiting, hides once a verdict lands", () => {
    renderRequest(TESTNET_REQUEST, HBAR_DISPLAY);
    renderWaitingHint();
    expect((document.getElementById("hint") as HTMLElement).hidden).toBe(false);
    renderFulfilment(TESTNET_REQUEST, match(TESTNET_REQUEST, [testnetPayment()]), HBAR_DISPLAY, []);
    expect((document.getElementById("hint") as HTMLElement).hidden).toBe(true);
  });
});

describe("wrong-asset verdict", () => {
  it("says a payment arrived in the wrong asset — not 'unpaid'", () => {
    renderRequest(TESTNET_REQUEST, HBAR_DISPLAY);
    const wrong = testnetPayment({
      credits: [
        {
          account: "0.0.2",
          asset: { kind: "token", network: "testnet", id: { shard: 0n, realm: 0n, num: 9n } },
          amount: 5n,
        },
      ],
    });
    renderFulfilment(TESTNET_REQUEST, match(TESTNET_REQUEST, [wrong]), HBAR_DISPLAY, []);
    expect(document.getElementById("status-text")!.textContent).toContain("wrong asset");
  });
});

describe("receipt download, actually clicked", () => {
  it("builds a blob URL and names the file after the transaction", () => {
    const create = vi.fn(() => "blob:receipt");
    vi.stubGlobal("URL", { ...URL, createObjectURL: create, revokeObjectURL: vi.fn() });
    renderRequest(TESTNET_REQUEST, HBAR_DISPLAY);
    const receipt = receiptFor(
      "0.0.2",
      fromMirror(
        toTransactionInfo({
          transaction_id: "0.0.9-1-000000000",
          name: "CRYPTOTRANSFER",
          result: "SUCCESS",
          consensus_timestamp: "1.000000000",
          charged_tx_fee: 1,
          transfers: [
            { account: "0.0.9", amount: -500_000_000 },
            { account: "0.0.2", amount: 500_000_000 },
          ],
        }),
        { network: "testnet" },
      ),
    );
    renderFulfilment(TESTNET_REQUEST, match(TESTNET_REQUEST, [testnetPayment()]), HBAR_DISPLAY, [
      receipt,
    ]);
    (document.getElementById("receipt") as HTMLButtonElement).click();
    expect(create).toHaveBeenCalledOnce();
  });
});

describe("invoice variants", () => {
  it("renders without label or expiry, and survives QR overflow", () => {
    renderInvoice(TESTNET_REQUEST, HBAR_DISPLAY); // no label, no expiry
    expect(document.body.textContent).not.toContain("Valid until");
    renderInvoice(
      { ...TESTNET_REQUEST, reference: "x".repeat(300), expiresAt: "1783012345.000000000" },
      HBAR_DISPLAY,
    );
    expect(document.querySelector(".invoice .qr")).toBeNull(); // too long — link stands alone
    expect(document.body.textContent).toContain("Valid until");
  });
});

describe("mirror mapping corners", () => {
  it("nft and staking rows map; an invalid memo becomes absence", () => {
    const mapped = toTransactionInfo({
      transaction_id: "t",
      name: "CRYPTOTRANSFER",
      result: "SUCCESS",
      consensus_timestamp: "1.0",
      charged_tx_fee: 1,
      memo_base64: "%%%not-base64%%%",
      nft_transfers: [
        {
          token_id: "0.0.7",
          serial_number: 3,
          sender_account_id: null,
          receiver_account_id: "0.0.2",
        },
      ],
      staking_reward_transfers: [{ account: "0.0.2", amount: 5 }],
    });
    expect(mapped.memo).toBeUndefined();
    expect(mapped.nftTransfers?.[0]).toMatchObject({ senderAccountId: "", serialNumber: 3 });
    expect(mapped.stakingRewardTransfers?.[0]).toMatchObject({ accountId: "0.0.2" });
  });
});

describe("confirm loop with a non-Error failure", () => {
  it("wraps thrown non-Errors before reporting", async () => {
    vi.useFakeTimers();
    recent.mockRejectedValue("plain string failure");
    const errors: string[] = [];
    const handle = watchFulfilment(
      TESTNET_REQUEST,
      () => undefined,
      (e) => errors.push(e.message),
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(errors).toEqual(["plain string failure"]);
    handle.stop();
  });
});
