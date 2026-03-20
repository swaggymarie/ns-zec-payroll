#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import { randomUUID } from "crypto";
import { unlockVault, initVault, loadConfig, saveConfig } from "./db.js";
import { importCsv } from "./csv.js";
import { fetchZecPrice, usdToZec } from "./price.js";
import { buildZip321Uri, buildTestTxUri } from "./zip321.js";
import { isDue, markPaid, getDueRecipients, formatDate } from "./schedule.js";
import type { PayrollConfig, BatchPayment, Recipient } from "./types.js";
import * as qrcode from "qrcode";

const program = new Command();

program
  .name("zcash-payroll")
  .description("Payroll software for paying contributors with shielded ZEC")
  .version("1.0.0");

// ─── Shared passphrase prompt ───────────────────────────────────────────────

async function askPassphrase(): Promise<string> {
  const { passphrase } = await inquirer.prompt([
    { type: "password", name: "passphrase", message: "Enter encryption passphrase:", mask: "*" },
  ]);
  return passphrase;
}

async function unlock(): Promise<{ vaultId: string; passphrase: string; config: PayrollConfig }> {
  const passphrase = await askPassphrase();
  const vaultId = await unlockVault(passphrase);
  if (!vaultId) {
    console.log(chalk.red("Invalid passphrase or no matching vault found."));
    process.exit(1);
  }
  const config = await loadConfig(vaultId, passphrase);
  return { vaultId, passphrase, config };
}

async function persist(vaultId: string, config: PayrollConfig, passphrase: string) {
  await saveConfig(vaultId, config, passphrase);
}

// ─── init ───────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Initialize a new payroll store")
  .action(async () => {
    const passphrase = await askPassphrase();
    const { confirm } = await inquirer.prompt([
      { type: "password", name: "confirm", message: "Confirm passphrase:", mask: "*" },
    ]);
    if (passphrase !== confirm) {
      console.log(chalk.red("Passphrases do not match."));
      process.exit(1);
    }
    const vaultId = await initVault(passphrase);
    console.log(chalk.green(`Payroll vault initialized (${vaultId}).`));
  });

// ─── import ─────────────────────────────────────────────────────────────────

program
  .command("import <csvFile>")
  .description("Import recipients from CSV (columns: name, wallet, amount, currency, memo)")
  .action(async (csvFile: string) => {
    const { vaultId, passphrase, config } = await unlock();
    const newRecipients = importCsv(csvFile);

    // Merge: update existing by name, add new
    for (const nr of newRecipients) {
      const existing = config.recipients.find((r) => r.name === nr.name);
      if (existing) {
        existing.wallet = nr.wallet;
        existing.amount = nr.amount;
        existing.currency = nr.currency;
        existing.memo = nr.memo;
        console.log(chalk.yellow(`Updated: ${nr.name}`));
      } else {
        config.recipients.push(nr);
        console.log(chalk.green(`Added: ${nr.name}`));
      }
    }

    await persist(vaultId, config, passphrase);
    console.log(chalk.green(`\n${config.recipients.length} total recipients in payroll.`));
  });

// ─── list ───────────────────────────────────────────────────────────────────

program
  .command("list")
  .description("List all recipients")
  .action(async () => {
    const { config } = await unlock();

    if (config.recipients.length === 0) {
      console.log(chalk.yellow("No recipients configured. Use `import` to add from CSV."));
      return;
    }

    console.log(chalk.bold("\nPayroll Recipients:\n"));
    console.log(
      chalk.gray(
        "Name".padEnd(20) +
          "Amount".padEnd(15) +
          "Currency".padEnd(10) +
          "Test TX".padEnd(10) +
          "Wallet"
      )
    );
    console.log(chalk.gray("─".repeat(90)));

    for (const r of config.recipients) {
      const testStatus = r.testTxConfirmed
        ? chalk.green("✓")
        : r.testTxSent
          ? chalk.yellow("pending")
          : chalk.red("✗");
      console.log(
        `${r.name.padEnd(20)}${r.amount.toString().padEnd(15)}${r.currency.padEnd(10)}${testStatus}${"".padEnd(10 - (r.testTxConfirmed ? 1 : r.testTxSent ? 7 : 1))}${r.wallet.substring(0, 20)}...`
      );
    }

    const dueCount = getDueRecipients(config.recipients).length;
    if (dueCount > 0) {
      console.log(chalk.red(`\n${dueCount} recipient(s) due for payment!`));
    }
  });

