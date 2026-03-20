import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { encrypt, decrypt } from "./crypto.js";
import type {
  PayrollConfig,
  Recipient,
  TelegramConfig,
  PaymentRecord,
} from "./types.js";

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
export { prisma };

// ── Lightweight single-recipient updates (no re-encryption) ──

export async function updateRecipientFlags(
  vaultId: string,
  name: string,
  flags: { testTxSent?: boolean; testTxConfirmed?: boolean; lastPaidDate?: string | null; paid?: boolean },
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (flags.testTxSent !== undefined) data.testTxSent = flags.testTxSent;
  if (flags.testTxConfirmed !== undefined) data.testTxConfirmed = flags.testTxConfirmed;
  if (flags.lastPaidDate !== undefined) data.lastPaidDate = flags.lastPaidDate ? new Date(flags.lastPaidDate) : null;
  if (flags.paid !== undefined) data.paid = flags.paid;
  await prisma.recipient.update({
    where: { vaultId_nameLookup: { vaultId, nameLookup: name.toLowerCase() } },
    data,
  });
}

// ── Probe: known plaintext used for passphrase verification ──

const PROBE_PLAINTEXT = "zcash-payroll-ok";

// ── Encrypted field helpers ──

interface RecipientSensitive {
  name: string;
  wallet: string;
  memo?: string;
  avatar?: string;
  usdcAddress?: string;
  usdcChain?: string;
}

function encryptSensitive(data: RecipientSensitive, passphrase: string): string {
  return encrypt(JSON.stringify(data), passphrase);
}

function decryptSensitive(encrypted: string, passphrase: string): RecipientSensitive {
  return JSON.parse(decrypt(encrypted, passphrase));
}

// ── Public store API ──

/**
 * Create a new vault. Returns the vault ID.
 */
export async function initVault(passphrase: string): Promise<string> {
  const probe = encrypt(PROBE_PLAINTEXT, passphrase);
  const vault = await prisma.vault.create({ data: { probe } });
  await prisma.settings.create({ data: { vaultId: vault.id } });
  return vault.id;
}

/**
 * Try to unlock by iterating all vaults and trial-decrypting the probe.
 * Returns the vault ID if a match is found, null otherwise.
 */
export async function unlockVault(passphrase: string): Promise<string | null> {
  const vaults = await prisma.vault.findMany({ select: { id: true, probe: true } });
  for (const vault of vaults) {
    try {
      const result = decrypt(vault.probe, passphrase);
      if (result === PROBE_PLAINTEXT) return vault.id;
    } catch {
      // wrong passphrase for this vault, try next
    }
  }
  return null;
}

/**
 * Check if any vaults exist.
 */
export async function hasVaults(): Promise<boolean> {
  const count = await prisma.vault.count();
  return count > 0;
}

// ── Load full config for a vault ──

export async function loadConfig(
  vaultId: string,
  passphrase: string,
): Promise<PayrollConfig> {
  const dbRecipients = await prisma.recipient.findMany({
    where: { vaultId },
    include: { history: { orderBy: { date: "asc" } } },
  });

  const recipients: Recipient[] = dbRecipients.map((r) => {
    const sensitive = decryptSensitive(r.encryptedData, passphrase);
    return {
      name: sensitive.name,
      wallet: sensitive.wallet,
      memo: sensitive.memo,
      avatar: sensitive.avatar,
      usdcAddress: sensitive.usdcAddress,
      usdcChain: sensitive.usdcChain as Recipient["usdcChain"],
      amount: r.amount,
      currency: r.currency as Recipient["currency"],
      schedule: r.schedule as Recipient["schedule"],
      group: r.groupName ?? undefined,
      testTxSent: r.testTxSent,
      testTxConfirmed: r.testTxConfirmed,
      lastPaidDate: r.lastPaidDate?.toISOString() ?? null,
      paid: r.paid,
      history: r.history.map((h) => ({
        date: h.date.toISOString(),
        amountZec: h.amountZec,
        amountOriginal: h.amountOriginal,
        currency: h.currency as PaymentRecord["currency"],
        zecPriceUsd: h.zecPriceUsd,
      })),
    };
  });

  const settings = await prisma.settings.findUnique({ where: { vaultId } });
  let telegram: TelegramConfig | undefined;
  if (settings?.encryptedTelegram) {
    try {
      telegram = JSON.parse(decrypt(settings.encryptedTelegram, passphrase));
    } catch {
      telegram = undefined;
    }
  }

  return {
    recipients,
    zecPriceUsd: settings?.zecPriceUsd ?? null,
    telegram,
  };
}

