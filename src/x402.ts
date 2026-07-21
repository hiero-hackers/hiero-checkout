// SPDX-License-Identifier: Apache-2.0
/**
 * x402 challenges as a payer entry point — now a thin veneer over the
 * library adapter this page's logic was upstreamed into
 * (`hiero-payment-requests` v0.1.3, `fromX402`). What remains HERE is
 * presentation: the card's label, and the parse-order rule that makes
 * pasting and deep-linking behave identically.
 *
 * Three pasteable spellings are recognized (see the adapter's docs): the
 * full 402 body, one requirements object, and the raw base64
 * `payment-required` header an agent actually holds. Anything that isn't
 * x402-shaped keeps the normal `fromAny` diagnosis; something that IS
 * x402-shaped but unusable throws the adapter's own honest reason.
 */
import { fromAny, fromX402 as libraryFromX402 } from "@hiero-hackers/hiero-payment-requests";
import type { PaymentRequest } from "@hiero-hackers/hiero-payment-requests";

/**
 * Every payer entry point's parser: `fromAny` (URIs, links, request JSON)
 * first, then the x402 fallback. One function so pasting and deep-linking
 * behave identically.
 */
export function parseRequest(text: string): PaymentRequest {
  try {
    return fromAny(text);
  } catch (error) {
    const x402 = fromX402(text);
    if (x402 !== undefined) return x402;
    throw error; // not x402-shaped either — the original diagnosis stands
  }
}

/**
 * An x402 challenge as a `PaymentRequest` with this page's presentation
 * label, or undefined when `text` isn't x402-shaped at all.
 */
export function fromX402(text: string): PaymentRequest | undefined {
  const request = libraryFromX402(text);
  if (request === undefined) return undefined;
  return {
    ...request,
    label: request.reference === "x402" ? "x402 payment" : `x402 · ${request.reference}`,
  };
}
