import Icon from './Icon.jsx';
import { dueLabel, repeatLabel } from '../lib/dates.js';

const PRIORITY_CLASS = { 1: 'p-low', 2: 'p-mid', 3: 'p-high' };

export default function TodoRow({
  todo,
  onToggle,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnter,
  onDragEnd,
  compact = false,
}) {
  const due = dueLabel(todo.dueAt, todo.allDay);
  const repeat = todo.repeatFreq ? repeatLabel(todo.repeatFreq, todo.repeatInterval) : '';
  const done = !!todo.doneAt;

  return (
    <div
      className={`todo-row${done ? ' is-done' : ''}${compact ? ' compact' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDragEnd={onDragEnd}
      onClick={() => onOpen && onOpen(todo)}
    >
      {draggable && (
        <span className="grip" onClick={(e) => e.stopPropagation()}>
          <Icon name="grip" size={14} />
        </span>
      )}

      <button
        className="check"
        aria-label={done ? '取消完成' : '完成'}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(todo);
        }}
      >
        <Icon name="check" size={13} strokeWidth={2.4} />
      </button>

      <div className="todo-main">
        <div className="todo-title">
          {todo.priority > 0 && <span className={`flag ${PRIORITY_CLASS[todo.priority]}`}>{todo.priority === 3 ? '高' : todo.priority === 2 ? '中' : '低'}</span>}
          <span className="title-text">{todo.title}</span>
        </div>
        <div className="todo-meta">
          {due && <span className={`chip due ${due.tone}`}>{due.text}</span>}
          {repeat && (
            <span className="chip repeat">
              <Icon name="repeat" size={11} />
              {repeat}
            </span>
          )}
          {todo.subTotal > 0 && (
            <span className="chip sub">
              {todo.subDone}/{todo.subTotal}
            </span>
          )}
          {todo.listName && <span className="chip quiet">{todo.listName}</span>}
        </div>
      </div>
    </div>
  );
}