// ─── test-tx ────────────────────────────────────────────────────────────────

program
  .command("test-tx [name]")
  .description("Generate test transaction URIs (0.0001 ZEC) for recipients")
  .action(async (name?: string) => {
    const { vaultId, passphrase, config } = await unlock();

    const targets = name
      ? config.recipients.filter((r) => r.name.toLowerCase() === name.toLowerCase())
      : config.recipients.filter((r) => !r.testTxSent);

    if (targets.length === 0) {
      console.log(chalk.yellow("No recipients need test transactions."));
      return;
    }

    for (const r of targets) {
      console.log(chalk.bold(`\n${r.name}:`));
      const uri = buildTestTxUri(r.wallet, r.name);
      console.log(chalk.cyan(uri));
      console.log("\nQR Code:");
      const qr = await qrcode.toString(uri, { type: "terminal", small: true });
      console.log(qr);
      r.testTxSent = true;
    }

    await persist(vaultId, config, passphrase);
    console.log(
      chalk.green(
        `\nTest transactions generated for ${targets.length} recipient(s).`
      )
    );
    console.log(
      chalk.gray(
        "Scan QR codes with Zodl wallet. After confirming receipt, run `confirm-test <name>`."
      )
    );
  });

// ─── confirm-test ───────────────────────────────────────────────────────────

program
  .command("confirm-test <name>")
  .description("Mark a test transaction as confirmed for a recipient")
  .action(async (name: string) => {
    const { vaultId, passphrase, config } = await unlock();
    const r = config.recipients.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (!r) {
      console.log(chalk.red(`Recipient "${name}" not found.`));
      process.exit(1);
    }
    r.testTxConfirmed = true;
    await persist(vaultId, config, passphrase);
    console.log(chalk.green(`Test transaction confirmed for ${r.name}.`));
  });

// ─── preview ────────────────────────────────────────────────────────────────

program
  .command("preview")
  .description("Preview the next payroll batch with current ZEC price")
  .action(async () => {
    const { vaultId, passphrase, config } = await unlock();

    const due = getDueRecipients(config.recipients);
    if (due.length === 0) {
      console.log(chalk.yellow("No recipients are due for payment."));
      return;
    }

    // Fetch current ZEC price
    let zecPrice = config.zecPriceUsd;
    try {
      console.log(chalk.gray("Fetching current ZEC price..."));
      zecPrice = await fetchZecPrice();
      config.zecPriceUsd = zecPrice;
      await persist(vaultId, config, passphrase);
      console.log(chalk.green(`ZEC price: $${zecPrice.toFixed(2)}`));
    } catch {
      if (zecPrice) {
        console.log(chalk.yellow(`Using cached ZEC price: $${zecPrice.toFixed(2)}`));
      } else {
        console.log(chalk.red("Cannot fetch ZEC price and no cached price available."));
        console.log(chalk.gray("Set price manually with `set-price <usd>`."));
        return;
      }
    }

    console.log(chalk.bold("\n── Payroll Batch Preview ──\n"));

    const payments: BatchPayment[] = [];
    let totalZec = 0;

    for (const r of due) {
      let amountZec: number;
      let displayAmount: string;

      if (r.currency === "USD") {
        amountZec = usdToZec(r.amount, zecPrice!);
        displayAmount = `$${r.amount} → ${amountZec} ZEC`;
      } else if (r.currency === "USDC") {
        // USDC recipients: still need ZEC amount for the swap
        amountZec = usdToZec(r.amount, zecPrice!);
        displayAmount = `${r.amount} USDC (via NEAR intents) → ${amountZec} ZEC`;
      } else {
        amountZec = r.amount;
        displayAmount = `${amountZec} ZEC`;
      }

      const memo = r.currency === "USDC"
        ? `${r.memo || ""} [USDC via NEAR intents - route through Zodl swap]`.trim()
        : r.memo || `Payment to ${r.name}`;

      payments.push({
        name: r.name,
        wallet: r.wallet,
        amountZec,
        currency: r.currency === "USDC" ? "USDC" : "ZEC",
        memo,
        isTestTx: false,
      });

      totalZec += amountZec;
      console.log(
        `  ${chalk.bold(r.name.padEnd(20))} ${displayAmount.padEnd(40)} ${chalk.gray(r.wallet.substring(0, 24) + "...")}`
      );
    }

    console.log(chalk.gray("\n" + "─".repeat(70)));
    console.log(chalk.bold(`  Total: ${totalZec.toFixed(8)} ZEC (~$${(totalZec * zecPrice!).toFixed(2)} USD)`));
    console.log(`  Recipients: ${due.length}`);

    if (payments.some((p) => p.currency === "USDC")) {
      console.log(
        chalk.yellow(
          "\n  ⚠ USDC recipients will need a separate Zodl swap via NEAR intents."
        )
      );
      console.log(
        chalk.gray(
          "    ZEC will be sent to their wallet first, then they swap to USDC in Zodl."
        )
      );
    }

    console.log(chalk.gray("\nRun `pay` to generate the ZIP-321 payment URI.\n"));
  });

