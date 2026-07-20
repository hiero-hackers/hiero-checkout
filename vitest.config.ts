// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // Excluded, with reasons stated rather than hidden:
      // - main.ts is entry glue: importing it executes boot() against a real
      //   window; its one piece of logic (routing) lives in route.ts, tested.
      // - wallets/walletconnect.ts beyond its gate needs a live relay and a
      //   human with a wallet — Tier 4 of the test strategy (see README).
      // - ui.ts is a pure re-export facade; style.css isn't executable.
      exclude: ["src/main.ts", "src/wallets/walletconnect.ts", "src/ui.ts", "**/*.css"],
      // Ratchet, don't rot: floors sit just under current; raise, never lower.
      thresholds: { statements: 94, branches: 86, functions: 90, lines: 96 },
    },
  },
});
