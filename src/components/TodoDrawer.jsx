import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../api.js';
import { PRIORITY, REPEAT, todayStr, toDateInput, toTimeInput } from '../lib/dates.js';

/** 右侧抽屉：所有编辑都在这里完成，不跳页面 */
export default function TodoDrawer({ todoId, lists, onClose, onChanged }) {
  const [draft, setDraft] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [subInput, setSubInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const [confirming, setConfirming] = useState(false);
  const firstRender = useRef(true);
  const timer = useRef(null);

  const load = async () => {
    const todo = await api.todo(todoId);
    if (!todo) return;
    setDraft({
      id: todo.id,
      title: todo.title,
      note: todo.note || '',
      priority: todo.priority || 0,
      listId: todo.listId,
      dateStr: toDateInput(todo.dueAt),
      timeStr: toTimeInput(todo.dueAt),
      allDay: todo.allDay || !toTimeInput(todo.dueAt),
      repeatFreq: todo.repeatFreq || '',
      repeatInterval: todo.repeatInterval || 1,
      doneAt: todo.doneAt,
    });
    setSubtasks(todo.subtasks || []);
    firstRender.current = true;
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoId]);

  const patch = useMemo(() => {
    if (!draft) return null;
    const dueAt = draft.dateStr
      ? draft.allDay || !draft.timeStr
        ? draft.dateStr
        : `${draft.dateStr}T${draft.timeStr}`
      : null;
    return {
      title: draft.title.trim() || '未命名待办',
      note: draft.note,
      priority: Number(draft.priority),
      listId: draft.listId,
      dueAt,
      allDay: !!(draft.allDay || !draft.timeStr),
      repeatFreq: draft.repeatFreq || null,
      repeatInterval: Number(draft.repeatInterval) || 1,
    };
  }, [draft]);

  useEffect(() => {
    if (!draft || !patch) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await api.updateTodo(draft.id, patch);
      setStatus('saved');
      onChanged && onChanged();
    }, 420);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch]);

  const close = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (draft && patch) await api.updateTodo(draft.id, patch);
    onChanged && onChanged();
    onClose();
  };

  const update = (key, value) => setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  const quickDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDraft((prev) => ({ ...prev, dateStr: str, allDay: prev.allDay }));
  };

  const addSubtask = async () => {
    const title = subInput.trim();
    if (!title) return;
    await api.createTodo({ title, parentId: todoId, listId: draft.listId });
    setSubInput('');
    setSubtasks(await api.todo(todoId).then((t) => t.subtasks || []));
    onChanged && onChanged();
  };

  const toggleSub = async (sub) => {
    await api.toggleTodo(sub.id, !sub.doneAt);
    setSubtasks(await api.todo(todoId).then((t) => t.subtasks || []));
    onChanged && onChanged();
  };

  const removeSub = async (sub) => {
    await api.removeTodo(sub.id);
    setSubtasks(await api.todo(todoId).then((t) => t.subtasks || []));
    onChanged && onChanged();
  };

  const removeTodo = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await api.removeTodo(todoId);
    onChanged && onChanged();
    onClose();
  };

  if (!draft) return <div className="drawer-backdrop" onClick={onClose} />;

  return (
    <>
      <div className="drawer-backdrop" onClick={close} />
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <span className={`save-state ${status}`}>
            {status === 'saving' ? '保存中…' : status === 'saved' ? '已自动保存' : '改动会自动保存'}
          </span>
          <div className="drawer-head-actions">
            <button className={`ghost-btn danger${confirming ? ' armed' : ''}`} onClick={removeTodo}>
              <Icon name="trash" size={15} />
              {confirming ? '再点一次删除' : '删除'}
            </button>
            <button className="icon-btn" onClick={close} title="关闭">
              <Icon name="x" size={18} />
            </button>
          </div>
        </header>

        <div className="drawer-body">
          <textarea
            className="title-field"
            rows={2}
            value={draft.title}
            placeholder="要做什么？"
            onChange={(e) => update('title', e.target.value)}
          />

          <div className="field-row">
            <label className="field">
              <span>清单</span>
              <select value={draft.listId || ''} onChange={(e) => update('listId', Number(e.target.value))}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>优先级</span>
              <div className="seg small">
                {PRIORITY.map((p) => (
                  <button
                    key={p.value}
                    className={`seg-item${Number(draft.priority) === p.value ? ' active' : ''}`}
                    onClick={() => update('priority', p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="field">
            <span>截止时间</span>
            <div className="due-row">
              <input type="date" value={draft.dateStr} onChange={(e) => update('dateStr', e.target.value)} />
              <input
                type="time"
                value={draft.timeStr}
                disabled={draft.allDay || !draft.dateStr}
                onChange={(e) => update('timeStr', e.target.value)}
              />
              <button
                className={`toggle${draft.allDay ? ' on' : ''}`}
                onClick={() => update('allDay', !draft.allDay)}
                title="全天"
              >
                <Icon name="clock" size={14} />
                全天
              </button>
            </div>
            <div className="quick-dates">
              <button onClick={() => quickDate(0)}>今天</button>
              <button onClick={() => quickDate(1)}>明天</button>
              <button onClick={() => quickDate(7)}>一周后</button>
              <button onClick={() => update('dateStr', '')}>清除</button>
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span>重复</span>
              <select value={draft.repeatFreq} onChange={(e) => update('repeatFreq', e.target.value)}>
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
                  onChange={(e) => update('repeatInterval', Number(e.target.value) || 1)}
                />
              </label>
            )}
          </div>

          <div className="field">
            <span>子任务 {subtasks.length > 0 && `· ${subtasks.filter((s) => s.doneAt).length}/${subtasks.length}`}</span>
            <div className="subtasks">
              {subtasks.map((sub) => (
                <div key={sub.id} className={`subtask${sub.doneAt ? ' done' : ''}`}>
                  <button className="check small" onClick={() => toggleSub(sub)}>
                    <Icon name="check" size={11} strokeWidth={2.6} />
                  </button>
                  <span>{sub.title}</span>
                  <button className="mini-x" onClick={() => removeSub(sub)}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
              <div className="subtask-add">
                <Icon name="plus" size={14} />
                <input
                  value={subInput}
                  placeholder="添加一步，回车确认"
                  onChange={(e) => setSubInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addSubtask();
                  }}
                />
              </div>
            </div>
          </div>

          <label className="field">
            <span>备注</span>
            <textarea
              className="note-field"
              rows={5}
              value={draft.note}
              placeholder="补充点细节，想到什么写什么"
              onChange={(e) => update('note', e.target.value)}
            />
          </label>
        </div>
      </aside>
    </>
  );
}
