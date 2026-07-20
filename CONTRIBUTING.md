# Contributing to hiero-checkout

Thanks for considering it! This project follows the practices of the wider
Hiero / LF Decentralized Trust ecosystem, including our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

```sh
npm install           # needs a read:packages token for the @hiero-hackers scope
npm run dev           # http://localhost:5173
npm run verify        # THE gate suite: typecheck, lint, format, tests, build + dist checks
```

## Ground rules

- **Attacker-chosen text becomes text.** Labels, references, and memos are
  hostile input; every new interpolation needs an escaping test in
  `test/ui.test.ts`.
- **The CSP is the privacy promise.** A new network destination is an
  architecture change, not a config tweak — it must be argued for in
  SECURITY.md and added to `vite.config.ts` deliberately.
- **Refuse rather than guess.** Unknown decimals render base units, invalid
  input renders a refusal. Keep it that way.
- **No frameworks, no analytics, no keys.** The page stays small, static,
  and unable to betray anyone.

## Sign your commits (DCO)

```sh
git commit -s -m "feat: ..."
```
