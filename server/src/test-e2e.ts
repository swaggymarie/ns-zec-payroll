/**
 * Non-interactive end-to-end test.
 * Verifies: encryption, CSV import, ZIP-321 URI generation, scheduling.
 */
import { encrypt, decrypt } from "./crypto.js";
import { importCsv } from "./csv.js";
import { buildZip321Uri, buildTestTxUri } from "./zip321.js";
import { usdToZec } from "./price.js";
import { isDue, markPaid, getDueRecipients } from "./schedule.js";
import { load, save } from "./store.js";
import { unlinkSync, existsSync } from "fs";
import type { PayrollConfig, BatchPayment, Recipient } from "./types.js";

const PASS = "test-passphrase-123";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function run() {
  console.log("\n── Crypto ──");
  const plain = '{"hello":"world","secret":12345}';
  const enc = encrypt(plain, PASS);
  assert(enc !== plain, "Encrypted text differs from plaintext");
  const dec = decrypt(enc, PASS);
  assert(dec === plain, "Decrypted text matches original");

  try {
    decrypt(enc, "wrong-password");
    assert(false, "Wrong password should throw");
  } catch {
    assert(true, "Wrong password throws error");
  }

  console.log("\n── CSV Import ──");
  const recipients = importCsv("sample.csv");
  assert(recipients.length === 3, `Imported ${recipients.length} recipients`);
  assert(recipients[0].name === "Alice", "First recipient is Alice");
  assert(recipients[0].currency === "USD", "Alice pays in USD");
  assert(recipients[0].schedule === "monthly", "Alice is monthly");
  assert(recipients[1].amount === 1.5, "Bob pays 1.5 ZEC");
  assert(recipients[1].schedule === "biweekly", "Bob is biweekly");
  assert(recipients[2].currency === "USDC", "Carol pays in USDC");
  assert(recipients[2].schedule === "one-time", "Carol is one-time");

  console.log("\n── Price Conversion ──");
  const zecPrice = 50; // $50/ZEC for testing
  const aliceZec = usdToZec(2500, zecPrice);
  assert(aliceZec === 50, `$2500 at $50/ZEC = ${aliceZec} ZEC`);

  console.log("\n── ZIP-321 URI ──");
  const payments: BatchPayment[] = recipients.map((r) => ({
    name: r.name,
    wallet: r.wallet,
    amountZec: r.currency === "USD" ? usdToZec(r.amount, zecPrice) : r.amount,
    currency: r.currency === "USDC" ? "USDC" as const : "ZEC" as const,
    memo: r.memo || `Payment to ${r.name}`,
    isTestTx: false,
  }));

  const uri = buildZip321Uri(payments);
  assert(uri.startsWith("zcash:?"), "URI starts with zcash:?");
  assert(uri.includes("address="), "URI has address parameter");
  assert(uri.includes("address.1="), "URI has indexed address.1");
  assert(uri.includes("address.2="), "URI has indexed address.2");
  assert(uri.includes("amount=50"), "Alice amount = 50 ZEC");
  assert(uri.includes("amount.1=1.5"), "Bob amount = 1.5 ZEC");
  assert(uri.includes("memo="), "URI has memo parameter");
  console.log(`\n  URI: ${uri.substring(0, 100)}...`);

  console.log("\n── Test TX URI ──");
  const testUri = buildTestTxUri(recipients[0].wallet, "Alice");
  assert(testUri.includes("amount=0.0001"), "Test TX amount is 0.0001 ZEC");
  assert(testUri.includes("address="), "Test TX has address");

  console.log("\n── Store (encrypted persistence) ──");
  if (existsSync("payroll.enc")) unlinkSync("payroll.enc");

  const config: PayrollConfig = {
    recipients,
    zecPriceUsd: zecPrice,
  };
  save(config, PASS);
  assert(existsSync("payroll.enc"), "Encrypted file created");

  const loaded = load(PASS);
  assert(loaded.recipients.length === 3, "Loaded 3 recipients");
  assert(loaded.zecPriceUsd === 50, "ZEC price preserved");

  console.log("\n── Schedule (per-recipient) ──");
  // All recipients are due (never paid)
  for (const r of loaded.recipients) {
    r.testTxConfirmed = true;
  }
  const due = getDueRecipients(loaded.recipients);
  assert(due.length === 3, "All 3 recipients due (never paid)");

  // Mark Alice as paid
  markPaid(loaded.recipients[0], 50, 50);
  const dueAfter = getDueRecipients(loaded.recipients);
  assert(dueAfter.length === 2, "2 recipients due after paying Alice (monthly)");
  assert(loaded.recipients[0].history.length === 1, "Alice has 1 payment in history");
  assert(loaded.recipients[0].history[0].amountZec === 50, "Alice history records 50 ZEC");

  // Mark Carol (one-time) as paid
  markPaid(loaded.recipients[2], 10, 50);
  assert(loaded.recipients[2].paid === true, "Carol marked as paid (one-time)");
  const dueAfter2 = getDueRecipients(loaded.recipients);
  assert(dueAfter2.length === 1, "1 recipient due (Carol done, Alice not due yet)");
  assert(dueAfter2[0].name === "Bob", "Only Bob is due");

  // Clean up
  unlinkSync("payroll.enc");

  console.log("\n══ All tests passed! ══\n");
}

run().catch((err) => {
  console.error("\n✗ Test failed:", err.message);
  process.exit(1);
});
