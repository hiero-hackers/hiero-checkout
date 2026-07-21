// SPDX-License-Identifier: Apache-2.0
/**
 * x402 challenges as a payer entry point — the bridge between the agent
 * economy and this human-facing page.
 *
 * An x402 resource server answers HTTP 402 with payment terms (scheme,
 * network, asset, amount, payTo — the official Hedera scheme wires bare ids
 * and atomic amounts, exactly this stack's conventions). Paste those terms
 * here and they become a normal, VALIDATED payment card: the agent's own
 * challenge, payable by a person. Three pasteable spellings are recognized:
 *
 *   1. the full 402 body        {"x402Version":2,"accepts":[…]}
 *   2. one requirements object  {"scheme":"exact","network":"hedera:…",…}
 *   3. the raw base64 `payment-required` HEADER value (what an agent
 *      actually holds) — decoded, then read as (1)
 *
 * Anything that isn't x402-shaped returns undefined so the caller's normal
 * error stands; something that IS x402-shaped but unusable throws its own
 * honest reason (wrong scheme, foreign network, bad amount) — a payer
 * deserves better than "not a hiero-pay URI" for a real challenge.
 */
import { createRequest, fromAny } from "@hiero-hackers/hiero-payment-requests";
import type { PaymentRequest } from "@hiero-hackers/hiero-payment-requests";

/** The subset of x402 `PaymentRequirements` this page reads (structural). */
interface RequirementsLike {
  readonly scheme?: unknown;
  readonly network?: unknown;
  readonly asset?: unknown;
  readonly amount?: unknown;
  readonly maxAmountRequired?: unknown; // v1 spelling
  readonly payTo?: unknown;
}

const ENTITY_ID = /^\d+\.\d+\.\d+$/;
/** The official Hedera scheme's sentinel for native HBAR. */
const HBAR_ASSET = "0.0.0";

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
 * An x402 challenge as a `PaymentRequest`, or undefined when `text` isn't
 * x402-shaped at all. Runs the full `createRequest` validation before
 * returning — what renders is what was verified, same as every other entry.
 */
export function fromX402(text: string): PaymentRequest | undefined {
  const parsed = candidateJson(text.trim());
  if (parsed === null || typeof parsed !== "object") return undefined;

  const body = parsed as { accepts?: unknown; resource?: { url?: unknown } };
  const options: unknown[] = Array.isArray(body.accepts) ? body.accepts : [parsed];
  const looksLikeRequirements = (option: unknown): option is RequirementsLike =>
    typeof option === "object" &&
    option !== null &&
    "scheme" in option &&
    "payTo" in option &&
    "asset" in option;
  const candidates = options.filter(looksLikeRequirements);
  if (candidates.length === 0) return undefined;

  const usable = candidates.find(
    (option) => option.scheme === "exact" && String(option.network).startsWith("hedera:"),
  );
  if (usable === undefined) {
    throw new Error(
      "this x402 challenge offers no payment option this page can render " +
        '(needs scheme "exact" on a hedera:* network)',
    );
  }

  const network = String(usable.network);
  const payTo = String(usable.payTo);
  const asset = String(usable.asset);
  const amount = String(usable.amount ?? usable.maxAmountRequired);
  if (!ENTITY_ID.test(payTo)) {
    throw new Error(`x402 payTo must be a bare Hedera account id (got "${payTo}")`);
  }
  if (asset !== HBAR_ASSET && !ENTITY_ID.test(asset)) {
    throw new Error(`x402 asset must be "${HBAR_ASSET}" (HBAR) or a token id (got "${asset}")`);
  }
  if (!/^\d+$/.test(amount)) {
    throw new Error(`x402 amount must be an integer string in atomic units (got "${amount}")`);
  }

  const resourceUrl = typeof body.resource?.url === "string" ? body.resource.url : undefined;
  const request: PaymentRequest = {
    recipient: `${network}:${payTo}`,
    asset: asset === HBAR_ASSET ? `${network}/slip44:3030` : `${network}/token:${asset}`,
    amount: BigInt(amount),
    reference: resourceUrl ?? "x402",
    label: resourceUrl === undefined ? "x402 payment" : `x402 · ${resourceUrl}`,
  };
  createRequest(request); // full validation — throws with its own honest reason
  return request;
}

/** Direct JSON, or the base64 header value decoded then parsed; else undefined. */
function candidateJson(text: string): unknown {
  for (const attempt of [text, base64Decoded(text)]) {
    if (attempt === undefined) continue;
    try {
      return JSON.parse(attempt);
    } catch {
      /* not this spelling — try the next */
    }
  }
  return undefined;
}

function base64Decoded(text: string): string | undefined {
  if (!/^[A-Za-z0-9+/]+=*$/.test(text) || text.length < 16) return undefined;
  try {
    return atob(text);
  } catch {
    return undefined;
  }
}
