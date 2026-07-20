// SPDX-License-Identifier: Apache-2.0
// @vitest-environment happy-dom
/** views/error.ts — the refusal screen defangs whatever it's shown. */
import { beforeEach, describe, expect, it } from "vitest";
import { renderError } from "../../src/ui.js";

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
});

describe("the error view", () => {
  it("a hostile message cannot inject, and the detail is folded", () => {
    const HOSTILE = '<img src=x onerror="window.__pwned=1">';
    renderError(HOSTILE);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector(".error")?.textContent).toContain("<img");
    expect(document.querySelector("details.tech")).not.toBeNull();
    expect(document.body.textContent).toContain("Nothing was charged");
  });
});
