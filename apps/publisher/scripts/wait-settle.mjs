import { NWCClient } from "@getalby/sdk";
const HASH = process.env.PH;
const URL = process.env.NWC;
const w = new NWCClient({ nostrWalletConnectUrl: URL });
const t0 = Date.now();
let attempt = 0;
while (true) {
  attempt++;
  try {
    const inv = await w.lookupInvoice({ payment_hash: HASH });
    const elapsed = Math.round((Date.now() - t0) / 1000);
    process.stdout.write(`t+${elapsed}s state=${inv.state}\n`);
    if (inv.state === "settled") {
      process.stdout.write(`SETTLED after ${elapsed}s on attempt ${attempt}\n`);
      process.exit(0);
    }
  } catch (e) {
    process.stdout.write(`t+? lookup error: ${e?.message ?? e}\n`);
  }
  await new Promise((r) => setTimeout(r, 30000));
}
