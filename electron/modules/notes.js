'use strict';
/**
 * 灵感备忘录：Markdown 笔记、标签、置顶归档、附件、转待办
 */

const fs = require('fs');
const path = require('path');

function createNotes(ctx) {
  const { db, dataDir, nowLocal, todayLocal } = ctx;

  const mapNote = (r) => ({
    id: r.id,
    title: r.title || '',
    content: r.content || '',
    tags: r.tags || '',
    attachments: r.attachments ? JSON.parse(r.attachments) : [],
    pinned: !!r.pinned,
    archived: !!r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    excerpt: String(r.content || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/[#>*`_\-\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90),
  });

  const attachmentDir = () => path.join(dataDir, 'attachments');

  return {
    'notes.list'({ q = '', tag = '', archived = false } = {}) {
      const where = ['archived = ?'];
      const params = [archived ? 1 : 0];
      if (q) {
        where.push('(title LIKE ? OR content LIKE ? OR IFNULL(tags, \'\') LIKE ?)');
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      if (tag) {
        where.push("(',' || IFNULL(tags, '') || ',' LIKE ?)");
        params.push(`%,${tag},%`);
      }
      return db
        .all(
          `SELECT * FROM notes WHERE ${where.join(' AND ')}
           ORDER BY pinned DESC, updated_at DESC`,
          params
        )
        .map(mapNote);
    },

    'notes.tags'() {
      const rows = db.all("SELECT tags FROM notes WHERE IFNULL(tags,'') <> '' AND archived = 0");
      const set = new Map();
      for (const { tags } of rows) {
        String(tags)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => set.set(t, (set.get(t) || 0) + 1));
      }
      return [...set.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    },

    'notes.get'({ id }) {
      const row = db.get('SELECT * FROM notes WHERE id = ?', [id]);
      return row ? mapNote(row) : null;
    },

    'notes.save'({ id, title, content, tags, attachments, pinned, archived }) {
      const cleanTitle =
        String(title || '').trim() || String(content || '').trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 40) || '无标题';
      const att = JSON.stringify(attachments || []);

      if (id) {
        db.run(
          `UPDATE notes SET title = ?, content = ?, tags = ?, attachments = ?, pinned = ?, archived = ?, updated_at = ?
           WHERE id = ?`,
          [
            cleanTitle,
            content || '',
            tags || '',
            att,
            pinned ? 1 : 0,
            archived ? 1 : 0,
            nowLocal(),
            id,
          ]
        );
        return mapNote(db.get('SELECT * FROM notes WHERE id = ?', [id]));
      }

      const newId = db.insert(
        `INSERT INTO notes (title, content, tags, attachments, pinned, archived, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [cleanTitle, content || '', tags || '', att, pinned ? 1 : 0, archived ? 1 : 0, nowLocal(), nowLocal()]
      );
      return mapNote(db.get('SELECT * FROM notes WHERE id = ?', [newId]));
    },

    'notes.patch'({ id, patch = {} }) {
      if (patch.pinned !== undefined) db.run('UPDATE notes SET pinned = ? WHERE id = ?', [patch.pinned ? 1 : 0, id]);
      if (patch.archived !== undefined) db.run('UPDATE notes SET archived = ? WHERE id = ?', [patch.archived ? 1 : 0, id]);
      db.run('UPDATE notes SET updated_at = ? WHERE id = ?', [nowLocal(), id]);
      const row = db.get('SELECT * FROM notes WHERE id = ?', [id]);
      return row ? mapNote(row) : null;
    },

    'notes.remove'({ id }) {
      db.run('DELETE FROM notes WHERE id = ?', [id]);
      return true;
    },

    /** 笔记一键转待办：标题用笔记名，备注带正文摘要 */
    'notes.toTodo'({ id, listId = null }) {
      const note = db.get('SELECT * FROM notes WHERE id = ?', [id]);
      if (!note) throw new Error('笔记不存在');
      const plain = String(note.content || '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/[#>`*_]/g, '')
        .trim()
        .slice(0, 500);
      const list = listId || (db.get('SELECT id FROM lists ORDER BY sort ASC LIMIT 1') || {}).id || null;
      const todoId = db.insert(
        `INSERT INTO todos (list_id, title, note, priority, all_day, done_at, sort, created_at, updated_at)
         VALUES (?,?,?,?,0,NULL,?,?,?)`,
        [list, note.title || '未命名待办', plain, 0, (db.get('SELECT MAX(sort) AS m FROM todos').m || 0) + 1024, nowLocal(), nowLocal()]
      );
      return { todoId, title: note.title };
    },

    /** 附件：渲染进程把图片转成 data URL 传进来，这里落盘 */
    'files.saveAttachment'({ dataUrl, name }) {
      const match = /^data:([^;]+);base64,(.*)$/s.exec(String(dataUrl || ''));
      if (!match) throw new Error('不是有效的图片数据');
      const mime = match[1];
      const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('gif') ? 'gif' : mime.includes('webp') ? 'webp' : 'bin';
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 8 * 1024 * 1024) throw new Error('图片太大了（上限 8MB）');
      fs.mkdirSync(attachmentDir(), { recursive: true });
      const stamp = nowLocal().replace(/[:T]/g, '').replace(/-/g, '');
      const safe = String(name || 'image').replace(/[^\w\u4e00-\u9fa5.-]/g, '').slice(0, 24) || 'image';
      const file = `${stamp}-${safe}.${ext}`;
      fs.writeFileSync(path.join(attachmentDir(), file), buffer);
      return { path: `attachments/${file}`, size: buffer.length };
    },

    /** 读回附件，转 data URL 交给渲染进程显示 */
    'files.readAttachments'({ paths = [] }) {
      const out = {};
      for (const rel of paths) {
        const clean = String(rel || '').replace(/^attachments\//, '');
        if (!clean || clean.includes('..')) continue;
        const full = path.join(attachmentDir(), clean);
        try {
          if (!fs.existsSync(full)) continue;
          const ext = path.extname(full).slice(1).toLowerCase();
          const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'application/octet-stream';
          out[rel] = `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`;
        } catch (_) {
          /* 跳过坏文件 */
        }
      }
      return out;
    },

    /** 快速记录：一句话决定它是灵感还是待办还是支出 */
    'quick.add'({ type = 'note', text = '' }) {
      const raw = String(text || '').trim();
      if (!raw) throw new Error('写点什么再回车');
      if (type === 'todo') {
        const todo = db.insert(
          `INSERT INTO todos (list_id, title, note, priority, all_day, done_at, sort, created_at, updated_at)
           VALUES ((SELECT id FROM lists ORDER BY sort ASC LIMIT 1), ?, '', 0, 0, NULL, ?, ?, ?)`,
          [raw, (db.get('SELECT MAX(sort) AS m FROM todos').m || 0) + 1024, nowLocal(), nowLocal()]
        );
        return { kind: 'todo', id: todo, text: raw };
      }
      if (type === 'money') {
        const match = /^(\d+(?:\.\d{1,2})?)\s*(.*)$/.exec(raw);
        const amount = match ? Number(match[1]) : 0;
        const note = match ? match[2].trim() : raw;
        if (!amount) throw new Error('支出要写成「金额 备注」，比如 18 早餐');
        const category = db.get("SELECT id FROM categories WHERE kind = 'expense' ORDER BY sort DESC LIMIT 1");
        const id = db.insert(
          `INSERT INTO txns (kind, amount_cents, category_id, occurred_on, merchant, note, tags, created_at)
           VALUES ('expense', ?, ?, ?, '', ?, '', ?)`,
          [Math.round(amount * 100), category ? category.id : null, todayLocal(), note, nowLocal()]
        );
        return { kind: 'money', id, amount, note };
      }
      const id = db.insert(
        `INSERT INTO notes (title, content, tags, attachments, pinned, archived, created_at, updated_at)
         VALUES (?, '', '', '[]', 0, 0, ?, ?)`,
        [raw.slice(0, 40), nowLocal(), nowLocal()]
      );
      return { kind: 'note', id, text: raw };
    },
  };
}

module.exports = { createNotes };
