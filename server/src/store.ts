import { readFileSync, writeFileSync, existsSync } from "fs";
import { encrypt, decrypt } from "./crypto.js";
import type { PayrollConfig } from "./types.js";

const DATA_FILE = "payroll.enc";

const DEFAULT_CONFIG: PayrollConfig = {
  recipients: [],
  zecPriceUsd: null,
};

export function load(passphrase: string): PayrollConfig {
  if (!existsSync(DATA_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(DATA_FILE, "utf8");
  const json = decrypt(raw, passphrase);
  return JSON.parse(json) as PayrollConfig;
}

export function save(config: PayrollConfig, passphrase: string): void {
  const json = JSON.stringify(config, null, 2);
  const enc = encrypt(json, passphrase);
  writeFileSync(DATA_FILE, enc, "utf8");
}
