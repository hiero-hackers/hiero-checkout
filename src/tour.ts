// SPDX-License-Identifier: Apache-2.0
/**
 * The walkthrough (`#tour`): the full lifecycle in twenty seconds with
 * SIMULATED payments — request → partial payment (remainder QR) → settled
 * with excess → proof links and receipt. Everything except the data source
 * is the production code path: real `match`, real renderers, real receipts —
 * the same honesty trick the library's own `fulfilment-states` example uses.
 * Nothing touches a network; the banner says so the whole time.
 */
import { match } from "@hiero-hackers/hiero-payment-requests";
import type { Payment, PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { receiptFor } from "@hiero-hackers/hiero-receipts";
import type { Receipt } from "@hiero-hackers/hiero-receipts";
import { fromMirror } from "@hiero-hackers/hiero-receipts/mirror";
import { renderFulfilment, renderRequest } from "./ui.js";
import type { DisplayContext } from "./ui.js";

const REQUEST: PaymentRequest = {
  recipient: "hedera:mainnet:0.0.1234-pikcw",
  asset: "hedera:mainnet/token:0.0.720",
  amount: 100_000000n,
  reference: "INV-2026-041",
  label: "Workshop ticket (simulated)",
};
const DISPLAY: DisplayContext = { decimals: 6, symbol: "USDC" };

/** A simulated transfer: payer → 0.0.1234, memo carried, fee charged. */
function simulatedPayment(amount: bigint, at: string): { payment: Payment; receipt: Receipt } {
  const seconds = at.split(".")[0]!;
  const receipt = receiptFor(
    "0.0.1234",
    fromMirror(
      {
        transactionId: `0.0.9-${seconds}-000000000`,
        name: "CRYPTOTRANSFER",
        result: "SUCCESS",
        consensusTimestamp: at,
        chargedTxFee: 76522,
        memo: "INV-2026-041",
        transfers: [
          { accountId: "0.0.9", amount: -76522 },
          { accountId: "0.0.98", amount: 76522 },
        ],
        tokenTransfers: [
          { tokenId: "0.0.720", accountId: "0.0.9", amount: -Number(amount) },
          { tokenId: "0.0.720", accountId: "0.0.1234", amount: Number(amount) },
        ],
      },
      { network: "mainnet" },
    ),
  );
  return {
    payment: {
      transactionId: `0.0.9-${seconds}-000000000`,
      consensusTimestamp: at,
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
    },
    receipt,
  };
}

export interface TourStep {
  readonly caption: string;
  readonly payments: readonly ReturnType<typeof simulatedPayment>[];
}

/** The script, pure and testable: what arrives, and what the payer sees. */
export function tourSteps(): TourStep[] {
  const first = simulatedPayment(60_000000n, "1783012000.000000000");
  const second = simulatedPayment(49_500000n, "1783012090.000000000");
  return [
    { caption: "1/3 · The payer opens the request — nothing has been paid yet.", payments: [] },
    {
      caption:
        "2/3 · A partial payment (60 USDC) arrives. The page offers a QR for exactly what's left — same reference, so it counts toward THIS request.",
      payments: [first],
    },
    {
      caption:
        "3/3 · The rest arrives (plus a little extra). Settled: on-chain proof links, the excess noted for refund, and a downloadable receipt.",
      payments: [first, second],
    },
  ];
}

const STEP_MS = 6000;

export function runTour(): void {
  const steps = tourSteps();
  const banner = document.createElement("div");
  banner.className = "demo-banner";
  document.body.prepend(banner);

  let index = 0;
  const play = (): void => {
    const step = steps[index]!;
    banner.textContent = `SIMULATED WALKTHROUGH — nothing on chain. ${step.caption}`;
    renderRequest(REQUEST, DISPLAY);
    const fulfilment = match(
      REQUEST,
      step.payments.map((entry) => entry.payment),
    );
    renderFulfilment(
      REQUEST,
      fulfilment,
      DISPLAY,
      step.payments.map((entry) => entry.receipt),
    );
    index += 1;
    if (index < steps.length) setTimeout(play, STEP_MS);
    else {
      const done = document.createElement("div");
      done.className = "actions";
      done.innerHTML = `<a class="button primary" href="${window.location.pathname}">Done — try it for real</a>
        <button id="tour-replay">Replay</button>`;
      document.getElementById("app")?.append(done);
      // Same-hash links don't navigate; a real reload restarts the tour.
      // (And no inline handlers — the CSP keeps scripts to 'self'.)
      document.getElementById("tour-replay")?.addEventListener("click", () => {
        window.location.reload();
      });
    }
  };
  play();
}
