// Armazenamento de contas e personagens. Com DATABASE_URL usa Postgres (ex.: Neon, gratuito);
// sem ela usa um arquivo local (desenvolvimento) — no Render gratuito esse arquivo some a cada reinício.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Account { id: string; username: string; pass: string; created: number }
export interface CharRow { slot: number; data: unknown; updated: number }

export interface Store {
  readonly kind: 'postgres' | 'arquivo';
  init(): Promise<void>;
  createAccount(username: string, pass: string): Promise<Account | null>;   // null = nome já existe
  findAccount(username: string): Promise<Account | null>;
  listChars(accountId: string): Promise<CharRow[]>;
  putChar(accountId: string, slot: number, data: unknown): Promise<void>;
  delChar(accountId: string, slot: number): Promise<void>;
}

class FileStore implements Store {
  readonly kind = 'arquivo' as const;
  private db: { accounts: Account[]; chars: Record<string, CharRow[]> } = { accounts: [], chars: {} };
  private timer?: NodeJS.Timeout;
  constructor(private path: string) {}
  async init() {
    try { if (existsSync(this.path)) this.db = JSON.parse(readFileSync(this.path, 'utf8')); } catch { /* arquivo novo */ }
  }
  private flush() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { try { mkdirSync(dirname(this.path), { recursive: true }); writeFileSync(this.path, JSON.stringify(this.db)); } catch { /* ignora */ } }, 300);
  }
  async createAccount(username: string, pass: string) {
    if (this.db.accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) return null;
    const a: Account = { id: String(Date.now()) + Math.floor(Math.random() * 1e6), username, pass, created: Date.now() };
    this.db.accounts.push(a); this.flush(); return a;
  }
  async findAccount(username: string) { return this.db.accounts.find((a) => a.username.toLowerCase() === username.toLowerCase()) ?? null; }
  async listChars(id: string) { return this.db.chars[id] ?? []; }
  async putChar(id: string, slot: number, data: unknown) {
    const l = (this.db.chars[id] ??= []).filter((c) => c.slot !== slot);
    l.push({ slot, data, updated: Date.now() }); this.db.chars[id] = l; this.flush();
  }
  async delChar(id: string, slot: number) { this.db.chars[id] = (this.db.chars[id] ?? []).filter((c) => c.slot !== slot); this.flush(); }
}

class PgStore implements Store {
  readonly kind = 'postgres' as const;
  private pool!: import('pg').Pool;
  constructor(private url: string) {}
  async init() {
    const { default: pg } = await import('pg');
    this.pool = new pg.Pool({ connectionString: this.url, max: 4, ssl: /localhost|127\.0\.0\.1/.test(this.url) ? undefined : { rejectUnauthorized: false } });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (id BIGSERIAL PRIMARY KEY, username TEXT NOT NULL, username_lc TEXT NOT NULL UNIQUE, pass TEXT NOT NULL, created TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS chars (account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, slot INT NOT NULL, data JSONB NOT NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (account_id, slot));`);
  }
  private acc(r: { id: string; username: string; pass: string; created: Date }): Account { return { id: String(r.id), username: r.username, pass: r.pass, created: +new Date(r.created) }; }
  async createAccount(username: string, pass: string) {
    const r = await this.pool.query('INSERT INTO accounts (username, username_lc, pass) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *', [username, username.toLowerCase(), pass]);
    return r.rows[0] ? this.acc(r.rows[0]) : null;
  }
  async findAccount(username: string) {
    const r = await this.pool.query('SELECT * FROM accounts WHERE username_lc=$1', [username.toLowerCase()]);
    return r.rows[0] ? this.acc(r.rows[0]) : null;
  }
  async listChars(id: string) {
    const r = await this.pool.query('SELECT slot, data, updated FROM chars WHERE account_id=$1 ORDER BY slot', [id]);
    return r.rows.map((x) => ({ slot: x.slot as number, data: x.data, updated: +new Date(x.updated) }));
  }
  async putChar(id: string, slot: number, data: unknown) {
    await this.pool.query('INSERT INTO chars (account_id, slot, data) VALUES ($1,$2,$3) ON CONFLICT (account_id, slot) DO UPDATE SET data=$3, updated=now()', [id, slot, JSON.stringify(data)]);
  }
  async delChar(id: string, slot: number) { await this.pool.query('DELETE FROM chars WHERE account_id=$1 AND slot=$2', [id, slot]); }
}

export async function openStore(): Promise<Store> {
  const url = process.env.DATABASE_URL;
  const s: Store = url ? new PgStore(url) : new FileStore(process.env.DATA_FILE ?? 'data/store.json');
  await s.init();
  return s;
}
