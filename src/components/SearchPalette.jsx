import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../api.js';
import { dateCN, dueLabel, weekday } from '../lib/dates.js';

/** Ctrl+K：跨模块搜索，一处就够 */
export default function SearchPalette({ onClose, onPickTodo, onPickDay }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState({ todos: [], days: [] });
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setResult({ todos: [], days: [] });
      return;
    }
    timer.current = setTimeout(async () => {
      const data = await api.search(q);
      setResult(data);
      setIndex(0);
    }, 140);
    return () => clearTimeout(timer.current);
  }, [q]);

  const flat = useMemo(() => {
    const rows = [];
    result.todos.forEach((t) => rows.push({ type: 'todo', item: t }));
    result.days.forEach((d) => rows.push({ type: 'day', item: d }));
    return rows;
  }, [result]);

  const pick = (row) => {
    if (!row) return;
    if (row.type === 'todo') onPickTodo(row.item.id);
    else onPickDay(row.item.date);
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
            placeholder="搜待办、日子…"
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
          {!q.trim() && <div className="palette-hint">输入关键词，待办和每天的名字都能搜到</div>}
          {q.trim() && flat.length === 0 && <div className="palette-hint">没有找到「{q}」</div>}

          {flat.map((row, i) => {
            const active = i === index;
            if (row.type === 'todo') {
              const due = dueLabel(row.item.dueAt, row.item.allDay);
              return (
                <button
                  key={`t-${row.item.id}`}
                  className={`palette-row${active ? ' active' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => pick(row)}
                >
                  <span className={`dot ${row.item.doneAt ? 'done' : ''}`} />
                  <span className="palette-title">{row.item.title}</span>
                  {due && <span className={`chip due ${due.tone}`}>{due.text}</span>}
                  <span className="palette-kind">待办</span>
                </button>
              );
            }
            return (
              <button
                key={`d-${row.item.date}`}
                className={`palette-row${active ? ' active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => pick(row)}
              >
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