// ─── set-price ──────────────────────────────────────────────────────────────

program
  .command("set-price <usd>")
  .description("Manually set the ZEC/USD price")
  .action(async (usd: string) => {
    const { vaultId, passphrase, config } = await unlock();
    const price = parseFloat(usd);
    if (isNaN(price) || price <= 0) {
      console.log(chalk.red("Invalid price."));
      process.exit(1);
    }
    config.zecPriceUsd = price;
    await persist(vaultId, config, passphrase);
    console.log(chalk.green(`ZEC price set to $${price.toFixed(2)}`));
  });

// ─── pay ────────────────────────────────────────────────────────────────────

program
  .command("pay")
  .description("Generate ZIP-321 multi-payment URI for the payroll batch")
  .action(async () => {
    const { vaultId, passphrase, config } = await unlock();

    const due = getDueRecipients(config.recipients);
    if (due.length === 0) {
      console.log(chalk.yellow("No recipients are due for payment."));
      return;
    }

    let zecPrice = config.zecPriceUsd;
    if (!zecPrice) {
      try {
        zecPrice = await fetchZecPrice();
        config.zecPriceUsd = zecPrice;
      } catch {
        console.log(chalk.red("Cannot determine ZEC price. Run `set-price <usd>` first."));
        return;
      }
    }

    // Separate ZEC and USDC recipients
    const zecPayments: BatchPayment[] = [];
    const usdcPayments: BatchPayment[] = [];

    for (const r of due) {
      let amountZec: number;
      if (r.currency === "USD") {
        amountZec = usdToZec(r.amount, zecPrice);
      } else if (r.currency === "USDC") {
        amountZec = usdToZec(r.amount, zecPrice);
      } else {
        amountZec = r.amount;
      }

      const payment: BatchPayment = {
        name: r.name,
        wallet: r.wallet,
        amountZec,
        currency: r.currency === "USDC" ? "USDC" : "ZEC",
        memo: r.memo || `Payment to ${r.name}`,
        isTestTx: false,
      };

      if (r.currency === "USDC") {
        usdcPayments.push(payment);
      } else {
        zecPayments.push(payment);
      }
    }

    // Generate ZIP-321 URI for ZEC payments
    if (zecPayments.length > 0) {
      console.log(chalk.bold("\n── ZIP-321 Payment URI (ZEC Recipients) ──\n"));
      const uri = buildZip321Uri(zecPayments);
      console.log(chalk.cyan(uri));
      console.log("\nQR Code (scan with Zodl to sign):");
      const qr = await qrcode.toString(uri, { type: "terminal", small: true });
      console.log(qr);
    }

    // USDC recipients need separate handling via NEAR intents
    if (usdcPayments.length > 0) {
      console.log(chalk.bold("\n── USDC Recipients (via Zodl NEAR Intents) ──\n"));
      console.log(
        chalk.yellow(
          "These recipients need payment routed through Zodl's NEAR intents swap.\n" +
          "Send ZEC to their wallet, then they use Zodl's off-ramp to convert to USDC.\n"
        )
      );

      // Still generate a ZIP-321 URI for the ZEC leg
      const usdcUri = buildZip321Uri(
        usdcPayments.map((p) => ({
          ...p,
          memo: `[USDC ${p.amountZec} ZEC → USDC via Zodl NEAR intents] ${p.memo}`,
        }))
      );
      console.log(chalk.cyan(usdcUri));
      console.log("\nQR Code:");
      const qr = await qrcode.toString(usdcUri, { type: "terminal", small: true });
      console.log(qr);
    }

    // Mark recipients as paid
    const allCliPayments = [...zecPayments, ...usdcPayments];
    for (const r of due) {
      const p = allCliPayments.find((p) => p.name === r.name);
      markPaid(r, p?.amountZec ?? 0, zecPrice);
    }
    await persist(vaultId, config, passphrase);

    console.log(chalk.green(`\nPayout recorded for ${due.length} recipient(s).`));
  });