// ── Save full config for a vault ──

export async function saveConfig(
  vaultId: string,
  config: PayrollConfig,
  passphrase: string,
): Promise<void> {
  // Save settings
  const encryptedTelegram = config.telegram
    ? encrypt(JSON.stringify(config.telegram), passphrase)
    : null;

  await prisma.settings.upsert({
    where: { vaultId },
    update: {
      zecPriceUsd: config.zecPriceUsd,
      encryptedTelegram,
    },
    create: {
      vaultId,
      zecPriceUsd: config.zecPriceUsd,
      encryptedTelegram,
    },
  });

  // Get current DB recipients for diffing
  const existing = await prisma.recipient.findMany({
    where: { vaultId },
    select: { id: true, nameLookup: true },
  });
  const existingByName = new Map(existing.map((r) => [r.nameLookup, r.id]));
  const configNames = new Set(config.recipients.map((r) => r.name.toLowerCase()));

  // Delete removed recipients
  const toDelete = existing.filter((r) => !configNames.has(r.nameLookup));
  if (toDelete.length > 0) {
    await prisma.recipient.deleteMany({
      where: { id: { in: toDelete.map((r) => r.id) } },
    });
  }

  // Upsert each recipient
  for (const r of config.recipients) {
    const nameLookup = r.name.toLowerCase();
    const encryptedData = encryptSensitive(
      { name: r.name, wallet: r.wallet, memo: r.memo, avatar: r.avatar, usdcAddress: r.usdcAddress, usdcChain: r.usdcChain },
      passphrase,
    );

    const dbId = existingByName.get(nameLookup);

    if (dbId) {
      await prisma.recipient.update({
        where: { id: dbId },
        data: {
          encryptedData,
          amount: r.amount,
          currency: r.currency,
          schedule: r.schedule,
          groupName: r.group ?? null,
          testTxSent: r.testTxSent,
          testTxConfirmed: r.testTxConfirmed,
          lastPaidDate: r.lastPaidDate ? new Date(r.lastPaidDate) : null,
          paid: r.paid,
        },
      });

      // Sync payment history
      await prisma.paymentRecord.deleteMany({ where: { recipientId: dbId } });
      if (r.history.length > 0) {
        await prisma.paymentRecord.createMany({
          data: r.history.map((h) => ({
            recipientId: dbId,
            date: new Date(h.date),
            amountZec: h.amountZec,
            amountOriginal: h.amountOriginal,
            currency: h.currency,
            zecPriceUsd: h.zecPriceUsd,
          })),
        });
      }
    } else {
      await prisma.recipient.upsert({
        where: { vaultId_nameLookup: { vaultId, nameLookup } },
        update: {
          encryptedData,
          amount: r.amount,
          currency: r.currency,
          schedule: r.schedule,
          groupName: r.group ?? null,
          testTxSent: r.testTxSent,
          testTxConfirmed: r.testTxConfirmed,
          lastPaidDate: r.lastPaidDate ? new Date(r.lastPaidDate) : null,
          paid: r.paid,
        },
        create: {
          vaultId,
          encryptedData,
          nameLookup,
          amount: r.amount,
          currency: r.currency,
          schedule: r.schedule,
          groupName: r.group ?? null,
          testTxSent: r.testTxSent,
          testTxConfirmed: r.testTxConfirmed,
          lastPaidDate: r.lastPaidDate ? new Date(r.lastPaidDate) : null,
          paid: r.paid,
        },
      });
    }
  }
}
