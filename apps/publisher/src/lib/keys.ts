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

export function signReceipt(payload: object): string {
  const { privateKey } = getServiceKeys();
  const msg = Buffer.from(JSON.stringify(payload));
  const sig = crypto.sign(null, msg, privateKey);
  return sig.toString("hex");
}
