// SPDX-License-Identifier: Apache-2.0
import { paymentInstructions, toQRSVG, toURI } from "@hiero-hackers/hiero-payment-requests";
import type { PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { amountText, app, esc } from "./shared.js";
import type { DisplayContext } from "./shared.js";

/**
 * The INVOICE view — the pre-payment document, printable. Same validated
 * request, rendered as paper: number (the reference), dates, payee with
 * checksum, amount, QR, and how to pay. The receipt (hiero-receipts) is this
 * document's post-payment mirror image.
 */
export function renderInvoice(request: PaymentRequest, display: DisplayContext): void {
  const wallet = paymentInstructions(request);
  const uri = toURI(request);
  let qr = "";
  try {
    qr = toQRSVG(request);
  } catch {
    /* too long for a QR — the link line still works */
  }
  const displayId = request.recipient.split(":").pop() ?? wallet.recipient;
  const expires =
    request.expiresAt === undefined
      ? ""
      : new Date(Number(request.expiresAt.split(".")[0]) * 1000).toISOString().slice(0, 10);
  app().innerHTML = `
    <p class="brand no-print"><a href="./">← Hiero Checkout</a></p>
    <div class="card invoice">
      <div class="inv-head">
        <h1>Invoice</h1>
        <span class="mono">${esc(wallet.memo)}</span>
      </div>
      <div class="inv-meta">
        <span>Issued ${new Date().toISOString().slice(0, 10)}</span>
        ${expires === "" ? "" : `<span>Valid until ${esc(expires)}</span>`}
        <span>${esc(wallet.network)}</span>
      </div>
      ${request.label === undefined ? "" : `<p>${esc(request.label)}</p>`}
      <p class="amount">${esc(amountText(request.amount, display))}</p>
      <p class="label">Pay to</p>
      <p class="account">${esc(displayId)}
        ${displayId.includes("-") ? '<span class="chip ok" translate="no">✓ checksum verified</span>' : ""}
      </p>
      <p class="label">Memo — include it with your transfer, exactly</p>
      <p class="mono">${esc(wallet.memo)}</p>
      <p class="label">How to pay</p>
      <p class="note">Scan the code with a Hedera wallet, or open the link on your device.</p>
      ${qr === "" ? "" : `<div class="qr">${qr}</div>`}
      <p class="mono secondary">${esc(uri)}</p>
      <div class="actions no-print">
        <button class="primary" id="inv-print">Print</button>
        <a class="button" href="${esc(`${window.location.pathname}#${uri}`)}">Open checkout</a>
      </div>
    </div>`;
  document.getElementById("inv-print")!.addEventListener("click", () => window.print());
}
