import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = process.env.TOLLGATE_DATA_DIR || path.join(os.homedir(), ".tollgate");
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "agent.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      receipt_id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      action_id TEXT NOT NULL,
      amount_msats INTEGER NOT NULL,
      payment_hash TEXT NOT NULL,
      preimage TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT NOT NULL,
      service_pubkey TEXT NOT NULL,
      service_signature TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recv_domain ON receipts(domain);
    CREATE INDEX IF NOT EXISTS idx_recv_created ON receipts(created_at DESC);
  `);
  return db;
}

export function recordReceipt(r: {
  receipt_id: string;
  domain: string;
  action_id: string;
  amount_msats: number;
  payment_hash: string;
  preimage: string;
  input_json: string;
  output_json: string;
  service_pubkey: string;
  service_signature: string;
  completed_at: string;
}) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO receipts
       (receipt_id, domain, action_id, amount_msats, payment_hash, preimage, input_json, output_json, service_pubkey, service_signature, completed_at, created_at)
       VALUES (@receipt_id, @domain, @action_id, @amount_msats, @payment_hash, @preimage, @input_json, @output_json, @service_pubkey, @service_signature, @completed_at, @created_at)`,
    )
    .run({ ...r, created_at: Date.now() });
}

export function todaysSpendMsats(): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const r = getDb()
    .prepare(`SELECT COALESCE(SUM(amount_msats), 0) AS total FROM receipts WHERE created_at >= ?`)
    .get(startOfDay.getTime()) as { total: number };
  return r.total;
}

export function spendSummary(period: "today" | "week" | "all" = "today") {
  const now = Date.now();
  let cutoff = 0;
  if (period === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    cutoff = d.getTime();
  } else if (period === "week") {
    cutoff = now - 7 * 24 * 60 * 60 * 1000;
  }
  const where = cutoff > 0 ? `WHERE created_at >= ${cutoff}` : "";
  const total = getDb()
    .prepare(`SELECT COALESCE(SUM(amount_msats), 0) AS total, COUNT(*) AS count FROM receipts ${where}`)
    .get() as { total: number; count: number };
  const byDomain = getDb()
    .prepare(`SELECT domain, COUNT(*) AS count, COALESCE(SUM(amount_msats), 0) AS total_msats
              FROM receipts ${where} GROUP BY domain ORDER BY total_msats DESC LIMIT 20`)
    .all() as Array<{ domain: string; count: number; total_msats: number }>;
  const recent = getDb()
    .prepare(`SELECT receipt_id, domain, action_id, amount_msats, completed_at, created_at
              FROM receipts ${where} ORDER BY created_at DESC LIMIT 20`)
    .all() as Array<{
    receipt_id: string;
    domain: string;
    action_id: string;
    amount_msats: number;
    completed_at: string;
    created_at: number;
  }>;
  return { period, total_msats: total.total, count: total.count, by_domain: byDomain, recent };
}

export function isKnownService(domain: string): boolean {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM receipts WHERE domain = ?`)
    .get(domain) as { c: number };
  return r.c > 0;
}
