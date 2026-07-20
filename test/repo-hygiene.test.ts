// SPDX-License-Identifier: Apache-2.0
/**
 * Repo conventions, checked: every source, test, and script file carries the
 * LFDT-style SPDX header — adopting the convention now is one less diff if
 * this ever migrates upstream, and the check keeps new files honest.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const files = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.(ts|mjs)$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

describe("every source file declares its license (SPDX)", () => {
  const all = [...files("src"), ...files("test"), ...files("scripts")];
  it("finds the files it is guarding", () => {
    expect(all.length).toBeGreaterThan(8);
  });
  for (const file of all) {
    it(file, () => {
      const source = readFileSync(join(ROOT, file), "utf8");
      const firstLines = source.split("\n").slice(0, 3).join("\n");
      expect(firstLines).toContain("SPDX-License-Identifier: Apache-2.0");
    });
  }
});
