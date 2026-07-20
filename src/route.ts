// SPDX-License-Identifier: Apache-2.0
/**
 * The page's routing, as a pure function — boot() applies it, tests exercise
 * it. Routes are deliberately few: growth means a new named fragment here,
 * not a router library.
 */
export type Route = "builder" | "tour" | "invoice" | "payer" | "landing";

export function route(fragment: string, invoiceQuery: boolean): Route {
  if (fragment === "create") return "builder";
  if (fragment === "tour") return "tour";
  if (fragment.length > 0) return invoiceQuery ? "invoice" : "payer";
  return "landing";
}
