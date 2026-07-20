// SPDX-License-Identifier: Apache-2.0
/**
 * The view layer's front door — one import site for every screen, organized
 * underneath by WHO is looking:
 *
 *   views/shared.ts    escaping, amount display rules, copy buttons
 *   views/landing.ts   the role chooser (pay / receive / learn)
 *   views/payer.ts     the request card, live watch, verdicts, Pay now
 *   views/invoice.ts   the printable pre-payment document
 *   views/error.ts     the refusal screen
 *
 * Growth seams, named in advance: i18n lands by threading a strings table
 * through these views (receipts' locale pattern); a new screen is a new
 * views/ file re-exported here. Framework-free is a decision, not a gap —
 * one page, a handful of states, no virtual DOM required.
 */
export { renderLanding } from "./views/landing.js";
export { renderError } from "./views/error.js";
export {
  ageChecked,
  renderChecked,
  renderExpiry,
  renderFulfilment,
  renderRequest,
  renderWaitingHint,
} from "./views/payer.js";
export { renderInvoice } from "./views/invoice.js";
export type { DisplayContext } from "./views/shared.js";
