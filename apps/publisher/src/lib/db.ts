import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const newDb = path.join(dir, "faregate.db");
  const oldDb = path.join(dir, "tollgate.db");
  // Keep using the legacy file if it exists (preserves prior receipts).
  const dbFile = !fs.existsSync(newDb) && fs.existsSync(oldDb) ? oldDb : newDb;
  db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      receipt_id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      amount_msats INTEGER NOT NULL,
      payment_hash TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      output_hash TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      service_pubkey TEXT NOT NULL,
      signature TEXT NOT NULL,
      buyer_pubkey TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at DESC);

    CREATE TABLE IF NOT EXISTS challenges (
      payment_hash TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      amount_msats INTEGER NOT NULL,
      issued_at INTEGER NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0
    );
  `);
  // Migration: add buyer_pubkey if upgrading from a pre-Nostr-feedback DB.
  const cols = db
    .prepare(`PRAGMA table_info(receipts)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "buyer_pubkey")) {
    db.exec(`ALTER TABLE receipts ADD COLUMN buyer_pubkey TEXT;`);
  }
  return db;
}

export function insertReceipt(r: {
  receipt_id: string;
  action_id: string;
  amount_msats: number;
  payment_hash: string;
  input_hash: string;
  output_hash: string;
  completed_at: string;
  service_pubkey: string;
  signature: string;
  buyer_pubkey?: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO receipts (receipt_id, action_id, amount_msats, payment_hash, input_hash, output_hash, completed_at, service_pubkey, signature, buyer_pubkey, created_at)
       VALUES (@receipt_id, @action_id, @amount_msats, @payment_hash, @input_hash, @output_hash, @completed_at, @service_pubkey, @signature, @buyer_pubkey, @created_at)`,
    )
    .run({
      buyer_pubkey: null,
      ...r,
      created_at: Date.now(),
    });
}

export function listRecentReceipts(limit = 50) {
  return getDb()
    .prepare(
      `SELECT * FROM receipts ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as Array<{
    receipt_id: string;
    action_id: string;
    amount_msats: number;
    payment_hash: string;
    input_hash: string;
    output_hash: string;
    completed_at: string;
    service_pubkey: string;
    signature: string;
    buyer_pubkey: string | null;
    created_at: number;
  }>;
}

export function totalRevenueMsats(): number {
  const r = getDb()
    .prepare(`SELECT COALESCE(SUM(amount_msats), 0) AS total FROM receipts`)
    .get() as { total: number };
  return r.total;
}

export function revenueByAction() {
  return getDb()
    .prepare(
      `SELECT action_id, COUNT(*) AS count, COALESCE(SUM(amount_msats), 0) AS total_msats
       FROM receipts GROUP BY action_id ORDER BY total_msats DESC`,
    )
    .all() as Array<{ action_id: string; count: number; total_msats: number }>;
}

export function recordChallenge(c: {
  payment_hash: string;
  action_id: string;
  input_hash: string;
  raw_input: string;
  amount_msats: number;
}) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO challenges (payment_hash, action_id, input_hash, raw_input, amount_msats, issued_at, consumed)
       VALUES (@payment_hash, @action_id, @input_hash, @raw_input, @amount_msats, @issued_at, 0)`,
    )
    .run({ ...c, issued_at: Date.now() });
}

export function getChallenge(paymentHash: string) {
  return getDb()
    .prepare(`SELECT * FROM challenges WHERE payment_hash = ?`)
    .get(paymentHash.toLowerCase()) as
    | {
        payment_hash: string;
        action_id: string;
        input_hash: string;
        raw_input: string;
        amount_msats: number;
        issued_at: number;
        consumed: number;
      }
    | undefined;
}

export function markChallengeConsumed(paymentHash: string) {
  getDb()
    .prepare(`UPDATE challenges SET consumed = 1 WHERE payment_hash = ?`)
    .run(paymentHash.toLowerCase());
}
