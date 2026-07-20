# Security

This page's product **is** its security posture: it shows a stranger where to
send money, so what it refuses to do matters more than what it does.

## Threat model

**Spoofed checkout clones.** This app is static and Apache-licensed — anyone
can host a lookalike that swaps the recipient. The defense is canonical
hosting: merchants must link to ONE known domain, and payers should treat a
checkout on any other host as hostile. (This is why the page never asks for
anything — a clone that asks for a key or password is immediately out of
character.)

**Address substitution.** The recipient is rendered from the PARSED, validated
request — HIP-15 checksum verified — never echoed from raw input. A tampered
fragment fails closed with the reason on screen; nothing renders half-way.

**QR swap.** The QR shown is always regenerated (`toQRSVG`) from the validated
request, never passed through from input, so the code on screen and the card
text cannot disagree.

**Injection.** Labels, references, and memos are attacker-chosen text. Every
interpolation is escaped, and `test/ui.test.ts` renders hostile payloads and
asserts they become text, never elements. The one deliberate `innerHTML` of
generated content is the QR SVG — produced by this stack from validated input.

**Exfiltration.** Production builds carry a Content-Security-Policy that
allows connections ONLY to the public mirror nodes and — argued for here, as
this file requires — the WalletConnect relay (`vite.config.ts`;
`scripts/check-dist.mjs` fails the build if it goes missing).

**WalletConnect (Pay now).** The relay and its support hosts are admitted to
the CSP because in-wallet payment is the page's purpose, not a convenience:
the page proposes an UNFROZEN transfer built from the validated request
(recipient, amount, memo); the wallet completes, signs, and submits it. What
travels to the relay is the encrypted session traffic — never a key, and the
payment request itself still never leaves the fragment. The wallet stack
loads lazily on tap, so payers who never press Pay now never load it. The
one CSP relaxation it needs is `style-src 'unsafe-inline'` for the modal's
runtime styles — styles only; scripts remain 'self'. The payment
request rides in the URL fragment, which browsers do not transmit — servers,
proxies, and link-preview bots never see it. There is no analytics, no error
reporting, no storage.

## What this page can never do

It holds no keys, signs nothing, and submits nothing. The worst a compromised
build could do is display wrong information — which is why the display path
is the tested surface.

## Supply-chain posture (prototype)

`npm audit` currently reports advisories in the WALLET STACK's upstream tree
(protobufjs via the Hiero SDK's `@hiero-ledger/proto`; `@grpc/grpc-js`;
elliptic/ethers via WalletConnect). None are reachable from this page's own
input paths — the SDK serializes only the transfer this page constructs, and
gRPC is never exercised in a browser — and no non-breaking fixes exist yet
(`npm audit fix --force` would DOWNGRADE the wallet bridge). Mitigations in
place: the wallet stack loads lazily (payers who never tap Pay now never run
it), in-page payment is testnet-only while this is a prototype, and
Dependabot tracks the upstream bumps. Revisit before any real-money
enablement.

## Reporting

Please report vulnerabilities privately via GitHub Security Advisories
("Report a vulnerability" on the repository), not public issues.
