// SPDX-License-Identifier: Apache-2.0
// @vitest-environment happy-dom
/** The tour plays through its acts on real render functions — fake timers
 *  drive the clock; the captions and verdicts must stay in sync. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTour } from "../src/tour.js";

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<main id="app"></main>';
});
afterEach(() => vi.useRealTimers());

describe("runTour", () => {
  it("act 1 renders immediately, banner narrating", () => {
    runTour();
    expect(document.querySelector(".demo-banner")?.textContent).toContain("SIMULATED");
    expect(document.querySelector(".demo-banner")?.textContent).toContain("1/3");
    expect(document.getElementById("status")?.className).toContain("await");
  });

  it("act 2 shows underpaid with the remainder QR; act 3 settles with proofs", () => {
    runTour();
    vi.advanceTimersByTime(6_000);
    expect(document.querySelector(".demo-banner")?.textContent).toContain("2/3");
    expect(document.getElementById("verdict")?.textContent).toContain("still owed");
    expect(document.querySelector("#verdict .qr svg")).not.toBeNull();
    vi.advanceTimersByTime(6_000);
    expect(document.querySelector(".demo-banner")?.textContent).toContain("3/3");
    expect(document.getElementById("status")?.className).toContain("paid");
    expect(document.querySelector(".proofs a")).not.toBeNull();
    expect(document.body.textContent).toContain("try it for real");
  });
});
