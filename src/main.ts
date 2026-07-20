// SPDX-License-Identifier: Apache-2.0
/**
 * Boot: read the payment request from the URL FRAGMENT (never sent to any
 * server — the privacy property `toLink` was designed around), validate it
 * through the library, render, and start watching the chain.
 *
 * First paint is NETWORK-FREE: the card renders immediately from the parsed
 * request (base units if need be), then upgrades in place once the token's
 * decimals arrive. A payer who just scanned a QR never stares at a blank
 * page because a mirror request is round-tripping.
 */
import { fromAny, paymentInstructions } from "@hiero-hackers/hiero-payment-requests";
import type { PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { renderBuilder } from "./builder.js";
import { watchFulfilment } from "./confirm.js";
import { tokenDecimals, usdEstimateCents } from "./mirror.js";
import { route } from "./route.js";
import { runTour } from "./tour.js";
import {
  ageChecked,
  renderChecked,
  renderError,
  renderInvoice,
  renderExpiry,
  renderFulfilment,
  renderLanding,
  renderRequest,
  renderWaitingHint,
} from "./ui.js";
import type { DisplayContext } from "./ui.js";

const HINT_AFTER_MS = 60_000;

function provisionalDisplay(request: PaymentRequest): DisplayContext {
  const { asset } = paymentInstructions(request);
  if (asset.kind === "hbar") return { decimals: 8, symbol: "ℏ" };
  if (asset.kind === "nft") return { decimals: 0, symbol: "NFT" };
  return { symbol: asset.id }; // token decimals unknown until the mirror answers
}

function present(text: string): void {
  let request: PaymentRequest;
  try {
    request = fromAny(text);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
    return;
  }

  // 1. Paint NOW, from what we already know.
  let display = provisionalDisplay(request);
  renderRequest(request, display);
  if (request.expiresAt !== undefined) renderExpiry(request.expiresAt);
  setTimeout(renderWaitingHint, HINT_AFTER_MS);

  // 2. Upgrade the amount in place when decimals arrive (tokens only).
  const { network, asset } = paymentInstructions(request);
  if (asset.kind === "token") {
    void tokenDecimals(network, asset.id).then((decimals) => {
      if (decimals === undefined) return;
      display = { decimals, symbol: asset.id };
      renderRequest(request, display);
      if (request.expiresAt !== undefined) renderExpiry(request.expiresAt);
      setTimeout(renderWaitingHint, HINT_AFTER_MS);
    });
  }

  // 2b. An honest fiat estimate for HBAR, from the network's own rate.
  if (asset.kind === "hbar") {
    void usdEstimateCents(network, request.amount).then((cents) => {
      const element = document.getElementById("fiat");
      if (cents === undefined || !element) return;
      element.hidden = false;
      const dollars = `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
      element.textContent = `≈ $${dollars} · network rate, approximate`;
    });
  }

  // 3. Watch the chain; verdicts render with whatever display is current.
  let lastPollAt = 0;
  setInterval(() => ageChecked(lastPollAt), 1000);
  watchFulfilment(
    request,
    ({ fulfilment, receipts }) => {
      lastPollAt = Date.now();
      renderChecked();
      renderFulfilment(request, fulfilment, display, receipts);
    },
    () => {
      // Transient mirror errors: keep polling — but the tick still counts
      // as a check, so the page never looks hung.
      lastPollAt = Date.now();
      renderChecked();
    },
  );
}

// The fragment is passed RAW: `toLink` put a percent-encoded URI there, and
// pre-decoding it would double-decode parameter values before the strict
// parser sees them. Browsers hand `location.hash` back exactly as written.
function presentInvoice(text: string): void {
  let request: PaymentRequest;
  try {
    request = fromAny(text);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
    return;
  }
  let display = provisionalDisplay(request);
  renderInvoice(request, display);
  const { network, asset } = paymentInstructions(request);
  if (asset.kind === "token") {
    void tokenDecimals(network, asset.id).then((decimals) => {
      if (decimals === undefined) return;
      display = { decimals, symbol: asset.id };
      renderInvoice(request, display);
    });
  }
}

function boot(): void {
  const fragment = window.location.hash.slice(1);
  const target = route(fragment, new URLSearchParams(window.location.search).has("invoice"));
  if (target === "builder") renderBuilder();
  else if (target === "tour") runTour();
  else if (target === "invoice") presentInvoice(fragment);
  else if (target === "payer") present(fragment);
  else renderLanding(present);
}

// In-page links change only the hash ("#create", a remainder request, the
// builder's "Open checkout") — reboot cleanly rather than juggling state.
window.addEventListener("hashchange", () => window.location.reload());
boot();
