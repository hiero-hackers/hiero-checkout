// SPDX-License-Identifier: Apache-2.0
/**
 * The "Pay now" experience: pair with the payer's wallet over WalletConnect,
 * propose the transfer, let the WALLET sign and execute. This page still
 * never touches a key — it builds an unfrozen `TransferTransaction` from
 * `paymentInstructions(request)` (recipient, asset, base-unit amount, and
 * the MEMO — dropping the memo breaks matching) and hands it over; the
 * wallet completes, signs, and submits it.
 *
 * Everything heavy (the bridge + the Hiero SDK) loads LAZILY on tap — the
 * initial page stays small, and the wallet stack downloads only for payers
 * who choose this path.
 */
import { paymentInstructions } from "@hiero-hackers/hiero-payment-requests";
import type { PaymentRequest } from "@hiero-hackers/hiero-payment-requests";
import { canPayInPage, IN_PAGE_PAYMENT_NETWORKS } from "../config.js";

/** WalletConnect Cloud project id — public by design (it ships in the
 *  bundle); it identifies this app to the relay, nothing more. */
export const WALLETCONNECT_PROJECT_ID = "81bd32b4b08a17775918aa0919e57763";

export const isConfigured = (): boolean => WALLETCONNECT_PROJECT_ID.length > 0;

export interface WalletPayment {
  readonly transactionId: string | undefined;
}

/** Browser-native base64 — the bridge's own helper reaches for Node's
 *  `Buffer`, which we shim only for its internals, never our own code. */
const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/**
 * Pair, propose, and let the wallet execute. `onStatus` narrates the stages
 * so the button can tell the payer what's happening. Throws on rejection or
 * failure — the caller restores the UI, and the watch loop stays the source
 * of truth either way.
 */
export async function payWithWallet(
  request: PaymentRequest,
  onStatus: (text: string) => void,
): Promise<WalletPayment> {
  const wallet = paymentInstructions(request);
  // PROTOTYPE SAFETY — the belt (the UI is the braces). Which networks may
  // pay in-page is declared in src/config.ts, deliberately in one place.
  if (!canPayInPage(wallet.network)) {
    throw new Error(
      `Pay now is limited to ${IN_PAGE_PAYMENT_NETWORKS.join("/")} while this is a ` +
        `prototype (this request is ${wallet.network}) — see src/config.ts`,
    );
  }

  onStatus("Loading wallet bridge…");
  // The bridge's internals expect Node's Buffer global; shim before import.
  const { Buffer } = await import("buffer");
  (globalThis as { Buffer?: unknown }).Buffer ??= Buffer;
  const [bridge, sdk] = await Promise.all([
    import("@hashgraph/hedera-wallet-connect"),
    import("@hiero-ledger/sdk"),
  ]);

  const connector = new bridge.DAppConnector(
    {
      name: "Hiero Checkout",
      description: "Review and pay a Hiero payment request",
      url: window.location.origin,
      icons: [],
    },
    sdk.LedgerId.fromString(wallet.network),
    WALLETCONNECT_PROJECT_ID,
    Object.values(bridge.HederaJsonRpcMethod),
    [bridge.HederaSessionEvent.ChainChanged, bridge.HederaSessionEvent.AccountsChanged],
    [`hedera:${wallet.network}`],
  );
  await connector.init({ logger: "error" });

  onStatus("Connect your wallet…");
  const session = await connector.openModal();
  const account = (session.namespaces["hedera"]?.accounts ?? [])[0]?.split(":").pop();
  if (account === undefined) {
    throw new Error("the wallet session exposed no account");
  }

  onStatus("Approve the transfer in your wallet…");
  const transaction = new sdk.TransferTransaction().setTransactionMemo(wallet.memo);
  const amount = wallet.amount.toString(); // exact — bigint straight to string
  if (wallet.asset.kind === "hbar") {
    transaction
      .addHbarTransfer(account, sdk.Hbar.fromTinybars(amount).negated())
      .addHbarTransfer(wallet.recipient, sdk.Hbar.fromTinybars(amount));
  } else if (wallet.asset.kind === "token") {
    const units = sdk.Long.fromString(amount);
    transaction
      .addTokenTransfer(wallet.asset.id, account, units.negate())
      .addTokenTransfer(wallet.asset.id, wallet.recipient, units);
  } else {
    transaction.addNftTransfer(
      new sdk.NftId(
        sdk.TokenId.fromString(wallet.asset.id),
        sdk.Long.fromString(wallet.asset.serial.toString()),
      ),
      account,
      wallet.recipient,
    );
  }

  const result = await connector.signAndExecuteTransaction({
    signerAccountId: account,
    transactionList: toBase64(transaction.toBytes()),
  });
  return { transactionId: (result as { transactionId?: string }).transactionId };
}
