import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../api.js';
import { dateCN, dueLabel, weekday } from '../lib/dates.js';
import { yuan } from '../lib/money.js';

/** Ctrl+K：四个模块一起搜，一处就够 */
export default function SearchPalette({ onClose, onPickTodo, onPickDay, onPickView }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState({ todos: [], days: [], notes: [], txns: [], events: [] });
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setResult({ todos: [], days: [], notes: [], txns: [], events: [] });
      return;
    }
    timer.current = setTimeout(async () => {
      const data = await api.search(q);
      setResult({
        todos: data.todos || [],
        days: data.days || [],
        notes: data.notes || [],
        txns: data.txns || [],
        events: data.events || [],
      });
      setIndex(0);
    }, 140);
    return () => clearTimeout(timer.current);
  }, [q]);

  const flat = useMemo(() => {
    const rows = [];
    result.todos.forEach((t) => rows.push({ type: 'todo', item: t }));
    result.events.forEach((e) => rows.push({ type: 'event', item: e }));
    result.notes.forEach((n) => rows.push({ type: 'note', item: n }));
    result.txns.forEach((t) => rows.push({ type: 'txn', item: t }));
    result.days.forEach((d) => rows.push({ type: 'day', item: d }));
    return rows;
  }, [result]);

  const pick = (row) => {
    if (!row) return;
    if (row.type === 'todo') onPickTodo(row.item.id);
    else if (row.type === 'day') onPickDay(row.item.date);
    else if (row.type === 'note') onPickView('notes');
    else if (row.type === 'txn') onPickView('money');
    else onPickView('calendar');
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={q}
            placeholder="搜待办、日程、账单、笔记、每天的名字…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, flat.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                pick(flat[index]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="palette-results">
          {!q.trim() && <div className="palette-hint">输入关键词，四个模块一起搜</div>}
          {q.trim() && flat.length === 0 && <div className="palette-hint">没有找到「{q}」</div>}

          {flat.map((row, i) => {
            const active = i === index;
            const cls = `palette-row${active ? ' active' : ''}`;
            if (row.type === 'todo') {
              const due = dueLabel(row.item.dueAt, row.item.allDay);
              return (
                <button key={`t-${row.item.id}`} className={cls} onMouseEnter={() => setIndex(i)} onClick={() => pick(row)}>
                  <span className={`dot ${row.item.doneAt ? 'done' : ''}`} />
                  <span className="palette-title">{row.item.title}</span>
                  {due && <span className={`chip due ${due.tone}`}>{due.text}</span>}
                  <span className="palette-kind">待办</span>
                </button>
              );
            }
            if (row.type === 'event') {
              return (
                <button key={`e-${row.item.id}`} className={cls} onMouseEnter={() => setIndex(i)} onClick={() => pick(row)}>
                  <span className="dot" style={{ background: 'var(--accent-2)' }} />
                  <span className="palette-title">{row.item.title}</span>
                  <span className="palette-kind">{dateCN(row.item.startAt)}</span>
                </button>
              );
            }
            if (row.type === 'note') {
              return (
                <button key={`n-${row.item.id}`} className={cls} onMouseEnter={() => setIndex(i)} onClick={() => pick(row)}>
                  <span className="dot day" />
                  <span className="palette-title">{row.item.title || '无标题'}</span>
                  <span className="palette-kind">灵感</span>
                </button>
              );
            }
            if (row.type === 'txn') {
              return (
                <button key={`x-${row.item.id}`} className={cls} onMouseEnter={() => setIndex(i)} onClick={() => pick(row)}>
                  <span className="dot" style={{ background: '#F0A44B' }} />
                  <span className="palette-title">
                    {row.item.kind === 'income' ? '+' : '-'}¥{yuan(row.item.amount_cents)} {row.item.note || row.item.merchant || row.item.category}
                  </span>
                  <span className="palette-kind">{row.item.occurred_on.slice(5)}</span>
                </button>
              );
            }
            return (
              <button key={`d-${row.item.date}`} className={cls} onMouseEnter={() => setIndex(i)} onClick={() => pick(row)}>
                <span className="dot day" />
                <span className="palette-title">{row.item.label}</span>
                <span className="palette-kind">
                  {dateCN(row.item.date)} {weekday(row.item.date)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
