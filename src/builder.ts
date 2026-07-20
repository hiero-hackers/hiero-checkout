// SPDX-License-Identifier: Apache-2.0
/**
 * The merchant side: mint a request in the browser. Open `#create`, fill the
 * form, get the link and QR — the whole loop with no tooling. Validation is
 * the library's (`createRequest` inside `toLink`), surfaced inline as you
 * type; amounts go through `parseDecimalAmount`, which refuses to round
 * rather than quietly changing someone's price.
 *
 * Nothing here is stored or sent anywhere — the "output" is a URL whose
 * fragment carries everything.
 */
import {
  expectedChecksum,
  parseDecimalAmount,
  toLink,
  toQRSVG,
  toURI,
} from "@hiero-hackers/hiero-payment-requests";
import type { Network, PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { tokenDecimals, usdEstimateCents } from "./mirror.js";

const value = (id: string): string =>
  (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value.trim();

/** Build the request from the form, or throw the library's own explanation.
 *  `resolvedDecimals` comes from the network lookup; the manual field is the
 *  fallback for networks/tokens the mirror can't answer for. */
function requestFromForm(resolvedDecimals: number | undefined): PaymentRequest {
  const network = value("b-network");
  const account = value("b-account");
  const kind = value("b-kind");
  const reference = value("b-reference");
  const label = value("b-label");
  const expiresMinutes = value("b-expires");

  const asset =
    kind === "hbar"
      ? `hedera:${network}/slip44:3030`
      : kind === "token"
        ? `hedera:${network}/token:${value("b-token")}`
        : `hedera:${network}/nft:${value("b-token")}/${value("b-serial")}`;
  const decimals =
    kind === "hbar"
      ? 8
      : kind === "nft"
        ? 0
        : (resolvedDecimals ?? Number(value("b-decimals") || "6"));
  const amount = kind === "nft" ? 1n : parseDecimalAmount(value("b-amount") || "0", decimals);

  // Mint requests WITH the checksum whenever the network defines one — the
  // payer's card then shows "✓ checksum verified" with no merchant homework.
  let recipient = account;
  if (!account.includes("-")) {
    const checksum = expectedChecksum(account, network as Network);
    if (checksum !== undefined) recipient = `${account}-${checksum}`;
  }

  return {
    recipient: `hedera:${network}:${recipient}`,
    asset,
    amount,
    reference,
    ...(label !== "" ? { label } : {}),
    ...(expiresMinutes !== ""
      ? {
          expiresAt: `${Math.floor(Date.now() / 1000) + Number(expiresMinutes) * 60}.000000000`,
        }
      : {}),
  };
}

export function renderBuilder(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <p class="brand"><a href="./">← Hiero Checkout</a></p>
    <div class="card">
      <h1>Create a payment request</h1>
      <p class="note"><strong>How it works:</strong> a request is a link + QR that says
      "pay <em>me</em> this amount". It isn't addressed to a payer — <strong>you choose
      who pays by sending it to them</strong> (paste the link anywhere, or show the QR).
      Whoever opens it sees a checkout paying <em>your</em> account, verified.
      Everything happens in your browser; nothing is stored or sent anywhere.</p>
      <form id="b-form">
        <div class="grid">
          <label>Network
            <select id="b-network">
              <option selected>testnet</option><option>mainnet</option>
              <option>previewnet</option><option>devnet</option>
            </select>
            <span class="hint" id="b-network-hint">testnet — free faucet money, ideal for trying this out</span>
          </label>
          <label>Pay to — YOUR account (it receives the money)
            <input id="b-account" placeholder="0.0.1234" autocomplete="off" />
          </label>
          <label>Asset
            <select id="b-kind">
              <option value="hbar">HBAR</option>
              <option value="token">Token</option>
              <option value="nft">NFT (one serial)</option>
            </select>
          </label>
          <label class="f-token" hidden>Token id
            <input id="b-token" placeholder="0.0.720" autocomplete="off" />
          </label>
          <label class="f-token" hidden><span id="b-decimals-label"></span>
            <span class="f-decimals" hidden>
              <input id="b-decimals" placeholder="6" inputmode="numeric" autocomplete="off" />
            </span>
          </label>
          <label class="f-serial" hidden>Serial
            <input id="b-serial" placeholder="3" inputmode="numeric" autocomplete="off" />
          </label>
          <label class="f-amount"><span id="b-amount-label">Amount — in HBAR (ℏ)</span>
            <input id="b-amount" placeholder="100.50" inputmode="decimal" autocomplete="off" />
            <span class="hint" id="b-amount-hint"></span>
          </label>
          <label>Reference — how you'll match the payment
            <span class="ref-row">
              <input id="b-reference" placeholder="INV-2026-041" autocomplete="off" />
              <button type="button" class="mini" id="b-genref">Generate</button>
            </span>
          </label>
          <label>What's it for (shown to the payer)
            <input id="b-label" placeholder="Workshop ticket" autocomplete="off" />
          </label>
          <label>Expires
            <select id="b-expires">
              <option value="">No expiry</option>
              <option value="60">In 1 hour</option>
              <option value="1440">In 1 day</option>
              <option value="10080">In 1 week</option>
              <option value="20160">In 2 weeks</option>
              <option value="43200">In 30 days</option>
            </select>
          </label>
        </div>
      </form>
      <p class="error" id="b-error" hidden></p>
    </div>
    <div class="card" id="b-output" hidden>
      <h1>Now choose who pays: send it to them</h1>
      <p class="note" id="b-who"></p>
      <p class="label">Share the link</p>
      <p class="mono" id="b-link"></p>
      <div class="actions">
        <button class="primary" id="b-copy">Copy link</button>
      </div>
      <p class="label">…or the QR — print it, save it, put it on the counter</p>
      <div class="qr" id="b-qr"></div>
      <div class="actions">
        <button id="b-dlqr">Download QR</button>
      </div>
      <p class="note" id="b-checksum" hidden></p>
      <div class="actions bottom">
        <a class="button" id="b-open" href="#">Open checkout — see what the payer sees</a>
        <a class="button" id="b-invoice">Generate invoice</a>
      </div>
    </div>`;

  const form = document.getElementById("b-form")!;
  const error = document.getElementById("b-error")!;
  const output = document.getElementById("b-output")!;

  // Which fields exist for which asset kind — a table, not cleverness.
  // (Decimals are LOOKED UP from the network — the manual input only appears
  // when the lookup fails; no merchant should have to know their decimals.)
  const FIELDS: Record<string, Record<string, boolean>> = {
    hbar: { "f-token": false, "f-serial": false, "f-amount": true },
    token: { "f-token": true, "f-serial": false, "f-amount": true },
    nft: { "f-token": true, "f-serial": true, "f-amount": false },
  };
  const decimalsCache = new Map<string, number | "failed" | "pending">();
  const networkHint = (): void => {
    const hint = document.getElementById("b-network-hint")!;
    hint.textContent =
      value("b-network") === "testnet"
        ? "testnet — free faucet money, ideal for trying this out"
        : "⚠ real network, real money — payers can't use in-page Pay now here (prototype)";
  };
  const showKindFields = (): void => {
    networkHint();
    const kind = value("b-kind");
    const visible = FIELDS[kind] ?? FIELDS.hbar!;
    for (const [cls, show] of Object.entries(visible)) {
      for (const el of app.querySelectorAll<HTMLElement>(`.${cls}`)) el.hidden = !show;
    }
    // The amount is denominated in the CHOSEN asset — say so on the label.
    document.getElementById("b-amount-label")!.textContent =
      kind === "hbar" ? "Amount — in HBAR (ℏ)" : "Amount — in tokens (whole units, e.g. 100.50)";
  };

  const rebuild = (): void => {
    // Wait for the essentials before judging the form.
    if (value("b-account") === "" || value("b-reference") === "") {
      output.hidden = true;
      error.hidden = true;
      return;
    }

    // Token decimals: fetched from the network, never homework. The manual
    // field appears only when the mirror can't answer.
    let resolvedDecimals: number | undefined;
    const decimalsLabel = document.getElementById("b-decimals-label")!;
    const manualDecimals = document.querySelector<HTMLElement>(".f-decimals")!;
    if (value("b-kind") === "token" && /^\d+\.\d+\.\d+$/.test(value("b-token"))) {
      const key = `${value("b-network")}:${value("b-token")}`;
      const known = decimalsCache.get(key);
      if (known === undefined) {
        decimalsCache.set(key, "pending");
        void tokenDecimals(value("b-network"), value("b-token")).then((decimals) => {
          decimalsCache.set(key, decimals ?? "failed");
          rebuild();
        });
      }
      if (known === undefined || known === "pending") {
        decimalsLabel.textContent = "Checking the token on the network…";
        manualDecimals.hidden = true;
        output.hidden = true;
        error.hidden = true;
        return;
      }
      if (known === "failed") {
        decimalsLabel.textContent = "Couldn't look this token up — enter its decimals";
        manualDecimals.hidden = false;
      } else {
        resolvedDecimals = known;
        decimalsLabel.textContent = `${known} decimals — fetched from the network`;
        manualDecimals.hidden = true;
      }
    } else {
      decimalsLabel.textContent = "";
      manualDecimals.hidden = true;
    }

    try {
      const request = requestFromForm(resolvedDecimals);
      const base = `${window.location.origin}${window.location.pathname}`;
      const link = toLink(request, base);
      // Ground the number: exact base units always; a $ estimate for HBAR.
      const hint = document.getElementById("b-amount-hint")!;
      const kind = value("b-kind");
      if (kind === "hbar") {
        hint.textContent = `= ${request.amount.toLocaleString("en-US")} tinybar`;
        void usdEstimateCents(value("b-network"), request.amount).then((cents) => {
          if (cents === undefined) return;
          const dollars = `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
          hint.textContent = `= ${request.amount.toLocaleString("en-US")} tinybar ≈ $${dollars} (network rate)`;
        });
      } else if (kind === "token") {
        hint.textContent = `= ${request.amount.toLocaleString("en-US")} base units of token ${value("b-token")}`;
      } else {
        hint.textContent = "";
      }
      error.hidden = true;
      output.hidden = false;
      document.getElementById("b-link")!.textContent = link;
      (document.getElementById("b-invoice") as HTMLAnchorElement).href =
        `${window.location.pathname}?invoice#${toURI(request)}`;
      document.getElementById("b-who")!.textContent =
        `Anyone who opens this pays ${request.recipient.split(":").pop()} (you) — ` +
        `so send it only to the person who owes you.`;
      const checksumNote = document.getElementById("b-checksum")!;
      checksumNote.hidden = !request.recipient.includes("-");
      checksumNote.textContent = `Payers will see ${request.recipient.split(":").pop()} with a verified checksum ✓`;
      (document.getElementById("b-open") as HTMLAnchorElement).href = `#${toURI(request)}`;
      try {
        document.getElementById("b-qr")!.innerHTML = toQRSVG(request);
      } catch {
        document.getElementById("b-qr")!.textContent = "";
      }
      const download = document.getElementById("b-dlqr")!;
      download.onclick = () => {
        const svg = document.getElementById("b-qr")!.innerHTML;
        if (svg === "") return;
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `payment-qr-${value("b-reference")}.svg`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      };
      const copy = document.getElementById("b-copy")!;
      copy.onclick = () => {
        void navigator.clipboard.writeText(link).then(() => {
          copy.textContent = "Copied ✓";
          setTimeout(() => (copy.textContent = "Copy link"), 1500);
        });
      };
    } catch (cause) {
      output.hidden = true;
      error.hidden = false;
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    }
  };

  form.addEventListener("input", () => {
    showKindFields();
    rebuild();
  });
  document.getElementById("b-genref")!.addEventListener("click", () => {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const salt = Math.random().toString(36).slice(2, 6).toUpperCase();
    (document.getElementById("b-reference") as HTMLInputElement).value = `INV-${stamp}-${salt}`;
    rebuild();
  });
  showKindFields();
}
