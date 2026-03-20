const BASE = (import.meta.env.VITE_API_URL || "") + "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  const text = await res.text();
  if (!text) throw new Error(`Empty response from ${path} (HTTP ${res.status})`);
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 100)}`);
  }
  if (!res.ok) throw new Error((data as Record<string, string>).error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  generatePassphrase: () => request<{ passphrase: string }>("/generate-passphrase"),
  status: () => request<{ unlocked: boolean }>("/status"),
  unlock: (passphrase: string) => request<{ ok: boolean }>("/unlock", { method: "POST", body: JSON.stringify({ passphrase }) }),
  init: (passphrase: string) => request<{ ok: boolean }>("/init", { method: "POST", body: JSON.stringify({ passphrase }) }),
  lock: () => request<{ ok: boolean }>("/lock", { method: "POST" }),

  getRecipients: () => request<{ recipients: Recipient[] }>("/recipients"),
  getRecipient: (name: string) => request<RecipientDetail>(`/recipients/${encodeURIComponent(name)}`),
  addRecipient: (r: Partial<Recipient>) => request<{ ok: boolean; total: number }>("/recipients", { method: "POST", body: JSON.stringify(r) }),
  deleteRecipient: (name: string) => request<{ ok: boolean }>(`/recipients/${encodeURIComponent(name)}`, { method: "DELETE" }),
  updateRecipient: (name: string, updates: Partial<Recipient>) => request<{ ok: boolean }>(`/recipients/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify(updates) }),

  importCsv: (csv: string) => request<{ ok: boolean; imported: number; total: number }>("/import", { method: "POST", body: JSON.stringify({ csv }) }),

  testTx: (name: string) => request<{ uri: string; name: string }>("/test-tx", { method: "POST", body: JSON.stringify({ name }) }),
  confirmTest: (name: string) => request<{ ok: boolean }>("/confirm-test", { method: "POST", body: JSON.stringify({ name }) }),

  getPrice: () => request<{ price: number; cached?: boolean }>("/price"),
  setPrice: (price: number) => request<{ ok: boolean; price: number }>("/price", { method: "POST", body: JSON.stringify({ price }) }),

  preview: () => request<PreviewResponse>("/preview"),
  pay: () => request<PayResponse>("/pay", { method: "POST" }),
  confirmPay: () => request<{ ok: boolean }>("/confirm-pay", { method: "POST" }),

  schedule: () => request<ScheduleResponse>("/schedule"),

  getTelegram: () => request<TelegramConfig>("/telegram"),
  setTelegram: (config: { chatId: string; enabled: boolean }) => request<{ ok: boolean }>("/telegram", { method: "POST", body: JSON.stringify(config) }),
  testTelegram: () => request<{ ok: boolean }>("/telegram/test", { method: "POST" }),
};

export interface TelegramConfig {
  chatId: string;
  enabled: boolean;
  botConfigured: boolean;
}

export type PaySchedule = "weekly" | "biweekly" | "monthly" | "one-time";

export interface PaymentRecord {
  date: string;
  amountZec: number;
  amountOriginal: number;
  currency: "USD" | "ZEC" | "USDC";
  zecPriceUsd: number | null;
}

export interface Recipient {
  name: string;
  wallet: string;
  amount: number;
  currency: "USD" | "ZEC" | "USDC";
  schedule: PaySchedule;
  memo?: string;
  avatar?: string;
  testTxSent: boolean;
  testTxConfirmed: boolean;
  lastPaidDate: string | null;
  paid: boolean;
  history: PaymentRecord[];
}

export interface RecipientDetail extends Recipient {
  totalPaidZec: number;
  totalPayments: number;
  nextDueDate: string | null;
}

export interface BatchPayment {
  name: string;
  wallet: string;
  amountZec: number;
  currency: "ZEC" | "USDC";
  memo: string;
  isTestTx: boolean;
}

export interface PreviewResponse {
  payments: BatchPayment[];
  totalZec: number;
  totalUsd: number;
  zecPrice: number;
  recipientCount: number;
}

export interface PayResponse {
  zec?: { uri: string; payments: BatchPayment[]; totalZec: number };
  usdc?: { uri: string; payments: BatchPayment[]; totalZec: number; note: string };
}

export interface ScheduleResponse {
  recipientCount: number;
  confirmedCount: number;
  dueCount: number;
  recipients: {
    name: string;
    schedule: PaySchedule;
    isDue: boolean;
    nextDue: string | null;
    lastPaid: string | null;
    paid: boolean;
    totalPaidZec: number;
    totalPayments: number;
  }[];
}