// ─── status ─────────────────────────────────────────────────────────────────

program
  .command("status")
  .description("Show payroll schedule status")
  .action(async () => {
    const { config } = await unlock();

    const due = getDueRecipients(config.recipients);
    console.log(chalk.bold("\n── Payroll Status ──\n"));
    console.log(`  Recipients: ${config.recipients.length}`);
    console.log(`  Test-confirmed: ${config.recipients.filter((r) => r.testTxConfirmed).length}`);
    console.log(`  Due now: ${due.length}`);
    console.log(`  ZEC price: ${config.zecPriceUsd ? "$" + config.zecPriceUsd.toFixed(2) : "Not set"}`);

    if (due.length > 0) {
      console.log(chalk.red.bold(`\n  ⚠ ${due.length} PAYMENT(S) DUE! Run \`preview\` then \`pay\`.`));
    }

    console.log();
  });

// ─── add ────────────────────────────────────────────────────────────────────

program
  .command("add")
  .description("Interactively add a single recipient")
  .action(async () => {
    const { vaultId, passphrase, config } = await unlock();

    const answers = await inquirer.prompt([
      { type: "input", name: "name", message: "Recipient name:" },
      { type: "input", name: "wallet", message: "Zcash wallet address:" },
      { type: "number", name: "amount", message: "Payment amount:" },
      {
        type: "list",
        name: "currency",
        message: "Currency:",
        choices: ["ZEC", "USD", "USDC"],
      },
      {
        type: "list",
        name: "schedule",
        message: "Schedule:",
        choices: ["weekly", "biweekly", "monthly", "one-time"],
      },
      { type: "input", name: "memo", message: "Memo (optional):", default: "" },
    ]);

    config.recipients.push({
      name: answers.name,
      wallet: answers.wallet,
      amount: answers.amount,
      currency: answers.currency,
      schedule: answers.schedule,
      memo: answers.memo,
      testTxSent: false,
      testTxConfirmed: false,
      lastPaidDate: null,
      paid: false,
      history: [],
    });

    await persist(vaultId, config, passphrase);
    console.log(chalk.green(`Added ${answers.name} to payroll.`));
  });

// ─── remove ─────────────────────────────────────────────────────────────────

program
  .command("remove <name>")
  .description("Remove a recipient by name")
  .action(async (name: string) => {
    const { vaultId, passphrase, config } = await unlock();

    const idx = config.recipients.findIndex(
      (r) => r.name.toLowerCase() === name.toLowerCase()
    );
    if (idx === -1) {
      console.log(chalk.red(`Recipient "${name}" not found.`));
      process.exit(1);
    }

    const removed = config.recipients.splice(idx, 1)[0];
    await persist(vaultId, config, passphrase);
    console.log(chalk.green(`Removed ${removed.name} from payroll.`));
  });

program.parse();
