// SPDX-License-Identifier: Apache-2.0
/**
 * The payer's whole journey: the request card, the live watch, the verdicts.
 * Display rules live in shared.ts; the memo is the payment's lifeline (no
 * memo → the merchant can never correlate), so it gets its own copy button
 * and the word "required"; the QR is for the OTHER device — collapsed on
 * narrow screens, open on wide ones.
 */
import {
  paymentInstructions,
  remainderRequest,
  toQRSVG,
  toURI,
} from "@hiero-hackers/hiero-payment-requests";
import type { Fulfilment, PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { toHTML } from "@hiero-hackers/hiero-receipts";
import type { Receipt } from "@hiero-hackers/hiero-receipts";
import { canPayInPage } from "../config.js";
import { isConfigured as walletConfigured, payWithWallet } from "../wallets/walletconnect.js";
import { amountText, app, esc, wireCopy } from "./shared.js";
import type { DisplayContext } from "./shared.js";

/** The request card. Instant to render — no network required. */
export function renderRequest(request: PaymentRequest, display: DisplayContext): void {
  const wallet = paymentInstructions(request);
  const uri = toURI(request);
  // A very long label/reference can exceed QR capacity — the encoder throws
  // (honestly). The CARD must still render: copy + wallet link work anyway.
  let qr: string | undefined;
  try {
    qr = toQRSVG(request);
  } catch {
    qr = undefined;
  }
  const displayId = request.recipient.split(":").pop() ?? wallet.recipient;
  const verified = displayId.includes("-");
  const asset =
    wallet.asset.kind === "hbar"
      ? "HBAR (native)"
      : wallet.asset.kind === "token"
        ? `token ${wallet.asset.id}`
        : `NFT ${wallet.asset.id} · serial ${wallet.asset.serial}`;
  const amount = amountText(request.amount, display);
  const qrOpen = window.matchMedia("(min-width: 640px)").matches;

  app().innerHTML = `
    <div class="card">
      <h1>${esc(request.label ?? "Payment request")}</h1>
      ${
        display.decimals === undefined
          ? `<p class="amount unknown">${esc(amount)}</p>
             <p class="note">of <span class="mono">${esc(asset)}</span> — your wallet will show
             the exact decimal amount before you confirm.</p>`
          : `<p class="amount">${esc(amount)}</p><p class="note" id="fiat" hidden></p>`
      }
      <p class="label">To</p>
      <p class="account">${esc(displayId)}
        <span class="chip">${esc(wallet.network)}</span>
        ${verified ? '<span class="chip ok" translate="no">✓ checksum verified</span>' : ""}
      </p>
      <p class="mono secondary">${esc(request.recipient)}</p>
      ${request.expiresAt !== undefined ? `<p class="note" id="expiry"></p>` : ""}
      <div class="actions" id="pay-actions">
        ${walletConfigured() && canPayInPage(wallet.network) ? '<button class="primary" id="pay-now">Pay now</button>' : ""}
        <a class="button${walletConfigured() && canPayInPage(wallet.network) ? "" : " primary"}" href="${esc(uri)}">Open in wallet</a>
        <button id="copy">Copy request</button>
      </div>
      <p class="note error" id="pay-error" hidden></p>
      ${
        walletConfigured() && !canPayInPage(wallet.network)
          ? `<p class="note">In-page <strong>Pay now</strong> is testnet-only while this is a
             prototype — on ${esc(wallet.network)}, use Copy request or the QR with your own wallet.</p>`
          : ""
      }
      <p class="label">Asset</p>
      <p class="mono">${esc(asset)}</p>
      <p class="label">Memo — <strong>required</strong>, or the merchant can't match your payment</p>
      <p class="mono memo-row">${esc(wallet.memo)} <button class="mini" id="copy-memo">Copy memo</button></p>
      ${
        qr === undefined
          ? `<p class="note">This request is too long for a QR code — use the buttons above.</p>`
          : `<details class="qr-details"${qrOpen ? " open" : ""}>
               <summary>QR for your wallet on another device</summary>
               <div class="qr" role="img" aria-label="payment request QR code">${qr}</div>
             </details>`
      }
      <p class="note">This page can't charge you and never asks for keys or passwords —
      your wallet always confirms. No app for <span class="mono">hiero-pay:</span> yet?
      Use Copy request.</p>
    </div>
    <div class="card">
      <div class="status await" id="status"><span class="dot"></span><span id="status-text">
      Watching ${esc(wallet.network)} for your payment…</span>
      <span class="checked" id="checked"></span></div>
      <p class="note" id="hint" hidden>Sent it? Payments usually appear within seconds.
      Check that the <strong>memo</strong> was included — without it the merchant can't
      match your payment.</p>
      <div id="verdict"></div>
    </div>`;

  wireCopy("copy", uri);
  wireCopy("copy-memo", wallet.memo);
  const payNow = document.getElementById("pay-now") as HTMLButtonElement | null;
  if (payNow) {
    payNow.addEventListener("click", () => {
      void (async () => {
        const original = payNow.textContent;
        const payError = document.getElementById("pay-error")!;
        payNow.disabled = true;
        payError.hidden = true;
        try {
          // The heavy wallet stack (bridge + SDK) loads inside payWithWallet,
          // on the tap — this module itself is light.
          await payWithWallet(request, (text) => (payNow.textContent = text));
          payNow.textContent = "Sent ✓ — watching for confirmation…";
          // The watch loop remains the source of truth for "paid".
        } catch (cause) {
          payNow.disabled = false;
          payNow.textContent = original;
          payError.hidden = false;
          payError.textContent =
            cause instanceof Error && /reject/i.test(cause.message)
              ? "Cancelled in the wallet — nothing was sent."
              : `Wallet connection failed: ${cause instanceof Error ? cause.message : String(cause)}`;
        }
      })();
    });
  }
}

/** Stamp the liveness tick — called after every poll, success or failure. */
export function renderChecked(): void {
  const element = document.getElementById("checked");
  if (element) element.textContent = "· checked just now";
}

/** Age the liveness tick; call on a 1s interval with the last-poll time. */
export function ageChecked(lastPollAt: number): void {
  const element = document.getElementById("checked");
  if (!element || lastPollAt === 0) return;
  const seconds = Math.max(0, Math.round((Date.now() - lastPollAt) / 1000));
  element.textContent = seconds < 2 ? "· checked just now" : `· checked ${seconds}s ago`;
}

/** Keep the expiry line current; call once after renderRequest. */
export function renderExpiry(expiresAt: string): void {
  const element = document.getElementById("expiry");
  if (!element) return;
  const expiry = Number(expiresAt.split(".")[0]) * 1000;
  const update = (): void => {
    if (!element.isConnected) return; // re-rendered — this loop's card is gone
    const left = expiry - Date.now();
    if (left <= 0) {
      element.textContent = "⚠ This request has expired — ask the merchant for a fresh one.";
      element.className = "note expired";
      // The page must not LEAD with paying an expired request: demote the
      // primary action and fold the QR away. (Paying late is still the
      // payer's right — late is a fact, not a verdict.)
      document.querySelector("#pay-actions .primary")?.classList.remove("primary");
      document.querySelector(".qr-details")?.removeAttribute("open");
      return;
    }
    const minutes = Math.floor(left / 60_000);
    const seconds = Math.floor((left % 60_000) / 1000);
    element.textContent = `Expires in ${minutes > 0 ? `${minutes}m ` : ""}${seconds}s`;
    setTimeout(update, 1000);
  };
  update();
}

/** Show the gentle troubleshooting hint (call when watching has gone quiet). */
export function renderWaitingHint(): void {
  const hint = document.getElementById("hint");
  const status = document.getElementById("status");
  if (hint && status?.className.includes("await")) hint.hidden = false;
}

/** Update the live status card as verdicts come in. */
/** HashScan link for a settled payment — third-party proof, or nothing on
 *  networks without an explorer. */
function explorerLink(network: string, consensusTimestamp: string): string | undefined {
  return ["mainnet", "testnet", "previewnet"].includes(network)
    ? `https://hashscan.io/${network}/transaction/${consensusTimestamp}`
    : undefined;
}

export function renderFulfilment(
  request: PaymentRequest,
  fulfilment: Fulfilment,
  display: DisplayContext,
  receipts: readonly Receipt[],
): void {
  const statusBox = document.getElementById("status");
  const text = document.getElementById("status-text");
  const verdict = document.getElementById("verdict");
  const hint = document.getElementById("hint");
  if (!statusBox || !text || !verdict) return;
  if (fulfilment.status !== "unpaid" && fulfilment.status !== "expired" && hint) {
    hint.hidden = true;
  }

  switch (fulfilment.status) {
    case "unpaid":
    case "expired":
      return; // keep the "watching…" pulse; the expiry line tells its own story
    case "underpaid": {
      statusBox.className = "status problem";
      text.textContent = "Partial payment received";
      // The same-reference rule, made scannable: a request for exactly
      // what's left, which accumulates into THIS match.
      let remainderQr = "";
      try {
        const remainder = remainderRequest(request, fulfilment);
        remainderQr = `<details class="qr-details" open>
            <summary>Pay the rest — scan or open</summary>
            <div class="qr small">${toQRSVG(remainder)}</div>
            <div class="actions"><a class="button primary" href="#${esc(toURI(remainder))}">
            Open request for the remainder</a></div>
          </details>`;
      } catch {
        /* QR overflow: the text guidance stands alone */
      }
      verdict.innerHTML =
        `<p class="verdict warn">${esc(amountText(fulfilment.received, display))} received — ` +
        `${esc(amountText(fulfilment.shortfall, display))} still owed</p>` +
        `<p class="note">Send the remainder with the same memo; it counts toward this request.</p>` +
        remainderQr;
      return;
    }
    case "wrong-asset":
      statusBox.className = "status problem";
      text.textContent = "A payment arrived, but in the wrong asset";
      verdict.innerHTML = `<p class="note">Contact the merchant — nothing was credited toward this request.</p>`;
      return;
    case "paid":
    case "overpaid": {
      statusBox.className = "status paid";
      text.textContent = fulfilment.status === "paid" ? "Paid" : "Paid (overpaid)";
      const over =
        fulfilment.status === "overpaid"
          ? `<p class="note">You sent ${esc(amountText(fulfilment.excess, display))} more than asked — the merchant can see it and refund the difference.</p>`
          : "";
      const proofs = fulfilment.payments
        .map((payment) => ({
          payment,
          href: explorerLink(payment.network, payment.consensusTimestamp),
        }))
        .filter((entry) => entry.href !== undefined)
        .map(
          (entry) =>
            `<li><a href="${esc(entry.href!)}" target="_blank" rel="noopener noreferrer">` +
            `${esc(entry.payment.transactionId)}</a></li>`,
        )
        .join("");
      verdict.innerHTML =
        `<p class="verdict good">✓ ${esc(amountText(fulfilment.received, display))} received</p>` +
        over +
        (proofs.length > 0
          ? `<p class="label">On-chain proof (HashScan)</p><ul class="proofs">${proofs}</ul>`
          : "") +
        (receipts.length > 0
          ? `<div class="actions"><button id="receipt">Download receipt</button></div>`
          : "");
      const button = document.getElementById("receipt");
      if (button && receipts.length > 0) {
        button.addEventListener("click", () => downloadReceipt(receipts[receipts.length - 1]!));
      }
      return;
    }
  }
}

function downloadReceipt(receipt: Receipt): void {
  const blob = new Blob([toHTML(receipt)], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `receipt-${receipt.transactionId.replace(/[^0-9a-zA-Z.@-]/g, "_")}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}
