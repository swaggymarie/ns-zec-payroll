export type PaySchedule = "weekly" | "biweekly" | "monthly" | "one-time";

export interface PaymentRecord {
  date: string; // ISO date
  amountZec: number;
  amountOriginal: number; // original amount in their currency
  currency: "USD" | "ZEC" | "USDC";
  zecPriceUsd: number | null; // ZEC price at time of payment
}

export type UsdcChain = "ethereum" | "solana" | "near" | "base" | "arbitrum" | "polygon";

export interface Recipient {
  name: string;
  wallet: string; // Zcash shielded address (sapling or unified)
  amount: number;
  currency: "USD" | "ZEC" | "USDC";
  schedule: PaySchedule;
  group?: string; // e.g. "Engineering", "Design", "Marketing"
  memo?: string;
  avatar?: string; // URL to profile picture
  usdcAddress?: string; // destination address for USDC CrossPay
  usdcChain?: UsdcChain; // chain for USDC payout
  testTxSent: boolean;
  testTxConfirmed: boolean;
  lastPaidDate: string | null; // ISO date
  paid: boolean; // for one-time: marks as completed
  history: PaymentRecord[]; // payment history
}

export interface TelegramConfig {
  chatId: string;
  enabled: boolean;
}

export interface PayrollConfig {
  recipients: Recipient[];
  zecPriceUsd: number | null; // cached price for USD conversion
  telegram?: TelegramConfig;
}

export interface PayrollBatch {
  id: string;
  createdAt: string;
  recipients: BatchPayment[];
  status: "preview" | "signed" | "sent";
  uri: string; // ZIP-321 URI
}

export interface BatchPayment {
  name: string;
  wallet: string;
  amountZec: number;
  currency: "ZEC" | "USDC";
  memo: string;
  isTestTx: boolean;
}
