#!/usr/bin/env node
/**
 * Lightweight HTTP API server that wraps the payroll logic for the web frontend.
 * Runs on port 3141. All data remains E2E encrypted on disk.
 */
import http from "http";
import { randomBytes } from "crypto";
import cron from "node-cron";
import { initVault, unlockVault, hasVaults, loadConfig, saveConfig, updateRecipientFlags } from "./db.js";
import { clearKeyCache } from "./crypto.js";
import { importCsv } from "./csv.js";
import { fetchZecPrice, usdToZec } from "./price.js";
import { buildZip321Uri, buildTestTxUri } from "./zip321.js";
import { isDue, markPaid, getDueRecipients, nextDueDate } from "./schedule.js";
import { sendDuePaymentNotification, sendTestMessage, hasBotToken } from "./telegram.js";
import type { PayrollConfig, BatchPayment, Recipient } from "./types.js";

const PORT = 3141;

// In-memory session: passphrase is held only in memory while server runs
let sessionPassphrase: string | null = null;
let sessionVaultId: string | null = null;
let cachedConfig: PayrollConfig | null = null;

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function error(res: http.ServerResponse, msg: string, status = 400) {
  json(res, { error: msg }, status);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function requireAuth(res: http.ServerResponse): PayrollConfig | null {
  if (!sessionPassphrase || !cachedConfig) {
    error(res, "Not unlocked. POST /api/unlock first.", 401);
    return null;
  }
  return cachedConfig;
}

async function persist() {
  if (sessionPassphrase && sessionVaultId && cachedConfig) {
    await saveConfig(sessionVaultId, cachedConfig, sessionPassphrase);
  }
}

function buildBatchPayments(
  recipients: Recipient[],
  zecPrice: number
): BatchPayment[] {
  return recipients.map((r) => {
    let amountZec: number;
    if (r.currency === "USD") {
      amountZec = usdToZec(r.amount, zecPrice);
    } else if (r.currency === "USDC") {
      amountZec = usdToZec(r.amount, zecPrice);
    } else {
      amountZec = r.amount;
    }
    return {
      name: r.name,
      wallet: r.wallet,
      amountZec,
      currency: r.currency === "USDC" ? "USDC" as const : "ZEC" as const,
      memo: r.memo || `Payment to ${r.name}`,
      isTestTx: false,
    };
  });
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = req.url || "/";

  try {
    // ── Passphrase generator ──
    if (url === "/api/generate-passphrase" && req.method === "GET") {
      // Diceware-style: pick 5 random words from a curated list
      const words = [
        "anchor", "badge", "candle", "delta", "ember", "frost", "grain",
        "haven", "ivory", "jewel", "karma", "lunar", "maple", "noble",
        "orbit", "prism", "quartz", "river", "solar", "thorn", "unity",
        "vivid", "wander", "xenon", "yield", "zephyr", "azure", "blaze",
        "cedar", "drift", "eagle", "flora", "gleam", "haste", "inlet",
        "jagged", "kneel", "latch", "mirth", "nexus", "oasis", "plume",
        "quest", "ridge", "storm", "trove", "ultra", "vault", "whirl",
        "oxide", "zenith", "amber", "brisk", "coral", "dusk", "flint",
        "grove", "heron", "iron", "jade", "kelp", "lynx", "mesa",
        "north", "onyx", "peak", "raven", "sage", "tide", "umber",
        "viper", "wheat", "birch", "crest", "fjord", "glyph", "haze",
        "isle", "jolt", "kite", "loom", "moss", "nook", "palm",
        "reef", "shard", "torch", "urge", "vale", "wren", "yoke",
        "zinc", "alder", "basalt", "cipher", "dune", "echo", "forge",
        "grit", "hull", "icon", "junco", "knot", "ledge", "mint",
      ];
      const picked: string[] = [];
      for (let i = 0; i < 5; i++) {
        const idx = randomBytes(2).readUInt16BE(0) % words.length;
        picked.push(words[idx]);
      }
      json(res, { passphrase: picked.join("-") });
      return;
    }

    // ── Auth ──
    if (url === "/api/unlock" && req.method === "POST") {
      const { passphrase } = JSON.parse(await readBody(req));
      if (!passphrase) return error(res, "Passphrase required");
      try {
        const vaultId = await unlockVault(passphrase);
        if (!vaultId) return error(res, "Invalid passphrase", 401);
        cachedConfig = await loadConfig(vaultId, passphrase);
        sessionPassphrase = passphrase;
        sessionVaultId = vaultId;
        json(res, { ok: true });
      } catch (e) {
        console.error("Unlock error:", e);
        error(res, "Invalid passphrase or database error", 401);
      }
      return;
    }

    if (url === "/api/init" && req.method === "POST") {
      const { passphrase } = JSON.parse(await readBody(req));
      if (!passphrase) return error(res, "Passphrase required");
      const vaultId = await initVault(passphrase);
      cachedConfig = {
        recipients: [],
        zecPriceUsd: null,
      };
      sessionPassphrase = passphrase;
      sessionVaultId = vaultId;
      json(res, { ok: true });
      return;
    }

    if (url === "/api/lock" && req.method === "POST") {
      sessionPassphrase = null;
      sessionVaultId = null;
      cachedConfig = null;
      clearKeyCache();
      json(res, { ok: true });
      return;
    }

    if (url === "/api/status" && req.method === "GET") {
      json(res, { unlocked: !!sessionPassphrase });
      return;
    }

    // ── Recipients ──
    if (url === "/api/recipients" && req.method === "GET") {
      const config = requireAuth(res);
      if (!config) return;
      json(res, { recipients: config.recipients });
      return;
    }

    if (url === "/api/recipients" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      const recipient = JSON.parse(await readBody(req)) as Recipient;
      if (!recipient.name || !recipient.wallet || !recipient.amount) {
        return error(res, "name, wallet, and amount are required");
      }
      recipient.testTxSent = false;
      recipient.testTxConfirmed = false;
      recipient.lastPaidDate = recipient.lastPaidDate || null;
      recipient.paid = recipient.paid || false;
      recipient.schedule = recipient.schedule || "monthly";
      recipient.history = recipient.history || [];
      const existing = config.recipients.findIndex(
        (r) => r.name.toLowerCase() === recipient.name.toLowerCase()
      );
      if (existing >= 0) {
        config.recipients[existing] = recipient;
      } else {
        config.recipients.push(recipient);
      }
      await persist();
      json(res, { ok: true, total: config.recipients.length });
      return;
    }

    if (url.startsWith("/api/recipients/") && req.method === "GET") {
      const config = requireAuth(res);
      if (!config) return;
      const name = decodeURIComponent(url.split("/api/recipients/")[1]);
      const r = config.recipients.find(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      if (!r) return error(res, "Recipient not found", 404);
      const history = r.history || [];
      const totalPaidZec = history.reduce((s, h) => s + h.amountZec, 0);
      const totalPayments = history.length;
      const next = nextDueDate(r);
      json(res, {
        ...r,
        totalPaidZec,
        totalPayments,
        nextDueDate: next,
      });
      return;
    }

    if (url.startsWith("/api/recipients/") && req.method === "DELETE") {
      const config = requireAuth(res);
      if (!config) return;
      const name = decodeURIComponent(url.split("/api/recipients/")[1]);
      const idx = config.recipients.findIndex(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      if (idx === -1) return error(res, "Recipient not found", 404);
      config.recipients.splice(idx, 1);
      await persist();
      json(res, { ok: true });
      return;
    }

    if (url.startsWith("/api/recipients/") && req.method === "PUT") {
      const config = requireAuth(res);
      if (!config) return;
      const name = decodeURIComponent(url.split("/api/recipients/")[1]);
      const idx = config.recipients.findIndex(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      if (idx === -1) return error(res, "Recipient not found", 404);
      const updates = JSON.parse(await readBody(req));
      const allowed = ["amount", "currency", "schedule", "memo", "wallet", "avatar", "group"];
      for (const key of allowed) {
        if (updates[key] !== undefined) {
          (config.recipients[idx] as unknown as Record<string, unknown>)[key] = updates[key];
        }
      }
      await persist();
      json(res, { ok: true });
      return;
    }

    // ── Sample CSV ──
    if (url === "/api/sample-csv" && req.method === "GET") {
      const config = requireAuth(res);
      if (!config) return;
      const { readFileSync } = await import("fs");
      const { resolve } = await import("path");
      const { fileURLToPath } = await import("url");
      const __dirname = resolve(fileURLToPath(import.meta.url), "..");
      const samplePath = resolve(__dirname, "..", "sample.csv");
      try {
        const csv = readFileSync(samplePath, "utf8");
        json(res, { csv });
      } catch {
        error(res, "sample.csv not found", 404);
      }
      return;
    }

    // ── CSV import ──
    if (url === "/api/import" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      const { csv } = JSON.parse(await readBody(req));
      if (!csv) return error(res, "csv field required");
      // Write temp file, import, delete
      const tmp = `/tmp/zcash-payroll-import-${Date.now()}.csv`;
      const { writeFileSync, unlinkSync } = await import("fs");
      writeFileSync(tmp, csv);
      try {
        const imported = importCsv(tmp);
        for (const nr of imported) {
          const existing = config.recipients.findIndex(
            (r) => r.name.toLowerCase() === nr.name.toLowerCase()
          );
          if (existing >= 0) {
            config.recipients[existing] = nr;
          } else {
            config.recipients.push(nr);
          }
        }
        await persist();
        json(res, { ok: true, imported: imported.length, total: config.recipients.length });
      } finally {
        unlinkSync(tmp);
      }
      return;
    }

    // ── Test transactions ──
    if (url === "/api/test-tx" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      const { name } = JSON.parse(await readBody(req));
      const r = config.recipients.find(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      if (!r) return error(res, "Recipient not found", 404);
      const uri = buildTestTxUri(r.wallet, r.name);
      r.testTxSent = true;
      await updateRecipientFlags(sessionVaultId!, r.name, { testTxSent: true });
      json(res, { uri, name: r.name });
      return;
    }

    if (url === "/api/confirm-test" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      const { name } = JSON.parse(await readBody(req));
      const r = config.recipients.find(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      if (!r) return error(res, "Recipient not found", 404);
      r.testTxConfirmed = true;
      await updateRecipientFlags(sessionVaultId!, r.name, { testTxConfirmed: true });
      json(res, { ok: true });
      return;
    }

    // ── Price ──
    if (url === "/api/price" && req.method === "GET") {
      const config = requireAuth(res);
      if (!config) return;
      try {
        const price = await fetchZecPrice();
        config.zecPriceUsd = price;
        await persist();
        json(res, { price });
      } catch {
        if (config.zecPriceUsd) {
          json(res, { price: config.zecPriceUsd, cached: true });
        } else {
          error(res, "Cannot fetch price", 502);
        }
      }
      return;
    }

    if (url === "/api/price" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      const { price } = JSON.parse(await readBody(req));
      if (typeof price !== "number" || price <= 0) return error(res, "Invalid price");
      config.zecPriceUsd = price;
      await persist();
      json(res, { ok: true, price });
      return;
    }

    // ── Preview / Pay ──
    if (url === "/api/preview" && req.method === "GET") {
      const config = requireAuth(res);
      if (!config) return;
      const due = getDueRecipients(config.recipients);
      if (due.length === 0) {
        return error(res, "No recipients are due for payment");
      }
      if (!config.zecPriceUsd) {
        return error(res, "ZEC price not set. Fetch or set price first.");
      }
      const payments = buildBatchPayments(due, config.zecPriceUsd);
      const totalZec = payments.reduce((s, p) => s + p.amountZec, 0);
      json(res, {
        payments,
        totalZec,
        totalUsd: totalZec * config.zecPriceUsd,
        zecPrice: config.zecPriceUsd,
        recipientCount: due.length,
      });
      return;
    }

    if (url === "/api/pay" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      const due = getDueRecipients(config.recipients);
      if (due.length === 0) return error(res, "No recipients are due for payment");
      if (!config.zecPriceUsd) return error(res, "ZEC price not set");

      const allPayments = buildBatchPayments(due, config.zecPriceUsd);
      const zecPayments = allPayments.filter((p) => p.currency === "ZEC");
      const usdcPayments = allPayments.filter((p) => p.currency === "USDC");

      const result: {
        zec?: { uri: string; payments: BatchPayment[]; totalZec: number };
        usdc?: { uri: string; payments: BatchPayment[]; totalZec: number; note: string };
      } = {};

      if (zecPayments.length > 0) {
        const uri = buildZip321Uri(zecPayments);
        result.zec = {
          uri,
          payments: zecPayments,
          totalZec: zecPayments.reduce((s, p) => s + p.amountZec, 0),
        };
      }

      if (usdcPayments.length > 0) {
        const tagged = usdcPayments.map((p) => ({
          ...p,
          memo: `[USDC via Zodl NEAR intents] ${p.memo}`,
        }));
        const uri = buildZip321Uri(tagged);
        result.usdc = {
          uri,
          payments: usdcPayments,
          totalZec: usdcPayments.reduce((s, p) => s + p.amountZec, 0),
          note: "Send ZEC first, recipient converts via Zodl NEAR intents swap",
        };
      }

      json(res, result);
      return;
    }

    // ── Confirm payment (mark recipients as paid) ──
    if (url === "/api/confirm-pay" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      const due = getDueRecipients(config.recipients);
      if (due.length === 0) return error(res, "No recipients are due for payment");
      if (!config.zecPriceUsd) return error(res, "ZEC price not set");

      const allPayments = buildBatchPayments(due, config.zecPriceUsd);
      for (const r of due) {
        const payment = allPayments.find((p) => p.name === r.name);
        markPaid(r, payment?.amountZec ?? 0, config.zecPriceUsd);
      }
      await persist();

      json(res, { ok: true });
      return;
    }

    // ── Schedule ──
    if (url === "/api/schedule" && req.method === "GET") {
      const config = requireAuth(res);
      if (!config) return;
      const dueRecipients = getDueRecipients(config.recipients);
      json(res, {
        recipientCount: config.recipients.length,
        confirmedCount: config.recipients.filter((r) => r.testTxConfirmed).length,
        dueCount: dueRecipients.length,
        recipients: config.recipients.map((r) => {
          const history = r.history || [];
          return {
            name: r.name,
            schedule: r.schedule,
            isDue: r.testTxConfirmed && isDue(r),
            nextDue: nextDueDate(r),
            lastPaid: r.lastPaidDate,
            paid: r.paid,
            totalPaidZec: history.reduce((s, h) => s + h.amountZec, 0),
            totalPayments: history.length,
          };
        }),
      });
      return;
    }

    // ── Telegram config ──
    if (url === "/api/telegram" && req.method === "GET") {
      const config = requireAuth(res);
      if (!config) return;
      json(res, {
        chatId: config.telegram?.chatId ?? "",
        enabled: config.telegram?.enabled ?? false,
        botConfigured: hasBotToken(),
      });
      return;
    }

    if (url === "/api/telegram" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      const { chatId, enabled } = JSON.parse(await readBody(req));
      config.telegram = {
        chatId: chatId ?? config.telegram?.chatId ?? "",
        enabled: enabled ?? config.telegram?.enabled ?? false,
      };
      await persist();
      json(res, { ok: true });
      return;
    }

    if (url === "/api/telegram/test" && req.method === "POST") {
      const config = requireAuth(res);
      if (!config) return;
      if (!hasBotToken()) return error(res, "TELEGRAM_BOT_TOKEN not configured on server");
      if (!config.telegram?.chatId) return error(res, "Telegram chat ID is required");
      const err = await sendTestMessage(config.telegram.chatId);
      if (err) return error(res, `Telegram error: ${err}. Make sure you've started a conversation with the bot first.`);
      json(res, { ok: true });
      return;
    }

    console.log(`404: ${req.method} ${url}`);
    error(res, "Not found", 404);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    error(res, msg, 500);
  }
});

server.listen(PORT, () => {
  console.log(`ZEC Payroll API running on http://localhost:${PORT}`);
});

// ── Biweekly Telegram notification cron (every other Monday at 9am) ──
cron.schedule("0 9 */14 * *", async () => {
  if (!cachedConfig?.telegram?.enabled) return;
  console.log("[cron] Checking for due payments...");
  const due = getDueRecipients(cachedConfig.recipients);
  if (due.length === 0) {
    console.log("[cron] No payments due.");
    return;
  }
  const ok = await sendDuePaymentNotification(
    cachedConfig.telegram,
    cachedConfig.recipients,
    cachedConfig.zecPriceUsd,
  );
  console.log(`[cron] Telegram notification ${ok ? "sent" : "failed"} (${due.length} due)`);
});
