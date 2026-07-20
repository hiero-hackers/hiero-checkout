// SPDX-License-Identifier: Apache-2.0
import { app, esc } from "./shared.js";

export function renderError(message: string): void {
  app().innerHTML = `
    <div class="card">
      <h1>This payment link is damaged</h1>
      <p>Nothing was charged. Ask the merchant for a fresh link — this page
      refuses anything it cannot verify, rather than guessing.</p>
      <details class="tech">
        <summary>Technical detail</summary>
        <p class="error mono">${esc(message)}</p>
      </details>
    </div>`;
}
