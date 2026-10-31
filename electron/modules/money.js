'use strict';
/**
 * 记账：分类、收支流水、月度汇总与趋势
 * 金额一律用「分」存整数，避免浮点误差；只在显示时除以 100。
 */

function createMoney(ctx) {
  const { db, readSetting, writeSetting, nowLocal, todayLocal } = ctx;

  const mapCategory = (r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    icon: r.icon || '✨',
    color: r.color || '#7C5CFF',
    sort: r.sort,
  });

  const mapTxn = (r) => ({
    id: r.id,
    kind: r.kind,
    amountCents: r.amount_cents,
    categoryId: r.category_id,
    categoryName: r.category_name || '未分类',
    categoryIcon: r.category_icon || '✨',
    categoryColor: r.category_color || '#8B8FA3',
    occurredOn: r.occurred_on,
    merchant: r.merchant || '',
    note: r.note || '',
    tags: r.tags || '',
    createdAt: r.created_at,
  });

  const currentMonth = () => todayLocal().slice(0, 7);

  return {
    'money.categories'() {
      return db
        .all('SELECT * FROM categories WHERE archived = 0 ORDER BY kind DESC, sort ASC, id ASC')
        .map(mapCategory);
    },

    'money.category.save'({ id, name, kind, icon, color }) {
      const clean = String(name || '').trim();
      if (!clean) throw new Error('分类名不能为空');
      if (id) {
        db.run('UPDATE categories SET name = ?, kind = ?, icon = ?, color = ? WHERE id = ?', [
          clean,
          kind === 'income' ? 'income' : 'expense',
          icon || '✨',
          color || '#7C5CFF',
          id,
        ]);
        return db.get('SELECT * FROM categories WHERE id = ?', [id]);
      }
      const newId = db.insert(
        'INSERT INTO categories (name, kind, icon, color, sort) VALUES (?,?,?,?,?)',
        [
          clean,
          kind === 'income' ? 'income' : 'expense',
          icon || '✨',
          color || '#7C5CFF',
          (db.get('SELECT MAX(sort) AS m FROM categories WHERE kind = ?', [kind === 'income' ? 'income' : 'expense']).m || 0) + 1024,
        ]
      );
      return db.get('SELECT * FROM categories WHERE id = ?', [newId]);
    },

    'money.category.remove'({ id }) {
      db.run('UPDATE txns SET category_id = NULL WHERE category_id = ?', [id]);
      db.run('DELETE FROM categories WHERE id = ?', [id]);
      return true;
    },

    'money.list'({ month = null, kind = null, categoryId = null, q = '', limit = 300 } = {}) {
      const where = [];
      const params = [];
      if (month) {
        where.push('substr(t.occurred_on, 1, 7) = ?');
        params.push(month);
      }
      if (kind) {
        where.push('t.kind = ?');
        params.push(kind);
      }
      if (categoryId) {
        where.push('t.category_id = ?');
        params.push(categoryId);
      }
      if (q) {
        where.push('(t.note LIKE ? OR t.merchant LIKE ? OR t.tags LIKE ?)');
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      const sql = `
        SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
        FROM txns t LEFT JOIN categories c ON c.id = t.category_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY t.occurred_on DESC, t.id DESC
        LIMIT ${Number(limit) || 300}`;
      return db.all(sql, params).map(mapTxn);
    },

    'money.recent'({ limit = 6 } = {}) {
      return db
        .all(
          `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
           FROM txns t LEFT JOIN categories c ON c.id = t.category_id
           ORDER BY t.occurred_on DESC, t.id DESC LIMIT ${Number(limit) || 6}`
        )
        .map(mapTxn);
    },

    'money.create'({ kind, amountCents, categoryId, occurredOn, merchant, note, tags }) {
      const cents = Math.round(Number(amountCents));
      if (!cents || cents <= 0) throw new Error('金额要大于 0');
      const id = db.insert(
        `INSERT INTO txns (kind, amount_cents, category_id, occurred_on, merchant, note, tags, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          kind === 'income' ? 'income' : 'expense',
          cents,
          categoryId || null,
          occurredOn || todayLocal(),
          merchant || '',
          note || '',
          tags || '',
          nowLocal(),
        ]
      );
      return db.get(
        `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM txns t LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`,
        [id]
      );
    },

    'money.update'({ id, patch = {} }) {
      const map = {
        kind: 'kind',
        amountCents: 'amount_cents',
        categoryId: 'category_id',
        occurredOn: 'occurred_on',
        merchant: 'merchant',
        note: 'note',
        tags: 'tags',
      };
      const sets = [];
      const params = [];
      for (const [key, column] of Object.entries(map)) {
        if (patch[key] === undefined) continue;
        sets.push(`${column} = ?`);
        let value = patch[key];
        if (key === 'amountCents') {
          value = Math.round(Number(value));
          if (!value || value <= 0) throw new Error('金额要大于 0');
        }
        if (key === 'categoryId') value = value || null;
        params.push(value);
      }
      if (!sets.length) return null;
      params.push(id);
      db.run(`UPDATE txns SET ${sets.join(', ')} WHERE id = ?`, params);
      return db.get(
        `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM txns t LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`,
        [id]
      );
    },

    'money.remove'({ id }) {
      db.run('DELETE FROM txns WHERE id = ?', [id]);
      return true;
    },

    /** 月度汇总：总额、分类占比、近 6 个月趋势、预算 */
    'money.summary'({ month = null } = {}) {
      const target = month || currentMonth();
      const totals = db.get(
        `SELECT
           IFNULL(SUM(CASE WHEN kind = 'expense' THEN amount_cents END), 0) AS expense,
           IFNULL(SUM(CASE WHEN kind = 'income' THEN amount_cents END), 0) AS income,
           COUNT(*) AS count
         FROM txns WHERE substr(occurred_on, 1, 7) = ?`,
        [target]
      );

      const byCategory = db.all(
        `SELECT IFNULL(c.id, 0) AS id, IFNULL(c.name, '未分类') AS name,
                IFNULL(c.icon, '✨') AS icon, IFNULL(c.color, '#8B8FA3') AS color,
                SUM(t.amount_cents) AS total, COUNT(*) AS count
         FROM txns t LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.kind = 'expense' AND substr(t.occurred_on, 1, 7) = ?
         GROUP BY IFNULL(c.id, 0) ORDER BY total DESC`,
        [target]
      );

      const months = [];
      const d = new Date();
      for (let i = 5; i >= 0; i -= 1) {
        const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
        months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
      }
      const trendRows = db.all(
        `SELECT substr(occurred_on, 1, 7) AS m,
                IFNULL(SUM(CASE WHEN kind = 'expense' THEN amount_cents END), 0) AS expense,
                IFNULL(SUM(CASE WHEN kind = 'income' THEN amount_cents END), 0) AS income
         FROM txns WHERE substr(occurred_on, 1, 7) >= ?
         GROUP BY m`,
        [months[0]]
      );
      const trend = months.map((m) => {
        const row = trendRows.find((r) => r.m === m);
        return { month: m, expenseCents: row ? row.expense : 0, incomeCents: row ? row.income : 0 };
      });

      const budgetYuan = Number(readSetting('budget', 0)) || 0;
      const todayCents = db.get(
        `SELECT IFNULL(SUM(amount_cents), 0) AS total FROM txns
         WHERE kind = 'expense' AND occurred_on = ?`,
        [todayLocal()]
      ).total;
      return {
        month: target,
        expenseCents: totals.expense,
        incomeCents: totals.income,
        todayCents,
        count: totals.count,
        budgetCents: Math.round(budgetYuan * 100),
        byCategory: byCategory.map((r) => ({
          id: r.id,
          name: r.name,
          icon: r.icon,
          color: r.color,
          totalCents: r.total,
          count: r.count,
        })),
        trend,
      };
    },

    'money.setBudget'({ yuan }) {
      const value = Math.max(0, Number(yuan) || 0);
      writeSetting('budget', value);
      return { budgetCents: Math.round(value * 100) };
    },
  };
}

module.exports = { createMoney };
