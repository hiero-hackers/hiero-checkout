// SPDX-License-Identifier: Apache-2.0
/**
 * Boot: read the payment request from the URL FRAGMENT (never sent to any
 * server — the privacy property `toLink` was designed around), validate it
 * through the library, render, and start watching the chain.
 *
 * Everything hard lives in the published packages; this file is glue:
 *
 *   fromAny → renderRequest → watchFulfilment → renderFulfilment
 */
import { fromAny, paymentInstructions } from "@hiero-hackers/hiero-payment-requests";
import type { PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { watchFulfilment } from "./confirm.js";
import { tokenDecimals } from "./mirror.js";
import { renderError, renderFulfilment, renderPastePrompt, renderRequest } from "./ui.js";
import type { DisplayContext } from "./ui.js";

async function displayContext(request: PaymentRequest): Promise<DisplayContext> {
  const { network, asset } = paymentInstructions(request);
  if (asset.kind === "hbar") return { decimals: 8, symbol: "ℏ" };
  if (asset.kind === "nft") return { decimals: 0, symbol: "NFT" };
  // Unknown decimals → show base units honestly rather than guess.
  return { decimals: await tokenDecimals(network, asset.id), symbol: asset.id };
}

function present(text: string): void {
  let request: PaymentRequest;
  try {
    request = fromAny(text);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
    return;
  }
  void (async () => {
    const display = await displayContext(request);
    renderRequest(request, display);
    watchFulfilment(
      request,
      ({ fulfilment, receipts }) => renderFulfilment(fulfilment, display, receipts),
      () => {
        /* transient mirror errors: keep polling; the pulse keeps pulsing */
      },
    );
  })();
}

// The fragment is passed RAW: `toLink` put a percent-encoded URI there, and
// pre-decoding it would double-decode parameter values before the strict
// parser sees them. Browsers hand `location.hash` back exactly as written.
const fragment = window.location.hash.slice(1);
if (fragment.length > 0) {
  present(fragment);
} else {
  renderPastePrompt(present);
}
