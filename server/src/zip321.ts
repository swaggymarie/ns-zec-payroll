import type { BatchPayment } from "./types.js";

/**
 * Encode a UTF-8 string to base64url (no padding) for ZIP-321 memo field.
 */
function toBase64url(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Format a ZEC amount with up to 8 decimal places, no trailing zeros beyond
 * what's needed (but at least one decimal place for clarity).
 */
function formatAmount(zec: number): string {
  // Ensure max 8 decimal places
  const fixed = zec.toFixed(8);
  // Remove trailing zeros but keep at least one decimal place
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/**
 * Build a ZIP-321 multi-payment URI from a list of payments.
 *
 * Per ZIP-321 spec:
 * - First payment can use path-style address: zcash:<addr>?amount=X
 * - Additional payments use indexed params: address.1=, amount.1=, etc.
 * - Memos are base64url-encoded (no padding)
 * - Memos are only valid on shielded addresses
 */
export function buildZip321Uri(payments: BatchPayment[]): string {
  if (payments.length === 0) {
    throw new Error("Cannot build URI with zero payments");
  }

  const first = payments[0];
  const params: string[] = [];

  // First payment: address goes in the path, params are un-indexed
  params.push(`amount=${formatAmount(first.amountZec)}`);
  if (first.memo) {
    params.push(`memo=${toBase64url(first.memo)}`);
  }

  // Additional payments: indexed params (address.1=, amount.1=, etc.)
  for (let i = 1; i < payments.length; i++) {
    const p = payments[i];
    params.push(`address.${i}=${p.wallet}`);
    params.push(`amount.${i}=${formatAmount(p.amountZec)}`);
    if (p.memo) {
      params.push(`memo.${i}=${toBase64url(p.memo)}`);
    }
  }

  return `zcash:${first.wallet}?${params.join("&")}`;
}

/**
 * Build a URI specifically for a test transaction (small amount).
 */
export function buildTestTxUri(
  wallet: string,
  name: string,
  memo: string = "Test transaction - zcash-payroll"
): string {
  const payment: BatchPayment = {
    name,
    wallet,
    amountZec: 0.0001, // ~$0.005 at typical prices
    currency: "ZEC",
    memo,
    isTestTx: true,
  };
  return buildZip321Uri([payment]);
}
