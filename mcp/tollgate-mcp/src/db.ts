import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let db: Database.Database | null = null;

function resolveDataDir(): string {
  const explicit = process.env.FAREGATE_DATA_DIR || process.env.TOLLGATE_DATA_DIR;
  if (explicit) return explicit;
  const home = os.homedir();
  const newPath = path.join(home, ".faregate");
  const oldPath = path.join(home, ".tollgate");
  if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) return oldPath;
  return newPath;
}

export function getDb(): Database.Database {
  if (db) return db;
  const dir = resolveDataDir();
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
      buyer_pubkey TEXT,
      receipt_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recv_domain ON receipts(domain);
    CREATE INDEX IF NOT EXISTS idx_recv_created ON receipts(created_at DESC);

    CREATE TABLE IF NOT EXISTS feedback_published (
      receipt_id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      service_pubkey TEXT NOT NULL,
      score REAL NOT NULL,
      event_id TEXT NOT NULL,
      relays_accepted TEXT NOT NULL,
      published_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reputation_cache (
      service_pubkey TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rater_diversity_cache (
      rater_pubkey TEXT PRIMARY KEY,
      distinct_services INTEGER NOT NULL,
      total_ratings INTEGER NOT NULL,
      cached_at INTEGER NOT NULL
    );
  `);
  // Migrations for older agent.db files.
  const cols = db
    .prepare(`PRAGMA table_info(receipts)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "buyer_pubkey")) {
    db.exec(`ALTER TABLE receipts ADD COLUMN buyer_pubkey TEXT;`);
  }
  if (!cols.some((c) => c.name === "receipt_json")) {
    db.exec(`ALTER TABLE receipts ADD COLUMN receipt_json TEXT;`);
  }
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
  buyer_pubkey?: string;
  receipt_json?: string;
}) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO receipts
       (receipt_id, domain, action_id, amount_msats, payment_hash, preimage, input_json, output_json, service_pubkey, service_signature, completed_at, buyer_pubkey, receipt_json, created_at)
       VALUES (@receipt_id, @domain, @action_id, @amount_msats, @payment_hash, @preimage, @input_json, @output_json, @service_pubkey, @service_signature, @completed_at, @buyer_pubkey, @receipt_json, @created_at)`,
    )
    .run({
      buyer_pubkey: null,
      receipt_json: null,
      ...r,
      created_at: Date.now(),
    });
}

export type StoredReceipt = {
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
  buyer_pubkey: string | null;
  receipt_json: string | null;
  created_at: number;
};

export function getStoredReceipt(receipt_id: string): StoredReceipt | undefined {
  return getDb()
    .prepare(`SELECT * FROM receipts WHERE receipt_id = ?`)
    .get(receipt_id) as StoredReceipt | undefined;
}

export function recordFeedbackPublished(r: {
  receipt_id: string;
  domain: string;
  service_pubkey: string;
  score: number;
  event_id: string;
  relays_accepted: string[];
}) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO feedback_published
       (receipt_id, domain, service_pubkey, score, event_id, relays_accepted, published_at)
       VALUES (@receipt_id, @domain, @service_pubkey, @score, @event_id, @relays_accepted, @published_at)`,
    )
    .run({
      ...r,
      relays_accepted: JSON.stringify(r.relays_accepted),
      published_at: Date.now(),
    });
}

export function getCachedReputation(service_pubkey: string, ttlMs = 5 * 60 * 1000) {
  const row = getDb()
    .prepare(`SELECT * FROM reputation_cache WHERE service_pubkey = ?`)
    .get(service_pubkey) as
    | { service_pubkey: string; domain: string; summary_json: string; cached_at: number }
    | undefined;
  if (!row) return null;
  if (Date.now() - row.cached_at > ttlMs) return null;
  return {
    cached_at: row.cached_at,
    summary: JSON.parse(row.summary_json),
  };
}

export function putCachedReputation(opts: {
  service_pubkey: string;
  domain: string;
  summary: unknown;
}) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO reputation_cache
       (service_pubkey, domain, summary_json, cached_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(opts.service_pubkey, opts.domain, JSON.stringify(opts.summary), Date.now());
}

export type RaterDiversity = {
  rater_pubkey: string;
  distinct_services: number;
  total_ratings: number;
  cached_at: number;
};

export function getCachedRaterDiversity(
  rater_pubkey: string,
  ttlMs = 60 * 60 * 1000, // 1 hour
): RaterDiversity | null {
  const row = getDb()
    .prepare(`SELECT * FROM rater_diversity_cache WHERE rater_pubkey = ?`)
    .get(rater_pubkey) as RaterDiversity | undefined;
  if (!row) return null;
  if (Date.now() - row.cached_at > ttlMs) return null;
  return row;
}

export function putCachedRaterDiversity(d: {
  rater_pubkey: string;
  distinct_services: number;
  total_ratings: number;
}) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO rater_diversity_cache
       (rater_pubkey, distinct_services, total_ratings, cached_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(d.rater_pubkey, d.distinct_services, d.total_ratings, Date.now());
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
