// SPDX-License-Identifier: Apache-2.0
import { toURI } from "@hiero-hackers/hiero-payment-requests";
import { app } from "./shared.js";

/**
 * The landing screen — a ROLE CHOOSER, not a form. Nobody arrives here
 * wanting to paste text: payers arrive via a link or QR (and never see this
 * page), merchants want to mint a request, and the curious want to know
 * what this is. The paste box still exists for the rare "someone sent me
 * the request as raw text" case — folded away where it can't confuse.
 */
export function renderLanding(onSubmit: (text: string) => void): void {
  app().innerHTML = `
    <div class="card landing">
      <div class="landing__hero">
        <h1>Pay — or get paid — on Hedera</h1>
        <p class="tagline">Right from this page. No accounts, no keys, nothing stored.
        <span class="chip">prototype</span></p>
      </div>
      <div class="roles">
        <section class="role">
          <span class="role__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
          </span>
          <h2>Pay</h2>
          <p class="note">Open the payment link or scan the QR you were given — this page
          shows you exactly who you're paying and how much, verified, and your wallet
          does the sending.</p>
          <details class="tech">
            <summary>Got the request as text instead? Paste it</summary>
            <textarea id="paste" placeholder="hiero-pay:hedera:mainnet:0.0… — or an x402 challenge"
              aria-label="payment request"></textarea>
            <div class="actions"><button class="primary" id="go">Review request</button></div>
          </details>
        </section>
        <section class="role">
          <span class="role__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7 7 17"/><path d="M16 17H7V8"/></svg>
          </span>
          <h2>Receive</h2>
          <p class="note">Make a payment link + QR that pays your account — send it to
          whoever owes you, watch it get paid live.</p>
          <div class="actions"><a class="button primary" href="#create">Create a request</a></div>
        </section>
      </div>
      <p class="note center">New here?
        <a href="#tour">Watch the 20-second walkthrough</a> ·
        <button class="linklike" id="demo">try a live demo</button>
      </p>
    </div>`;
  const area = document.getElementById("paste") as HTMLTextAreaElement;
  const submit = (): void => {
    if (area.value.trim().length > 0) onSubmit(area.value);
  };
  document.getElementById("go")!.addEventListener("click", submit);
  // The demo: a real testnet request with a fresh reference — the full payer
  // experience in one tap, no wallet needed to look around.
  document.getElementById("demo")!.addEventListener("click", () => {
    const expiry = Math.floor(Date.now() / 1000) + 600;
    onSubmit(
      toURI({
        recipient: "hedera:testnet:0.0.2",
        asset: "hedera:testnet/slip44:3030",
        amount: 500_000_000n, // 5 ℏ
        reference: `DEMO-${Date.now().toString(36).toUpperCase()}`,
        label: "Demo request (testnet)",
        expiresAt: `${expiry}.000000000`,
      }),
    );
  });
  // Pasting IS the intent — don't make people hunt for the button.
  area.addEventListener("paste", () => setTimeout(submit, 0));
  area.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });
}
