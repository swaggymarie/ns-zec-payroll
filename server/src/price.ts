import https from "https";

export async function fetchZecPrice(): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd";
    const opts = {
      headers: { "User-Agent": "zcash-payroll/1.0", "Accept": "application/json" },
    };
    https
      .get(url, opts, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`CoinGecko returned HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            const price = json?.zcash?.usd;
            if (typeof price !== "number" || price <= 0) {
              reject(new Error("Invalid price response from CoinGecko"));
            } else {
              resolve(price);
            }
          } catch {
            reject(new Error("Failed to parse CoinGecko response"));
          }
        });
      })
      .on("error", reject);
  });
}

export function usdToZec(usdAmount: number, zecPriceUsd: number): number {
  return parseFloat((usdAmount / zecPriceUsd).toFixed(8));
}
