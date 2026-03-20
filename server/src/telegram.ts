import type { TelegramConfig, Recipient } from "./types.js";
import { getDueRecipients } from "./schedule.js";

const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN environment variable is not set");
  return token;
}

async function sendMessage(chatId: string, text: string): Promise<string | null> {
  const token = getBotToken();
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      const body = await res.json() as { description?: string };
      const msg = body.description || `HTTP ${res.status}`;
      console.error(`Telegram API error: ${msg}`);
      return msg;
    }
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Telegram send failed:", msg);
    return msg;
  }
}

export function hasBotToken(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export async function sendTestMessage(chatId: string): Promise<string | null> {
  return sendMessage(chatId, "✅ *ZEC Payroll* — Telegram notifications are working!");
}

export async function sendDuePaymentNotification(
  config: TelegramConfig,
  recipients: Recipient[],
  zecPriceUsd: number | null,
): Promise<boolean> {
  const due = getDueRecipients(recipients);
  if (due.length === 0) return false;

  const lines = [
    `💰 *ZEC Payroll — Payments Due*`,
    ``,
    `*${due.length}* recipient${due.length !== 1 ? "s" : ""} due for payment:`,
    ``,
  ];

  for (const r of due) {
    const amount = r.currency === "ZEC"
      ? `${r.amount} ZEC`
      : `${r.amount} ${r.currency}`;
    lines.push(`• *${r.name}* — ${amount}`);
  }

  if (zecPriceUsd) {
    lines.push(``);
    lines.push(`📊 ZEC Price: $${zecPriceUsd.toFixed(2)}`);
  }

  lines.push(``);
  lines.push(`Open your payroll dashboard to initiate payment.`);

  const result = await sendMessage(config.chatId, lines.join("\n"));
  return result !== null;
}
