// SPDX-License-Identifier: Apache-2.0
/**
 * DOM rendering — deliberately framework-free. One screen, four states
 * (invalid / presented / awaiting / settled); fifty lines of DOM updates do
 * not need a virtual one. Everything shown is derived from the PARSED
 * request via the library (never echoed from raw input), so what the payer
 * sees is what was validated — checksums included.
 */
import {
  formatBaseUnits,
  paymentInstructions,
  toQRSVG,
  toURI,
} from "@hiero-hackers/hiero-payment-requests";
import type { Fulfilment, PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { toHTML } from "@hiero-hackers/hiero-receipts";
import type { Receipt } from "@hiero-hackers/hiero-receipts";

const app = (): HTMLElement => document.getElementById("app")!;

const esc = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface DisplayContext {
  /** Token decimals when known; undefined → show base units, say so. */
  readonly decimals?: number;
  readonly symbol: string;
}

const amountText = (amount: bigint, display: DisplayContext): string =>
  display.decimals === undefined
    ? `${amount} base units`
    : `${formatBaseUnits(amount, display.decimals, { trim: true })} ${display.symbol}`;

/** The landing screen when the page has no fragment: paste or scan. */
export function renderPastePrompt(onSubmit: (text: string) => void): void {
  app().innerHTML = `
    <div class="card">
      <h1>Hiero Checkout</h1>
      <p class="note">Open a payment link, or paste a request — a
      <span class="mono">hiero-pay:</span> URI, an https payment link, or its JSON form.</p>
      <textarea id="paste" placeholder="hiero-pay:hedera:mainnet:0.0…" aria-label="payment request"></textarea>
      <div class="actions"><button class="primary" id="go">Review request</button></div>
    </div>`;
  document.getElementById("go")!.addEventListener("click", () => {
    const text = (document.getElementById("paste") as HTMLTextAreaElement).value;
    if (text.trim().length > 0) onSubmit(text);
  });
}

export function renderError(message: string): void {
  app().innerHTML = `
    <div class="card">
      <h1>Not a payment request</h1>
      <p class="error">${esc(message)}</p>
      <p class="note">Nothing was charged. Ask the merchant for a fresh link — this page
      refuses anything it cannot verify, rather than guessing.</p>
    </div>`;
}

/** The request card: who, what, how much — plus the QR for cross-device. */
export function renderRequest(request: PaymentRequest, display: DisplayContext): void {
  const wallet = paymentInstructions(request);
  const uri = toURI(request);
  const asset =
    wallet.asset.kind === "hbar"
      ? "HBAR (native)"
      : wallet.asset.kind === "token"
        ? `token ${wallet.asset.id}`
        : `NFT ${wallet.asset.id} · serial ${wallet.asset.serial}`;
  app().innerHTML = `
    <div class="card">
      <h1>${esc(request.label ?? "Payment request")}</h1>
      <p class="amount">${esc(amountText(request.amount, display))}</p>
      <p class="label">To</p>
      <p class="mono">${esc(request.recipient)} <span class="checksum">✓ checksum verified</span></p>
      <p class="label">Asset</p>
      <p class="mono">${esc(asset)} · ${esc(wallet.network)}</p>
      <p class="label">Reference (goes in your transfer memo)</p>
      <p class="mono">${esc(wallet.memo)}</p>
      <div class="qr" role="img" aria-label="payment request QR code">${toQRSVG(request)}</div>
      <div class="actions">
        <a class="button primary" href="${esc(uri)}">Open in wallet</a>
        <button id="copy">Copy request</button>
      </div>
      <p class="note">No wallet app installed for <span class="mono">hiero-pay:</span> yet?
      Copy the request, or scan the code from your wallet on another device.</p>
    </div>
    <div class="card">
      <div class="status await" id="status"><span class="dot"></span><span id="status-text">
      Watching ${esc(wallet.network)} for your payment…</span></div>
      <div id="verdict"></div>
    </div>`;
  document.getElementById("copy")!.addEventListener("click", () => {
    void navigator.clipboard.writeText(uri);
  });
}

/** Update the live status card as verdicts come in. */
export function renderFulfilment(
  fulfilment: Fulfilment,
  display: DisplayContext,
  receipts: readonly Receipt[],
): void {
  const statusBox = document.getElementById("status");
  const text = document.getElementById("status-text");
  const verdict = document.getElementById("verdict");
  if (!statusBox || !text || !verdict) return;

  switch (fulfilment.status) {
    case "unpaid":
    case "expired":
      return; // keep the "watching…" pulse
    case "underpaid": {
      statusBox.className = "status problem";
      text.textContent = "Partial payment received";
      verdict.innerHTML =
        `<p class="verdict warn">${esc(amountText(fulfilment.received, display))} received — ` +
        `${esc(amountText(fulfilment.shortfall, display))} still owed</p>` +
        `<p class="note">Send the remainder with the same memo; it counts toward this request.</p>`;
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
      verdict.innerHTML =
        `<p class="verdict good">✓ ${esc(amountText(fulfilment.received, display))} received</p>` +
        over +
        (receipts.length > 0 ? `<div class="actions"><button id="receipt">Download receipt</button></div>` : "");
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
