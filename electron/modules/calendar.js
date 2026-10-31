'use strict';
/**
 * 日程：事件 CRUD + 重复展开 + 与待办截止时间合并成「一份时间」
 */

const { parseDue, formatDue, nextOccurrence } = require('../time');

function createCalendar(ctx) {
  const { db, nowLocal, todayLocal } = ctx;

  const mapEvent = (r) => ({
    id: r.id,
    title: r.title,
    note: r.note || '',
    startAt: r.start_at,
    endAt: r.end_at,
    allDay: !!r.all_day,
    repeatFreq: r.repeat_freq,
    repeatInterval: r.repeat_interval || 1,
    remindBefore: r.remind_before || 0,
    color: r.color || '#7C5CFF',
    createdAt: r.created_at,
  });

  /** 把重复事件在 [from, to] 区间里摊平成一次次出现 */
  const expand = (event, fromStr, toStr) => {
    const out = [];
    if (!event.startAt) return out;
    const from = parseDue(fromStr);
    const to = parseDue(toStr);
    to.setHours(23, 59, 59, 999);

    const start = parseDue(event.startAt);
    const end = event.endAt ? parseDue(event.endAt) : null;
    const durationMs = end ? Math.max(0, end.getTime() - start.getTime()) : 0;
    const allDay = !String(event.startAt).includes('T');

    let cursor = new Date(start.getTime());
    let guard = 0;
    while (guard < 500) {
      guard += 1;
      const occEnd = new Date(cursor.getTime() + durationMs);
      if (cursor > to) break;
      if (occEnd >= from || cursor >= from) {
        out.push({
          ...event,
          key: `${event.id}@${formatDue(cursor, allDay)}`,
          startAt: formatDue(cursor, allDay),
          endAt: durationMs ? formatDue(occEnd, allDay) : null,
          occurrence: true,
        });
      }
      if (!event.repeatFreq) break;
      const nextStr = nextOccurrence(formatDue(cursor, allDay), event.repeatFreq, event.repeatInterval);
      if (!nextStr) break;
      const nextDate = parseDue(nextStr);
      if (nextDate.getTime() <= cursor.getTime()) break;
      cursor = nextDate;
    }
    return out;
  };

  const eventsInRange = (from, to) => {
    const rows = db
      .all('SELECT * FROM events ORDER BY start_at ASC')
      .map(mapEvent);
    const list = [];
    for (const event of rows) {
      // 只从「不晚于区间结束」的事件开始展开
      list.push(...expand(event, from, to));
    }
    return list.sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
  };

  return {
    'events.list'({ from, to }) {
      return eventsInRange(from, to);
    },

    'events.get'({ id }) {
      const row = db.get('SELECT * FROM events WHERE id = ?', [id]);
      return row ? mapEvent(row) : null;
    },

    'events.create'({ title, note, startAt, endAt, allDay, repeatFreq, repeatInterval, remindBefore, color }) {
      const clean = String(title || '').trim();
      if (!clean) throw new Error('事件要有个名字');
      if (!startAt) throw new Error('事件要有开始时间');
      const id = db.insert(
        `INSERT INTO events (title, note, start_at, end_at, all_day, repeat_freq, repeat_interval,
                             remind_before, reminded, color, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,0,?,?,?)`,
        [
          clean,
          note || '',
          startAt,
          endAt || null,
          allDay ? 1 : 0,
          repeatFreq || null,
          repeatInterval || 1,
          Number(remindBefore) || 0,
          color || '#7C5CFF',
          nowLocal(),
          nowLocal(),
        ]
      );
      return db.get('SELECT * FROM events WHERE id = ?', [id]);
    },

    'events.update'({ id, patch = {} }) {
      const map = {
        title: 'title',
        note: 'note',
        startAt: 'start_at',
        endAt: 'end_at',
        allDay: 'all_day',
        repeatFreq: 'repeat_freq',
        repeatInterval: 'repeat_interval',
        remindBefore: 'remind_before',
        color: 'color',
      };
      const sets = [];
      const params = [];
      for (const [key, column] of Object.entries(map)) {
        if (patch[key] === undefined) continue;
        sets.push(`${column} = ?`);
        let value = patch[key];
        if (key === 'allDay') value = value ? 1 : 0;
        if (key === 'endAt') value = value || null;
        if (key === 'repeatFreq') value = value || null;
        params.push(value);
      }
      if (patch.startAt !== undefined || patch.remindBefore !== undefined) {
        sets.push('reminded = 0');
      }
      sets.push('updated_at = ?');
      params.push(nowLocal());
      params.push(id);
      db.run(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, params);
      return db.get('SELECT * FROM events WHERE id = ?', [id]);
    },

    'events.remove'({ id }) {
      db.run('DELETE FROM events WHERE id = ?', [id]);
      return true;
    },

    /** 日历主数据：区间内的事件 + 待办截止 + 每天的名字 */
    'agenda.get'({ from, to }) {
      const events = eventsInRange(from, to);

      const todos = db
        .all(
          `SELECT t.*, l.name AS list_name, l.color AS list_color
           FROM todos t LEFT JOIN lists l ON l.id = t.list_id
           WHERE t.parent_id IS NULL AND t.due_at IS NOT NULL
             AND substr(t.due_at, 1, 10) BETWEEN ? AND ?
           ORDER BY t.due_at ASC`,
          [from, to]
        )
        .map((r) => ({
          id: r.id,
          title: r.title,
          dueAt: r.due_at,
          allDay: !!r.all_day,
          doneAt: r.done_at,
          priority: r.priority,
          listName: r.list_name,
          listColor: r.list_color,
        }));

      const days = db.all('SELECT * FROM day_labels WHERE date BETWEEN ? AND ? ORDER BY date ASC', [
        from,
        to,
      ]);

      return { events, todos, days, from, to, today: todayLocal() };
    },
  };
}

module.exports = { createCalendar };
