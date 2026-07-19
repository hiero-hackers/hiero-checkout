// SPDX-License-Identifier: Apache-2.0
/**
 * The confirmation loop — the page reaches "paid ✓" through the SAME stack
 * the merchant runs, so the two ends cannot disagree:
 *
 *   mirror REST → hiero-receipts fromMirror + receiptFor (net movements,
 *   custom fees already deducted) → payment-requests fromReceipt → match
 *
 * Polling is deduplicated by transaction id here only as a courtesy — the
 * matching pipeline canonicalizes anyway (at-least-once is fine).
 */
import { fromReceipt, match, paymentInstructions } from "@hiero-hackers/hiero-payment-requests";
import type { Fulfilment, Payment, PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { receiptFor } from "@hiero-hackers/hiero-receipts";
import type { Receipt } from "@hiero-hackers/hiero-receipts";
import { fromMirror } from "@hiero-hackers/hiero-receipts/mirror";
import { recentTransactions } from "./mirror.js";

export interface ConfirmUpdate {
  readonly fulfilment: Fulfilment;
  /** Receipts for the payments that contributed — offered for download. */
  readonly receipts: readonly Receipt[];
}

export interface ConfirmHandle {
  stop(): void;
}

const POLL_MS = 5_000;

/** Watch the chain for fulfilment of `request`; `onUpdate` fires after every
 *  poll. Never throws out of the loop — network hiccups surface via `onError`
 *  and the next poll tries again. */
export function watchFulfilment(
  request: PaymentRequest,
  onUpdate: (update: ConfirmUpdate) => void,
  onError: (error: Error) => void,
): ConfirmHandle {
  const { network, recipient } = paymentInstructions(request);
  const payments = new Map<string, { payment: Payment; receipt: Receipt }>();
  let stopped = false;

  const poll = async (): Promise<void> => {
    try {
      for (const tx of await recentTransactions(network, recipient)) {
        if (payments.has(tx.transactionId)) continue;
        const receipt = receiptFor(recipient, fromMirror(tx, { network }));
        payments.set(tx.transactionId, { payment: fromReceipt(receipt, network), receipt });
      }
      const all = [...payments.values()];
      const fulfilment = match(
        request,
        all.map((entry) => entry.payment),
      );
      const contributing =
        "payments" in fulfilment
          ? new Set(fulfilment.payments.map((p) => p.transactionId))
          : new Set<string>();
      onUpdate({
        fulfilment,
        receipts: all
          .filter((entry) => contributing.has(entry.payment.transactionId))
          .map((entry) => entry.receipt),
      });
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
    if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
  };

  let timer = setTimeout(() => void poll(), 0);
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
