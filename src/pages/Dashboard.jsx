import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import DayTitle from '../components/DayTitle.jsx';
import TodoRow from '../components/TodoRow.jsx';
import { api } from '../api.js';
import { dateCN, dueLabel, greeting, todayStr, weekday } from '../lib/dates.js';
import { yuan, yuanShort } from '../lib/money.js';

export default function Dashboard({ dayLabel, onDayLabel, onOpenTodo, onNavigate, onChanged }) {
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const today = todayStr();

  const load = async () => {
    const [ov, list] = await Promise.all([api.overview(), api.todos({ view: 'today' })]);
    setOverview(ov);
    setRows(list);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    await api.createTodo({ title, dueAt: today, allDay: true });
    setDraft('');
    await load();
    onChanged && onChanged();
    inputRef.current && inputRef.current.focus();
  };

  const toggle = async (todo) => {
    await api.toggleTodo(todo.id, !todo.doneAt);
    await load();
    onChanged && onChanged();
  };

  const counts = (overview && overview.counts) || { openToday: 0, doneToday: 0, overdue: 0, openAll: 0 };
  const money = (overview && overview.money) || { expenseCents: 0, incomeCents: 0, budgetCents: 0, byCategory: [] };
  const upcoming = (overview && overview.upcoming) || [];
  const notes = (overview && overview.notes) || [];
  const budgetPct = money.budgetCents ? Math.min(100, (money.expenseCents / money.budgetCents) * 100) : 0;

  return (
    <div className="page dashboard">
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-head">
          <span className="hero-date">
            {dateCN(today)} · {weekday(today)}
          </span>
          <span className="hero-greet">{greeting()}</span>
        </div>

        <DayTitle value={dayLabel} onSave={onDayLabel} />

        <p className="hero-sub">
          {counts.openToday > 0 ? (
            <>
              今天还有 <b>{counts.openToday}</b> 件事
              {counts.overdue > 0 && <span className="hero-warn"> · 其中 {counts.overdue} 件已经过期</span>}
              {counts.doneToday > 0 && <> · 已完成 {counts.doneToday}</>}
            </>
          ) : (
            <>今天没有到期的事{counts.doneToday > 0 ? ` · 已经完成 ${counts.doneToday} 件` : '，给自己留点空白'}</>
          )}
        </p>

        <div className="hero-add">
          <Icon name="plus" size={18} />
          <input
            ref={inputRef}
            value={draft}
            placeholder="脑子里冒出来的事，回车就记下"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <kbd>Enter</kbd>
        </div>
      </section>

      <div className="grid">
        <section className="card panel today-panel">
          <header className="panel-head">
            <div>
              <h2>今日待办</h2>
              <p className="muted">{rows.length} 件待办 · 点击可编辑</p>
            </div>
            <button className="link-btn" onClick={() => onNavigate('todos')}>
              全部 <Icon name="chevron" size={14} />
            </button>
          </header>

          <div className="today-list">
            {rows.length === 0 && (
              <div className="empty small">
                <Icon name="sparkles" size={22} />
                <p>今天还没有安排，上面输入一句话就能开始</p>
              </div>
            )}
            {rows.slice(0, 6).map((todo) => (
              <TodoRow key={todo.id} todo={todo} compact onToggle={toggle} onOpen={onOpenTodo} />
            ))}
          </div>
        </section>

        <section className="card panel money-card">
          <header className="panel-head">
            <div>
              <h2>本月支出</h2>
              <p className="muted">
                {money.byCategory.length} 个分类 · 今天 ¥{yuan(overview ? overview.todayExpense : 0)}
              </p>
            </div>
            <button className="link-btn" onClick={() => onNavigate('money')}>
              记账 <Icon name="chevron" size={14} />
            </button>
          </header>

          <div className="money-card-body">
            <div className="money-big">
              <strong>¥{yuan(money.expenseCents)}</strong>
              {money.budgetCents > 0 ? (
                <>
                  <div className="budget-bar">
                    <span
                      className={`budget-fill${money.expenseCents > money.budgetCents ? ' over' : ''}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <span className="muted">
                    {money.expenseCents > money.budgetCents
                      ? `已超支 ¥${yuan(money.expenseCents - money.budgetCents)}`
                      : `预算 ¥${yuanShort(money.budgetCents)}，还剩 ¥${yuan(money.budgetCents - money.expenseCents)}`}
                  </span>
                </>
              ) : (
                <span className="muted">还没设预算，去记账页设一个</span>
              )}
            </div>
            <div className="money-cats">
              {money.byCategory.slice(0, 4).map((c) => (
                <div className="money-cat" key={`${c.id}-${c.name}`}>
                  <span className="dot" style={{ background: c.color }} />
                  <span>{c.icon} {c.name}</span>
                  <em>¥{yuanShort(c.totalCents)}</em>
                </div>
              ))}
              {money.byCategory.length === 0 && <span className="muted">这个月还没记账</span>}
            </div>
          </div>
        </section>

        <section className="card panel upcoming-card">
          <header className="panel-head">
            <div>
              <h2>接下来 7 天</h2>
              <p className="muted">日程和待办截止合在一起</p>
            </div>
            <button className="link-btn" onClick={() => onNavigate('calendar')}>
              日历 <Icon name="chevron" size={14} />
            </button>
          </header>

          <div className="upcoming-list">
            {upcoming.length === 0 && (
              <div className="empty small">
                <Icon name="calendar" size={22} />
                <p>这一周还没有安排</p>
              </div>
            )}
            {upcoming.map((item) => {
              const due = dueLabel(item.at, item.allDay);
              return (
                <button
                  key={item.key}
                  className="upcoming-row"
                  onClick={() => (item.type === 'todo' ? onOpenTodo({ id: item.id }) : onNavigate('calendar'))}
                >
                  <span className="upcoming-bar" style={{ background: item.color || 'var(--accent)' }} />
                  <span className="upcoming-title">{item.title}</span>
                  <span className={`chip due ${due ? due.tone : 'later'}`}>
                    {due ? due.text : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card panel notes-card">
          <header className="panel-head">
            <div>
              <h2>最近的灵感</h2>
              <p className="muted">想到就先记下来</p>
            </div>
            <button className="link-btn" onClick={() => onNavigate('notes')}>
              灵感 <Icon name="chevron" size={14} />
            </button>
          </header>

          <div className="notes-mini">
            {notes.length === 0 && (
              <div className="empty small">
                <Icon name="note" size={22} />
                <p>还没有笔记，点进去写一条</p>
              </div>
            )}
            {notes.map((note) => (
              <button key={note.id} className="notes-mini-row" onClick={() => onNavigate('notes')}>
                {note.pinned && <Icon name="flag" size={12} className="pin-mark" />}
                <span className="notes-mini-title">{note.title || '无标题'}</span>
                <span className="notes-mini-excerpt">{note.excerpt}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
