import { NWCClient } from "@getalby/sdk";
const wallet = new NWCClient({ nostrWalletConnectUrl: process.env.NWC });
// step 1: make invoice 1 sat
const inv = await wallet.makeInvoice({ amount: 1000, description: "probe", expiry: 600 });
console.log("MAKE_INVOICE response:");
console.log(JSON.stringify(inv, null, 2));
console.log("---");
// step 2: pay it
const pay = await wallet.payInvoice({ invoice: inv.invoice });
console.log("PAY_INVOICE response:");
console.log(JSON.stringify(pay, null, 2));
console.log("---");
// step 3: lookup the invoice via the wallet
try {
  const look = await wallet.lookupInvoice({ payment_hash: inv.payment_hash });
  console.log("LOOKUP_INVOICE response:");
  console.log(JSON.stringify(look, null, 2));
} catch (e) {
  console.log("lookup failed:", e?.message);
}
