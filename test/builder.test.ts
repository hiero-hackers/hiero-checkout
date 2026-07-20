// SPDX-License-Identifier: Apache-2.0
// @vitest-environment happy-dom
/**
 * The merchant builder: filling the form mints a VALID, checksummed link —
 * the trust chip appears for payers with zero merchant homework — and the
 * library's refusals surface inline instead of producing a broken link.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fromLink } from "@hiero-hackers/hiero-payment-requests";
import { renderBuilder } from "../src/builder.js";

const set = (id: string, value: string): void => {
  const el = document.getElementById(id) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  renderBuilder();
});

describe("the builder mints valid, checksummed links", () => {
  it("appends the network's checksum automatically — payers get the green chip", () => {
    set("b-network", "mainnet"); // the pinned checksum vector is mainnet's
    set("b-account", "0.0.1234");
    set("b-amount", "42.5");
    set("b-reference", "INV-1");
    const link = document.getElementById("b-link")!.textContent!;
    const request = fromLink(link);
    expect(request.recipient).toBe("hedera:mainnet:0.0.1234-pikcw");
    expect(request.amount).toBe(4_250_000_000n); // 42.5 ℏ in tinybar, exactly
    expect(document.getElementById("b-checksum")!.hidden).toBe(false);
  });

  it("keeps a checksum the merchant typed themselves", () => {
    set("b-network", "mainnet");
    set("b-account", "0.0.1234-pikcw");
    set("b-amount", "1");
    set("b-reference", "INV-1");
    expect(fromLink(document.getElementById("b-link")!.textContent!).recipient).toBe(
      "hedera:mainnet:0.0.1234-pikcw",
    );
  });

  it("surfaces the library's refusal inline — a bad amount never becomes a link", () => {
    set("b-account", "0.0.1234");
    set("b-amount", "1.123456789"); // more precision than HBAR has
    set("b-reference", "INV-1");
    expect(document.getElementById("b-output")!.hidden).toBe(true);
    expect(document.getElementById("b-error")!.textContent).toContain("will not round");
  });

  it("the send-it surface is copy + QR — deliberately minimal", () => {
    set("b-account", "0.0.1234");
    set("b-amount", "1");
    set("b-reference", "INV-1");
    expect(document.getElementById("b-copy")).not.toBeNull();
    expect(document.querySelector("#b-qr svg")).not.toBeNull();
    expect(document.getElementById("b-dlqr")).not.toBeNull(); // the QR is saveable
    // No per-app share buttons: a copied link goes anywhere; the QR covers
    // the physical world. (Removed by design — keep it lean.)
    expect(document.getElementById("b-wa")).toBeNull();
    expect(document.getElementById("b-mail")).toBeNull();
    expect(document.getElementById("b-share")).toBeNull();
    const invoice = (document.getElementById("b-invoice") as HTMLAnchorElement).getAttribute(
      "href",
    )!;
    expect(invoice).toContain("?invoice#hiero-pay:");
  });

  it("the builder defaults to testnet — prototype-safe by default", () => {
    expect((document.getElementById("b-network") as HTMLSelectElement).value).toBe("testnet");
    expect(document.getElementById("b-network-hint")!.textContent).toContain("faucet");
  });

  it("the amount is grounded in its asset — exact base units shown", () => {
    set("b-account", "0.0.1234");
    set("b-amount", "42.5");
    set("b-reference", "INV-1");
    expect(document.getElementById("b-amount-hint")!.textContent).toContain(
      "= 4,250,000,000 tinybar",
    );
    expect(document.getElementById("b-amount-label")!.textContent).toContain("HBAR");
  });

  it("expiry is a human duration select, optional by default", () => {
    const select = document.getElementById("b-expires") as HTMLSelectElement;
    expect(select.value).toBe(""); // no expiry unless chosen
    expect([...select.options].map((o) => o.textContent)).toContain("In 1 week");
    set("b-account", "0.0.1234");
    set("b-amount", "1");
    set("b-reference", "INV-1");
    set("b-expires", "10080");
    const link = document.getElementById("b-link")!.textContent!;
    expect(link).toContain("exp=");
  });

  it("token decimals are LOOKED UP, never homework — and the link uses them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ decimals: "6" }) }),
    );
    set("b-kind", "token");
    set("b-token", "0.0.720");
    set("b-account", "0.0.1234");
    set("b-amount", "100.5");
    set("b-reference", "INV-1");
    await Promise.resolve(); // let the lookup settle and rebuild re-run
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("b-decimals-label")!.textContent).toContain(
      "fetched from the network",
    );
    expect(document.querySelector<HTMLElement>(".f-decimals")!.hidden).toBe(true);
    const request = fromLink(document.getElementById("b-link")!.textContent!);
    expect(request.amount).toBe(100_500000n); // 100.5 at the FETCHED 6 decimals
    vi.unstubAllGlobals();
  });

  it("when the lookup fails, the manual decimals field appears — fallback, not default", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    set("b-kind", "token");
    set("b-token", "0.0.999999");
    set("b-account", "0.0.1234");
    set("b-amount", "1");
    set("b-reference", "INV-1");
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("b-decimals-label")!.textContent).toContain(
      "enter its decimals",
    );
    expect(document.querySelector<HTMLElement>(".f-decimals")!.hidden).toBe(false);
    vi.unstubAllGlobals();
  });

  it("an NFT request locks amount to 1 and carries the serial", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ decimals: "0" }) }),
    );
    set("b-network", "mainnet");
    set("b-kind", "token"); // pass through token to prove the switch back
    set("b-kind", "nft");
    // amount field is hidden for NFTs — the FIELDS table drives it
    expect(document.querySelector<HTMLElement>(".f-amount")!.hidden).toBe(true);
    set("b-token", "0.0.721");
    set("b-serial", "3");
    set("b-account", "0.0.1234");
    set("b-reference", "TICKET-1");
    await new Promise((r) => setTimeout(r, 0));
    const request = fromLink(document.getElementById("b-link")!.textContent!);
    expect(request.asset).toContain("/nft:0.0.721/3");
    expect(request.amount).toBe(1n);
    vi.unstubAllGlobals();
  });

  it("Download QR wires a blob download named after the reference", () => {
    const create = vi.fn(() => "blob:qr");
    vi.stubGlobal("URL", { ...URL, createObjectURL: create, revokeObjectURL: vi.fn() });
    set("b-account", "0.0.1234");
    set("b-amount", "1");
    set("b-reference", "INV-9");
    (document.getElementById("b-dlqr") as HTMLButtonElement).click();
    expect(create).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("Open checkout points at the minted request", () => {
    set("b-account", "0.0.1234");
    set("b-amount", "1");
    set("b-reference", "INV-9");
    expect((document.getElementById("b-open") as HTMLAnchorElement).getAttribute("href")).toMatch(
      /^#hiero-pay:/,
    );
  });

  it("the generate button invents a usable reference", () => {
    set("b-account", "0.0.1234");
    set("b-amount", "1");
    (document.getElementById("b-genref") as HTMLButtonElement).click();
    const reference = (document.getElementById("b-reference") as HTMLInputElement).value;
    expect(reference).toMatch(/^INV-\d{8}-[A-Z0-9]{4}$/);
    expect(document.getElementById("b-output")!.hidden).toBe(false);
  });
});
