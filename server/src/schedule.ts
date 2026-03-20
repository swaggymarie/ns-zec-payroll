import type { Recipient, PaySchedule, PaymentRecord } from "./types.js";

const INTERVAL_DAYS: Record<PaySchedule, number> = {
  "weekly": 7,
  "biweekly": 14,
  "monthly": 30,
  "one-time": 0,
};

/**
 * Determine if a recipient is due for payment today.
 */
export function isDue(r: Recipient): boolean {
  if (r.schedule === "one-time") {
    return !r.paid;
  }

  if (!r.lastPaidDate) return true;

  const last = new Date(r.lastPaidDate);
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return elapsed >= INTERVAL_DAYS[r.schedule];
}

/**
 * Mark a recipient as paid today.
 */
export function markPaid(r: Recipient, amountZec: number, zecPriceUsd: number | null): void {
  const today = new Date().toISOString().split("T")[0];
  r.lastPaidDate = today;
  if (r.schedule === "one-time") {
    r.paid = true;
  }
  if (!r.history) r.history = [];
  r.history.push({
    date: today,
    amountZec,
    amountOriginal: r.amount,
    currency: r.currency,
    zecPriceUsd,
  });
}

/**
 * Get the next due date for a recipient, or null if one-time and already paid.
 */
export function nextDueDate(r: Recipient): string | null {
  if (r.schedule === "one-time") {
    return r.paid ? null : "Now";
  }

  if (!r.lastPaidDate) return "Now";

  const last = new Date(r.lastPaidDate);
  const next = new Date(last);
  next.setDate(next.getDate() + INTERVAL_DAYS[r.schedule]);
  return next.toISOString().split("T")[0];
}

/**
 * Filter confirmed recipients to only those currently due.
 */
export function getDueRecipients(recipients: Recipient[]): Recipient[] {
  return recipients.filter((r) => r.testTxConfirmed && isDue(r));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
