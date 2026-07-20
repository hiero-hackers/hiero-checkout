// SPDX-License-Identifier: Apache-2.0
/** The routing table, pinned — boot() applies exactly this. */
import { describe, expect, it } from "vitest";
import { route } from "../src/route.js";

describe("route", () => {
  it("maps every entry the page has", () => {
    expect(route("create", false)).toBe("builder");
    expect(route("tour", false)).toBe("tour");
    expect(route("hiero-pay:whatever", false)).toBe("payer");
    expect(route("hiero-pay:whatever", true)).toBe("invoice");
    expect(route("", false)).toBe("landing");
    // ?invoice with no request falls back to the landing, not a blank page.
    expect(route("", true)).toBe("landing");
  });
});
