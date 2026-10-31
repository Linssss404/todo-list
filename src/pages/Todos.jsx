import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import DayTitle from '../components/DayTitle.jsx';
import TodoRow from '../components/TodoRow.jsx';
import TodoDrawer from '../components/TodoDrawer.jsx';
import { api } from '../api.js';
import { dateCN, todayStr, weekday } from '../lib/dates.js';

const VIEWS = [
  { id: 'all', label: '全部', icon: 'inbox' },
  { id: 'today', label: '今天', icon: 'clock' },
  { id: 'upcoming', label: '即将', icon: 'calendar' },
  { id: 'done', label: '已完成', icon: 'check' },
];

const PALETTE = ['#7C5CFF', '#4C9AFF', '#3FBF9F', '#F0A44B', '#F0748C', '#9B7BF5'];

export default function Todos({ lists, refreshLists, dayLabel, onDayLabel, onChanged, focusTodoId, onFocusConsumed }) {
  const [scope, setScope] = useState({ kind: 'all' });
  const [rows, setRows] = useState([]);
  const [openRows, setOpenRows] = useState([]);
  const [doneRows, setDoneRows] = useState([]);
  const [draft, setDraft] = useState('');
  const [drawerId, setDrawerId] = useState(null);
  const [editingList, setEditingList] = useState(null);
  const [listName, setListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dragId, setDragId] = useState(null);
  const quickRef = useRef(null);
  const creatingRef = useRef(false); // 回车创建后紧接着的 blur 不再重复创建
  const justDragged = useRef(false); // 拖完不要顺手把抽屉打开
  const today = todayStr();

  const load = useCallback(async () => {
    const query = scope.kind === 'list' ? { listId: scope.id, view: 'all' } : { view: scope.kind };
    const [current, open, done] = await Promise.all([
      api.todos(query),
      api.todos({ view: 'all' }),
      api.todos({ view: 'done' }),
    ]);
    setRows(current);
    setOpenRows(open);
    setDoneRows(done);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (focusTodoId) {
      setDrawerId(focusTodoId);
      onFocusConsumed && onFocusConsumed();
    }
  }, [focusTodoId, onFocusConsumed]);

  const after = async () => {
    await load();
    onChanged && onChanged();
  };

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    const payload = { title };
    if (scope.kind === 'list') payload.listId = scope.id;
    if (scope.kind === 'today') {
      payload.dueAt = today;
      payload.allDay = true;
    }
    await api.createTodo(payload);
    setDraft('');
    await after();
    quickRef.current && quickRef.current.focus();
  };

  const toggle = async (todo) => {
    await api.toggleTodo(todo.id, !todo.doneAt);
    await after();
  };

  const createList = async () => {
    const name = newListName.trim();
    if (!name || creatingRef.current) return;
    creatingRef.current = true;
    const color = PALETTE[lists.length % PALETTE.length];
    const created = await api.createList(name, color);
    setNewListName('');
    setCreatingList(false);
    await refreshLists();
    if (created) setScope({ kind: 'list', id: created.id });
    creatingRef.current = false;
  };

  const renameList = async (id) => {
    const name = listName.trim();
    if (name) await api.updateList(id, { name });
    setEditingList(null);
    await refreshLists();
  };

  const deleteList = async (id) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    await api.removeList(id);
    setConfirmDelete(null);
    await refreshLists();
    setScope({ kind: 'all' });
  };

  const onDragEnter = (targetId) => {
    if (!dragId || dragId === targetId) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.id === dragId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const onDragEnd = async () => {
    setDragId(null);
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 220);
    if (scope.kind === 'done') return;
    await api.reorderTodos(rows.map((r) => r.id));
    await after();
  };

  const openDrawer = (todo) => {
    if (justDragged.current) return;
    setDrawerId(todo.id);
  };

  const title = scope.kind === 'list' ? (lists.find((l) => l.id === scope.id) || {}).name || '清单' : VIEWS.find((v) => v.id === scope.kind).label;
  const countFor = (view) => {
    if (view === 'done') return doneRows.length;
    if (view === 'today') {
      return openRows.filter((r) => r.dueAt && r.dueAt.slice(0, 10) <= today).length;
    }
    if (view === 'upcoming') return openRows.filter((r) => r.dueAt && r.dueAt.slice(0, 10) > today).length;
    return openRows.length;
  };
  const listCount = (id) => openRows.filter((r) => r.listId === id).length;

  return (
    <div className="page todos-page">
      <aside className="rail card">
        <div className="rail-group">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`rail-item${scope.kind === v.id ? ' active' : ''}`}
              onClick={() => setScope({ kind: v.id })}
            >
              <Icon name={v.icon} size={16} />
              <span>{v.label}</span>
              <em>{countFor(v.id)}</em>
            </button>
          ))}
        </div>

        <div className="rail-group">
          <div className="rail-label">
            <span>清单</span>
            <button className="mini-btn" title="新建清单" onClick={() => setCreatingList(true)}>
              <Icon name="plus" size={14} />
            </button>
          </div>

          {lists.map((list) => (
            <div
              key={list.id}
              className={`rail-item list${scope.kind === 'list' && scope.id === list.id ? ' active' : ''}`}
              onClick={() => setScope({ kind: 'list', id: list.id })}
              onDoubleClick={() => {
                setEditingList(list.id);
                setListName(list.name);
              }}
            >
              <span className="dot" style={{ background: list.color }} />
              {editingList === list.id ? (
                <input
                  className="rail-input"
                  autoFocus
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => renameList(list.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameList(list.id);
                    if (e.key === 'Escape') setEditingList(null);
                  }}
                />
              ) : (
                <span className="rail-name">{list.name}</span>
              )}
              <em>{listCount(list.id)}</em>
              <button
                className={`mini-btn del${confirmDelete === list.id ? ' armed' : ''}`}
                title={confirmDelete === list.id ? '再点一次删除' : '删除清单'}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteList(list.id);
                }}
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}

          {creatingList && (
            <div className="rail-create">
              <input
                autoFocus
                className="rail-input"
                value={newListName}
                placeholder="清单名字"
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createList();
                  if (e.key === 'Escape') setCreatingList(false);
                }}
                onBlur={() => newListName.trim() && createList()}
              />
            </div>
          )}
        </div>

        <div className="rail-foot">
          <Icon name="sparkles" size={14} />
          <span>每天可以有个名字</span>
        </div>
      </aside>

      <section className="card panel main-panel">
        <header className="panel-head">
          <div>
            <h2>{title}</h2>
            <p className="muted">
              {rows.length} 项 · {dateCN(today)} {weekday(today)}
              {dayLabel ? ` · ${dayLabel}` : ''}
            </p>
          </div>
          <div className="head-right">
            <div className="seg">
              {['all', 'today', 'upcoming', 'done'].map((v) => (
                <button
                  key={v}
                  className={`seg-item${scope.kind === v ? ' active' : ''}`}
                  onClick={() => setScope({ kind: v })}
                >
                  {VIEWS.find((x) => x.id === v).label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {scope.kind !== 'done' && (
          <div className="quickadd">
            <Icon name="plus" size={18} />
            <input
              ref={quickRef}
              value={draft}
              placeholder={scope.kind === 'list' ? `添加到「${title}」` : '写下一件事，回车添加'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
                if (e.key === 'Escape') setDraft('');
              }}
            />
            <kbd>Enter</kbd>
          </div>
        )}

        <div className="todo-list">
          {rows.length === 0 && (
            <div className="empty">
              <Icon name={scope.kind === 'done' ? 'check' : 'sparkles'} size={26} />
              <p>{scope.kind === 'done' ? '还没有完成的事，慢慢来' : '这里空着，正好可以放下第一件事'}</p>
            </div>
          )}

          {rows.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              draggable={scope.kind !== 'done'}
              onDragStart={() => setDragId(todo.id)}
              onDragEnter={() => onDragEnter(todo.id)}
              onDragEnd={onDragEnd}
              onToggle={toggle}
              onOpen={openDrawer}
            />
          ))}
        </div>

        <footer className="panel-foot">
          <DayTitle value={dayLabel} onSave={onDayLabel} size="sm" />
          <span className="muted">{openRows.length} 件未完成 · 已收回 {doneRows.length} 件</span>
        </footer>
      </section>

      {drawerId && (
        <TodoDrawer
          todoId={drawerId}
          lists={lists}
          onClose={() => setDrawerId(null)}
          onChanged={after}
        />
      )}
    </div>
  );
}
