// SPDX-License-Identifier: Apache-2.0
// @vitest-environment happy-dom
/** views/invoice.ts — the printable pre-payment document. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderInvoice } from "../../src/ui.js";
import { MAINNET_REQUEST as BASE, USDC_DISPLAY as DISPLAY } from "../helpers.js";

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
});

describe("the invoice view", () => {
  it("number = reference, payee with chip, memo instruction, QR, print", () => {
    renderInvoice({ ...BASE, recipient: "hedera:mainnet:0.0.1234-pikcw" }, DISPLAY);
    expect(document.body.textContent).toContain("Invoice");
    expect(document.body.textContent).toContain("INV-2026-041");
    expect(document.body.textContent).toContain("0.0.1234-pikcw");
    expect(document.querySelector(".chip.ok")).not.toBeNull();
    expect(document.body.textContent).toContain("include it with your transfer");
    expect(document.querySelector(".qr svg")).not.toBeNull();
    expect(document.getElementById("inv-print")).not.toBeNull();
  });

  it("the Print button prints", () => {
    renderInvoice(BASE, DISPLAY);
    const print = vi.fn();
    vi.stubGlobal("print", print);
    try {
      document.getElementById("inv-print")!.click();
      expect(print).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
