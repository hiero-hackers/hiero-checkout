// SPDX-License-Identifier: Apache-2.0
/**
 * What every view shares: the mount point, escaping, and the display rules
 * argued once —
 * - The HERO number is only ever a verified decimal rendering. Unknown token
 *   decimals demote the amount to grouped base units with a plain-words
 *   explanation — a payer shown a giant raw integer closes the tab.
 * - Everything rendered is derived from the PARSED request (never echoed
 *   from raw input), and every interpolation goes through `esc`.
 */
import { formatBaseUnits } from "@hiero-hackers/hiero-payment-requests";

export const app = (): HTMLElement => document.getElementById("app")!;

export const esc = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Digit grouping for display — locale-fixed so tests and payers agree. */
export const group = (digits: string): string => BigInt(digits).toLocaleString("en-US");

export interface DisplayContext {
  /** Token decimals when known; undefined → grouped base units, demoted. */
  readonly decimals?: number;
  readonly symbol: string;
}

export const amountText = (amount: bigint, display: DisplayContext): string => {
  if (display.decimals === undefined) return `${group(amount.toString())} base units`;
  const text = formatBaseUnits(amount, display.decimals, { trim: true });
  const [whole, fraction] = text.split(".");
  return `${group(whole!)}${fraction !== undefined ? `.${fraction}` : ""} ${display.symbol}`;
};

/** Wire a copy button: writes `text`, confirms visibly, reverts. */
export function wireCopy(id: string, text: string): void {
  const button = document.getElementById(id);
  if (!button) return;
  const label = button.textContent;
  button.addEventListener("click", () => {
    void navigator.clipboard.writeText(text).then(() => {
      button.textContent = "Copied ✓";
      setTimeout(() => (button.textContent = label), 1500);
    });
  });
}
