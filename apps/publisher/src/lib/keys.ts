import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let cached: { publicKey: string; privateKey: crypto.KeyObject } | null = null;

function dataDir() {
  const d = path.join(process.cwd(), "data");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function getServiceKeys() {
  if (cached) return cached;
  const dir = dataDir();
  const skPath = path.join(dir, "service.ed25519.pem");
  let privateKey: crypto.KeyObject;
  if (fs.existsSync(skPath)) {
    privateKey = crypto.createPrivateKey(fs.readFileSync(skPath));
  } else {
    const kp = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(skPath, kp.privateKey.export({ format: "pem", type: "pkcs8" }) as Buffer | string);
    privateKey = kp.privateKey;
  }
  const publicKey = crypto
    .createPublicKey(privateKey)
    .export({ format: "der", type: "spki" })
    .toString("hex");
  cached = { publicKey, privateKey };
  return cached;
}

/**
 * Canonical core fields of a receipt, used for signing AND for downstream
 * verification (e.g. by Nostr feedback aggregators).
 *
 * Fixed alphabetical key order; absent optional fields (buyer_pubkey) are
 * omitted entirely so old receipts and new receipts can be verified by the
 * same routine.
 */
export type ReceiptCore = {
  action_id: string;
  amount_msats: number;
  buyer_pubkey?: string;
  completed_at: string;
  input_hash: string;
  output_hash: string;
  payment_hash: string;
  receipt_id: string;
  service_pubkey: string;
};

const CORE_KEYS: (keyof ReceiptCore)[] = [
  "action_id",
  "amount_msats",
  "buyer_pubkey",
  "completed_at",
  "input_hash",
  "output_hash",
  "payment_hash",
  "receipt_id",
  "service_pubkey",
];

export function canonicalReceiptCore(r: ReceiptCore): string {
  const present = CORE_KEYS.filter((k) => r[k] !== undefined);
  return JSON.stringify(r, present);
}

export function signReceipt(core: ReceiptCore): string {
  const { privateKey } = getServiceKeys();
  const msg = Buffer.from(canonicalReceiptCore(core));
  const sig = crypto.sign(null, msg, privateKey);
  return sig.toString("hex");
}
