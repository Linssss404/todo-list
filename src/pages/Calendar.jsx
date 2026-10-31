import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';
import { REPEAT, dateCN, parseDue, weekday } from '../lib/dates.js';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + n);
  return next;
};
/** 周一为一周开始 */
const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
const sameDay = (a, b) => ymd(a) === ymd(b);

const EVENT_COLORS = ['#7C5CFF', '#4C9AFF', '#3FBF9F', '#F0A44B', '#F0748C', '#9B7BF5'];
const REMIND_OPTIONS = [
  { value: 0, label: '不提醒' },
  { value: 5, label: '提前 5 分钟' },
  { value: 15, label: '提前 15 分钟' },
  { value: 30, label: '提前 30 分钟' },
  { value: 60, label: '提前 1 小时' },
  { value: 1440, label: '提前 1 天' },
];

function timeText(at) {
  return String(at).includes('T') ? String(at).split('T')[1].slice(0, 5) : '';
}

export default function Calendar({ onToast, onOpenTodo }) {
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());
  const [data, setData] = useState({ events: [], todos: [], days: [] });
  const [dayPanel, setDayPanel] = useState(null); // 'YYYY-MM-DD'
  const [editing, setEditing] = useState(null); // {mode:'new'|'edit', date, event}
  const today = new Date();

  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor);
      return { from: ymd(start), to: ymd(addDays(start, 6)) };
    }
    if (view === 'list') {
      return { from: ymd(today), to: ymd(addDays(today, 30)) };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return { from: ymd(gridStart), to: ymd(addDays(gridStart, 41)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor]);

  const load = async () => {
    setData(await api.agenda(range.from, range.to));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const itemsByDay = useMemo(() => {
    const map = new Map();
    const push = (key, item) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    };
    for (const ev of data.events) {
      const key = String(ev.startAt).slice(0, 10);
      push(key, { type: 'event', item: ev, sortKey: `${ev.startAt}` });
    }
    for (const todo of data.todos) {
      const key = String(todo.dueAt).slice(0, 10);
      push(key, { type: 'todo', item: todo, sortKey: `${todo.dueAt}` });
    }
    for (const [key, list] of map) {
      list.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'event' ? -1 : 1;
        return a.sortKey.localeCompare(b.sortKey);
      });
      map.set(key, list);
    }
    return map;
  }, [data]);

  const dayLabels = useMemo(() => {
    const map = new Map();
    for (const d of data.days) map.set(d.date, d.label);
    return map;
  }, [data.days]);

  const toggleTodo = async (todo) => {
    await api.toggleTodo(todo.id, !todo.doneAt);
    await load();
  };

  const openEvent = (ev) => setEditing({ mode: 'edit', event: ev, date: String(ev.startAt).slice(0, 10) });

  /* ---------------- 月历 ---------------- */
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const monthTitle = `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`;
  const weekTitle = `${dateCN(ymd(weekDays[0]))} – ${dateCN(ymd(weekDays[6]))}`;

  const shiftCursor = (delta) => {
    if (view === 'week') setCursor(addDays(cursor, delta * 7));
    else if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else setCursor(addDays(cursor, delta * 30));
  };

  const listRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < 31; i += 1) {
      const day = addDays(today, i);
      const key = ymd(day);
      const items = itemsByDay.get(key) || [];
      if (items.length) rows.push({ key, date: day, items });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsByDay]);

  return (
    <div className="page cal-page">
      <section className="card panel cal-panel">
        <header className="panel-head cal-head">
          <div className="month-nav">
            <button className="icon-btn tiny" onClick={() => shiftCursor(-1)}>
              <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <h2>{view === 'week' ? weekTitle : view === 'list' ? '接下来 30 天' : monthTitle}</h2>
            <button className="icon-btn tiny" onClick={() => shiftCursor(1)}>
              <Icon name="chevron" size={14} />
            </button>
            <button className="link-btn" onClick={() => setCursor(new Date())}>今天</button>
          </div>
          <div className="head-right">
            <div className="seg">
              {[['month', '月'], ['week', '周'], ['list', '列表']].map(([id, label]) => (
                <button key={id} className={`seg-item${view === id ? ' active' : ''}`} onClick={() => setView(id)}>
                  {label}
                </button>
              ))}
            </div>
            <button
              className="primary-btn"
              onClick={() => setEditing({ mode: 'new', date: ymd(cursor), event: null })}
            >
              <Icon name="plus" size={15} /> 新日程
            </button>
          </div>
        </header>

        {view === 'month' && (
          <div className="month-grid">
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
              <div className="month-weekday" key={w}>{w}</div>
            ))}
            {monthCells.map((day) => {
              const key = ymd(day);
              const items = itemsByDay.get(key) || [];
              const isToday = sameDay(day, today);
              const dim = day.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={key}
                  className={`month-cell${dim ? ' dim' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => setDayPanel(key)}
                >
                  <div className="cell-head">
                    <span className="cell-date">{day.getDate()}</span>
                    {dayLabels.get(key) && <span className="cell-label">{dayLabels.get(key)}</span>}
                  </div>
                  <div className="cell-items">
                    {items.slice(0, 3).map((entry) =>
                      entry.type === 'event' ? (
                        <button
                          key={`e-${entry.item.key}`}
                          className="cell-item event"
                          style={{ borderLeftColor: entry.item.color }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEvent(entry.item);
                          }}
                        >
                          {!entry.item.allDay && <em>{timeText(entry.item.startAt)}</em>}
                          <span>{entry.item.title}</span>
                        </button>
                      ) : (
                        <button
                          key={`t-${entry.item.id}`}
                          className={`cell-item todo${entry.item.doneAt ? ' done' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTodo(entry.item);
                          }}
                        >
                          <span className="cell-check">{entry.item.doneAt ? '✓' : ''}</span>
                          <span>{entry.item.title}</span>
                        </button>
                      )
                    )}
                    {items.length > 3 && <span className="cell-more">+{items.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'week' && (
          <div className="week-grid">
            <div className="week-col week-axis">
              <div className="week-allday-label">全天</div>
              {Array.from({ length: 16 }, (_, i) => (
                <div className="week-hour-label" key={i}>{i + 7}:00</div>
              ))}
            </div>
            {weekDays.map((day) => {
              const key = ymd(day);
              const items = itemsByDay.get(key) || [];
              const events = items.filter((i) => i.type === 'event' && !i.item.allDay);
              const allDay = items.filter((i) => i.type === 'todo' || (i.item.allDay && i.type === 'event'));
              return (
                <div className={`week-col${sameDay(day, today) ? ' today' : ''}`} key={key}>
                  <div className="week-day-head">
                    <span>{weekday(key)}</span>
                    <strong>{day.getDate()}</strong>
                  </div>
                  <div className="week-allday">
                    {allDay.slice(0, 4).map((entry) =>
                      entry.type === 'todo' ? (
                        <button
                          key={`t-${entry.item.id}`}
                          className={`allday-chip todo${entry.item.doneAt ? ' done' : ''}`}
                          onClick={() => toggleTodo(entry.item)}
                        >
                          {entry.item.title}
                        </button>
                      ) : (
                        <button key={`e-${entry.item.key}`} className="allday-chip" style={{ background: `${entry.item.color}26`, color: entry.item.color }} onClick={() => openEvent(entry.item)}>
                          {entry.item.title}
                        </button>
                      )
                    )}
                  </div>
                  <div className="week-hours" onClick={() => setEditing({ mode: 'new', date: key, event: null })}>
                    {Array.from({ length: 16 }, (_, i) => (
                      <div className="week-hour" key={i} />
                    ))}
                    {events.map(({ item }) => {
                      const start = parseDue(item.startAt);
                      const end = item.endAt ? parseDue(item.endAt) : new Date(start.getTime() + 3600000);
                      const top = ((start.getHours() + start.getMinutes() / 60) - 7) * 56;
                      const height = Math.max(24, ((end - start) / 3600000) * 56);
                      return (
                        <button
                          key={item.key}
                          className="week-event"
                          style={{
                            top: `${Math.max(0, top)}px`,
                            height: `${height}px`,
                            background: `${item.color}24`,
                            borderLeftColor: item.color,
                            color: 'var(--text)',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEvent(item);
                          }}
                        >
                          <strong>{item.title}</strong>
                          <em>{timeText(item.startAt)}–{item.endAt ? timeText(item.endAt) : ''}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'list' && (
          <div className="agenda-list">
            {listRows.length === 0 && (
              <div className="empty">
                <Icon name="calendar" size={26} />
                <p>接下来 30 天还没有安排，点右上角「新日程」</p>
              </div>
            )}
            {listRows.map(({ key, date, items }) => (
              <div className="agenda-day" key={key}>
                <div className="agenda-day-head">
                  <strong>{date.getDate()}</strong>
                  <span>{weekday(key)}</span>
                  {dayLabels.get(key) && <em>{dayLabels.get(key)}</em>}
                </div>
                <div className="agenda-items">
                  {items.map((entry) =>
                    entry.type === 'event' ? (
                      <button key={`e-${entry.item.key}`} className="agenda-item" style={{ borderLeftColor: entry.item.color }} onClick={() => openEvent(entry.item)}>
                        <span className="agenda-time">{entry.item.allDay ? '全天' : timeText(entry.item.startAt)}</span>
                        <span>{entry.item.title}</span>
                      </button>
                    ) : (
                      <button key={`t-${entry.item.id}`} className={`agenda-item todo${entry.item.doneAt ? ' done' : ''}`} onClick={() => toggleTodo(entry.item)}>
                        <span className="agenda-time">{entry.item.allDay ? '截止' : `截止 ${timeText(entry.item.dueAt)}`}</span>
                        <span>{entry.item.title}</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {dayPanel && (
        <DayPanel
          date={dayPanel}
          items={itemsByDay.get(dayPanel) || []}
          label={dayLabels.get(dayPanel)}
          onClose={() => setDayPanel(null)}
          onNew={(date) => setEditing({ mode: 'new', date, event: null })}
          onOpenEvent={openEvent}
          onToggleTodo={toggleTodo}
          onOpenTodo={onOpenTodo}
        />
      )}

      {editing && (
        <EventDrawer
          mode={editing.mode}
          date={editing.date}
          event={editing.event}
          onClose={() => setEditing(null)}
          onChanged={async () => {
            await load();
            onToast && onToast('日程已更新');
          }}
        />
      )}
    </div>
  );
}

/* ---------------- 某一天的面板 ---------------- */
function DayPanel({ date, items, label, onClose, onNew, onOpenEvent, onToggleTodo, onOpenTodo }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <strong>{dateCN(date)}</strong>
            <span className="muted" style={{ marginLeft: 8 }}>{weekday(date)}</span>
            {label && <span className="day-chip">{label}</span>}
          </div>
          <div className="drawer-head-actions">
            <button className="primary-btn small" onClick={() => onNew(date)}>
              <Icon name="plus" size={14} /> 加一件事
            </button>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </header>
        <div className="drawer-body">
          {items.length === 0 && (
            <div className="empty small">
              <Icon name="sparkles" size={22} />
              <p>这一天还空着</p>
            </div>
          )}
          {items.map((entry) =>
            entry.type === 'event' ? (
              <button key={`e-${entry.item.key}`} className="day-item" style={{ borderLeftColor: entry.item.color }} onClick={() => onOpenEvent(entry.item)}>
                <span className="day-item-time">{entry.item.allDay ? '全天' : timeText(entry.item.startAt)}</span>
                <span className="day-item-title">{entry.item.title}</span>
                {entry.item.repeatFreq && <Icon name="repeat" size={12} />}
              </button>
            ) : (
              <div key={`t-${entry.item.id}`} className={`day-item todo${entry.item.doneAt ? ' done' : ''}`}>
                <button className="check small" onClick={() => onToggleTodo(entry.item)}>
                  <Icon name="check" size={11} strokeWidth={2.6} />
                </button>
                <span className="day-item-title" onClick={() => onOpenTodo && onOpenTodo(entry.item)}>{entry.item.title}</span>
                <span className="chip quiet">待办</span>
              </div>
            )
          )}
        </div>
      </aside>
    </>
  );
}

/* ---------------- 事件编辑抽屉 ---------------- */
function EventDrawer({ mode, date, event, onClose, onChanged }) {
  const [draft, setDraft] = useState(() => ({
    title: event ? event.title : '',
    note: event ? event.note : '',
    date: event ? String(event.startAt).slice(0, 10) : date,
    start: event && timeText(event.startAt) ? timeText(event.startAt) : '09:00',
    end: event && event.endAt ? timeText(event.endAt) : '10:00',
    allDay: event ? event.allDay : false,
    repeatFreq: event ? event.repeatFreq || '' : '',
    repeatInterval: event ? event.repeatInterval || 1 : 1,
    remindBefore: event ? event.remindBefore : 15,
    color: event ? event.color : EVENT_COLORS[0],
  }));
  const [saved, setSaved] = useState(false);

  const payload = () => {
    const startAt = draft.allDay ? draft.date : `${draft.date}T${draft.start}`;
    const endAt = draft.allDay ? null : `${draft.date}T${draft.end}`;
    return {
      title: draft.title.trim() || '新日程',
      note: draft.note,
      startAt,
      endAt,
      allDay: draft.allDay,
      repeatFreq: draft.repeatFreq || null,
      repeatInterval: Number(draft.repeatInterval) || 1,
      remindBefore: Number(draft.remindBefore) || 0,
      color: draft.color,
    };
  };

  const save = async () => {
    if (!draft.title.trim()) return;
    if (mode === 'new') {
      await api.createEvent(payload());
    } else {
      await api.updateEvent(event.id, payload());
    }
    await onChanged();
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <span className="save-state">Ctrl+Enter 保存</span>
          <div className="drawer-head-actions">
            {mode === 'edit' && (
              <button
                className="ghost-btn danger"
                onClick={async () => {
                  await api.removeEvent(event.id);
                  await onChanged();
                  onClose();
                }}
              >
                <Icon name="trash" size={15} /> 删除
              </button>
            )}
            <button className="icon-btn" onClick={onClose}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </header>

        <div className="drawer-body">
          <input
            className="title-field"
            value={draft.title}
            placeholder="安排点什么"
            autoFocus
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
          />

          <div className="field-row">
            <label className="field">
              <span>日期</span>
              <input type="date" value={draft.date} onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))} />
            </label>
            <label className="field">
              <span>提醒</span>
              <select value={draft.remindBefore} onChange={(e) => setDraft((p) => ({ ...p, remindBefore: Number(e.target.value) }))}>
                {REMIND_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="field">
            <span>时间</span>
            <div className="due-row">
              <input
                type="time"
                value={draft.start}
                disabled={draft.allDay}
                onChange={(e) => setDraft((p) => ({ ...p, start: e.target.value }))}
              />
              <span className="dash">–</span>
              <input
                type="time"
                value={draft.end}
                disabled={draft.allDay}
                onChange={(e) => setDraft((p) => ({ ...p, end: e.target.value }))}
              />
              <button className={`toggle${draft.allDay ? ' on' : ''}`} onClick={() => setDraft((p) => ({ ...p, allDay: !p.allDay }))}>
                <Icon name="clock" size={14} /> 全天
              </button>
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span>重复</span>
              <select value={draft.repeatFreq} onChange={(e) => setDraft((p) => ({ ...p, repeatFreq: e.target.value }))}>
                {REPEAT.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            {draft.repeatFreq && (
              <label className="field narrow">
                <span>间隔</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={draft.repeatInterval}
                  onChange={(e) => setDraft((p) => ({ ...p, repeatInterval: Number(e.target.value) || 1 }))}
                />
              </label>
            )}
          </div>

          <div className="field">
            <span>颜色</span>
            <div className="color-row">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  className={`swatch-btn${draft.color === c ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setDraft((p) => ({ ...p, color: c }))}
                />
              ))}
            </div>
          </div>

          <label className="field">
            <span>备注</span>
            <textarea
              className="note-field"
              rows={4}
              value={draft.note}
              placeholder="地点、要带的东西、想说的话…"
              onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
            />
          </label>

          <button className="primary-btn wide" onClick={save}>
            {mode === 'new' ? '创建日程' : '保存修改'}
          </button>
        </div>
      </aside>
    </>
  );
}
