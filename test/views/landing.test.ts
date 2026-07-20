// SPDX-License-Identifier: Apache-2.0
// @vitest-environment happy-dom
/** views/landing.ts — the role chooser, with the paste box folded away. */
import { beforeEach, describe, expect, it } from "vitest";
import { renderLanding } from "../../src/ui.js";

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
});

describe("the landing page is a role chooser", () => {
  it("both roles visible, both paths one interaction away", () => {
    renderLanding(() => undefined);
    const headings = [...document.querySelectorAll(".role h2")].map((h) => h.textContent);
    expect(headings).toEqual(["Pay", "Receive"]);
    expect(document.querySelector('a[href="#create"]')).not.toBeNull();
    expect(document.querySelector('a[href="#tour"]')).not.toBeNull();
    expect(document.getElementById("demo")).not.toBeNull();
    // The textarea exists only inside its details fold — never the hero.
    expect(document.querySelector("details #paste")).not.toBeNull();
  });

  it("the folded paste box submits only non-empty input", () => {
    let submitted: string | undefined;
    renderLanding((text) => (submitted = text));
    (document.getElementById("paste") as HTMLTextAreaElement).value = "   ";
    (document.getElementById("go") as HTMLButtonElement).click();
    expect(submitted).toBeUndefined();
    (document.getElementById("paste") as HTMLTextAreaElement).value = "hiero-pay:x";
    (document.getElementById("go") as HTMLButtonElement).click();
    expect(submitted).toBe("hiero-pay:x");
  });
});
