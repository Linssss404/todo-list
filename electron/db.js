'use strict';
/**
 * 数据层：真正的 SQLite 文件（data/life.db）
 *
 * 用的是 sql.js（SQLite 编译成 WebAssembly），这样不需要在用户机器上
 * 编译原生模块，产出的仍然是标准 .db 文件，可以用 DB Browser 直接打开。
 * 每次写入后延迟 350ms 落盘：先写临时文件再改名，断电也不会写坏原库。
 */

const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#7C5CFF',
  sort       REAL NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id         INTEGER REFERENCES lists(id) ON DELETE CASCADE,
  parent_id       INTEGER REFERENCES todos(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  note            TEXT NOT NULL DEFAULT '',
  priority        INTEGER NOT NULL DEFAULT 0,
  due_at          TEXT,
  all_day         INTEGER NOT NULL DEFAULT 0,
  remind_at       TEXT,
  reminded        INTEGER NOT NULL DEFAULT 0,
  repeat_freq     TEXT,
  repeat_interval INTEGER NOT NULL DEFAULT 1,
  done_at         TEXT,
  sort            REAL NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_todos_due   ON todos(due_at);
CREATE INDEX IF NOT EXISTS idx_todos_list  ON todos(list_id);

/* 每天的名字，例如 2026-10-31 → 自信绽放日 */
CREATE TABLE IF NOT EXISTS day_labels (
  date       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  color      TEXT,
  updated_at TEXT NOT NULL
);

/* ↓ 以下三张表为第二阶段的三模块预留，先建好结构，界面后续接 */
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  start_at   TEXT NOT NULL,
  end_at     TEXT,
  all_day    INTEGER NOT NULL DEFAULT 0,
  repeat_freq TEXT,
  repeat_interval INTEGER NOT NULL DEFAULT 1,
  remind_before INTEGER NOT NULL DEFAULT 0,
  reminded   INTEGER NOT NULL DEFAULT 0,
  color      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  kind     TEXT NOT NULL DEFAULT 'expense',
  icon     TEXT,
  color    TEXT NOT NULL DEFAULT '#7C5CFF',
  sort     REAL NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS txns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL DEFAULT 'expense',
  amount_cents INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  occurred_on TEXT NOT NULL,
  merchant    TEXT,
  note        TEXT NOT NULL DEFAULT '',
  tags        TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_txns_date ON txns(occurred_on);

CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  tags       TEXT,
  pinned     INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

class Database {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'life.db');
    this.db = null;
    this._timer = null;
    this._dirty = false;
  }

  async open() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const initSqlJs = require('sql.js');
    const distDir = path.dirname(require.resolve('sql.js'));
    // 打包后 wasm 位于 app.asar.unpacked 中
    let wasm = path.join(distDir, 'sql-wasm.wasm');
    if (wasm.includes('app.asar') && !fs.existsSync(wasm)) {
      wasm = wasm.replace('app.asar', 'app.asar.unpacked');
    }
    const SQL = await initSqlJs({ locateFile: () => wasm });

    if (fs.existsSync(this.file)) {
      const buf = fs.readFileSync(this.file);
      this.db = new SQL.Database(new Uint8Array(buf));
    } else {
      this.db = new SQL.Database();
    }
    this.db.run('PRAGMA foreign_keys = ON;');
    this.db.run(SCHEMA);
    this._ensureSeed();
    this.flush();
    return this;
  }

  /** 首次启动写入默认清单与默认设置 */
  _ensureSeed() {
    const row = this.get('SELECT COUNT(*) AS n FROM lists');
    if (!row || row.n === 0) {
      const now = nowLocal();
      this.insert(
        'INSERT INTO lists (name, color, sort, created_at) VALUES (?,?,?,?)',
        ['收件箱', '#7C5CFF', 0, now]
      );
      this.insert(
        'INSERT INTO lists (name, color, sort, created_at) VALUES (?,?,?,?)',
        ['工作', '#4C9AFF', 1024, now]
      );
      this.insert(
        'INSERT INTO lists (name, color, sort, created_at) VALUES (?,?,?,?)',
        ['生活', '#3FBF9F', 2048, now]
      );
    }
    this._default('theme', '"light"');
    this._default('budget', '0');
    this._default('auth.enabled', 'false');
  }

  _default(key, value) {
    if (!this.get('SELECT value FROM settings WHERE key = ?', [key])) {
      this.run('INSERT INTO settings (key, value) VALUES (?,?)', [key, value]);
    }
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  get(sql, params = []) {
    return this.all(sql, params)[0] || null;
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    this._dirty = true;
    this._schedule();
    return this.db.getRowsModified();
  }

  insert(sql, params = []) {
    this.db.run(sql, params);
    this._dirty = true;
    this._schedule();
    return this.get('SELECT last_insert_rowid() AS id').id;
  }

  transaction(fn) {
    this.db.run('BEGIN');
    try {
      const out = fn();
      this.db.run('COMMIT');
      this._dirty = true;
      this._schedule();
      return out;
    } catch (err) {
      try { this.db.run('ROLLBACK'); } catch (_) { /* ignore */ }
      throw err;
    }
  }

  _schedule() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 350);
  }

  flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (!this.db || !this._dirty) return;
    const tmp = this.file + '.tmp';
    const data = Buffer.from(this.db.export());
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, this.file);
    this._dirty = false;
  }

  close() {
    this.flush();
    if (this.db) this.db.close();
    this.db = null;
  }
}

function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

module.exports = { Database, nowLocal };
