'use strict';
/**
 * 渲染进程能调用的全部能力都集中在这里（单一 IPC 通道 api:call）。
 * 好处：接口一目了然，加模块时只在这里加一个方法。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { nowLocal, todayLocal, nextOccurrence } = require('./time');

const TODO_FIELDS = {
  title: 'title',
  note: 'note',
  priority: 'priority',
  dueAt: 'due_at',
  allDay: 'all_day',
  remindAt: 'remind_at',
  repeatFreq: 'repeat_freq',
  repeatInterval: 'repeat_interval',
  listId: 'list_id',
  sort: 'sort',
  parentId: 'parent_id',
};

function createApi({ db, app, shell, dataDir, getWindow }) {
  const session = { unlocked: false };

  /* ---------------- 工具 ---------------- */

  const readSetting = (key, fallback) => {
    const row = db.get('SELECT value FROM settings WHERE key = ?', [key]);
    if (!row) return fallback;
    try {
      return JSON.parse(row.value);
    } catch (_) {
      return fallback;
    }
  };

  const writeSetting = (key, value) => {
    db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)]
    );
  };

  const hashPassword = (password, salt) =>
    crypto.scryptSync(String(password), salt, 64).toString('hex');

  const mapTodo = (r) => ({
    id: r.id,
    listId: r.list_id,
    parentId: r.parent_id,
    title: r.title,
    note: r.note,
    priority: r.priority,
    dueAt: r.due_at,
    allDay: !!r.all_day,
    repeatFreq: r.repeat_freq,
    repeatInterval: r.repeat_interval,
    doneAt: r.done_at,
    sort: r.sort,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    subTotal: r.sub_total || 0,
    subDone: r.sub_done || 0,
    listName: r.list_name,
    listColor: r.list_color,
  });

  const todoSelect = `
    SELECT t.*,
      (SELECT COUNT(*) FROM todos c WHERE c.parent_id = t.id) AS sub_total,
      (SELECT COUNT(*) FROM todos c WHERE c.parent_id = t.id AND c.done_at IS NOT NULL) AS sub_done,
      l.name AS list_name, l.color AS list_color
    FROM todos t LEFT JOIN lists l ON l.id = t.list_id
  `;

  const nextSort = () => {
    const row = db.get('SELECT MAX(sort) AS m FROM todos');
    return (row && row.m ? row.m : 0) + 1024;
  };

  const inboxId = () => {
    const row = db.get('SELECT id FROM lists WHERE archived = 0 ORDER BY sort ASC, id ASC LIMIT 1');
    return row ? row.id : null;
  };

  /* ---------------- 认证 ---------------- */

  const auth = {
    status() {
      return { enabled: !!readSetting('auth.enabled', false), unlocked: session.unlocked };
    },
    setup({ password }) {
      if (!password || String(password).length < 1) throw new Error('密码不能为空');
      const salt = crypto.randomBytes(16).toString('hex');
      writeSetting('auth.salt', salt);
      writeSetting('auth.hash', hashPassword(password, salt));
      writeSetting('auth.enabled', true);
      session.unlocked = true;
      return { enabled: true, unlocked: true };
    },
    unlock({ password }) {
      const salt = readSetting('auth.salt', '');
      const hash = readSetting('auth.hash', '');
      const input = hashPassword(password, salt);
      const ok =
        hash.length === input.length &&
        crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(input, 'hex'));
      if (!ok) throw new Error('密码不对');
      session.unlocked = true;
      return { unlocked: true };
    },
    change({ current, next }) {
      auth.unlock({ password: current });
      const salt = crypto.randomBytes(16).toString('hex');
      writeSetting('auth.salt', salt);
      writeSetting('auth.hash', hashPassword(next, salt));
      return true;
    },
    disable({ password }) {
      auth.unlock({ password });
      writeSetting('auth.enabled', false);
      session.unlocked = true;
      return true;
    },
    lock() {
      session.unlocked = false;
      return true;
    },
  };

  /* ---------------- 清单 ---------------- */

  const lists = {
    list() {
      return db.all('SELECT * FROM lists WHERE archived = 0 ORDER BY sort ASC, id ASC');
    },
    create({ name, color }) {
      const id = db.insert('INSERT INTO lists (name, color, sort, created_at) VALUES (?,?,?,?)', [
        String(name || '新清单').trim() || '新清单',
        color || '#7C5CFF',
        (db.get('SELECT MAX(sort) AS m FROM lists').m || 0) + 1024,
        nowLocal(),
      ]);
      return db.get('SELECT * FROM lists WHERE id = ?', [id]);
    },
    update({ id, patch }) {
      if (patch.name !== undefined) {
        db.run('UPDATE lists SET name = ? WHERE id = ?', [String(patch.name).trim() || '未命名', id]);
      }
      if (patch.color !== undefined) {
        db.run('UPDATE lists SET color = ? WHERE id = ?', [patch.color, id]);
      }
      return db.get('SELECT * FROM lists WHERE id = ?', [id]);
    },
    remove({ id }) {
      const fallback = inboxId();
      if (String(fallback) === String(id)) throw new Error('收件箱不能删除');
      db.run('UPDATE todos SET list_id = ? WHERE list_id = ?', [fallback, id]);
      db.run('DELETE FROM lists WHERE id = ?', [id]);
      return { movedTo: fallback };
    },
    reorder({ ids }) {
      db.transaction(() => {
        ids.forEach((id, i) => db.run('UPDATE lists SET sort = ? WHERE id = ?', [i * 1024, id]));
      });
      return true;
    },
  };

  /* ---------------- 待办 ---------------- */

  const todos = {
    list({ listId = null, view = 'all', q = '' } = {}) {
      let rows = db.all(`${todoSelect} WHERE t.parent_id IS NULL ORDER BY t.created_at ASC`);
      const today = todayLocal();
      const keyword = String(q || '').trim().toLowerCase();

      rows = rows.filter((r) => {
        if (listId && r.list_id !== listId) return false;
        if (view === 'done') {
          if (!r.done_at) return false;
        } else {
          if (r.done_at) return false;
          if (view === 'today') {
            if (!r.due_at) return false;
            if (r.due_at.slice(0, 10) > today) return false;
          }
          if (view === 'upcoming') {
            if (!r.due_at || r.due_at.slice(0, 10) <= today) return false;
          }
          if (view === 'inbox' && r.due_at) return false;
        }
        if (keyword) {
          const hay = `${r.title} ${r.note || ''} ${r.list_name || ''}`.toLowerCase();
          if (!hay.includes(keyword)) return false;
        }
        return true;
      });

      if (view === 'done') rows.sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)));
      else rows.sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));

      return rows.map(mapTodo);
    },

    get({ id }) {
      const row = db.get(`${todoSelect} WHERE t.id = ?`, [id]);
      if (!row) return null;
      return { ...mapTodo(row), subtasks: todos.subtasks({ id }) };
    },

    subtasks({ id }) {
      return db
        .all(`${todoSelect} WHERE t.parent_id = ? ORDER BY t.sort ASC, t.id ASC`, [id])
        .map(mapTodo);
    },

    create(payload = {}) {
      const now = nowLocal();
      const listId = payload.listId || inboxId();
      const id = db.insert(
        `INSERT INTO todos (list_id, parent_id, title, note, priority, due_at, all_day, repeat_freq,
                            repeat_interval, done_at, sort, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          listId,
          payload.parentId || null,
          String(payload.title || '').trim() || '未命名待办',
          payload.note || '',
          payload.priority || 0,
          payload.dueAt || null,
          payload.allDay ? 1 : 0,
          payload.repeatFreq || null,
          payload.repeatInterval || 1,
          payload.doneAt || null,
          payload.sort !== undefined ? payload.sort : nextSort(),
          now,
          now,
        ]
      );
      return todos.get({ id });
    },

    update({ id, patch = {} }) {
      const sets = [];
      const params = [];
      for (const [camel, column] of Object.entries(TODO_FIELDS)) {
        if (patch[camel] === undefined) continue;
        sets.push(`${column} = ?`);
        let value = patch[camel];
        if (camel === 'allDay') value = value ? 1 : 0;
        if (camel === 'dueAt') value = value || null;
        params.push(value);
      }
      if (patch.dueAt !== undefined) {
        sets.push('reminded = ?');
        params.push(0);
      }
      sets.push('updated_at = ?');
      params.push(nowLocal());
      params.push(id);
      db.run(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`, params);
      return todos.get({ id });
    },

    toggle({ id, done }) {
      const row = db.get('SELECT * FROM todos WHERE id = ?', [id]);
      if (!row) throw new Error('待办不存在');
      const now = nowLocal();

      if (done) {
        db.run('UPDATE todos SET done_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
        db.run('UPDATE todos SET done_at = ?, updated_at = ? WHERE parent_id = ? AND done_at IS NULL', [
          now,
          now,
          id,
        ]);

        // 重复任务：完成即自动生成下一次
        if (row.repeat_freq && row.due_at) {
          const next = nextOccurrence(row.due_at, row.repeat_freq, row.repeat_interval);
          if (next) {
            db.insert(
              `INSERT INTO todos (list_id, title, note, priority, due_at, all_day, repeat_freq,
                                  repeat_interval, done_at, sort, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,NULL,?,?,?)`,
              [
                row.list_id,
                row.title,
                row.note,
                row.priority,
                next,
                row.all_day,
                row.repeat_freq,
                row.repeat_interval,
                row.sort,
                now,
                now,
              ]
            );
          }
        }
      } else {
        db.run('UPDATE todos SET done_at = NULL, updated_at = ? WHERE id = ?', [now, id]);
      }
      return todos.get({ id });
    },

    remove({ id }) {
      db.run('DELETE FROM todos WHERE id = ?', [id]);
      return true;
    },

    reorder({ ids }) {
      db.transaction(() => {
        ids.forEach((id, i) => db.run('UPDATE todos SET sort = ? WHERE id = ?', [i * 1024, id]));
      });
      return true;
    },
  };

  /* ---------------- 每天的名字 ---------------- */

  const days = {
    get({ date }) {
      const row = db.get('SELECT * FROM day_labels WHERE date = ?', [date]);
      return row || null;
    },
    set({ date, label }) {
      const text = String(label || '').trim();
      if (!text) {
        db.run('DELETE FROM day_labels WHERE date = ?', [date]);
        return null;
      }
      db.run(
        `INSERT INTO day_labels (date, label, updated_at) VALUES (?,?,?)
         ON CONFLICT(date) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at`,
        [date, text, nowLocal()]
      );
      return db.get('SELECT * FROM day_labels WHERE date = ?', [date]);
    },
    range({ from, to }) {
      return db.all('SELECT * FROM day_labels WHERE date BETWEEN ? AND ? ORDER BY date ASC', [from, to]);
    },
  };

  /* ---------------- 设置 / 概览 / 搜索 / 导出 ---------------- */

  const settings = {
    all() {
      const rows = db.all('SELECT key, value FROM settings');
      const out = {};
      for (const { key, value } of rows) {
        if (key.startsWith('auth.')) continue;
        try {
          out[key] = JSON.parse(value);
        } catch (_) {
          out[key] = value;
        }
      }
      return out;
    },
    set({ key, value }) {
      if (String(key).startsWith('auth.')) throw new Error('不可写入');
      writeSetting(key, value);
      return true;
    },
  };

  const overview = {
    get() {
      const today = todayLocal();
      const label = db.get('SELECT * FROM day_labels WHERE date = ?', [today]);
      const openToday = db.get(
        `SELECT COUNT(*) AS n FROM todos
         WHERE parent_id IS NULL AND done_at IS NULL AND due_at IS NOT NULL AND substr(due_at,1,10) <= ?`,
        [today]
      ).n;
      const overdue = db.get(
        `SELECT COUNT(*) AS n FROM todos
         WHERE parent_id IS NULL AND done_at IS NULL AND due_at IS NOT NULL AND substr(due_at,1,10) < ?`,
        [today]
      ).n;
      const doneToday = db.get(
        `SELECT COUNT(*) AS n FROM todos WHERE done_at IS NOT NULL AND substr(done_at,1,10) = ?`,
        [today]
      ).n;
      const openAll = db.get(
        'SELECT COUNT(*) AS n FROM todos WHERE parent_id IS NULL AND done_at IS NULL'
      ).n;
      return {
        date: today,
        dayLabel: label,
        counts: { openToday, overdue, doneToday, openAll },
      };
    },
  };

  const search = {
    query({ q }) {
      const keyword = String(q || '').trim();
      if (!keyword) return { todos: [], days: [] };
      const like = `%${keyword}%`;
      return {
        todos: db
          .all(
            `${todoSelect} WHERE t.title LIKE ? OR t.note LIKE ? ORDER BY t.done_at IS NOT NULL, t.sort LIMIT 20`,
            [like, like]
          )
          .map(mapTodo),
        days: db.all('SELECT * FROM day_labels WHERE label LIKE ? ORDER BY date DESC LIMIT 10', [like]),
      };
    },
  };

  const csvCell = (v) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;

  const exporter = {
    run() {
      const stamp = nowLocal().replace(/[:T]/g, '-');
      const dir = path.join(dataDir, 'exports', stamp);
      fs.mkdirSync(dir, { recursive: true });

      const tables = ['lists', 'todos', 'day_labels', 'events', 'categories', 'txns', 'notes'];
      const dump = { exportedAt: nowLocal(), app: 'Linsssside', version: app.getVersion(), data: {} };
      for (const t of tables) dump.data[t] = db.all(`SELECT * FROM ${t}`);

      fs.writeFileSync(path.join(dir, '全部数据.json'), JSON.stringify(dump, null, 2), 'utf8');

      const txns = db.all(
        `SELECT t.occurred_on, t.kind, t.amount_cents, IFNULL(c.name,'未分类') AS category,
                IFNULL(t.merchant,'') AS merchant, t.note, t.tags
         FROM txns t LEFT JOIN categories c ON c.id = t.category_id
         ORDER BY t.occurred_on ASC`
      );
      const header = ['日期', '收支', '金额', '分类', '商家', '备注', '标签'];
      const lines = [header.join(',')];
      for (const r of txns) {
        lines.push(
          [
            csvCell(r.occurred_on),
            csvCell(r.kind === 'income' ? '收入' : '支出'),
            csvCell((r.amount_cents / 100).toFixed(2)),
            csvCell(r.category),
            csvCell(r.merchant),
            csvCell(r.note),
            csvCell(r.tags),
          ].join(',')
        );
      }
      fs.writeFileSync(path.join(dir, '账单.csv'), '\uFEFF' + lines.join('\r\n'), 'utf8');

      const todoLines = [['状态', '清单', '标题', '优先级', '截止', '备注'].join(',')];
      for (const t of db.all(
        `SELECT t.*, IFNULL(l.name,'') AS list_name FROM todos t LEFT JOIN lists l ON l.id = t.list_id
         WHERE t.parent_id IS NULL ORDER BY t.sort`
      )) {
        todoLines.push(
          [
            csvCell(t.done_at ? '已完成' : '未完成'),
            csvCell(t.list_name),
            csvCell(t.title),
            csvCell(t.priority),
            csvCell(t.due_at || ''),
            csvCell(t.note),
          ].join(',')
        );
      }
      fs.writeFileSync(path.join(dir, '待办.csv'), '\uFEFF' + todoLines.join('\r\n'), 'utf8');

      return { dir, files: fs.readdirSync(dir) };
    },
  };

  const appApi = {
    info() {
      return {
        version: app.getVersion(),
        dataDir,
        packaged: app.isPackaged,
        dbPath: path.join(dataDir, 'life.db'),
      };
    },
    openDataDir() {
      shell.openPath(dataDir);
      return true;
    },
    revealPath({ target }) {
      shell.showItemInFolder(target);
      return true;
    },
    quit() {
      app.quit();
      return true;
    },
  };

  /* ---------------- 分发 ---------------- */

  const api = {
    'auth.status': auth.status,
    'auth.setup': auth.setup,
    'auth.unlock': auth.unlock,
    'auth.change': auth.change,
    'auth.disable': auth.disable,
    'auth.lock': auth.lock,

    'lists.list': lists.list,
    'lists.create': lists.create,
    'lists.update': lists.update,
    'lists.remove': lists.remove,
    'lists.reorder': lists.reorder,

    'todos.list': todos.list,
    'todos.get': todos.get,
    'todos.subtasks': todos.subtasks,
    'todos.create': todos.create,
    'todos.update': todos.update,
    'todos.toggle': todos.toggle,
    'todos.remove': todos.remove,
    'todos.reorder': todos.reorder,

    'days.get': days.get,
    'days.set': days.set,
    'days.range': days.range,

    'settings.all': settings.all,
    'settings.set': settings.set,
    'overview.get': overview.get,
    'search.query': search.query,
    'export.run': exporter.run,
    'app.info': appApi.info,
    'app.openDataDir': appApi.openDataDir,
    'app.revealPath': appApi.revealPath,
    'app.quit': appApi.quit,
  };

  return {
    session,
    invoke(method, payload) {
      const fn = api[method];
      if (!fn) throw new Error(`未知接口：${method}`);
      const locked = readSetting('auth.enabled', false) && !session.unlocked;
      if (locked && !method.startsWith('auth.')) {
        const err = new Error('已锁定');
        err.code = 'LOCKED';
        throw err;
      }
      return fn(payload || {});
    },
    readSetting,
    writeSetting,
  };
}

module.exports = { createApi };
