import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import type { Recipient, PaySchedule } from "./types.js";

export function importCsv(filePath: string): Recipient[] {
  const content = readFileSync(filePath, "utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  return records.map((row, i) => {
    const name = row["name"] || row["Name"];
    const wallet = row["wallet"] || row["Wallet"] || row["address"] || row["Address"];
    const amountStr = row["amount"] || row["Amount"];
    const currency = (row["currency"] || row["Currency"] || "ZEC").toUpperCase();
    const schedule = (row["schedule"] || row["Schedule"] || "monthly").toLowerCase();
    const memo = row["memo"] || row["Memo"] || "";
    const avatar = row["avatar"] || row["Avatar"] || "";
    const group = row["group"] || row["Group"] || "";
    const usdcAddress = row["usdc_address"] || row["usdcAddress"] || row["USDC Address"] || "";
    const usdcChain = (row["usdc_chain"] || row["usdcChain"] || row["USDC Chain"] || "").toLowerCase();

    if (!name || !wallet || !amountStr) {
      throw new Error(`Row ${i + 1}: missing required field (name, wallet, or amount)`);
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Row ${i + 1}: invalid amount "${amountStr}"`);
    }

    if (!["USD", "ZEC", "USDC"].includes(currency)) {
      throw new Error(`Row ${i + 1}: currency must be USD, ZEC, or USDC (got "${currency}")`);
    }

    const validSchedules = ["weekly", "biweekly", "monthly", "one-time"];
    if (!validSchedules.includes(schedule)) {
      throw new Error(`Row ${i + 1}: schedule must be weekly, biweekly, monthly, or one-time (got "${schedule}")`);
    }

    if (currency === "USDC" && !usdcAddress) {
      throw new Error(`Row ${i + 1}: USDC recipients require a usdc_address`);
    }

    const validChains = ["ethereum", "solana", "near", "base", "arbitrum", "polygon"];
    if (currency === "USDC" && usdcChain && !validChains.includes(usdcChain)) {
      throw new Error(`Row ${i + 1}: usdc_chain must be one of ${validChains.join(", ")} (got "${usdcChain}")`);
    }

    return {
      name,
      wallet,
      amount,
      currency: currency as "USD" | "ZEC" | "USDC",
      schedule: schedule as PaySchedule,
      memo,
      avatar: avatar || undefined,
      group: group || undefined,
      usdcAddress: usdcAddress || undefined,
      usdcChain: (usdcChain || "ethereum") as Recipient["usdcChain"],
      testTxSent: false,
      testTxConfirmed: false,
      lastPaidDate: null,
      paid: false,
      history: [],
    };
  });
}
