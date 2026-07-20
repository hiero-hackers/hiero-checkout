// SPDX-License-Identifier: Apache-2.0
// @vitest-environment happy-dom
/**
 * The UI inventory, pinned. Every view is rendered and its complete set of
 * interactive controls (buttons + identified links) is asserted EXACTLY —
 * so adding a control breaks this test until it's inventoried here, and the
 * red diff is the prompt to add an interaction test beside it in
 * interactions.test.ts. "Did we test every button?" becomes a question CI
 * answers instead of a hope.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { renderBuilder } from "../src/builder.js";
import { renderError, renderInvoice, renderLanding, renderRequest } from "../src/ui.js";

const controls = (): string[] =>
  [...document.querySelectorAll("button[id], a.button[href], textarea[id]")]
    .map((el) => {
      if (el.id !== "") return el.id;
      const href = el.getAttribute("href")!;
      // Unlabeled action links, normalized so the inventory stays stable:
      if (href.startsWith("hiero-pay:")) return "a:open-in-wallet";
      if (href.includes("#hiero-pay")) return "a:open-checkout";
      return href; // named routes like #create keep their own names
    })
    .sort();

const TESTNET = {
  recipient: "hedera:testnet:0.0.2",
  asset: "hedera:testnet/slip44:3030",
  amount: 500_000_000n,
  reference: "INV-1",
} as const;
const DISPLAY = { decimals: 8, symbol: "ℏ" } as const;

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
});

describe("the complete control inventory, per view", () => {
  it("landing", () => {
    renderLanding(() => undefined);
    expect(controls()).toEqual(["#create", "demo", "go", "paste"]);
  });

  it("payer card (testnet: Pay now present)", () => {
    renderRequest(TESTNET, DISPLAY);
    expect(controls()).toEqual(["a:open-in-wallet", "copy", "copy-memo", "pay-now"]);
  });

  it("payer card (mainnet: no in-page payment)", () => {
    renderRequest(
      { ...TESTNET, recipient: "hedera:mainnet:0.0.2", asset: "hedera:mainnet/slip44:3030" },
      DISPLAY,
    );
    expect(controls()).toEqual(["a:open-in-wallet", "copy", "copy-memo"]);
  });

  it("invoice", () => {
    renderInvoice(TESTNET, DISPLAY);
    expect(controls()).toEqual(["a:open-checkout", "inv-print"]);
  });

  it("error", () => {
    renderError("nope");
    expect(controls()).toEqual([]);
  });

  it("builder (with output)", () => {
    renderBuilder();
    const set = (id: string, v: string): void => {
      const el = document.getElementById(id) as HTMLInputElement;
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("b-account", "0.0.1234");
    set("b-amount", "1");
    set("b-reference", "INV-1");
    expect(controls()).toEqual(["b-copy", "b-dlqr", "b-genref", "b-invoice", "b-open"]);
  });
});
