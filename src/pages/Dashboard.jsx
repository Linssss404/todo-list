import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import DayTitle from '../components/DayTitle.jsx';
import TodoRow from '../components/TodoRow.jsx';
import { api } from '../api.js';
import { dateCN, greeting, todayStr, weekday } from '../lib/dates.js';

const PLACEHOLDERS = [
  {
    id: 'money',
    icon: 'wallet',
    title: '本月支出',
    text: '记账模块 · 下一阶段接入',
    detail: '收支、分类、预算进度会在这里汇总成一张小卡。',
  },
  {
    id: 'calendar',
    icon: 'calendar',
    title: '近期日程',
    text: '日程模块 · 下一阶段接入',
    detail: '日程和待办会共用同一份时间，加截止时间就自动出现在日历上。',
  },
  {
    id: 'notes',
    icon: 'sparkles',
    title: '灵感碎片',
    text: '灵感模块 · 下一阶段接入',
    detail: '随手记下的想法会在这里冒出来，随时能转成待办。',
  },
];

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
            {rows.slice(0, 7).map((todo) => (
              <TodoRow key={todo.id} todo={todo} compact onToggle={toggle} onOpen={onOpenTodo} />
            ))}
          </div>
        </section>

        {PLACEHOLDERS.map((card) => (
          <section key={card.id} className="card panel ghost-card">
            <div className="ghost-top">
              <span className="ghost-icon">
                <Icon name={card.icon} size={18} />
              </span>
              <span className="badge">下一阶段</span>
            </div>
            <h2>{card.title}</h2>
            <p className="muted">{card.text}</p>
            <p className="ghost-detail">{card.detail}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
