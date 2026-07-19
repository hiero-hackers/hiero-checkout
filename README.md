# hiero-checkout

**The payer side of payments on Hiero: scan → review → pay with your wallet →
watch it confirm live.**

A static page — no backend, no keys, no analytics, no configuration. It is the
universal-link target for [`toLink`](https://github.com/hiero-hackers/hiero-payment-requests):
a phone that scans a payment QR opens this page, and the page does the rest.
Prototype.

```
URL #fragment           parse (library)          act (wallet)         confirm (browser)
#hiero-pay:…      →   fromAny → request    →   open in wallet /  →  poll mirror → receipts
                      card + QR                copy / scan          → match → paid ✓
```

## Why it's this small (13 kB gzipped, everything included)

Everything hard ships in the published libraries; this repo is glue:

| Concern | Where it lives |
| --- | --- |
| Parse scanned/pasted/linked input | `fromAny` — payment-requests |
| Validate (checksums, networks, amounts) | `createRequest` via every entry point |
| What to show + hand a wallet | `paymentInstructions` |
| The QR itself | `toQRSVG` — the in-house, decoder-verified encoder |
| Amounts as text, no floats | `formatBaseUnits` |
| Normalize mirror transactions (net credits, custom fees) | `fromMirror` + `receiptFor` — hiero-receipts |
| The verdict | `match` — the SAME rule the merchant runs; the two ends cannot disagree |
| The keepsake | `toHTML` — hiero-receipts renders the downloadable receipt |

The page adds ~500 lines: a thin typed `fetch` for two mirror endpoints
(deliberately not a data-client dependency), a poll loop, and framework-free
DOM rendering — one screen, four states, no virtual DOM required.

## Privacy properties (the point of the design)

- The request rides in the **URL fragment** — browsers never send fragments,
  so payment details stay out of every server, proxy, and access log.
- The page talks **only** to the network's public mirror node, derived from
  the network inside the request's own CAIP identifiers.
- Everything rendered is derived from the **parsed** request — never echoed
  from raw input — so what the payer sees is what was validated, checksummed
  recipient included. A wrong checksum renders a refusal, not a card.

## Develop

```sh
npm install
npm run setup:local   # packs ../hiero-payment-requests + ../hiero-receipts
npm run dev           # → http://localhost:5173
npm run verify        # typecheck + tests + build
```

Until the `@hiero-hackers` packages publish to a registry this repo can
resolve, `setup:local` installs them as real tarballs from the sibling
checkouts (`--no-save`, so package.json stays registry-ready). **Note:** any
later `npm install <pkg>` prunes them — just re-run `setup:local`.

Try it with a request: `npm run dev`, then open

```
http://localhost:5173/#hiero-pay:hedera:mainnet:0.0.1234-pikcw?v=1&asset=hedera%3Amainnet%2Ftoken%3A0.0.720&amount=100000000&ref=INV-2026-041&label=Workshop%20ticket
```

The tests consume the **official wire vectors** shipped inside
payment-requests — this app is the vectors' first external consumer: every
valid vector must render, every invalid one must be refused.

## Roadmap

- **WalletConnect** (`@hashgraph/hedera-wallet-connect`) — lazy-loaded pairing
  in `src/wallets/`, needs a WalletConnect Cloud project id. Deep links per
  wallet land in the same directory, where churn is contained.
- **GitHub Pages deploy** + CI (verify gates, SPDX/browser drift checks — kit
  parity with the sibling repos).
- **Underpaid → remainder QR** via `remainderRequest` (the library call
  exists; the screen needs designing).
- Upstream: an `exports` subpath for the vectors file in payment-requests,
  and a browser-cleanliness pin for hiero-receipts (this app is the reason).

## What it deliberately doesn't do

Hold keys · sign anything · run a server · track anyone · guess (unknown
token decimals render as base units, labeled as such; unverifiable input
renders a refusal).

## License

Apache-2.0
